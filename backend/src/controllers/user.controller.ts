import { UserModel } from '@/models/user.model.js';
import { User } from "@/types/models.js";
import { FastifyReply, FastifyRequest } from "fastify";

export class UserController {
    constructor(private userModel: UserModel) {}

    // POST /users
    async create(request: FastifyRequest, reply: FastifyReply) {
        const { username, email } = request.body as any;
        if (!username || !email) {
            return reply.sendError('User details not found in request');
        }

        try {
            const newUser = await this.userModel.create(username, email);
            console.log('created newUser:', newUser);

            return reply.status(201).send({ user: newUser });
        } catch (err) {
            console.error('Error in UserController.create:', err);
            return reply.sendError(err);
        }
    }

    // DELETE /me
    async delete(request: FastifyRequest, reply: FastifyReply) {
        const user_id = request.user.id;

        try {
            const response = await this.userModel.delete(user_id);
            console.log('deleted user:', response);

            return reply.status(200).send({ success: true });
        } catch (err) {
            console.error('Error in UserController.delete:', err);
            return reply.sendError(err);
        }
    }
}