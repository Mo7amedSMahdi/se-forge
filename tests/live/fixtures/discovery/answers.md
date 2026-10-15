# Discovery questionnaire: clinic booking (filled in by the owner)

## 1. Users and roles
Patients (self sign-up with email), receptionists and one administrator. Receptionists and the administrator are invited by the administrator. Patients see only their own appointments.
## 2. Scope and priorities
Release 1: features 1-5 of the requirements. Later: SMS reminders, payments. Out: video consultations.
## 3. Business rules
Slots are 20 minutes inside a doctor's working hours. A patient may hold at most 2 future appointments. Cancelling is allowed until 2 hours before the start; receptionists may cancel any time. No double booking of a slot.
## 4. Data
Patients (name, email, phone), doctors (name, speciality), working hours per weekday, appointments (patient, doctor, start, status: BOOKED, CANCELLED). Keep cancelled appointments for 2 years. Personal data: name, email, phone.
## 5. Integrations
Own login (email and password). Email for sign-up confirmation through an SMTP account the clinic owns. No payments.
## 6. Libraries and licences
Frontend: react-hook-form, zod, @tanstack/react-query, i18next, react-i18next. Backend: httpx, pydantic-settings, argon2-cffi. No GPL libraries.
## 7. Security and privacy
Email and password, sessions expire after 30 minutes idle, no multi-factor in release 1. Permissions as in section 1. Audit log of bookings and cancellations (who, when). Jordanian personal-data rules; data stays in the clinic's own server. OWASP ASVS Level 2.
## 8. Performance and scale
About 2,000 patients, 6 doctors, peaks at 9:00 on weekdays (about 50 people at once). Pages answer within 1 second. Daily backups.
## 9. Languages and accessibility
Arabic (default, right-to-left) and English, interface only. Dates as day/month/year, 24-hour time, Amman time zone. WCAG 2.1 AA.
## 10. Stack
Frontend React + TypeScript with Vite; backend FastAPI; database PostgreSQL. ORM with raw SQL for complex queries. One repository.
## 11. Hosting and environments
Docker containers on the clinic's own server; staging and production; the owner deploys to production. GitLab with GitLab CI.
## 12. Design source
Images: the two attached screens (appointment list, booking form). Brand colour as in the screens.
## 13. Delivery
The owner approves; tests on staging with test users; a daily summary.
