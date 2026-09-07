import type { DesignDocument, DesignGraph, DesignNode, Page, Project } from '../contracts'

const timestamp = '2026-09-05T00:00:00.000Z'

const project: Project = {
  id: 'project_invoiceflow',
  name: 'InvoiceFlow',
  slug: 'invoiceflow',
  createdAt: timestamp,
  updatedAt: timestamp,
}

const document: DesignDocument = {
  id: 'doc_invoiceflow',
  projectId: project.id,
  name: 'InvoiceFlow dashboard design',
  createdAt: timestamp,
  updatedAt: timestamp,
}

const page: Page = {
  id: 'page_invoiceflow_dashboard',
  documentId: document.id,
  name: 'Dashboard',
  routeHint: '/dashboard',
  createdAt: timestamp,
  updatedAt: timestamp,
}

function node(partial: Omit<DesignNode, 'pageId' | 'createdAt' | 'updatedAt'>): DesignNode {
  return { ...partial, pageId: page.id, createdAt: timestamp, updatedAt: timestamp }
}

export function createInvoiceFlowGraph(): DesignGraph {
  const graph: DesignGraph = {
    project,
    document,
    page,
    nodes: [
      node({ id: 'node_dashboard_shell', parentId: null, type: 'container', name: 'Dashboard shell', orderIndex: 0, semantic: { role: 'main', accessibleName: 'InvoiceFlow dashboard' }, properties: {}, layout: { display: 'flex', direction: 'column', gap: 'space.4', width: 'fill', x: 0, y: 0 }, responsive: [{ breakpoint: 'mobile', layout: { padding: { top: 16, right: 16, bottom: 16, left: 16 } } }, { breakpoint: 'desktop', layout: { padding: { top: 32, right: 40, bottom: 32, left: 40 } } }], accessibility: { role: 'main', focusable: false }, intentIds: ['intent_dashboard_clarity'] }),
      node({ id: 'node_dashboard_header', parentId: 'node_dashboard_shell', type: 'section', name: 'Dashboard header', orderIndex: 0, semantic: { role: 'banner', label: 'Dashboard header' }, properties: {}, layout: { display: 'flex', direction: 'row', align: 'center', justify: 'space-between', gap: 'space.3' } }),
      node({ id: 'node_dashboard_title', parentId: 'node_dashboard_header', type: 'heading', name: 'Outstanding invoices', orderIndex: 0, semantic: { role: 'heading', accessibleName: 'Outstanding invoices', level: 1 }, properties: { text: 'Outstanding invoices' }, layout: { width: 'auto', height: 'auto' }, typographyId: 'type_heading_1', tokenRefs: { text: 'token_color_text_primary' }, accessibility: { role: 'heading', accessibleName: 'Outstanding invoices' } }),
      node({ id: 'node_primary_button', parentId: 'node_dashboard_header', type: 'component-instance', name: 'Create invoice', orderIndex: 1, semantic: { role: 'button', accessibleName: 'Create invoice' }, properties: {}, layout: { width: 'auto', height: 'auto' }, componentInstanceId: 'instance_primary_button', interactions: [{ type: 'click', intent: 'Create a new invoice' }], states: [{ name: 'default' }, { name: 'hover' }, { name: 'focus' }, { name: 'disabled' }], accessibility: { role: 'button', accessibleName: 'Create invoice', keyboard: 'button', focusable: true } }),
      node({ id: 'node_metric_grid', parentId: 'node_dashboard_shell', type: 'section', name: 'Summary metrics', orderIndex: 1, semantic: { role: 'region', label: 'Summary metrics' }, properties: {}, layout: { display: 'grid', gap: 'space.4', width: 'fill' }, responsive: [{ breakpoint: 'mobile', layout: { gap: 'space.3' } }, { breakpoint: 'tablet', layout: { gap: 'space.4' } }, { breakpoint: 'desktop', layout: { gap: 'space.5' } }] }),
      node({ id: 'node_metric_card', parentId: 'node_metric_grid', type: 'component-instance', name: 'Revenue metric', orderIndex: 0, semantic: { role: 'region', accessibleName: 'Revenue metric' }, properties: { label: 'Revenue', value: '$128,400' }, layout: { width: 'fill', height: 'auto' }, componentInstanceId: 'instance_metric_card', tokenRefs: { fill: 'token_color_surface', radius: 'token_radius_card', shadow: 'token_shadow_card' } }),
      node({ id: 'node_invoice_table', parentId: 'node_dashboard_shell', type: 'component-instance', name: 'Invoice table', orderIndex: 2, semantic: { role: 'table', accessibleName: 'Invoices' }, properties: {}, layout: { width: 'fill', height: 'auto' }, componentInstanceId: 'instance_invoice_table', accessibility: { role: 'table', accessibleName: 'Invoices', focusable: false } }),
      node({ id: 'node_status_badge', parentId: 'node_invoice_table', type: 'component-instance', name: 'Paid status', orderIndex: 0, semantic: { role: 'cell', accessibleName: 'Paid' }, properties: { text: 'Paid' }, layout: { width: 'auto', height: 'auto' }, componentInstanceId: 'instance_status_badge', states: [{ name: 'default' }, { name: 'selected' }] }),
    ],
    componentDefinitions: [
      { id: 'component_metric_card', name: 'MetricCard', description: 'A compact summary metric with a label and value.', anatomy: ['label', 'value', 'trend'], variants: { tone: ['neutral', 'positive', 'negative'] }, props: ['label', 'value', 'trend'], states: ['default'], tokenRefs: { fill: 'token_color_surface', radius: 'token_radius_card', shadow: 'token_shadow_card' }, intentIds: ['intent_metrics_scan'] },
      { id: 'component_invoice_table', name: 'InvoiceTable', description: 'A readable table for outstanding invoices.', anatomy: ['header', 'row', 'status'], variants: { density: ['comfortable', 'compact'] }, props: ['rows'], states: ['default', 'loading', 'error'], tokenRefs: { border: 'token_border_subtle' } },
      { id: 'component_status_badge', name: 'StatusBadge', description: 'A compact status label.', anatomy: ['label'], variants: { tone: ['paid', 'pending', 'overdue'] }, props: ['status'], states: ['default'], tokenRefs: { radius: 'token_radius_pill' } },
      { id: 'component_primary_button', name: 'PrimaryButton', description: 'The dominant action for a surface.', anatomy: ['label', 'icon'], variants: { size: ['sm', 'md'], tone: ['brand'] }, props: ['label', 'disabled'], states: ['default', 'hover', 'focus', 'disabled', 'loading'], tokenRefs: { fill: 'token_color_action_primary', text: 'token_color_text_on_action', radius: 'token_radius_button' }, accessibility: { role: 'button', keyboard: 'button', focusable: true }, intentIds: ['intent_primary_action'] },
    ],
    componentInstances: [
      { id: 'instance_metric_card', definitionId: 'component_metric_card', nodeId: 'node_metric_card', props: { label: 'Revenue', value: '$128,400' }, variant: { tone: 'positive' } },
      { id: 'instance_invoice_table', definitionId: 'component_invoice_table', nodeId: 'node_invoice_table', props: { rows: [] }, variant: { density: 'comfortable' }, state: 'default' },
      { id: 'instance_status_badge', definitionId: 'component_status_badge', nodeId: 'node_status_badge', props: { status: 'Paid' }, variant: { tone: 'paid' } },
      { id: 'instance_primary_button', definitionId: 'component_primary_button', nodeId: 'node_primary_button', props: { label: 'Create invoice', disabled: false }, variant: { size: 'md', tone: 'brand' } },
    ],
    tokens: [
      { id: 'token_color_surface', name: 'color.surface', category: 'color', value: '#ffffff' },
      { id: 'token_color_text_primary', name: 'color.text.primary', category: 'color', value: '#0f172a' },
      { id: 'token_color_text_on_action', name: 'color.text.onAction', category: 'color', value: '#ffffff' },
      { id: 'token_color_action_primary', name: 'color.action.primary', category: 'color', value: '#2563eb' },
      { id: 'token_spacing_page', name: 'space.page', category: 'spacing', value: 32 },
      { id: 'token_spacing_grid', name: 'space.4', category: 'spacing', value: 16 },
      { id: 'token_typography_body', name: 'type.body', category: 'typography', value: 'type_body' },
      { id: 'token_radius_card', name: 'radius.card', category: 'radius', value: 12 },
      { id: 'token_radius_button', name: 'radius.button', category: 'radius', value: 8 },
      { id: 'token_radius_pill', name: 'radius.pill', category: 'radius', value: 999 },
      { id: 'token_border_subtle', name: 'border.subtle', category: 'border', value: { color: '#e2e8f0', width: 1 } },
      { id: 'token_shadow_card', name: 'shadow.card', category: 'shadow', value: { color: '#0f172a20', blur: 16, y: 4 } },
    ],
    typography: [
      { id: 'type_heading_1', name: 'Heading 1', fontFamily: 'Inter', fontSize: 30, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.2, style: 'normal' },
      { id: 'type_body', name: 'Body', fontFamily: 'Inter', fontSize: 14, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0, style: 'normal' },
    ],
    assets: [{ id: 'asset_invoiceflow_mark', kind: 'icon', name: 'InvoiceFlow mark', source: 'invoiceflow-mark', altText: 'InvoiceFlow' }],
    intents: [
      { id: 'intent_dashboard_clarity', targetType: 'page', targetId: page.id, statement: 'Give operators an immediate view of financial health and outstanding work.', priority: 'high' },
      { id: 'intent_metrics_scan', targetType: 'component', targetId: 'component_metric_card', statement: 'Metrics should be scannable before the user reads detail.', priority: 'medium' },
      { id: 'intent_primary_action', targetType: 'component', targetId: 'component_primary_button', statement: 'Primary actions should have strong visual emphasis and remain distinct from secondary actions.', priority: 'high' },
    ],
  }
  return graph
}
