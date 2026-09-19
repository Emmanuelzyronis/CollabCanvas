import type { AssetReference, JsonObject, LayoutConstraints, NodeSemantic, NodeType } from './contracts.js'

export const WORKSPACE_PRESETS = ['blank', 'website', 'flyer', 'logo'] as const
export type WorkspacePreset = (typeof WORKSPACE_PRESETS)[number]

export function isWorkspacePreset(value: string): value is WorkspacePreset {
  return (WORKSPACE_PRESETS as readonly string[]).includes(value)
}

/**
 * A preset node before it receives identity from the workspace bootstrap.
 * Blueprints carry presentation only; ids, page scope, timestamps and sibling
 * order are assigned when the node enters the canonical graph.
 */
export interface PresetNodeBlueprint {
  readonly type: NodeType
  readonly name: string
  readonly layout: LayoutConstraints
  readonly properties: JsonObject
  readonly semantic: NodeSemantic
  readonly assetRef?: AssetReference
}

export interface WorkspacePresetTemplate {
  readonly nodes: readonly PresetNodeBlueprint[]
  readonly assets: readonly AssetReference[]
}

/**
 * Bundled artwork keeps a preset self-contained: no network fetch, no client
 * asset store, and a deterministic graph for the same preset.
 */
const STARTER_ARTWORK_ID = 'asset_preset_starter_artwork'
const STARTER_ARTWORK_SOURCE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%230f766e'/%3E%3Cstop offset='1' stop-color='%231e3a8a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='800' fill='url(%23g)'/%3E%3Ccircle cx='930' cy='210' r='150' fill='%23fef3c7' opacity='0.85'/%3E%3Cpath d='M0 620 260 380 470 600 700 320 1200 660V800H0Z' fill='%230f172a' opacity='0.65'/%3E%3C/svg%3E"

const STARTER_ARTWORK: AssetReference = {
  id: STARTER_ARTWORK_ID,
  kind: 'image',
  name: 'Starter artwork',
  source: STARTER_ARTWORK_SOURCE,
  altText: 'Abstract teal and navy gradient artwork with a pale sun and dark hills',
  width: 1200,
  height: 800,
}

const WEBSITE: WorkspacePresetTemplate = {
  assets: [STARTER_ARTWORK],
  nodes: [
    {
      type: 'section',
      name: 'Hero',
      layout: { x: 0, y: 0, width: 1440, height: 620, position: 'absolute' },
      properties: { text: '', style: { fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, borderRadius: 0, opacity: 1 } },
      semantic: { role: 'banner', label: 'Hero' },
    },
    {
      type: 'heading',
      name: 'Headline',
      layout: { x: 120, y: 140, width: 720, height: 150, position: 'absolute' },
      properties: { text: 'Design at the speed of thought', fontSize: 56, fontWeight: 800, textAlign: 'left', style: { textColor: '#0f172a', lineHeight: 1.1 } },
      semantic: { role: 'heading', level: 1 },
    },
    {
      type: 'text',
      name: 'Subhead',
      layout: { x: 120, y: 320, width: 560, height: 96, position: 'absolute' },
      properties: { text: 'A modern starting point for your next product page — edit anything you see here.', fontSize: 20, fontWeight: 400, textAlign: 'left', style: { textColor: '#475569', lineHeight: 1.5 } },
      semantic: { role: 'textbox' },
    },
    {
      type: 'button',
      name: 'Get started',
      layout: { x: 120, y: 450, width: 220, height: 60, position: 'absolute' },
      properties: { text: 'Get started', fontSize: 18, fontWeight: 600, style: { fill: '#2563eb', stroke: '#2563eb', strokeWidth: 0, borderRadius: 12, opacity: 1, textColor: '#ffffff' } },
      semantic: { role: 'button' },
    },
    {
      type: 'image',
      name: 'Hero image',
      layout: { x: 880, y: 140, width: 440, height: 340, position: 'absolute' },
      properties: { style: { fill: '#e2e8f0', stroke: '#cbd5e1', strokeWidth: 1, borderRadius: 20, opacity: 1 } },
      semantic: { role: 'img' },
      assetRef: STARTER_ARTWORK,
    },
    {
      type: 'card',
      name: 'Feature card',
      layout: { x: 120, y: 700, width: 380, height: 220, position: 'absolute' },
      properties: { text: '', style: { fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1, borderRadius: 16, opacity: 1 } },
      semantic: { role: 'region', label: 'Feature' },
    },
    {
      type: 'heading',
      name: 'Feature title',
      layout: { x: 156, y: 744, width: 300, height: 40, position: 'absolute' },
      properties: { text: 'Built for real work', fontSize: 24, fontWeight: 700, textAlign: 'left', style: { textColor: '#0f172a', lineHeight: 1.2 } },
      semantic: { role: 'heading', level: 3 },
    },
    {
      type: 'text',
      name: 'Feature copy',
      layout: { x: 156, y: 792, width: 310, height: 96, position: 'absolute' },
      properties: { text: 'Edit visually, keep your layout tidy, and take the design wherever it needs to go.', fontSize: 16, fontWeight: 400, textAlign: 'left', style: { textColor: '#64748b', lineHeight: 1.5 } },
      semantic: { role: 'textbox' },
    },
  ],
}

