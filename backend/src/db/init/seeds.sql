BEGIN;

-- -------------------------------------
-- USERS
-- -------------------------------------
INSERT INTO users (username, email)
SELECT
	'User ' || i, -- generate username
	'user' || i || '@test.com' -- generate email
FROM generate_series(1, 100) AS i;

-- -------------------------------------
-- ALBUMS
-- -------------------------------------
INSERT INTO albums (user_id, title)
SELECT
    u.id AS user_id,
    'Album ' || i || ' of User ' || u.id AS title
FROM users u
JOIN generate_series(
    1,
    (2 + (random() * 3)::int) -- generate 2-5 albums per user
) i ON true;

-- -------------------------------------
-- PHOTOS
-- -------------------------------------
INSERT INTO photos (user_id, file_path, caption)
SELECT
    u.id AS user_id,
    '/uploads/' || u.id || '/photo_' || i || '.jpg' AS file_path,
    'Caption for photo ' || i AS caption
FROM generate_series(1, 100) AS i
JOIN users u
    ON u.id = (1 + (random() * (SELECT MAX(id) FROM users))::BIGINT)
;

-- -------------------------------------
-- TAGS
-- -------------------------------------
INSERT INTO tags (name)
SELECT 'tag_' || i
FROM generate_series(1,50) AS i;

-- assign random tags to photos
INSERT INTO photo_tags (photo_id, tag_id)
SELECT DISTINCT p.id, t.id
FROM photos p
-- generate random number of tags per photo
JOIN LATERAL (
    SELECT id
    FROM tags
    ORDER BY random()
    LIMIT (1 + (random()*4)::int)
) t ON true;

COMMIT;