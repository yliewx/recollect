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