import { User } from "@/types/models.js";
import { Pool } from "pg";

export class UserModel {
    constructor(private db: Pool) {}

    async create(username: string, email: string): Promise<User> {
        const query = `
            INSERT INTO users (username, email)
            VALUES ($1, $2)
            RETURNING id, username, email, created_at
        `;
        const values = [username, email];
        const result = await this.db.query(query, values);

        if (!result.rows || result.rows.length === 0) {
            throw new Error('User INSERT failed');
        }
    
        return result.rows[0];
    }

    async delete(id: string): Promise<User> {
        const query = `
            DELETE FROM users WHERE id = $1
            RETURNING id, username, email, created_at
        `;
        const result = await this.db.query(query, [id]);

        if (!result.rows || result.rows.length === 0) {
            throw new Error('User DELETE failed');
        }

        return result.rows[0];
    }
}
