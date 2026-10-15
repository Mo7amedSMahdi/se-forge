# Decision register: clinic booking
| ID | Category | Decision | Source | For the agents |
|---|---|---|---|---|
| D-004 | Scope | Release 1: sign-up, booking, my appointments, reception schedule, doctors' hours. Later: SMS reminders, payments. | owner 2026-10-07 | SMS is not in release 1 |
| D-012 | Business rules | No double booking of a slot; at most 2 future appointments per patient. | owner 2026-10-07 | API answers 409 |
| D-019 | Performance | Pages answer within 1 second for 50 people at once. | owner 2026-10-07 | |
