import { FastifyInstance } from 'fastify';
import { PhotoModel } from '@/models/photo.model.js';
import { PhotoController } from '@/controllers/photo.controller.js';

export async function photoRoutes(app: FastifyInstance) {
  const photoModel = new PhotoModel(app.db);
  const photoController = new PhotoController(photoModel);

  app.post('/photos', photoController.upload.bind(photoController));
}
