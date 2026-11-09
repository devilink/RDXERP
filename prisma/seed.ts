/* Demo data: one super admin + two fully separate schools. Run: npm run db:seed */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Password@123";

function ymd(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}
// Deterministic pseudo-random so reseeding gives the same data.
let seed = 42;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const FIRST = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Reyansh", "Ananya", "Diya", "Saanvi", "Aadhya", "Kiara", "Rohan", "Arjun", "Meera", "Riya", "Kabir", "Zara", "Ayaan", "Neha", "Sara", "Dev", "Tara", "Aryan", "Isha", "Nikhil"];
const LAST = ["Sharma", "Das", "Ghosh", "Banerjee", "Gupta", "Roy", "Sen", "Patel", "Singh", "Mukherjee", "Chatterjee", "Bose", "Khan", "Verma"];

/** This script deletes every school, so refuse to run anywhere it could destroy real data. */
async function assertSafeToWipe() {
  const url = process.env.DATABASE_URL ?? "";
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (!local && process.env.ALLOW_DEMO_SEED !== "yes") {
    throw new Error('Refusing to seed a remote database. Set ALLOW_DEMO_SEED="yes" in .env only for a trial database.');
  }
  const real = await prisma.school.count({ where: { code: { notIn: ["greenwood", "sunrise"] } } });
  if (real > 0) throw new Error(`Refusing to seed: this database has ${real} non-demo school(s) that would be deleted.`);
}

async function main() {
  await assertSafeToWipe();
  console.log("Resetting database…");
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);

  await prisma.user.create({
    data: { name: "Platform Owner", email: "superadmin@radix.app", passwordHash: hash, role: "SUPER_ADMIN" },
  });

  await seedSchool({
    hash,
    name: "Greenwood High School",
    code: "greenwood",
    domain: "greenwood.edu",
    color: "#4f46e5",
    classes: ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"],
    sections: ["A", "B"],
    perSection: 8,
    center: [22.5726, 88.3639],
  });
  await seedSchool({
    hash,
    name: "Sunrise Public School",
    code: "sunrise",
    domain: "sunrise.edu",
    color: "#0d9488",
    classes: ["Class 1", "Class 2", "Class 3"],
    sections: ["A"],
    perSection: 6,
    center: [22.65, 88.43],
  });
  console.log(`\nDone. All demo passwords: ${PASSWORD}`);
}

