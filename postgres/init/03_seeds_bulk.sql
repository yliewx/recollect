BEGIN;

-- -------------------------------------
-- BULK INSERT USERS (1000)
-- -------------------------------------
INSERT INTO users (username, email)
SELECT
    'User_' || i, -- generate username
    'User_' || i || '@test.com' -- generate email
FROM generate_series(1, 1000) AS i;

-- -------------------------------------
-- ALBUMS (4000): 4 albums per user
-- -------------------------------------
INSERT INTO albums (user_id, title)
SELECT
    u.id,
    'Album_' || g || '_of_User_' || u.id AS title
FROM users u
JOIN generate_series(1, 4) g ON true;

-- -------------------------------------
-- PHOTOS (60k): 60 photos per user
-- -------------------------------------
INSERT INTO photos (user_id, filename)
SELECT
    u.id,
    '/uploads/photo_' || u.id || '_' || g || '.jpg' 
FROM users u
JOIN generate_series(1, 60) g ON true;

-- -------------------------------------
-- ALBUM_PHOTOS: assign each photo to an album from the same user
-- album_id -> (photo_id % 4)
-- -------------------------------------
INSERT INTO album_photos (album_id, photo_id)
SELECT
    a.id AS album_id,
    p.id AS photo_id
FROM photos p
JOIN LATERAL (
    SELECT id
    FROM albums
    WHERE user_id = p.user_id
    ORDER BY id
    LIMIT 1
    OFFSET (p.id % 4)
) a ON true;

-- -------------------------------------
-- CAPTIONS: 1 per photo
-- -------------------------------------
INSERT INTO captions (photo_id, caption)
SELECT
    p.id AS photo_id,
    'Caption for photo ' || p.id || ' of User ' || p.user_id AS caption
FROM photos p;

-- -------------------------------------
-- TAGS (6000): 6 tags per user
-- -------------------------------------
INSERT INTO tags (user_id, tag_name)
SELECT
    u.id,
    CASE g
        WHEN 1 THEN 'sunset'
        WHEN 2 THEN 'beach'
        WHEN 3 THEN 'pets'
        WHEN 4 THEN 'nature'
        WHEN 5 THEN 'travel'
        WHEN 6 THEN 'food'
    END
FROM users u
CROSS JOIN generate_series(1, 6) g;

-- -------------------------------------
-- PHOTO_TAGS (180k)
-- 3 tags per photo, cycling through the 6 available tags
-- -------------------------------------
INSERT INTO photo_tags (photo_id, tag_id)
SELECT
    p.id AS photo_id,
    t.id AS tag_id
FROM photos p
JOIN LATERAL (
    SELECT id
    FROM tags
    WHERE user_id = p.user_id
    ORDER BY id
    OFFSET (p.id % 6)
    LIMIT 3
) t ON true;

COMMIT;