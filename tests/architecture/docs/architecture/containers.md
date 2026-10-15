# Containers: Users portal

The portal's deployable parts and how they talk (C4 level 2). Each container is one image built from
its repository's Dockerfile; locally they run in Docker Compose (decisions 70-72).

```mermaid
C4Container
  title Containers: Users portal
  Person(admin, "Administrator")
  Container_Boundary(portal, "Users portal") {
    Container(web, "Web app", "React, Vite; served by Caddy", "Pages and forms in Arabic and English")
    Container(api, "API", "FastAPI, Python 3.13", "The users contract, OpenAPI 3.1, /v1")
    ContainerDb(db, "Database", "PostgreSQL 17", "Users")
  }
  Rel(admin, web, "Uses", "HTTPS")
  Rel(web, api, "Calls /v1 through Caddy's proxy", "JSON over HTTP")
  Rel(api, db, "Reads and writes", "SQL, asyncpg")
```

| Container | Image | Reaches |
|---|---|---|
| Web app | `caddy:2-alpine` with the built app | the API, through `/v1` |
| API | `python:3.13-slim-bookworm` with the app | the database |
| Database | `postgres:17-alpine` | nothing |
