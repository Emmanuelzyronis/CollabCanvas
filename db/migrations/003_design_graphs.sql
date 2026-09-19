-- Complete canonical graph snapshot used by the graph-backed workspace boundary.
-- Normalized tables remain the CRUD foundation while richer graph entities are
-- hydrated atomically from this canonical JSON document.
CREATE TABLE IF NOT EXISTS design_graphs (
  document_id TEXT PRIMARY KEY REFERENCES design_documents(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  graph JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS design_graphs_project_id_idx ON design_graphs(project_id);
CREATE INDEX IF NOT EXISTS design_graphs_page_id_idx ON design_graphs(page_id);
