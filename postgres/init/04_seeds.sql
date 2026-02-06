BEGIN;

-- -------------------------------------
-- single user with 50k photos for testing
-- -------------------------------------
INSERT INTO users (username, email)
VALUES ('test_user', 'test@example.com');

-- Store the user ID for subsequent queries
DO $$
DECLARE
    test_user_id INTEGER;
    album_count INTEGER := 50;
    photo_count INTEGER := 50000;
    caption_keywords TEXT[] := ARRAY[
        'Cat sitting on the beach watching a golden sunset',
        'A peaceful sunset at the beach while a cat naps nearby',
        'Golden sunset over the beach with waves crashing softly',
        'Sleepy cat curled up by the window on a rainy afternoon',
        'Afternoon walk through the city with coffee and music'
    ];
    tag_keywords TEXT[] := ARRAY[
        'nature', 'travel', 'sunset', 'food', 'family',
        'work', 'summer', 'pets', 'beach', 'friends'
    ];
BEGIN
    SELECT id INTO test_user_id FROM users WHERE username = 'test_user';

    -- -------------------------------------
    -- ALBUMS (50)
    -- -------------------------------------
    INSERT INTO albums (user_id, title)
    SELECT
        test_user_id,
        'Album_' || i || '_of_User_' || test_user_id AS title
    FROM generate_series(1, album_count) AS i;

    -- -------------------------------------
    -- PHOTOS (50k): 1000 per album
    -- -------------------------------------
    INSERT INTO photos (user_id, file_path)
    SELECT
        test_user_id,
        '/uploads/photo_' || test_user_id || '_' || i || '.jpg'
    FROM generate_series(1, photo_count) AS i;

    -- -------------------------------------
    -- ALBUM_PHOTOS: distribute photos across albums
    -- -------------------------------------
    INSERT INTO album_photos (album_id, photo_id)
    SELECT
        a.id,
        p.id
    FROM photos p
    JOIN albums a
        ON a.user_id = test_user_id
        AND a.id = (
            SELECT id
            FROM albums
            WHERE user_id = test_user_id
            ORDER BY id
            OFFSET ((p.id - 1) % album_count)
            LIMIT 1
        )
    WHERE p.user_id = test_user_id;

    -- -------------------------------------
    -- CAPTIONS with rotating keywords
    -- Cycle through keywords predictably
    -- -------------------------------------
    INSERT INTO captions (photo_id, caption)
    SELECT
        p.id,
        CASE (p.id % 3)
            WHEN 0 THEN 
                -- 2 words
                caption_keywords[1 + ((p.id - 1) % 5)] || ' and ' || 
                tag_keywords[1 + ((p.id + 3) % 10)]
            WHEN 1 THEN 
                -- 3 words with different offset
                caption_keywords[1 + ((p.id - 1) % 5)] || ' for ' || 
                tag_keywords[1 + ((p.id + 4) % 10)] || ' and ' ||
                tag_keywords[1 + ((p.id + 7) % 10)]
            ELSE 
                -- 4 words with different offset
                caption_keywords[1 + ((p.id - 1) % 5)] || ' at ' || 
                tag_keywords[1 + ((p.id + 2) % 10)] || ' with ' ||
                tag_keywords[1 + ((p.id + 5) % 10)]
        END
    FROM photos p
    WHERE p.user_id = test_user_id;

    -- -------------------------------------
    -- TAGS (10 tags using keywords)
    -- -------------------------------------
    INSERT INTO tags (user_id, tag_name)
    SELECT
        test_user_id,
        tag_keywords[i]
    FROM generate_series(1, 10) AS i;

    -- -------------------------------------
    -- PHOTO_TAGS (60,000)
    -- 6 tags per photo, cycling through 10 available tags
    -- -------------------------------------
    INSERT INTO photo_tags (photo_id, tag_id)
    SELECT
        p.id,
        t.id
    FROM photos p
    CROSS JOIN LATERAL (
        SELECT id
        FROM tags
        WHERE user_id = test_user_id
        ORDER BY id
        OFFSET ((p.id - 1) % 10)
        LIMIT 6
    ) t
    WHERE p.user_id = test_user_id;

END $$;

COMMIT;

-- BEGIN;

-- -- -------------------------------------
-- -- USERS: generate 100 users
-- -- -------------------------------------
-- INSERT INTO users (username, email)
-- SELECT
-- 	'User ' || i, -- generate username
-- 	'user' || i || '@test.com' -- generate email
-- FROM generate_series(1, 100) AS i;

-- -- -------------------------------------
-- -- ALBUMS: generate 2-5 albums per user
-- -- -------------------------------------
-- INSERT INTO albums (user_id, title)
-- SELECT
--     u.id AS user_id,
--     'Album ' || i || ' of User ' || u.id AS title
-- FROM users u
-- JOIN LATERAL generate_series(
--     1,
--     random(2, 5)
-- ) i ON true;

-- -- -------------------------------------
-- -- PHOTOS: generate 2-10 photos per user
-- -- -------------------------------------
-- INSERT INTO photos (user_id, file_path)
-- SELECT
--     u.id AS user_id,
--     '/uploads/' || gen_random_uuid() || '.jpg'
-- FROM users u
-- JOIN LATERAL generate_series(
--     1,
--     random(2, 10)
-- ) i ON true;

-- -- -------------------------------------
-- -- ALBUM_PHOTOS: assign each photo to a random album from the same user
-- -- -------------------------------------
-- INSERT INTO album_photos (album_id, photo_id)
-- SELECT a.id AS album_id, p.id AS photo_id
-- FROM photos p
-- JOIN LATERAL (
--     SELECT id
--     FROM albums
--     WHERE user_id = p.user_id
--     ORDER BY random()
--     LIMIT 1
-- ) a ON true;

-- -- -------------------------------------
-- -- CAPTIONS: generate a caption for each photo
-- -- -------------------------------------
-- INSERT INTO captions (photo_id, caption)
-- SELECT
--     p.id AS photo_id,
--     'Caption for photo ' || p.id || ' of User ' || p.user_id AS caption
-- FROM photos p;

-- -- -------------------------------------
-- -- TAGS: generate 2-5 tags per user
-- -- -------------------------------------
-- INSERT INTO tags (user_id, tag_name)
-- SELECT
--     u.id AS user_id,
--     'Tag ' || i || ' of User ' || u.id AS tag_name
-- FROM users u
-- JOIN LATERAL generate_series(
--     1,
--     random(2, 5)
-- ) i ON true;

-- -- -------------------------------------
-- -- PHOTO_TAGS: assign random tags to photos
-- -- -------------------------------------
-- INSERT INTO photo_tags (photo_id, tag_id)
-- SELECT DISTINCT p.id, t.id
-- FROM photos p
-- JOIN LATERAL (
--     SELECT id
--     FROM tags
--     WHERE tags.user_id = p.user_id
--     ORDER BY random()
--     LIMIT (random(1, 5)) -- random number of tags per photo
-- ) t ON true;

-- COMMIT;