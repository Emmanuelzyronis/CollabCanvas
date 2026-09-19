import type { CreateNodeInput, DesignGraph, DesignNode } from '../domain/contracts.js'
import type { JsonObject } from '../domain/graph-types.js'
import { DomainError } from '../domain/errors.js'
import { GraphValidationError } from '../domain/graph-validation.js'
import type { DesignVersion } from '../domain/version-types.js'
import type { CanvasGraphApplication } from './canvas-graph-service.js'
import type { EditorHistoryRecorder } from './editor-history-service.js'
import type { VersioningApplicationService } from './version-service.js'
import { serializeDesignGraph } from '../domain/serialization.js'

export const EDITOR_COMMANDS = ['create', 'update', 'move', 'resize', 'delete', 'reorder', 'duplicate'] as const
export type EditorCommandName = (typeof EDITOR_COMMANDS)[number]

export interface EditorCommandResult {
  readonly graph: DesignGraph
  readonly nodeId: string | null
  readonly version: {
    readonly baseVersionId: string | null
    readonly currentVersionId: string | null
    readonly revision: number | null
    readonly status: DesignVersion['status'] | null
  }
  readonly validation: { readonly valid: true }
}

/**
 * The single canonical mutation path for human editor operations. Every
 * editor mutation names the version it is based on; a stale base version is a
 * conflict rather than a silent overwrite.
 */
export class EditorCommandApplicationService {
  constructor(
    private readonly graphs: CanvasGraphApplication,
    private readonly versioning: VersioningApplicationService,
    private readonly recorder?: EditorHistoryRecorder,
  ) {}

  async execute(documentId: string, command: string, payload: Record<string, unknown>, baseVersionId?: string): Promise<EditorCommandResult> {
    if (typeof documentId !== 'string' || documentId.trim().length === 0) throw new DomainError('VALIDATION_ERROR', 'documentId is required.')
    if (!EDITOR_COMMANDS.includes(command as EditorCommandName)) throw new DomainError('VALIDATION_ERROR', `command must be one of: ${EDITOR_COMMANDS.join(', ')}.`)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new DomainError('VALIDATION_ERROR', 'payload must be an object.')

    const head = await this.versioning.getHeadVersion(documentId)
    if (baseVersionId !== undefined) {
      if (typeof baseVersionId !== 'string' || baseVersionId.trim().length === 0) throw new DomainError('VALIDATION_ERROR', 'baseVersionId must be a non-empty string.')
      if (!head) throw new DomainError('VERSION_CONFLICT', 'This document has no version to base the mutation on.')
      if (head.id !== baseVersionId) throw new DomainError('VERSION_CONFLICT', 'The mutation base version is stale; refresh the design and retry.')
    }

    const before = this.recorder ? await this.graphs.getDocumentGraph(documentId) : null
    const result = await this.run(command as EditorCommandName, documentId, payload)
    if (this.recorder && before && contentSignature(before) !== contentSignature(result.graph)) {
      this.recorder.record(documentId, { command, nodeId: result.nodeId ?? null, before, after: result.graph })
    }
    const version = head ? { id: head.id, number: head.number, status: head.status } : null
    return {
      graph: result.graph,
      nodeId: result.nodeId ?? null,
      version: {
        baseVersionId: baseVersionId ?? null,
        currentVersionId: version?.id ?? null,
        revision: version?.number ?? null,
        status: version?.status ?? null,
      },
      validation: { valid: true },
    }
  }

