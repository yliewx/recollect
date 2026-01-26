BEGIN;

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

    CONSTRAINT albums_deleted_at
        CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

-- -------------------------------------
-- PHOTOS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS photos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT photos_deleted_at
        CHECK (deleted_at IS NULL OR deleted_at >= uploaded_at)
);

-- -------------------------------------
-- TAGS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- -------------------------------------
-- PHOTO CAPTIONS
-- -------------------------------------
CREATE TABLE IF NOT EXISTS captions (
    photo_id BIGINT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
    caption TEXT NOT NULL,
    caption_tsv TSVECTOR -- tokenized version of caption
        GENERATED ALWAYS AS (
            to_tsvector('english', caption)
        ) STORED
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

-- GIN (generalized inverted index): for full-text search
CREATE INDEX IF NOT EXISTS idx_photos_captions_tsv ON captions USING GIN (caption_tsv);

-- filter albums and photos to account for soft deletion
CREATE INDEX IF NOT EXISTS idx_photos_active ON photos(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_albums_active ON albums(id) WHERE deleted_at IS NULL;

-- prevent duplicate album titles per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_user_title ON albums(user_id, title) WHERE deleted_at IS NULL;

-- foreign keys
CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_album_id ON album_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_photo_id ON album_photos(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo_id ON photo_tags(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag_id ON photo_tags(tag_id);

COMMIT;