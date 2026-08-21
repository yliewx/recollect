BEGIN;

-- =========================================================
-- * visual similarity search (pgvector)
-- =========================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- One whole-image embedding per photo, extracted on-device (Vision framework,
-- VNGenerateImageFeaturePrintRequestRevision1 -- pinned so vectors stay comparable
-- for a given OS/model generation). Deliberately unconstrained (no fixed N):
-- VNFeaturePrintObservation.elementCount is not a documented constant -- it has
-- been observed to differ across iOS versions even for the same pinned revision
-- (e.g. 2048 on older iOS, 768 on iOS 17+). Read elementCount dynamically on the
-- Swift side rather than assuming a size (see mobile/modules/photo-embedding).
-- EmbeddingService guards nearest-neighbor comparisons with vector_dims() so
-- rows of mismatched dimension (e.g. captured on different OS versions) are
-- simply excluded from results rather than erroring.
-- No index in v1: at single-user library scale, an unindexed exact scan is fast
-- enough and gives perfect recall. Add an HNSW/IVFFlat index later if query
-- latency becomes a measured problem -- note pgvector indexes also require a
-- fixed dimension, so that would need revisiting alongside this column.
ALTER TABLE photos ADD COLUMN IF NOT EXISTS embedding vector;

COMMIT;
