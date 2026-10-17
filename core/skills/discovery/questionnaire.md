# Discovery questionnaire: <project>
For <owner/client>. Each question: what the requirements say, then the options lettered A, B, C with our recommendation first. Mark one (`[x] B`), or write your own under it; leave it unmarked to accept the recommendation (not possible for security, stack and architecture questions).

## 1. Users and roles
Who uses the product; every role and what it may and may not do; sign-up and invitation; who administers users.
## 2. Scope and priorities
What is in the first release (must), what comes later (should/could), what is out; milestones and dates.
## 3. Business rules
Rules, limits, calculations, state changes and approvals that the screens alone do not show.
## 4. Data
Main entities and their fields; what is required or unique; history and audit; retention and deletion; data to import at launch; personal data.
## 5. Integrations
Identity provider (own login, Keycloak, Microsoft, Google), email and SMS, payments, file storage, maps, partner APIs; who owns each account and key.
## 6. Libraries and licences
Libraries approved per stack (UI kit, forms, charts, PDF, validation…); licences that are not allowed; paid components.
## 7. Security and privacy
Login method, sessions, multi-factor; permissions per role and feature; audit log; personal-data rules and the law that applies; encryption; security review level (default OWASP ASVS Level 2).
## 8. Performance and scale
Users at launch and in a year; peak moments; response times; data volumes; availability and backups.
## 9. Languages and accessibility
Languages (Arabic, English), right-to-left, default language, translated content vs interface only; date, number and currency formats; accessibility level.
## 10. Stack
Frontend (React + TypeScript, Vite), backend (.NET 10, NestJS or FastAPI), database (PostgreSQL, SQL Server, MySQL/MariaDB, MongoDB), and for NestJS/FastAPI: entities with raw SQL for complex queries, or raw SQL only. One repo or separate frontend and backend repos. A mobile app is built in Flutter (decisions 101-112): phones only or tablets too; iOS, Android or both, and the oldest versions to support; who owns the Apple Developer and Google Play accounts; push notifications; use without a connection.
## 11. Hosting and environments
Docker containers (decision 26). Team defaults, record them and ask only for exceptions: local containers in Compose for development (decisions 70-72); branches `dev`, `staging`, `main` with promotions merged by a person (74); CI images pushed from `dev` (73). Ask: the Git host and CI (GitHub or GitLab); who may promote to `staging` and `main`; for later (staging comes with the next release): domains and certificates, where the containers will run, backups.
## 12. Design source
We design the screens in Figma, or you provide them: a Figma file, a PDF or image files (all screens and states; brand colours, fonts, logo). Provided screens are built in their exact style.
## 13. Delivery
Who approves what; how and when you test (staging, test users); definition of done; reporting (daily summary, demos).
