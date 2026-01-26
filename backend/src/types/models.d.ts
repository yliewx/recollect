/**========================================================================
 * *                  TYPE DECLARATIONS: DATABASE MODELS
 *========================================================================**/

// aliases for prisma-generated types
export type User = import('@/generated/prisma/client.js').users;
export type Photo = import('@/generated/prisma/client.js').photos;
export type Album = import('@/generated/prisma/client.js').albums;
export type Tag = import('@/generated/prisma/client.js').tags;
export type Caption = import('@/generated/prisma/client.js').captions;

// export interface User {
//     id: number;
//     username: string;
//     email: string;
//     created_at: string;
// }

// export interface Album {
//     id: number;
//     user_id: number;
//     title: string;
//     created_at: string;
//     deleted_at: string | null;
// }

// export interface Photo {
//     id: number;
//     user_id: number;
//     file_path: string;
//     caption: string | null;
//     uploaded_at: string;
//     deleted_at: string | null;
// }

// export interface Tags {
//     id: number;
//     name: string;
// }
