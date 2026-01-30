/**========================================================================
 * *                  TYPE DECLARATIONS: DATABASE MODELS
 *========================================================================**/

// aliases for prisma-generated types
export type User = import('@/generated/prisma/client.js').users;
export type Photo = import('@/generated/prisma/client.js').photos;
export type Album = import('@/generated/prisma/client.js').albums;
export type Tag = import('@/generated/prisma/client.js').tags;
export type Caption = import('@/generated/prisma/client.js').captions;
export type PhotoTag = import('@/generated/prisma/client.js').photo_tags;