  private async run(command: EditorCommandName, documentId: string, payload: Record<string, unknown>): Promise<{ graph: DesignGraph; nodeId?: string }> {
    try {
      switch (command) {
        case 'create': {
          const { type, name } = payload
          if (typeof type !== 'string' || typeof name !== 'string') throw new DomainError('VALIDATION_ERROR', 'create requires type and name.')
          const input = {
            type: type as CreateNodeInput['type'],
            name,
            parentId: optionalString(payload.parentId),
            orderIndex: optionalInteger(payload.orderIndex),
            ...(payload.semantic !== undefined ? { semantic: optionalObject(payload.semantic, 'semantic') } : {}),
            ...(payload.properties !== undefined ? { properties: optionalObject(payload.properties, 'properties') } : {}),
            ...(payload.layout !== undefined ? { layout: optionalObject(payload.layout, 'layout') } : {}),
            ...(payload.assetRef !== undefined ? { assetRef: optionalObject(payload.assetRef, 'assetRef') as CreateNodeInput['assetRef'] } : {}),
          } as CreateNodeInput
          const before = await this.graphs.getDocumentGraph(documentId)
          const graph = await this.graphs.createNode(documentId, input)
          const previousIds = new Set(before.nodes.map((node) => node.id))
          return { graph, nodeId: graph.nodes.find((node) => !previousIds.has(node.id))?.id }
        }
        case 'update': {
          const nodeId = requiredId(payload.nodeId, 'nodeId')
          const patch = payload.patch
          if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new DomainError('VALIDATION_ERROR', 'update requires a patch object.')
          return { graph: await this.graphs.updateNode(documentId, nodeId, patch as Partial<Omit<DesignNode, 'id' | 'pageId'>>) }
        }
        case 'move': {
          const nodeId = requiredId(payload.nodeId, 'nodeId')
          const parentId = payload.parentId === null || payload.parentId === undefined ? null : requiredId(payload.parentId, 'parentId')
          return { graph: await this.graphs.moveNode(documentId, nodeId, parentId, optionalInteger(payload.orderIndex)) }
        }
        case 'resize': {
          const nodeId = requiredId(payload.nodeId, 'nodeId')
          const width = requiredNumber(payload.width, 'width')
          const height = requiredNumber(payload.height, 'height')
          const x = payload.x === undefined ? undefined : requiredNumber(payload.x, 'x')
          const y = payload.y === undefined ? undefined : requiredNumber(payload.y, 'y')
          return { graph: await this.graphs.resizeNode(documentId, nodeId, width, height, x, y) }
        }
        case 'delete': {
          const nodeId = requiredId(payload.nodeId, 'nodeId')
          return { graph: await this.graphs.deleteNode(documentId, nodeId), nodeId }
        }
        case 'reorder': {
          const nodeId = requiredId(payload.nodeId, 'nodeId')
          const orderIndex = requiredInteger(payload.orderIndex, 'orderIndex')
          const graph = await this.graphs.moveNode(documentId, nodeId, null, orderIndex)
          return { graph }
        }
        case 'duplicate': {
          const before = await this.graphs.getDocumentGraph(documentId)
          const graph = await this.graphs.duplicateNode(documentId, requiredId(payload.nodeId, 'nodeId'))
          const previousIds = new Set(before.nodes.map((node) => node.id))
          return { graph, nodeId: graph.nodes.find((node) => !previousIds.has(node.id))?.id }
        }
      }
    } catch (error) {
      if (error instanceof GraphValidationError) {
        throw new DomainError('VALIDATION_ERROR', error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '), { issues: error.issues })
      }
      throw error
    }
  }
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value === null ? null : undefined
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_ERROR', 'Expected a non-empty string.')
  return value.trim()
}

function optionalInteger(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isInteger(value)) throw new DomainError('VALIDATION_ERROR', 'Expected an integer.')
  return value as number
}

function requiredInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value)) throw new DomainError('VALIDATION_ERROR', `${field} must be an integer.`)
  return value as number
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new DomainError('VALIDATION_ERROR', `${field} must be a finite number.`)
  return value
}

function requiredId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_ERROR', `${field} must be a non-empty string.`)
  return value.trim()
}

function optionalObject(value: unknown, field: string): JsonObject | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_ERROR', `${field} must be a JSON object.`)
  return value as unknown as JsonObject
}

/**
 * Semantic content of a graph, ignoring the volatile `updatedAt` stamp that a
 * no-op update still touches. Used to avoid recording undo entries that would
 * not change what the user sees.
 */
function contentSignature(graph: DesignGraph): string {
  return serializeDesignGraph({ ...graph, nodes: graph.nodes.map((node) => ({ ...node, updatedAt: '' })) })
}
