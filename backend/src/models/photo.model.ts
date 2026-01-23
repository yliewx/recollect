import { Photo } from "@/types/models.js";
import { Pool } from "pg";

/*
    const query = `

    `;
    const values = [];
    const result = await this.db.query(query, values);

    if (!result.rows || result.rows.length === 0) {
        throw new Error();
    }

    return result.rows[0];
*/

export class PhotoModel {
    constructor(private db: Pool) {}

    // POST /photos
    async upload(userId: number, filePath: string, caption?: string): Promise<Photo> {
        const query = `
            INSERT INTO photos (user_id, file_path, caption)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, file_path, caption, uploaded_at
        `;
        const values = [userId, filePath, caption ?? null];
        const result = await this.db.query(query, values);

        if (!result.rows || result.rows.length === 0) {
            throw new Error('Photo INSERT failed');
        }

        return result.rows[0];
    }

    // DELETE /photos:id
    // soft delete
    async delete(photoId: number, userId: number) {
        const query = `
            UPDATE photos
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1
                AND user_id = $2
                AND deleted_at IS NULL
            RETURNING id, user_id, file_path, caption, uploaded_at, deleted_at
        `;

        const values = [photoId, userId];
        const result = await this.db.query(query, values);

        if (!result.rows || result.rows.length === 0) {
            throw new Error('Photo delete (UPDATE) failed');
        }

        return result.rows[0];
    }
}
