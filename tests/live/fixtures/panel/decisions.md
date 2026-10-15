# Decision register: Team lunch poll

| Id | Category | Decision |
|---|---|---|
| D-001 | Scope | One office team picks a lunch place by voting in a poll. Nothing else: no orders, no payments. |
| D-002 | Roles | Two roles: the organiser, who creates and closes polls, and the voter. Anyone with the poll's link can vote. |
| D-003 | Identity | No sign-in. The organiser is recognised by a secret link given when the poll is created. A voter is recognised by a random voter id the browser keeps in a cookie. |
| D-004 | Rule | One vote per voter per poll. A voter may change the vote while the poll is open. |
| D-005 | Rule | A poll has 2 to 8 options and a closing time. It closes at that time, or earlier when the organiser closes it. Closed polls show the result. |
| D-006 | Data | Polls are kept 30 days after closing, then deleted with their votes. No personal data is collected. |
| D-007 | Stack | NestJS 12 + MongoDB 8.0 for the API, React + TypeScript (Vite) for the web app, one repository with backend/ and frontend/. |
| D-008 | Hosting | Runs on the company's existing Linux server with Docker Compose, behind its reverse proxy. |
| D-009 | Language | English only, left to right. |
| D-010 | Volume | Up to 50 voters per poll, about 5 polls a week. |
