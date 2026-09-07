CREATE TABLE IF NOT EXISTS design_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES design_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved')),
  graph JSONB NOT NULL,
  graph_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS design_proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES design_documents(id) ON DELETE CASCADE,
  base_version_id TEXT NOT NULL REFERENCES design_versions(id) ON DELETE RESTRICT,
  operations JSONB NOT NULL,
  affected_resource_ids JSONB NOT NULL,
  rationale TEXT NOT NULL,
  author TEXT NOT NULL,
  validation JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  resulting_version_id TEXT REFERENCES design_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS design_versions_document_id_idx ON design_versions(document_id, version_number);
CREATE INDEX IF NOT EXISTS design_proposals_document_id_idx ON design_proposals(document_id, created_at);

CREATE OR REPLACE FUNCTION prevent_approved_version_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Approved design versions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS design_versions_immutable ON design_versions;
CREATE TRIGGER design_versions_immutable
  BEFORE UPDATE ON design_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_approved_version_mutation();
