CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS design_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES design_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  route_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS design_nodes (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  parent_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  semantic JSONB NOT NULL DEFAULT '{}'::jsonb,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT design_nodes_page_id_id_key UNIQUE (page_id, id),
  CONSTRAINT design_nodes_parent_same_page CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT design_nodes_parent_fk FOREIGN KEY (page_id, parent_id)
    REFERENCES design_nodes(page_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS design_documents_project_id_idx ON design_documents(project_id);
CREATE INDEX IF NOT EXISTS pages_document_id_idx ON pages(document_id);
CREATE INDEX IF NOT EXISTS design_nodes_page_id_idx ON design_nodes(page_id);
CREATE INDEX IF NOT EXISTS design_nodes_parent_id_idx ON design_nodes(parent_id);
