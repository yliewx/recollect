/**========================================================================
 * *                  TYPE DECLARATIONS: DATABASE MODELS
 *========================================================================**/

export interface User {
    id: number;
    username: string;
    email: string;
    created_at: string;
}

export interface Album {
    id: number;
    user_id: number;
    title: string;
    created_at: string;
    deleted_at: string | null;
}

export interface Photo {
    id: number;
    user_id: number;
    file_path: string;
    caption: string | null;
    uploaded_at: string;
    deleted_at: string;
}

export interface Tags {
    id: number;
    name: string;
}
