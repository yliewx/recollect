BEGIN;

-- =========================================================
-- * reset db
-- =========================================================

DROP TABLE IF EXISTS album_photos;
DROP TABLE IF EXISTS photo_tags;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS albums;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS users;

-- =========================================================
-- * core entities
-- =========================================================

-- -------------------------------------
-- USERS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------
-- ALBUMS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS albums (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT albums_deleted_at_valid
        CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

-- -------------------------------------
-- PHOTOS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS photos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    caption TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT photos_deleted_at_valid
        CHECK (deleted_at IS NULL OR deleted_at >= uploaded_at)
);

-- -------------------------------------
-- TAGS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- =========================================================
-- * relationship tables
-- =========================================================

-- -------------------------------------
-- ALBUM_PHOTOS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS album_photos (
    album_id BIGINT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    photo_id BIGINT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, photo_id)
);

-- -------------------------------------
-- PHOTO_TAGS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS photo_tags (
    photo_id BIGINT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (photo_id, tag_id)
);

-- =========================================================
-- * indexes
-- =========================================================

-- filter photos
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_photos_active ON photos(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_albums_active ON albums(id) WHERE deleted_at IS NULL;

-- foreign keys
CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_album_id ON album_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_photo_id ON album_photos(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON photo_tags(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag_id ON photo_tags(tag_id);

COMMIT;