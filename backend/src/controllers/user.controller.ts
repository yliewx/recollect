import { UserModel } from '@/models/user.model.js';
import { User } from "@/types/models.js";
import { FastifyReply, FastifyRequest } from "fastify";

export class UserController {
    constructor(private userModel: UserModel) {}

    // POST /users
    async create(request: FastifyRequest, reply: FastifyReply) {
        const { username, email } = request.body as any;

        try {
            const newUser = await this.userModel.create(username, email);
            console.log('create newUser:', newUser);
            return reply.status(201).send({
                newUser: newUser
            });
        } catch (err) {
            console.error('Error in UserController.create:', err);
            return reply.status(400).send({
                success: false,
                error: err
            });
        }
    }
}