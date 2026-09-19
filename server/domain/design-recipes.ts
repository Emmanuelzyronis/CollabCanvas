import type { JsonObject, LayoutConstraints, NodeSemantic, NodeType } from './contracts.js'
import type { DesignChangeOperation } from './version-types.js'

/** A recipe only ever produces creations. */
export type CreateNodeOperation = Extract<DesignChangeOperation, { type: 'createNode' }>

/**
 * A recipe node before it is turned into a proposal operation. Blueprints carry
 * presentation and structural layout only — no ids, no page scope, no
 * timestamps — so the same recipe always yields the same plan.
 *
 * Structural layout is what makes the assistant's output editable: a recipe
 * describes a stack (direction, gap, padding, alignment), not a set of pixel
 * coordinates, so spacing refinements reflow the real design.
 */
export interface RecipeNodeBlueprint {
  readonly key: string
  readonly parentKey?: string
  readonly type: NodeType
  readonly name: string
  readonly layout: LayoutConstraints
  readonly properties: JsonObject
  readonly semantic: NodeSemantic
}

export interface DesignRecipe {
  readonly id: 'navigation' | 'hero' | 'featureCards'
  readonly label: string
  readonly keywords: readonly string[]
  readonly blueprint: readonly RecipeNodeBlueprint[]
}

const PAGE_WIDTH = 1440

const surface = (fill: string, stroke = '#e2e8f0', borderRadius = 0): JsonObject => ({
  text: '',
  style: { fill, stroke, strokeWidth: stroke === 'none' ? 0 : 1, borderRadius, opacity: 1 },
})

/** A container placed on the page; its children flow through the layout resolver. */
const section = (
  x: number,
  y: number,
  width: number,
  height: number,
  flow: Pick<LayoutConstraints, 'display' | 'direction' | 'gap' | 'padding' | 'align' | 'justify'>,
): LayoutConstraints => ({ position: 'absolute', x, y, width, height, ...flow })

/** A child that takes part in its parent's stack. */
const flowChild = (width: LayoutConstraints['width'], height: LayoutConstraints['height'] = 'auto'): LayoutConstraints => ({
  position: 'flow',
  width,
  height,
})

const NAVIGATION: DesignRecipe = {
  id: 'navigation',
  label: 'navigation bar',
  keywords: ['navigation', 'navbar', 'nav bar', 'top bar', 'header', 'menu'],
  blueprint: [
    {
      key: 'nav',
      type: 'section',
      name: 'Navigation',
      layout: section(0, 0, PAGE_WIDTH, 88, {
        display: 'flex',
        direction: 'row',
        align: 'center',
        justify: 'space-between',
        padding: { top: 0, right: 120, bottom: 0, left: 120 },
      }),
      properties: surface('#ffffff'),
      semantic: { role: 'region', label: 'Navigation' },
    },
    { key: 'brand', parentKey: 'nav', type: 'heading', name: 'Brand', layout: flowChild('auto'), properties: { text: 'Your product', fontSize: 20, fontWeight: 700, textAlign: 'left', style: { textColor: '#0f172a' } }, semantic: { role: 'heading', level: 2 } },
    { key: 'link-overview', parentKey: 'nav', type: 'text', name: 'Overview link', layout: flowChild('auto'), properties: { text: 'Overview', fontSize: 15, fontWeight: 400, textAlign: 'left', style: { textColor: '#475569' } }, semantic: { role: 'textbox' } },
    { key: 'link-features', parentKey: 'nav', type: 'text', name: 'Features link', layout: flowChild('auto'), properties: { text: 'Features', fontSize: 15, fontWeight: 400, textAlign: 'left', style: { textColor: '#475569' } }, semantic: { role: 'textbox' } },
    { key: 'nav-cta', parentKey: 'nav', type: 'button', name: 'Get started', layout: flowChild(140, 40), properties: { text: 'Get started', fontSize: 15, fontWeight: 600, style: { fill: '#2563eb', stroke: '#2563eb', strokeWidth: 0, borderRadius: 10, opacity: 1, textColor: '#ffffff' } }, semantic: { role: 'button' } },
  ],
}

