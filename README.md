# Radix School ERP

A multi-school (SaaS) school management system. One deployment serves many schools; every school's data is fully isolated.

## Quick start

The app runs on Postgres, hosted on Supabase.

1. Create a Supabase project (choose the region closest to your schools, such as Mumbai).
2. In `.env`, paste the two connection strings described in `.env.example`.
3. Set up the database and create your owner account:

```bash
npm install
npm run db:deploy                                 # creates the tables and locks them against Supabase's public API
npm run db:create-admin -- you@yourcompany.com    # prints your password once
npm run dev                                       # http://localhost:3000
```

Always change the schema with a Prisma migration followed by `npm run db:deploy`, which re-applies the table lockdown.

### Demo data (trial databases only)

`npm run db:seed` **deletes every school** and loads demo data. It refuses to run unless the database is on localhost or `ALLOW_DEMO_SEED="yes"` is in `.env`, and it always refuses if a non-demo school exists.

## Demo logins (password for all: `Password@123`)

| Role | Email |
|---|---|
| Platform super admin (you, the vendor) | `superadmin@radix.app` |
| School admin | `admin@greenwood.edu` |
| Teacher | `teacher@greenwood.edu` |
| Accountant | `accountant@greenwood.edu` |
| Parent | `parent@greenwood.edu` |
| Student | `student@greenwood.edu` |
| Bus driver | `driver@greenwood.edu` |
| Second school's admin | `admin@sunrise.edu` (same roles exist under `@sunrise.edu`) |

## Modules

| Module | What it does | Who uses it |
|---|---|---|
| **Platform console** (`/super`) | Onboard schools and create their first admin, set plan and student limit, suspend or reactivate a school, reset an admin's password, see estimated revenue | Super admin |
| **Dashboard** | Different for each role: key numbers, today's attendance, fee collection, the teacher's periods, the child's summary | Everyone |
| **Classes & Subjects** | Academic years, classes, sections, class teachers, subjects, which teacher teaches what, grading scale | Admin |
| **Students** | Admission, guardians (siblings share a guardian by phone), parent and student logins, profile, search, promote or graduate a whole section | Admin, Teacher, Accountant |
| **Staff** | Staff records, login roles (Teacher, Accountant, Driver, Admin), deactivate, reset password, payroll total | Admin |
| **Attendance** | Marks a whole section in one tap per student (Present / Absent / Late / Leave), with holiday/Sunday warnings. Teachers can only mark their own sections. Monthly register with flags for students under 75%, and a summary per section | Admin, Teacher |
| **Exams & Results** | Create exams; build the routine by hand (with clash detection) or generate it automatically (skips Sundays and holidays); enter marks (`AB` = absent); tabulation sheet with ranks; subject analysis; printable report cards; publish or unpublish results | Admin, Teacher |
| **Timetable** | Weekly grid for each section, a teacher's own timetable, warning when a teacher is double-booked | All |
| **Fees** | Fee heads per class, bulk invoicing (safe to re-run), single invoices, part payments, printable receipts, defaulter list, daily and monthly collection | Admin, Accountant |
| **Transport** | Routes, stops (latitude/longitude), vehicles, drivers, which students ride which stop | Admin |
| **Live bus tracking** | The driver's phone shares GPS while on a trip (`/app/driver`). Admins and parents watch a live map with the bus, its 30-minute trail, the route and the child's stop, plus distance and an ETA | Driver, Admin, Parent, Student |
| **Parent/Student portal** (`/app/my`) | Attendance calendar, results, report cards, exam routine, fees, homework, library books and bus status, for each child | Parent, Student |
| **Homework, Notices, Calendar, Library** | Homework for each section, notices targeted at a chosen audience, holidays and events, issuing and returning books | Various |

## Architecture

- **Next.js 16** (App Router, Server Components, Server Actions) + **Tailwind CSS 4**
- **Prisma 6** on **Supabase Postgres**. The app connects as the table owner through the pooler. Row-level security is on for every table with no policies, and Supabase's API roles have no access (`prisma/secure.sql`), so the database cannot be reached with a Supabase API key.
- **Auth**: bcrypt-hashed passwords and a signed httpOnly JWT cookie (`SESSION_SECRET`). The user is re-checked against the database on every request, so disabling a user or suspending a school takes effect immediately. Five failed sign-ins lock an email for 15 minutes; 50 lock an IP address.
- **Multi-tenancy**: every tenant table has a `schoolId`. Application code reaches school data only through `tenantDb(schoolId)` (`src/lib/db.ts`), and the `schoolId` comes from the session. `tenantDb` forces that school onto every `where`, `create` and `upsert`, so an ID taken from another school returns "not found". IDs that arrive in forms (section, stop, teacher and so on) are checked against the school before they are written.
- **Maps**: Leaflet with OpenStreetMap tiles, so no API key is needed. Live positions are polled every 5 s from `/api/transport/positions`, and drivers post to `/api/transport/ping`.

## Going to production

1. Set `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` (a new long random string) and `APP_TIMEZONE` on the host. `APP_TIMEZONE` defaults to `Asia/Kolkata` and decides "today" for attendance, overdue fees and daily collections. Per-school timezones are on the roadmap.
2. Host the app in the same region as the database, because each page makes several database calls.
3. Serve the site over HTTPS. Browsers only give GPS to the driver page on a secure origin (`https://` or `localhost`). Opening it on a phone through a LAN IP such as `http://192.168.x.x` will be blocked.
4. Run `npm run db:deploy` and `npm run db:create-admin`, then create real schools from `/super`. Do not seed demo data.
5. Pricing used for the revenue estimate is in `src/app/super/page.tsx` (`PRICE`).

## Not included yet (suggested roadmap)

- Online fee payment gateway (Razorpay / Stripe), SMS/WhatsApp/email notifications for absences, dues and bus arrival
- Native driver app with background GPS. The web page has to stay open with the screen on.
- Document uploads (birth certificate, photos), ID card printing, certificates (TC, bonafide)
- Staff attendance, leave, and a full payroll with payslips
- Online admission enquiries, hostel, inventory, and data import from Excel
- Audit log and two-factor authentication for admins
