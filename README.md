## Instructions

### Prerequisites
Ensure the following tools are installed on your system:
- Docker
- Docker Compose
- Git

### How to run
1. Create a `.env` file at the project root
2. Start all services:
```bash
make
```
- OR run tests in development mode:
```bash
make test
```
- view test output:
```bash
docker logs backend
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
│   ├── test/ # unit tests
│   └── tsconfig.json
├── docker-compose.dev.yml # for testing
├── docker-compose.yml # production mode
└── postgres/
    └── init/ # contains files for initialising database
        ├── schema.sql
        └── seeds.sql
```