const HERO: DesignRecipe = {
  id: 'hero',
  label: 'hero section',
  keywords: ['hero', 'landing page', 'landing', 'headline', 'call to action'],
  blueprint: [
    {
      key: 'hero',
      type: 'section',
      name: 'Hero',
      layout: section(0, 0, PAGE_WIDTH, 620, {
        display: 'stack',
        direction: 'column',
        gap: 28,
        align: 'start',
        justify: 'start',
        padding: { top: 120, right: 120, bottom: 120, left: 120 },
      }),
      properties: surface('#f8fafc'),
      semantic: { role: 'banner', label: 'Hero' },
    },
    { key: 'headline', parentKey: 'hero', type: 'heading', name: 'Headline', layout: flowChild('fill'), properties: { text: 'Design at the speed of thought', fontSize: 56, fontWeight: 800, textAlign: 'left', style: { textColor: '#0f172a', lineHeight: 1.1 } }, semantic: { role: 'heading', level: 1 } },
    { key: 'subhead', parentKey: 'hero', type: 'text', name: 'Supporting text', layout: flowChild('fill'), properties: { text: 'A modern starting point for your next product page — edit anything you see here.', fontSize: 20, fontWeight: 400, textAlign: 'left', style: { textColor: '#475569', lineHeight: 1.5 } }, semantic: { role: 'textbox' } },
    { key: 'hero-cta', parentKey: 'hero', type: 'button', name: 'Primary action', layout: flowChild(220, 60), properties: { text: 'Get started', fontSize: 18, fontWeight: 600, style: { fill: '#2563eb', stroke: '#2563eb', strokeWidth: 0, borderRadius: 12, opacity: 1, textColor: '#ffffff' } }, semantic: { role: 'button' } },
  ],
}

const CARD_COPY: readonly { readonly key: string; readonly title: string; readonly body: string }[] = [
  { key: 'card-fast', title: 'Fast to start', body: 'Begin from a real interface and change anything you see.' },
  { key: 'card-clear', title: 'Clear structure', body: 'Every element stays editable, named and arranged as layers.' },
  { key: 'card-ready', title: 'Ready to build', body: 'Hand the finished design to a coding agent without redrawing it.' },
]

const FEATURE_CARDS: DesignRecipe = {
  id: 'featureCards',
  label: 'feature cards',
  keywords: ['feature cards', 'feature card', 'cards', 'benefits', 'pillars', 'three column'],
  blueprint: [
    {
      key: 'cards',
      type: 'section',
      name: 'Feature cards',
      layout: section(0, 0, PAGE_WIDTH, 380, {
        display: 'flex',
        direction: 'row',
        gap: 24,
        align: 'stretch',
        justify: 'start',
        padding: { top: 64, right: 120, bottom: 64, left: 120 },
      }),
      properties: surface('#ffffff', 'none'),
      semantic: { role: 'region', label: 'Feature cards' },
    },
    ...CARD_COPY.flatMap((card): RecipeNodeBlueprint[] => [
      {
        key: card.key,
        parentKey: 'cards',
        type: 'section',
        name: card.title,
        layout: { ...flowChild('fill', 220), display: 'stack', direction: 'column', gap: 12, align: 'start', padding: { top: 32, right: 32, bottom: 32, left: 32 } },
        properties: surface('#ffffff', '#e2e8f0', 16),
        semantic: { role: 'region', label: card.title },
      },
      { key: `${card.key}-title`, parentKey: card.key, type: 'heading', name: `${card.title} title`, layout: flowChild('fill'), properties: { text: card.title, fontSize: 22, fontWeight: 700, textAlign: 'left', style: { textColor: '#0f172a' } }, semantic: { role: 'heading', level: 3 } },
      { key: `${card.key}-body`, parentKey: card.key, type: 'text', name: `${card.title} text`, layout: flowChild('fill'), properties: { text: card.body, fontSize: 16, fontWeight: 400, textAlign: 'left', style: { textColor: '#475569', lineHeight: 1.5 } }, semantic: { role: 'textbox' } },
    ]),
  ],
}

export const DESIGN_RECIPES: readonly DesignRecipe[] = [HERO, NAVIGATION, FEATURE_CARDS]

/** The recipe an instruction is asking for, if any. Longest keyword wins. */
export function recipeForInstruction(instruction: string): DesignRecipe | undefined {
  const lower = instruction.toLowerCase()
  let best: { recipe: DesignRecipe; length: number } | undefined
  for (const recipe of DESIGN_RECIPES) {
    for (const keyword of recipe.keywords) {
      if (lower.includes(keyword) && (best === undefined || keyword.length > best.length)) best = { recipe, length: keyword.length }
    }
  }
  return best?.recipe
}

/** Turn a recipe into proposal operations, placed below existing content. */
export function recipeOperations(recipe: DesignRecipe, offsetY: number): CreateNodeOperation[] {
  return recipe.blueprint.map((blueprint) => ({
    type: 'createNode' as const,
    key: blueprint.key,
    ...(blueprint.parentKey === undefined ? {} : { parentKey: blueprint.parentKey }),
    node: {
      type: blueprint.type,
      name: blueprint.name,
      // Only a placed root takes the offset; flow children keep their layout
      // free of x/y so the resolver can stack them.
      layout: typeof blueprint.layout.y === 'number' ? { ...blueprint.layout, y: blueprint.layout.y + offsetY } : blueprint.layout,
      properties: blueprint.properties,
      semantic: blueprint.semantic,
    },
  }))
}