const FLYER: WorkspacePresetTemplate = {
  assets: [STARTER_ARTWORK],
  nodes: [
    {
      type: 'section',
      name: 'Flyer background',
      layout: { x: 0, y: 0, width: 794, height: 1123, position: 'absolute' },
      properties: { text: '', style: { fill: '#0f172a', stroke: '#0f172a', strokeWidth: 0, borderRadius: 32, opacity: 1 } },
      semantic: { role: 'banner', label: 'Flyer' },
    },
    {
      type: 'heading',
      name: 'Event title',
      layout: { x: 72, y: 110, width: 650, height: 160, position: 'absolute' },
      properties: { text: 'HARBOUR COFFEE NIGHT MARKET', fontSize: 58, fontWeight: 800, textAlign: 'left', style: { textColor: '#fef3c7', lineHeight: 1.05 } },
      semantic: { role: 'heading', level: 1 },
    },
    {
      type: 'image',
      name: 'Event photo',
      layout: { x: 72, y: 330, width: 650, height: 300, position: 'absolute' },
      properties: { style: { fill: '#1e293b', stroke: '#1e293b', strokeWidth: 0, borderRadius: 20, opacity: 1 } },
      semantic: { role: 'img' },
      assetRef: STARTER_ARTWORK,
    },
    {
      type: 'text',
      name: 'Details',
      layout: { x: 72, y: 680, width: 560, height: 140, position: 'absolute' },
      properties: { text: 'Friday 6–10pm\nPier 7, Wapping\nLive music · Street food · Local makers', fontSize: 22, fontWeight: 500, textAlign: 'left', style: { textColor: '#e2e8f0', lineHeight: 1.5 } },
      semantic: { role: 'textbox' },
    },
    {
      type: 'button',
      name: 'Reserve a table',
      layout: { x: 72, y: 920, width: 280, height: 64, position: 'absolute' },
      properties: { text: 'Reserve a table', fontSize: 20, fontWeight: 700, style: { fill: '#f59e0b', stroke: '#f59e0b', strokeWidth: 0, borderRadius: 32, opacity: 1, textColor: '#0f172a' } },
      semantic: { role: 'button' },
    },
  ],
}

const LOGO: WorkspacePresetTemplate = {
  assets: [],
  nodes: [
    {
      type: 'section',
      name: 'Logo canvas',
      layout: { x: 0, y: 0, width: 512, height: 512, position: 'absolute' },
      properties: { text: '', style: { fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1, borderRadius: 36, opacity: 1 } },
      semantic: { role: 'banner', label: 'Logo' },
    },
    {
      type: 'container',
      name: 'Mark',
      layout: { x: 88, y: 88, width: 140, height: 140, position: 'absolute' },
      properties: { text: '', style: { fill: '#2563eb', stroke: '#2563eb', strokeWidth: 0, borderRadius: 44, opacity: 1 } },
      semantic: { role: 'img', label: 'Logo mark' },
    },
    {
      type: 'text',
      name: 'Wordmark',
      layout: { x: 88, y: 272, width: 340, height: 60, position: 'absolute' },
      properties: { text: 'Northwind', fontSize: 46, fontWeight: 800, textAlign: 'left', style: { textColor: '#0f172a', lineHeight: 1.1 } },
      semantic: { role: 'heading', level: 1 },
    },
    {
      type: 'text',
      name: 'Tagline',
      layout: { x: 88, y: 336, width: 340, height: 32, position: 'absolute' },
      properties: { text: 'PRODUCT STUDIO', fontSize: 16, fontWeight: 600, textAlign: 'left', style: { textColor: '#64748b', lineHeight: 1.2 } },
      semantic: { role: 'textbox' },
    },
  ],
}

const BLANK: WorkspacePresetTemplate = { nodes: [], assets: [] }

const TEMPLATES: Record<WorkspacePreset, WorkspacePresetTemplate> = { blank: BLANK, website: WEBSITE, flyer: FLYER, logo: LOGO }

/**
 * Deterministic starter composition for a preset. The template contains no
 * identity, timestamps, or ordering state, so the same preset always seeds the
 * same design.
 */
export function presetTemplate(preset: WorkspacePreset): WorkspacePresetTemplate {
  return TEMPLATES[preset]
}
