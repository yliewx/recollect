import { User } from "@/types/models.js";
import { Pool } from "pg";

export class UserModel {
    constructor(private db: Pool) {}

    async create(username: string, email: string): Promise<User> {
        const query = `
            INSERT INTO users (username, email)
            VALUES ($1, $2)
            RETURNING *
        `;
        const values = [username, email];

        const result = await this.db.query(query, values);
        return result.rows[0];
    }
}
