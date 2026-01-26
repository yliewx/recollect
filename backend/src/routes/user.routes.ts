import { FastifyInstance } from 'fastify';
import { UserModel } from '@/models/user.model.js';
import { UserController } from '@/controllers/user.controller.js';
import userContext from '@/plugins/user.context.js';

export async function userRoutes(app: FastifyInstance) {
    const userModel = new UserModel(app.prisma);
    const userController = new UserController(userModel);

    // public
    app.post('/users', userController.create.bind(userController));

    // protected
    app.register(async function protectedUserRoutes(app) {
        app.register(userContext);

        app.delete('/users/me', userController.delete.bind(userController));
    });
}
