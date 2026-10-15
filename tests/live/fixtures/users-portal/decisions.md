# Decision register: Users portal

| ID | Category | Decision | Source | For the agents |
|---|---|---|---|---|
| D-001 | Users and roles | One role in release 1: the administrator, who manages the portal's users. | owner 2026-10-08 | |
| D-002 | Scope | Release 1: list, create and view users. Later: suspend users. | owner 2026-10-08 | Suspension is not in release 1 |
| D-003 | Business rules | An email address identifies one user regardless of letter case: `Ana@Example.com` and `ana@example.com` are the same user. Emails are stored in lowercase. | owner 2026-10-08 | A second user with the same email in any case: 409 |
| D-004 | Business rules | A display name has 1 to 100 characters after trimming spaces at both ends; a name of only spaces is invalid. Stored trimmed. | owner 2026-10-08 | API answers 400 with the field `displayName` |
| D-005 | Stack | Backend FastAPI (Python 3.13) with PostgreSQL 17; a React frontend comes in release 2. | owner 2026-10-08 | Skills `stack-fastapi`, `db-postgresql` |
| D-006 | Hosting and delivery | Local containers for development (team decisions 70-74); GitLab with GitLab CI; branches dev, staging, main. | owner 2026-10-08 | |
| D-007 | Data | Lists never skip or repeat a user while new users are added. | owner 2026-10-08 | Cursor pagination (team style) |
| D-008 | Performance | Listing users answers within 300 ms (p95) at 10 requests per second. | owner 2026-10-08 | |
| D-009 | Languages | API error messages in English. | owner 2026-10-08 | |
| D-010 | Security | Internal tool behind the company VPN; authentication is out of scope for release 1 (owner accepts the risk); OWASP ASVS Level 2 otherwise. | owner 2026-10-08 | |
| D-011 | Libraries | No new libraries in release 1 beyond the stack guide's. | owner 2026-10-08 | |
