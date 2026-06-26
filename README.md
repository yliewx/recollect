# Recollect

A **photo organiser application** that allows users to organize, search, and manage photo collections by tags and captions. It is designed for efficient querying at scale, supporting cursor-based pagination and full-text search. The mobile client (React Native/Expo) references photos by their local device asset identifier rather than uploading files; the backend stores metadata (captions, tags, albums) without accessing the actual image bytes.

## Instructions

### Prerequisites
Ensure the following tools are installed on your system:
- Docker
- Docker Compose
- Git
- Node.js (for the mobile client)
- Xcode + iOS Simulator (for running the mobile client on iOS)

### Running the backend
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

### Running the mobile client

```bash
cd mobile
npm install
npm run ios
```

On first launch: grant photo library access, then use "Import Photos" to register a few photos from the device's library before the Library screen will show anything.

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
├── mobile/ # React Native (Expo) mobile client
│   ├── App.tsx # entrypoint
│   ├── app.json
│   ├── package.json
│   └── src/
│       ├── api/ # typed backend client (client.ts, photos.ts, users.ts, types.ts)
│       ├── components/
│       ├── hooks/
│       ├── navigation/
│       ├── screens/
│       └── theme/
├── docker-compose.dev.yml # for testing
├── docker-compose.yml # production mode
└── postgres/
    └── init/ # contains files for initialising database, run in order
        ├── 001_pg_stat_statements.sql
        ├── 01_schema.sql
        ├── 02_triggers.sql
        ├── 03_seeds_bulk.sql
        └── 04_seeds.sql
```

## Core Features

- **Photo registration**
  - Photos are referenced by the device's local asset identifier (e.g. iOS `PHAsset` id), not uploaded
  - Single-device prototype scope: an `asset_id` only resolves on the device it was registered from

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
- React Native + Expo (mobile client)

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
| POST | `/photos` | Register one or more photos by local device `asset_id` |
| GET | `/photos` | List photos (supports filtering & search) |
| DELETE | `/photos/:id` | Soft-delete a photo |
| PATCH | `/photos/:id/restore` | Restore a deleted photo |
| PATCH | `/photos/:id/tags` | Update photo tags |
| PATCH | `/photos/:id/caption` | Update photo caption |

---

## Registering Photos

Photos are registered by local device `asset_id`, not uploaded.

- Supports multiple assets per request
- Each item can optionally include a caption and tags
- Already-registered `asset_id`s for the user are skipped, not duplicated

Example request body:

```json
{
  "items": [
    { "asset_id": "48F3C1B2-...-IMG_0421.HEIC/L0/001", "caption": "Sunset at the beach", "tags": ["sunset", "travel"] },
    { "asset_id": "9A21EE4F-...-IMG_0422.HEIC/L0/001", "caption": "City skyline", "tags": ["city", "night"] }
  ]
}
```
