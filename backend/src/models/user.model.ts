import { User } from "@/types/models.js";
import { PrismaClient } from '@/generated/prisma/client.js';

export class UserModel {
    constructor(private prisma: PrismaClient) {}

    async create(username: string, email: string): Promise<User> {
        return await this.prisma.users.create({
            data: { username, email }
        });
    }

    async delete(id: bigint): Promise<User> {
        return await this.prisma.users.delete({
            where: { id }
        });
    }
}