async function seedSchool(o: {
  hash: string;
  name: string;
  code: string;
  domain: string;
  color: string;
  classes: string[];
  sections: string[];
  perSection: number;
  center: [number, number];
}) {
  console.log(`Seeding ${o.name}…`);
  const school = await prisma.school.create({
    data: { name: o.name, code: o.code, primaryColor: o.color, email: `office@${o.domain}`, phone: "+91 33 4000 1234", address: "12 Park Street, Kolkata", plan: "PREMIUM" },
  });
  const sid = school.id;
  const user = (name: string, email: string, role: string) =>
    prisma.user.create({ data: { schoolId: sid, name, email, role, passwordHash: o.hash } });

  await user("Principal " + o.name.split(" ")[0], `admin@${o.domain}`, "ADMIN");
  await user("Accounts Office", `accountant@${o.domain}`, "ACCOUNTANT");

  const year = await prisma.academicYear.create({
    data: { schoolId: sid, name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: true },
  });

  // Grade scale
  const grades = [
    ["A+", 90, 10, "Outstanding"], ["A", 80, 9, "Excellent"], ["B+", 70, 8, "Very Good"], ["B", 60, 7, "Good"],
    ["C", 50, 6, "Average"], ["D", 33, 5, "Pass"], ["F", 0, 0, "Needs Improvement"],
  ] as const;
  await prisma.gradeScale.createMany({ data: grades.map(([grade, minPercent, gradePoint, remark]) => ({ schoolId: sid, grade, minPercent, gradePoint, remark })) });

  // Subjects & teachers
  const subjectNames = ["English", "Mathematics", "Science", "Social Studies", "Hindi", "Computer"];
  const subjects = [];
  for (const [i, n] of subjectNames.entries()) {
    subjects.push(await prisma.subject.create({ data: { schoolId: sid, name: n, code: n.slice(0, 3).toUpperCase() + (100 + i) } }));
  }
  const teacherNames = ["Anita Roy", "Suresh Kumar", "Priya Sen", "Rahul Dutta", "Kavita Joshi", "Manoj Pal"];
  const teachers = [];
  for (const [i, n] of teacherNames.entries()) {
    const email = i === 0 ? `teacher@${o.domain}` : `teacher${i + 1}@${o.domain}`;
    const u = await user(n, email, "TEACHER");
    teachers.push(
      await prisma.staff.create({
        data: { schoolId: sid, userId: u.id, employeeNo: `EMP${101 + i}`, name: n, designation: `${subjectNames[i]} Teacher`, email, phone: `98300${10000 + i}`, joinDate: "2022-06-01", salary: 35000 + i * 1500 },
      }),
    );
  }
  await prisma.staff.create({ data: { schoolId: sid, employeeNo: "EMP200", name: "Accounts Office", designation: "Accountant", salary: 30000 } });

  // Transport: 2 routes, stops around the school, 2 buses with drivers
  const [clat, clng] = o.center;
  const stops = [];
  const vehicles = [];
  for (let r = 0; r < 2; r++) {
    const route = await prisma.busRoute.create({ data: { schoolId: sid, name: r === 0 ? "Route 1 — North" : "Route 2 — South", fare: 1200 } });
    for (let s = 0; s < 4; s++) {
      const dir = r === 0 ? 1 : -1;
      stops.push(
        await prisma.busStop.create({
          data: { schoolId: sid, routeId: route.id, name: `${r === 0 ? "North" : "South"} Stop ${s + 1}`, order: s + 1, lat: clat + dir * 0.012 * (s + 1), lng: clng + 0.006 * (s - 1.5), pickupTime: `07:${String(10 + s * 8).padStart(2, "0")}` },
        }),
      );
    }
    const driver = await user(r === 0 ? "Ramesh Yadav" : "Sunil Mondal", r === 0 ? `driver@${o.domain}` : `driver2@${o.domain}`, "DRIVER");
    vehicles.push(
      await prisma.vehicle.create({
        data: {
          schoolId: sid, regNo: `WB-0${r + 1}-${o.code.slice(0, 2).toUpperCase()}-${1000 + r * 111}`, model: "Tata Starbus", capacity: 40, routeId: route.id, driverId: driver.id,
          tripActive: r === 0, lastLat: clat + (r === 0 ? 0.02 : -0.015), lastLng: clng + 0.003, lastSpeed: 24, lastSeenAt: new Date(),
        },
      }),
    );
  }
  void vehicles;

  // Classes, sections, class-subjects, students, guardians
  const allStudents: { id: string; sectionId: string; classId: string }[] = [];
  const sectionsAll: { id: string; classId: string }[] = [];
  const classesAll = [];
  let adm = 1;
  let parentN = 0;
  for (const [ci, cname] of o.classes.entries()) {
    const klass = await prisma.class.create({ data: { schoolId: sid, name: cname, order: ci } });
    classesAll.push(klass);
    for (const [si, sub] of subjects.entries()) {
      await prisma.classSubject.create({ data: { schoolId: sid, classId: klass.id, subjectId: sub.id, teacherId: teachers[si].id } });
    }
    for (const [secI, sname] of o.sections.entries()) {
      const section = await prisma.section.create({
        data: { schoolId: sid, classId: klass.id, name: sname, room: `${100 + ci * 10 + secI}`, classTeacherId: teachers[(ci + secI) % teachers.length].id },
      });
      sectionsAll.push({ id: section.id, classId: klass.id });
      for (let k = 0; k < o.perSection; k++) {
        const first = pick(FIRST);
        const last = pick(LAST);
        parentN++;
        const isDemoFamily = parentN === 1;
        const pUser = await user(
          `Mr./Mrs. ${last}`,
          isDemoFamily ? `parent@${o.domain}` : `parent${parentN}@${o.domain}`,
          "PARENT",
        );
        const guardian = await prisma.guardian.create({
          data: { schoolId: sid, userId: pUser.id, name: pUser.name, relation: "Parent", phone: `9831${String(100000 + parentN)}`, email: pUser.email },
        });
        const sUser = isDemoFamily ? await user(`${first} ${last}`, `student@${o.domain}`, "STUDENT") : null;
        const st = await prisma.student.create({
          data: {
            schoolId: sid, userId: sUser?.id, admissionNo: `${o.code.slice(0, 2).toUpperCase()}${2026}${String(adm++).padStart(4, "0")}`,
            rollNo: k + 1, firstName: first, lastName: last, gender: rand() > 0.5 ? "M" : "F", dob: `20${12 - ci}-0${1 + (k % 9)}-1${k % 9}`,
            sectionId: section.id, guardianId: guardian.id, busStopId: k % 2 === 0 || isDemoFamily ? pick(stops).id : null, admittedOn: "2026-04-01",
            address: "Kolkata, West Bengal", bloodGroup: pick(["A+", "B+", "O+", "AB+"]),
          },
        });
        allStudents.push({ id: st.id, sectionId: section.id, classId: klass.id });
      }
    }
  }
  // Make the demo family's child ride Route 1 (the bus with an active trip).
  const demo = allStudents[0];
  await prisma.student.update({ where: { id: demo.id }, data: { busStopId: stops[1].id } });

  // Attendance: last 30 calendar days, skipping Sundays
  const att = [];
  for (let d = 60; d >= 1; d--) {
    const date = addDays(-d);
    if (new Date(date + "T00:00:00").getDay() === 0) continue;
    for (const s of allStudents) {
      const r = rand();
      att.push({ schoolId: sid, studentId: s.id, sectionId: s.sectionId, date, status: r < 0.86 ? "PRESENT" : r < 0.93 ? "ABSENT" : r < 0.97 ? "LATE" : "LEAVE" });
    }
  }
  await prisma.attendance.createMany({ data: att });

  // Exams: a completed, published one with marks, and an upcoming one with only a routine
  const done = await prisma.exam.create({ data: { schoolId: sid, academicYearId: year.id, name: "Half Yearly Examination", startDate: addDays(-40), endDate: addDays(-33), published: true } });
  const upcoming = await prisma.exam.create({ data: { schoolId: sid, academicYearId: year.id, name: "Annual Examination", startDate: addDays(14), endDate: addDays(21), published: false } });
  for (const klass of classesAll) {
    for (const [i, sub] of subjects.entries()) {
      const sc = await prisma.examSchedule.create({
        data: { schoolId: sid, examId: done.id, classId: klass.id, subjectId: sub.id, date: addDays(-40 + i), startTime: "10:00", endTime: "13:00", room: "Hall A", maxMarks: 100, passMarks: 33 },
      });
      await prisma.examSchedule.create({
        data: { schoolId: sid, examId: upcoming.id, classId: klass.id, subjectId: sub.id, date: addDays(14 + i), startTime: "10:00", endTime: "13:00", room: "Hall B", maxMarks: 100, passMarks: 33 },
      });
      const studs = allStudents.filter((s) => s.classId === klass.id);
      await prisma.mark.createMany({
        data: studs.map((s) => {
          const absent = rand() < 0.02;
          return { schoolId: sid, examScheduleId: sc.id, studentId: s.id, absent, marksObtained: absent ? null : Math.round(28 + rand() * 72) };
        }),
      });
    }
  }

  // Timetable: 6 days x 6 periods per section
  const times = [["08:00", "08:45"], ["08:45", "09:30"], ["09:30", "10:15"], ["10:30", "11:15"], ["11:15", "12:00"], ["12:00", "12:45"]];
  const slots = [];
  for (const sec of sectionsAll) {
    for (let day = 1; day <= 6; day++) {
      for (let p = 1; p <= 6; p++) {
        const si = (day + p + sec.id.length) % subjects.length;
        slots.push({ schoolId: sid, sectionId: sec.id, day, period: p, startTime: times[p - 1][0], endTime: times[p - 1][1], subjectId: subjects[si].id, teacherId: teachers[si].id });
      }
    }
  }
  await prisma.timetableSlot.createMany({ data: slots });

  // Fees: monthly tuition per class, invoices for last 2 months, most paid
  let inv = 1;
  let rec = 1;
  for (const [ci, klass] of classesAll.entries()) {
    const amount = 2500 + ci * 250;
    await prisma.feeStructure.create({ data: { schoolId: sid, classId: klass.id, name: "Monthly Tuition Fee", amount } });
    await prisma.feeStructure.create({ data: { schoolId: sid, classId: klass.id, name: "Annual Development Fee", amount: 6000 } });
    for (const s of allStudents.filter((x) => x.classId === klass.id)) {
      for (const [mi, month] of ["October 2026", "November 2026"].entries()) {
        const invoice = await prisma.feeInvoice.create({
          data: { schoolId: sid, invoiceNo: `INV-${String(inv++).padStart(5, "0")}`, studentId: s.id, title: `Monthly Tuition Fee — ${month}`, amount, dueDate: addDays(mi === 0 ? -20 : 10) },
        });
        const r = rand();
        if (mi === 0 ? r < 0.85 : r < 0.4) {
          await prisma.feePayment.create({
            data: { schoolId: sid, invoiceId: invoice.id, receiptNo: `RCP-${String(rec++).padStart(5, "0")}`, amount: r < 0.1 ? amount / 2 : amount, method: pick(["CASH", "UPI", "CARD", "BANK"]), paidOn: addDays(mi === 0 ? -22 : -2) },
          });
        }
      }
    }
  }

  // Notices, events, homework, library
  const admin = await prisma.user.findFirst({ where: { schoolId: sid, role: "ADMIN" } });
  await prisma.notice.createMany({
    data: [
      { schoolId: sid, title: "Annual Examination routine published", body: "The routine for the Annual Examination is now available in the portal. Please prepare accordingly.", audience: "ALL", createdById: admin?.id },
      { schoolId: sid, title: "Parent–Teacher Meeting", body: "PTM will be held this Saturday from 10 AM to 1 PM in respective classrooms.", audience: "PARENTS", createdById: admin?.id },
      { schoolId: sid, title: "Staff meeting", body: "All teaching staff to assemble in the conference room on Monday at 2 PM.", audience: "STAFF", createdById: admin?.id },
    ],
  });
  await prisma.schoolEvent.createMany({
    data: [
      { schoolId: sid, title: "Annual Sports Day", date: addDays(7), type: "EVENT", details: "Track and field events on the main ground." },
      { schoolId: sid, title: "Guru Nanak Jayanti", date: addDays(12), type: "HOLIDAY" },
      { schoolId: sid, title: "Parent–Teacher Meeting", date: addDays(3), type: "MEETING" },
      { schoolId: sid, title: "Winter Vacation", date: "2026-12-24", endDate: "2027-01-01", type: "HOLIDAY" },
    ],
  });
  for (const sec of sectionsAll) {
    await prisma.homework.create({ data: { schoolId: sid, sectionId: sec.id, subjectId: subjects[1].id, title: "Exercise 7.2 — Linear equations", description: "Solve questions 1 to 15 in your notebook.", dueDate: addDays(2) } });
    await prisma.homework.create({ data: { schoolId: sid, sectionId: sec.id, subjectId: subjects[0].id, title: "Essay: My favourite season", description: "300 words.", dueDate: addDays(4) } });
  }
  const books = [];
  for (const [t, a] of [["Wings of Fire", "A. P. J. Abdul Kalam"], ["The Jungle Book", "Rudyard Kipling"], ["Malgudi Days", "R. K. Narayan"], ["A Brief History of Time", "Stephen Hawking"]]) {
    books.push(await prisma.book.create({ data: { schoolId: sid, title: t, author: a, copies: 3 } }));
  }
  await prisma.bookIssue.create({ data: { schoolId: sid, bookId: books[0].id, studentId: allStudents[0].id, issuedOn: addDays(-5), dueOn: addDays(9) } });
  await prisma.bookIssue.create({ data: { schoolId: sid, bookId: books[1].id, studentId: allStudents[1].id, issuedOn: addDays(-20), dueOn: addDays(-6) } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
