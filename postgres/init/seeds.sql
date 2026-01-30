BEGIN;

-- -------------------------------------
-- USERS: generate 100 users
-- -------------------------------------
INSERT INTO users (username, email)
SELECT
	'User ' || i, -- generate username
	'user' || i || '@test.com' -- generate email
FROM generate_series(1, 100) AS i;

-- -------------------------------------
-- ALBUMS: generate 2-5 albums per user
-- -------------------------------------
INSERT INTO albums (user_id, title)
SELECT
    u.id AS user_id,
    'Album ' || i || ' of User ' || u.id AS title
FROM users u
JOIN LATERAL generate_series(
    1,
    random(2, 5)
) i ON true;

-- -------------------------------------
-- PHOTOS: generate 2-10 photos per user
-- -------------------------------------
INSERT INTO photos (user_id, file_path)
SELECT
    u.id AS user_id,
    '/uploads/' || u.id || '/' || gen_random_uuid() || '.jpg'
FROM users u
JOIN LATERAL generate_series(
    1,
    random(2, 10)
) i ON true;

-- -------------------------------------
-- ALBUM_PHOTOS: assign each photo to a random album from the same user
-- -------------------------------------
INSERT INTO album_photos (album_id, photo_id)
SELECT a.id AS album_id, p.id AS photo_id
FROM photos p
JOIN LATERAL (
    SELECT id
    FROM albums
    WHERE user_id = p.user_id
    ORDER BY random()
    LIMIT 1
) a ON true;

-- -------------------------------------
-- CAPTIONS: generate a caption for each photo
-- -------------------------------------
INSERT INTO captions (photo_id, caption)
SELECT
    p.id AS photo_id,
    'Caption for photo ' || p.id || ' of User ' || p.user_id AS caption
FROM photos p;

-- -------------------------------------
-- TAGS: generate 2-5 tags per user
-- -------------------------------------
INSERT INTO tags (user_id, tag_name)
SELECT
    u.id AS user_id,
    'Tag ' || i || ' of User ' || u.id AS tag_name
FROM users u
JOIN LATERAL generate_series(
    1,
    random(2, 5)
) i ON true;

-- -------------------------------------
-- PHOTO_TAGS: assign random tags to photos
-- -------------------------------------
INSERT INTO photo_tags (photo_id, tag_id)
SELECT DISTINCT p.id, t.id
FROM photos p
JOIN LATERAL (
    SELECT id
    FROM tags
    WHERE tags.user_id = p.user_id
    ORDER BY random()
    LIMIT (random(1, 5)) -- random number of tags per photo
) t ON true;

COMMIT;