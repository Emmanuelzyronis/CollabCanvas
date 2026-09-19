import type { DesignGraph } from '../domain/contracts.js'
import { DomainError } from '../domain/errors.js'
import type { DesignVersion } from '../domain/version-types.js'
import type { CanvasGraphApplication } from './canvas-graph-service.js'
import type { VersioningApplicationService } from './version-service.js'

export type EditorHistoryOperation = 'undo' | 'redo'

/**
 * A canonical mutation record. It carries the graph state on both sides of a
 * committed editor command, which is enough information to produce an exact
 * inverse without re-deriving command-specific semantics.
 */
export interface EditorHistoryRecord {
  readonly command: string
  readonly nodeId: string | null
  readonly before: DesignGraph
  readonly after: DesignGraph
}

export interface EditorHistoryRecorder {
  record(documentId: string, entry: EditorHistoryRecord): void
}

export interface EditorHistoryState {
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export interface EditorHistoryResult {
  readonly graph: DesignGraph
  readonly nodeId: string | null
  readonly version: {
    readonly baseVersionId: string | null
    readonly currentVersionId: string | null
    readonly revision: number | null
    readonly status: DesignVersion['status'] | null
  }
  readonly validation: { readonly valid: true }
  readonly changed: boolean
  readonly history: EditorHistoryState
}

interface DocumentHistory {
  past: EditorHistoryRecord[]
  future: EditorHistoryRecord[]
}

/** In-memory, per-document undo/redo stack of canonical mutation records. */
export class DesignGraphHistory {
  private readonly documents = new Map<string, DocumentHistory>()
  private readonly limit: number

  constructor(limit = 100) {
    this.limit = limit
  }

  record(documentId: string, entry: EditorHistoryRecord): void {
    const history = this.documents.get(documentId) ?? { past: [], future: [] }
    history.past.push(entry)
    if (history.past.length > this.limit) history.past.splice(0, history.past.length - this.limit)
    history.future = []
    this.documents.set(documentId, history)
  }

  peek(documentId: string, operation: EditorHistoryOperation): EditorHistoryRecord | null {
    const history = this.documents.get(documentId)
    if (!history) return null
    const stack = operation === 'undo' ? history.past : history.future
    return stack.length > 0 ? stack[stack.length - 1] : null
  }

  commit(documentId: string, operation: EditorHistoryOperation): void {
    const history = this.documents.get(documentId)
    if (!history) return
    if (operation === 'undo') {
      const entry = history.past.pop()
      if (entry) history.future.push(entry)
    } else {
      const entry = history.future.pop()
      if (entry) history.past.push(entry)
    }
    this.documents.set(documentId, history)
  }

  state(documentId: string): EditorHistoryState {
    const history = this.documents.get(documentId)
    return { canUndo: Boolean(history && history.past.length > 0), canRedo: Boolean(history && history.future.length > 0) }
  }

  clear(documentId: string): void {
    this.documents.delete(documentId)
  }
}

/**
 * Undo/redo application boundary. Restores a previously observed canonical
 * graph through the same validated write path as every other mutation, so the
 * resulting state persists and reprojects exactly like a normal command.
 */
export class EditorHistoryApplicationService implements EditorHistoryRecorder {
  constructor(
    private readonly graphs: CanvasGraphApplication,
    private readonly versioning: VersioningApplicationService,
    private readonly history: DesignGraphHistory = new DesignGraphHistory(),
  ) {}

  record(documentId: string, entry: EditorHistoryRecord): void {
    this.history.record(documentId, entry)
  }

  state(documentId: string): EditorHistoryState {
    return this.history.state(documentId)
  }

  async run(documentId: string, operation: EditorHistoryOperation, baseVersionId?: string): Promise<EditorHistoryResult> {
    if (typeof documentId !== 'string' || documentId.trim().length === 0) throw new DomainError('VALIDATION_ERROR', 'documentId is required.')
    if (operation !== 'undo' && operation !== 'redo') throw new DomainError('VALIDATION_ERROR', 'operation must be "undo" or "redo".')

    const head = await this.versioning.getHeadVersion(documentId)
    if (baseVersionId !== undefined) {
      if (typeof baseVersionId !== 'string' || baseVersionId.trim().length === 0) throw new DomainError('VALIDATION_ERROR', 'baseVersionId must be a non-empty string.')
      if (!head) throw new DomainError('VERSION_CONFLICT', 'This document has no version to base the mutation on.')
      if (head.id !== baseVersionId) throw new DomainError('VERSION_CONFLICT', 'The mutation base version is stale; refresh the design and retry.')
    }

    const version = head ? { id: head.id, number: head.number, status: head.status } : null
    const summary = {
      baseVersionId: baseVersionId ?? null,
      currentVersionId: version?.id ?? null,
      revision: version?.number ?? null,
      status: version?.status ?? null,
    }

    const entry = this.history.peek(documentId, operation)
    if (!entry) {
      const graph = await this.graphs.getDocumentGraph(documentId)
      return { graph, nodeId: null, version: summary, validation: { valid: true }, changed: false, history: this.history.state(documentId) }
    }

    const target = operation === 'undo' ? entry.before : entry.after
    const graph = await this.graphs.restoreDesignGraph(documentId, target)
    this.history.commit(documentId, operation)
    return { graph, nodeId: entry.nodeId, version: summary, validation: { valid: true }, changed: true, history: this.history.state(documentId) }
  }
}
