# Recollect

A web-based **photo organizer application** that allows users to organize, search, and manage photo collections by tags and captions. It is designed for efficient querying at scale, supporting cursor-based pagination and full-text search.

## Instructions

### Prerequisites
Ensure the following tools are installed on your system:
- Docker
- Docker Compose
- Git

### How to run
1. Create a `.env` file at the project root (based on the `.env.sample`)
2. Start all services:
```bash
make
```
- Note: On the first startup and creation of the database, please allow up to a few minutes for the seeds scripts to finish running.
3. View the Swagger UI here:
```bash
http://localhost:3000/docs
```

## Project Structure
```bash
├── Makefile
├── backend/
│   ├── Dockerfile # production mode
│   ├── Dockerfile.dev # for testing
│   ├── package-lock.json
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/ # contains backend source code
│   │   ├── app.ts
│   │   ├── controllers/
│   │   ├── generated/
│   │   ├── models/
│   │   ├── plugins/
│   │   ├── routes/
│   │   ├── server.ts # entrypoint
│   │   ├── services/
│   │   └── types/
│   ├── test/ # unit tests
│   └── tsconfig.json
├── docker-compose.dev.yml # for testing
├── docker-compose.yml # production mode
└── postgres/
    └── init/ # contains files for initialising database
        ├── schema.sql
        └── seeds.sql
```

## Core Features

- **Photo storage**
  - Photos are saved to the filesystem under unique filenames (UUIDs)
  - File paths are stored in the database and served via generated URLs

- **Album management**
  - Create, rename, delete, and restore deleted albums
  - Add or remove photos from albums

- **Tag-based organization**
  - Assign multiple tags to photos
  - Update tags incrementally (insert/remove)

- **Caption support**
  - Add or update photo captions
  - Perform full-text search on captions

- **Search & filtering**
  - Filter photos by tags
  - Search captions using full-text search
  - Combine tag and caption filters
  - Cursor-based pagination for scalable browsing

## Tech Stack
- PostgreSQL
- Redis
- Fastify + Prisma
- Swagger UI
- Docker Compose

---

## API Overview

### Users

| Method | Endpoint | Description |
|------|--------|------------|
| POST | `/users` | Create a new user |
| DELETE | `/users` | Delete the authenticated user |

---

### Albums

| Method | Endpoint | Description |
|------|--------|------------|
| POST | `/albums` | Create a new album |
| GET | `/albums` | List all albums for the user |
| PATCH | `/albums/:id` | Rename an album |
| DELETE | `/albums/:id` | Soft-delete an album |
| PATCH | `/albums/:id/restore` | Restore a deleted album |
| GET | `/albums/:id/photos` | List photos in an album (supports filtering & search) |
| POST | `/albums/:id/photos` | Add photos to an album |
| DELETE | `/albums/:id/photos` | Remove photos from an album |

---

### Photos

| Method | Endpoint | Description |
|------|--------|------------|
| POST | `/photos` | Upload one or more photos |
| GET | `/photos` | List photos (supports filtering & search) |
| DELETE | `/photos/:id` | Soft-delete a photo |
| PATCH | `/photos/:id/restore` | Restore a deleted photo |
| PATCH | `/photos/:id/tags` | Update photo tags |
| PATCH | `/photos/:id/caption` | Update photo caption |

---

## Uploading Photos

Photos are uploaded using `multipart/form-data`.

- Supports multiple files per request
- Optional metadata (caption + tags) is provided as a JSON string
- Metadata must match the order of uploaded files

Example metadata payload:

```json
[
  { "caption": "Sunset at the beach", "tags": ["sunset", "travel"] },
  { "caption": "City skyline", "tags": ["city", "night"] }
]
