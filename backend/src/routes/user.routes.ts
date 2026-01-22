import { FastifyInstance } from 'fastify';
import { UserModel } from '@/models/user.model.js';
import { UserController } from '@/controllers/user.controller.js';

export async function userRoutes(app: FastifyInstance) {
  const userModel = new UserModel(app.db);
  const userController = new UserController(userModel);

  app.post('/users', userController.create.bind(userController));
}
