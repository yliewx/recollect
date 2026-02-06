// import { idParamSchema } from "./photo.schema.js";

// const Album = {
//   $id: 'Album',
//   type: 'object',
//   properties: {
//     id: { type: 'string' },
//     user_id: { type: 'string' },
//     title: { type: 'string', minLength: 1, maxLength: 30 },
//     created_at: { type: 'string' },
//     updated_at: { type: 'string' },
//     deleted_at: { anyOf: [{ type: 'string' }, { type: 'null' }] },
//   },
//   required: ['id', 'user_id', 'title', 'created_at', 'updated_at'],
//   additionalProperties: true,
// } as const;

// const Photo = {
//   $id: 'Photo',
//   type: 'object',
//   properties: {
//     id: { type: 'string' },
//     user_id: { type: 'string' },
//     file_path: { type: 'string' },
//     uploaded_at: { type: 'string' },
//     deleted_at: { anyOf: [{ type: 'string' }, { type: 'null' }] },
//     caption: { anyOf: [{ type: 'string' }, { type: 'null' }] },
//     tags: { type: 'array', items: { type: 'string' } },
//     url: { type: 'string', format: 'uri' },
//   },
//   required: ['id', 'user_id', 'file_path', 'uploaded_at', 'tags', 'url'],
//   additionalProperties: true,
// } as const;

// const AlbumIdParams = {
//   $id: 'AlbumIdParams',
//   type: 'object',
//   properties: {
//     id: { type: 'string', minLength: 1, maxLength: 20 },
//   },
//   required: ['id'],
//   additionalProperties: false,
// } as const;

// // -------------------------
// // Route-specific schemas
// // -------------------------

// export const getAlbumPhotosSchema = {
//   tags: ['Albums'],
//   summary: 'List photos in an album',
//   description:
//     'Returns photos inside the album. Supports optional tag and caption search, and cursor pagination.',
//   params: { $ref: 'AlbumIdParams#' },
//   querystring: {
//     type: 'object',
//     properties: {
//       tag: {
//         type: 'string',
//         description: 'Comma-separated tags (e.g. "travel,sunset")',
//       },
//       caption: {
//         type: 'string',
//         description: 'Caption full-text search string',
//       },
//       match: {
//         type: 'string',
//         enum: ['any', 'all'],
//         default: 'any',
//         description: 'How to match multiple tags',
//       },
//       limit: {
//         type: 'integer',
//         minimum: 1,
//         maximum: 50,
//         default: 20,
//       },
//       cursor_rank: {
//         type: 'number',
//         description: 'Only applicable for caption FTS pagination',
//       },
//       cursor_id: {
//         type: 'string',
//         description: 'Photo id cursor (or id in cursor object)',
//       },
//     },
//     additionalProperties: false,
//   },
//   response: {
//     200: {
//       type: 'object',
//       properties: {
//         photos: { type: 'array', items: { $ref: 'Photo#' } },
//         nextCursor: { anyOf: [{ $ref: 'Cursor#' }, { type: 'null' }] },
//       },
//       required: ['photos', 'nextCursor'],
//       additionalProperties: false,
//     },
//     400: { $ref: 'ErrorResponse#' },
//     401: { $ref: 'ErrorResponse#' },
//     404: { $ref: 'ErrorResponse#' },
//   },
// } as const;

// export const createAlbumSchema = {
//   tags: ['Albums'],
//   summary: 'Create an album',
//   body: {
//     type: 'object',
//     properties: {
//       title: { type: 'string', minLength: 1, maxLength: 30 },
//     },
//     required: ['title'],
//     additionalProperties: false,
//   },
//   response: {
//     201: {
//       type: 'object',
//       properties: {
//         album: { $ref: 'Album#' },
//       },
//       required: ['album'],
//       additionalProperties: false,
//     },
//     400: { $ref: 'ErrorResponse#' },
//     401: { $ref: 'ErrorResponse#' },
//   },
// } as const;

