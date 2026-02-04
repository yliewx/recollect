BEGIN;

-- =========================================================
-- * trigger updates on Albums.updated_at timestamp
-- =========================================================

-- -------------------------------------
-- direct album field updates
-- -------------------------------------
CREATE OR REPLACE FUNCTION touch_album_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_album_updated_at ON albums;

CREATE TRIGGER trg_touch_album_updated_at
BEFORE UPDATE ON albums
FOR EACH ROW
EXECUTE FUNCTION touch_album_updated_at();

-- -------------------------------------
-- indirect updates (album_photos)
-- -------------------------------------
CREATE OR REPLACE FUNCTION album_photos_touch_album()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE albums
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.album_id, OLD.album_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_album_photos_touch_album ON album_photos;

CREATE TRIGGER trg_album_photos_touch_album
AFTER INSERT OR DELETE ON album_photos
FOR EACH ROW
EXECUTE FUNCTION album_photos_touch_album();

COMMIT;