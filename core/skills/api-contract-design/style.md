# Team API style (defaults; a project's rules may override single items)

- **OpenAPI 3.1**, one spec file per API. `info.version` is semver; the approved version is the git tag `api-v<version>`.
- **URLs**: `/v<major>/<plural-resource>[/{id}[/<sub-resource>]]`, kebab-case path segments, plural nouns, no verbs. The URL major equals `info.version`'s major. Actions that are not CRUD: `POST /v1/orders/{orderId}/cancel`.
- **Methods**: GET reads, POST creates (201 + `Location`) or runs an action, PUT replaces, PATCH updates partially (JSON Merge Patch), DELETE removes (204). GET, PUT and DELETE are idempotent.
- **JSON fields**: camelCase. IDs are strings (opaque to clients). Nullable is `type: [string, "null"]` (3.1). Enums are UPPER_SNAKE_CASE strings.
- **Dates**: `type: string, format: date-time`, ISO 8601 in UTC with `Z`. Dates without a time: `format: date`.
- **Errors**: RFC 9457 problem details, media type `application/problem+json`, fields `type`, `title`, `status`, `detail`, `instance`. Validation errors add `errors: [{ field, message }]`. Every operation lists its 4xx responses: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 business rule, 429 rate limited.
- **Lists**: cursor pagination. Query `limit` (default 20, max 100) and `cursor`; response `{ "items": [...], "nextCursor": "..." | null }`. Filters are plain query parameters; sorting is `sort=field,-other`.
- **Security**: schemes in `components.securitySchemes`; a global `security` requirement; public operations say `security: []` on purpose.
- **Operations**: a unique camelCase `operationId` (`listOrders`, `getOrder`, `createOrder`), a `summary`, one tag per resource. Shared shapes go in `components.schemas`, never inline duplicates.