// export const listAlbumsSchema = {
//   tags: ['Albums'],
//   summary: 'List user albums',
//   response: {
//     200: {
//       type: 'object',
//       properties: {
//         albums: { type: 'array', items: { $ref: 'Album#' } },
//       },
//       required: ['albums'],
//       additionalProperties: false,
//     },
//     401: { $ref: 'ErrorResponse#' },
//   },
// } as const;

// export const addAlbumPhotosSchema = {
//   tags: ['Albums'],
//   summary: 'Add photos to album',
//   params: { $ref: 'AlbumIdParams#' },
//   body: {
//     type: 'object',
//     properties: {
//       photo_ids: {
//         type: 'array',
//         items: { type: 'string', minLength: 1, maxLength: 20 },
//         minItems: 1,
//         maxItems: 100,
//       },
//     },
//     required: ['photo_ids'],
//     additionalProperties: false,
//   },
//   response: {
//     200: {
//       type: 'object',
//       properties: {
//         added: { type: 'integer' },
//       },
//       required: ['added'],
//       additionalProperties: false,
//     },
//     400: { $ref: 'ErrorResponse#' },
//     401: { $ref: 'ErrorResponse#' },
//     404: { $ref: 'ErrorResponse#' },
//   },
// } as const;

// export const deleteAlbumPhotosSchema = {
//   tags: ['Albums'],
//   summary: 'Remove photos from album',
//   params: { $ref: 'AlbumIdParams#' },
//   body: {
//     type: 'object',
//     properties: {
//       photo_ids: {
//         type: 'array',
//         items: { type: 'string', minLength: 1, maxLength: 20 },
//         minItems: 1,
//         maxItems: 100,
//       },
//     },
//     required: ['photo_ids'],
//     additionalProperties: false,
//   },
//   response: {
//     200: {
//       type: 'object',
//       properties: {
//         removed: { type: 'integer' },
//       },
//       required: ['removed'],
//       additionalProperties: false,
//     },
//     400: { $ref: 'ErrorResponse#' },
//     401: { $ref: 'ErrorResponse#' },
//     404: { $ref: 'ErrorResponse#' },
//   },
// } as const;

// export const deleteAlbumSchema = {
//   tags: ['Albums'],
//   summary: 'Delete album',
//   params: { $ref: 'AlbumIdParams#' },
//   response: {
//     200: {
//       type: 'object',
//       properties: {
//         deleted: { type: 'boolean' },
//       },
//       required: ['deleted'],
//       additionalProperties: false,
//     },
//     401: { $ref: 'ErrorResponse#' },
//     404: { $ref: 'ErrorResponse#' },
//   },
// } as const;

// export const restoreAlbumSchema = {
//   tags: ['Albums'],
//   summary: 'Restore deleted album',
//   params: { $ref: 'AlbumIdParams#' },
//   response: {
//     200: {
//       type: 'object',
//       properties: {
//         restored: { type: 'boolean' },
//       },
//       required: ['restored'],
//       additionalProperties: false,
//     },
//     401: { $ref: 'ErrorResponse#' },
//     404: { $ref: 'ErrorResponse#' },
//   },
// } as const;

// export const renameAlbumSchema = {
//   tags: ['Albums'],
//   summary: 'Rename album',
//   params: { $ref: 'AlbumIdParams#' },
//   body: {
//     type: 'object',
//     properties: {
//       title: { type: 'string', minLength: 1, maxLength: 30 },
//     },
//     required: ['title'],
//     additionalProperties: false,
//   },
//   response: {
//     200: {
//       type: 'object',
//       properties: {
//         album: { $ref: 'Album#' },
//       },
//       required: ['album'],
//       additionalProperties: false,
//     },
//     400: { $ref: 'ErrorResponse#' },
//     401: { $ref: 'ErrorResponse#' },
//     404: { $ref: 'ErrorResponse#' },
//   },
// } as const;

// // Export the "shared models" too
// export const sharedSchemas = {
//   ErrorResponse,
//   Cursor,
//   Album,
//   Photo,
//   AlbumIdParams,
// } as const;
