// Fills one existing, empty school with realistic dummy data. It only inserts rows,
// runs in a single transaction, and refuses to touch a school that already has students.
// Usage: npx tsx scripts/seed-dummy-school.ts <school-code>
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const code = process.argv[2]?.trim();
if (!code) {
  console.error("Usage: npx tsx scripts/seed-dummy-school.ts <school-code>");
  process.exit(1);
}

const prisma = new PrismaClient();

// Deterministic pseudo-random, so the data is reproducible.
let state = 2026;
function rand() {
  state = (state * 9301 + 49297) % 233280;
  return state / 233280;
}
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const id = (): string => randomUUID();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Dates are plain YYYY-MM-DD strings in the school's timezone, as elsewhere in the app.
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const utc = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => {
  const d = utc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isSunday = (s: string) => utc(s).getUTCDay() === 0;
const nextWorkingDay = (s: string) => (isSunday(s) ? addDays(s, 1) : s);
const stamp = (s: string, hour = 9) => new Date(`${s}T${String(hour).padStart(2, "0")}:00:00+05:30`);
const fmtNo = (p: string, n: number) => `${p}-${String(n).padStart(5, "0")}`;
const fakePhone = (n: number) => `00000${String(n).padStart(5, "0")}`;

const FIRST = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Reyansh", "Ananya", "Diya", "Saanvi", "Aadhya", "Kiara", "Rohan", "Arjun", "Meera", "Riya", "Kabir", "Zara", "Ayaan", "Neha", "Sara", "Dev", "Tara", "Aryan", "Isha", "Nikhil", "Pooja", "Sneha", "Rahul", "Tanvi", "Arnav", "Mira", "Joseph", "Maria", "Anita", "Samuel", "Grace", "Ritika", "Sayan", "Debjani", "Soham", "Trisha"];
const LAST = ["Sharma", "Das", "Ghosh", "Banerjee", "Gupta", "Roy", "Sen", "Patel", "Singh", "Mukherjee", "Chatterjee", "Bose", "Khan", "Verma", "D'Souza", "Fernandes", "Biswas", "Mondal", "Saha", "Paul"];
const GUARDIAN_FIRST = ["Rajesh", "Sunita", "Amit", "Rekha", "Sanjay", "Mita", "Prakash", "Shalini", "Tapan", "Nandini", "Peter", "Lucy"];
const BLOOD = ["A+", "B+", "O+", "AB+", "O-", "A-"];
const METHODS = ["CASH", "UPI", "UPI", "BANK", "CARD"];

const HOLIDAYS: { title: string; date: string; endDate?: string }[] = [
  { title: "Gandhi Jayanti", date: "2026-10-02" },
  { title: "Durga Puja break", date: "2026-10-17", endDate: "2026-10-22" },
  { title: "Kali Puja and Diwali", date: "2026-11-08" },
  { title: "Christmas and winter break", date: "2026-12-24", endDate: "2027-01-01" },
];

function holidaySet() {
  const set = new Set<string>();
  for (const h of HOLIDAYS) {
    for (let d = h.date; d <= (h.endDate ?? h.date); d = addDays(d, 1)) set.add(d);
  }
  return set;
}

async function main() {
  const school = await prisma.school.findUnique({ where: { code } });
  if (!school) throw new Error(`No school with code "${code}".`);
  const existing = await prisma.student.count({ where: { schoolId: school.id } });
  if (existing > 0) throw new Error(`${school.name} already has ${existing} students, so nothing was added.`);

  const schoolId = school.id;
  const year = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  const academicYearId = year?.id ?? id();
  const newYears = year ? [] : [{ id: academicYearId, schoolId, name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", isCurrent: true }];

  // ---- Classes, sections, subjects
  const classes = [3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ id: id(), schoolId, name: `Class ${n}`, order: n }));
  const subjectNames = ["English", "Mathematics", "Science", "Social Studies", "Hindi", "Computer"];
  const subjects = subjectNames.map((name, i) => ({ id: id(), schoolId, name, code: `${name.slice(0, 3).toUpperCase()}${101 + i}` }));

  // ---- Staff (no logins are created)
  const perSubject = [3, 3, 3, 3, 2, 2];
  const staff: { id: string; schoolId: string; employeeNo: string; name: string; designation: string; phone: string; joinDate: string; salary: number }[] = [];
  const addStaff = (name: string, designation: string, salary: number) => {
    const row = { id: id(), schoolId, employeeNo: `SDB${String(staff.length + 1).padStart(3, "0")}`, name, designation, phone: fakePhone(10000 + staff.length), joinDate: `20${between(12, 25)}-0${between(4, 7)}-01`, salary };
    staff.push(row);
    return row;
  };
  addStaff("Fr. Thomas Mathew", "Principal", 95000);
  const bySubject = subjectNames.map((subject, s) =>
    Array.from({ length: perSubject[s] }, () => addStaff(`${pick(["Anita", "Suresh", "Priya", "Rahul", "Kavita", "Manoj", "Sister Rosa", "Bikash", "Jaya", "Paul", "Moumita", "Dipak"])} ${pick(LAST)}`, `${subject} Teacher`, between(32, 58) * 1000)),
  );
  const teachers = bySubject.flat();
  addStaff("Ratan Halder", "Accountant", 36000);
  addStaff("Mary Lobo", "Librarian", 28000);
  for (const name of ["Gopal Naskar", "Imran Ali", "Bablu Sardar"]) addStaff(name, "Driver", 22000);

  const sections = classes.flatMap((c, i) =>
    ["A", "B"].map((name, s) => ({ id: id(), schoolId, classId: c.id, name, room: `${i + 1}0${s + 1}`, classTeacherId: teachers[(i * 2 + s) % teachers.length].id })),
  );
  const classSubjects = classes.flatMap((c, i) =>
    subjects.map((sub, s) => ({ id: id(), schoolId, classId: c.id, subjectId: sub.id, teacherId: bySubject[s][i % bySubject[s].length].id })),
  );

  // ---- Transport
  const routes = ["North Line", "South Line", "East Line"].map((name, i) => ({ id: id(), schoolId, name: `Route ${i + 1} - ${name}`, fare: 900 + i * 150 }));
  const directions = [[1, 0.3], [-1, -0.2], [0.2, 1]];
  const stops = routes.flatMap((r, i) =>
    Array.from({ length: 5 }, (_, s) => ({
      id: id(), schoolId, routeId: r.id, name: `${r.name.split(" - ")[1].split(" ")[0]} Stop ${s + 1}`, order: s + 1,
      lat: 22.5726 + directions[i][0] * 0.011 * (s + 1), lng: 88.3639 + directions[i][1] * 0.011 * (s + 1),
      pickupTime: `07:${String(10 + s * 8).padStart(2, "0")}`,
    })),
  );
  const vehicles = routes.map((r, i) => ({ id: id(), schoolId, regNo: `WB-02-AK-${4101 + i * 37}`, model: pick(["Tata Starbus", "Ashok Leyland Lynx"]), capacity: 42, routeId: r.id }));

  // ---- Students and guardians
  const guardians: { id: string; schoolId: string; name: string; relation: string; phone: string }[] = [];
  const students: { id: string; schoolId: string; admissionNo: string; rollNo: number; firstName: string; lastName: string; gender: string; dob: string; bloodGroup: string; address: string; sectionId: string; guardianId: string; busStopId: string | null; admittedOn: string }[] = [];
  const profile = new Map<string, { attendance: number; ability: number; payer: number; discount: boolean }>();
  sections.forEach((sec) => {
    const classIndex = classes.findIndex((c) => c.id === sec.classId);
    const size = between(18, 24);
    for (let roll = 1; roll <= size; roll++) {
      const lastName = pick(LAST);
      const first = pick(FIRST);
      const guardian = { id: id(), schoolId, name: `${pick(GUARDIAN_FIRST)} ${lastName}`, relation: pick(["Father", "Mother", "Guardian"]), phone: fakePhone(20000 + students.length) };
      guardians.push(guardian);
      const student = {
        id: id(), schoolId, admissionNo: `SDB2026${String(students.length + 1).padStart(4, "0")}`, rollNo: roll, firstName: first, lastName,
        gender: rand() < 0.52 ? "M" : "F", dob: `${2018 - classIndex}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`,
        bloodGroup: pick(BLOOD), address: `${between(1, 240)} ${pick(["Park Street", "College Road", "Lake View", "Station Road", "Church Lane"])}, Kolkata`,
        sectionId: sec.id, guardianId: guardian.id, busStopId: rand() < 0.42 ? pick(stops).id : null, admittedOn: `${2026 - between(0, 4)}-04-01`,
      };
      students.push(student);
      const r = rand();
      profile.set(student.id, {
        attendance: r < 0.05 ? 0.62 + rand() * 0.1 : r < 0.2 ? 0.78 + rand() * 0.08 : 0.9 + rand() * 0.09,
        ability: clamp(0.42 + rand() * 0.5, 0, 1),
        payer: rand() < 0.08 ? 0.45 : 1,
        discount: rand() < 0.08,
      });
    }
  });
  const classOfSection = new Map(sections.map((s) => [s.id, s.classId]));
  const studentsInClass = (classId: string) => students.filter((s) => classOfSection.get(s.sectionId) === classId);
  if (students.length > school.maxStudents) throw new Error(`This would exceed the school's limit of ${school.maxStudents} students.`);

  // ---- Attendance: the last 45 school days
  const holidays = holidaySet();
  const schoolDays: string[] = [];
  for (let d = TODAY; schoolDays.length < 45; d = addDays(d, -1)) {
    if (!isSunday(d) && !holidays.has(d)) schoolDays.push(d);
  }
  const classMood = new Map(classes.map((c) => [c.id, -0.03 + rand() * 0.05]));
  const attendance = schoolDays.flatMap((date) => {
    const dayMood = -0.03 + rand() * 0.05;
    return students.map((s) => {
      const base = profile.get(s.id)!.attendance + dayMood + classMood.get(classOfSection.get(s.sectionId)!)!;
      const r = rand();
      const status = r < base ? (rand() < 0.05 ? "LATE" : "PRESENT") : rand() < 0.25 ? "LEAVE" : "ABSENT";
      return { id: id(), schoolId, studentId: s.id, sectionId: s.sectionId, date, status };
    });
  });

  // ---- Exams
  const examPlan = [
    { name: "Unit Test 1", start: "2026-07-13", max: 25, published: true, marks: true },
    { name: "Half Yearly 2026", start: "2026-09-14", max: 100, published: true, marks: true },
    { name: "Unit Test 2", start: "2026-12-07", max: 25, published: false, marks: false },
  ];
  const exams = examPlan.map((e) => ({ id: id(), schoolId, academicYearId, name: e.name, startDate: e.start, endDate: addDays(e.start, subjects.length + 1), published: e.published, createdAt: stamp(addDays(e.start, -14)) }));
  const schedules: { id: string; schoolId: string; examId: string; classId: string; subjectId: string; date: string; startTime: string; endTime: string; room: string; maxMarks: number; passMarks: number }[] = [];
  const marks: { id: string; schoolId: string; examScheduleId: string; studentId: string; marksObtained: number | null; absent: boolean }[] = [];
  examPlan.forEach((plan, e) => {
    classes.forEach((c, ci) => {
      let date = nextWorkingDay(plan.start);
      subjects.forEach((sub) => {
        const passMarks = Math.ceil(plan.max * 0.33);
        const schedule = { id: id(), schoolId, examId: exams[e].id, classId: c.id, subjectId: sub.id, date, startTime: plan.max > 25 ? "09:30" : "10:00", endTime: plan.max > 25 ? "12:30" : "11:00", room: `Hall ${(ci % 3) + 1}`, maxMarks: plan.max, passMarks };
        schedules.push(schedule);
        date = nextWorkingDay(addDays(date, 1));
        if (!plan.marks) return;
        for (const s of studentsInClass(c.id)) {
          const absent = rand() < 0.015;
          const share = clamp(profile.get(s.id)!.ability - 0.1 + rand() * 0.22, 0.12, 1);
          marks.push({ id: id(), schoolId, examScheduleId: schedule.id, studentId: s.id, marksObtained: absent ? null : Math.round(share * plan.max), absent });
        }
      });
    });
  });

  // ---- Fees: invoices for each month, payments mostly complete except the current month
  const tuitionFee = new Map(classes.map((c, i) => [c.id, 1800 + i * 200]));
  const structures = [
    ...classes.map((c) => ({ id: id(), schoolId, classId: c.id as string | null, name: "Monthly Tuition Fee", amount: tuitionFee.get(c.id)! })),
    { id: id(), schoolId, classId: null as string | null, name: "Exam Fee", amount: 500 },
  ];
  const billing = [
    { month: "2026-07", label: "July 2026", paid: 0.98 },
    { month: "2026-08", label: "August 2026", paid: 0.97 },
    { month: "2026-09", label: "September 2026", paid: 0.95 },
    { month: "2026-10", label: "October 2026", paid: 0.88 },
    { month: "2026-11", label: "November 2026", paid: 0.52 },
  ];
  const invoices: { id: string; schoolId: string; invoiceNo: string; studentId: string; title: string; amount: number; discount: number; dueDate: string; createdAt: Date }[] = [];
  const pendingPayments: { invoiceId: string; amount: number; paidOn: string }[] = [];
  const bill = (s: (typeof students)[number], title: string, amount: number, discount: number, month: string, payChance: number) => {
    const invoice = { id: id(), schoolId, invoiceNo: fmtNo("INV", invoices.length + 1), studentId: s.id, title, amount, discount, dueDate: `${month}-10`, createdAt: stamp(`${month}-01`) };
    invoices.push(invoice);
    if (rand() >= payChance * profile.get(s.id)!.payer) return;
    const paidOn = [`${month}-${String(between(1, 15)).padStart(2, "0")}`, TODAY].sort()[0];
    const net = amount - discount;
    pendingPayments.push({ invoiceId: invoice.id, amount: rand() < 0.06 ? Math.round(net / 2) : net, paidOn });
  };
  for (const { month, label, paid } of billing) {
    for (const s of students) {
      const amount = tuitionFee.get(classOfSection.get(s.sectionId)!)!;
      bill(s, `Monthly Tuition Fee — ${label}`, amount, profile.get(s.id)!.discount ? Math.round(amount * 0.1) : 0, month, paid);
    }
  }
  for (const s of students) bill(s, "Exam Fee — Half Yearly 2026", 500, 0, "2026-09", 0.96);
  pendingPayments.sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  const payments = pendingPayments.map((p, i) => ({ id: id(), schoolId, invoiceId: p.invoiceId, receiptNo: fmtNo("RCP", i + 1), amount: p.amount, method: pick(METHODS), paidOn: p.paidOn, createdAt: stamp(p.paidOn, 11) }));

  // ---- Timetable: a teacher is never placed in two sections in the same period
  const periods = [["08:00", "08:40"], ["08:40", "09:20"], ["09:20", "10:00"], ["10:20", "11:00"], ["11:00", "11:40"], ["11:40", "12:20"]];
  const timetable: { id: string; schoolId: string; sectionId: string; day: number; period: number; startTime: string; endTime: string; subjectId: string; teacherId: string }[] = [];
  const busy = new Set<string>();
  sections.forEach((sec, si) => {
    const own = classSubjects.filter((cs) => cs.classId === sec.classId);
    for (let day = 1; day <= 6; day++) {
      periods.forEach(([startTime, endTime], p) => {
        for (let attempt = 0; attempt < own.length; attempt++) {
          const cs = own[(si + day + p + attempt) % own.length];
          const key = `${day}-${p}-${cs.teacherId}`;
          if (busy.has(key)) continue;
          busy.add(key);
          timetable.push({ id: id(), schoolId, sectionId: sec.id, day, period: p + 1, startTime, endTime, subjectId: cs.subjectId, teacherId: cs.teacherId });
          break;
        }
      });
    }
  });

  // ---- Homework, notices, calendar, library
  const homeworkTitles = ["Chapter exercises", "Revision worksheet", "Reading and summary", "Project outline", "Practice problems"];
  const homework = sections.flatMap((sec) =>
    Array.from({ length: 2 }, (_, i) => ({ id: id(), schoolId, sectionId: sec.id, subjectId: pick(subjects).id, title: pick(homeworkTitles), description: "Complete in your notebook and bring it to the next class.", dueDate: nextWorkingDay(addDays(TODAY, 2 + i * 3)), createdAt: stamp(addDays(TODAY, -i)) })),
  );
  const noticeRows: [string, string, string, number][] = [
    ["Unit Test 2 schedule published", "Unit Test 2 begins on 7 December. The routine is available under Exams.", "ALL", 1],
    ["November fee reminder", "Please clear November tuition fees by the 10th to avoid a late payment notice.", "PARENTS", 3],
    ["Staff meeting on Saturday", "All teaching staff will meet in the conference room at 1 PM.", "STAFF", 4],
    ["Children's Day celebration", "Students may come in colour dress on 14 November. Classes end at noon.", "STUDENTS", 5],
    ["Parent-teacher meeting", "The meeting for all classes will be held on 21 November from 9 AM.", "PARENTS", 8],
    ["School reopens after Puja break", "Regular classes resumed on 23 October. Please check the updated timetable.", "ALL", 17],
  ];
  const notices = noticeRows.map(([title, body, audience, ago]) => ({ id: id(), schoolId, title, body, audience, createdAt: stamp(addDays(TODAY, -ago), 10) }));
  const events = [
    ...HOLIDAYS.map((h) => ({ id: id(), schoolId, title: h.title, date: h.date, endDate: h.endDate ?? null, type: "HOLIDAY", details: null as string | null })),
    { id: id(), schoolId, title: "Children's Day celebration", date: "2026-11-14", endDate: null, type: "EVENT", details: "Assembly and cultural programme" },
    { id: id(), schoolId, title: "Parent-teacher meeting", date: "2026-11-21", endDate: null, type: "MEETING", details: "All classes, 9 AM to 1 PM" },
    { id: id(), schoolId, title: "Annual Sports Day", date: "2026-12-05", endDate: null, type: "EVENT", details: "School ground" },
    { id: id(), schoolId, title: "Science Exhibition", date: "2026-12-19", endDate: null, type: "EVENT", details: "Classes 6 to 10" },
    { id: id(), schoolId, title: "Feast of St. John Bosco", date: "2027-01-31", endDate: null, type: "EVENT", details: "School celebration" },
  ];
  const titles: [string, string][] = [["Malgudi Days", "R. K. Narayan"], ["The Story of My Experiments with Truth", "M. K. Gandhi"], ["Wings of Fire", "A. P. J. Abdul Kalam"], ["Gitanjali", "Rabindranath Tagore"], ["The Jungle Book", "Rudyard Kipling"], ["Treasure Island", "R. L. Stevenson"], ["Feluda Omnibus", "Satyajit Ray"], ["Oxford School Atlas", "Oxford"], ["Concise Mathematics", "Selina Publishers"], ["Basic Science Reader", "School Press"], ["A Brief History of India", "School Press"], ["Computer Basics", "School Press"]];
  const books = titles.map(([title, author], i) => ({ id: id(), schoolId, title, author, isbn: `97800000${String(10000 + i)}`, copies: between(3, 6) }));
  const issues: { id: string; schoolId: string; bookId: string; studentId: string; issuedOn: string; dueOn: string; returnedOn: string | null }[] = [];
  const onLoan = new Map<string, number>();
  for (let i = 0; i < 36; i++) {
    const book = pick(books);
    const issuedOn = nextWorkingDay(addDays(TODAY, -between(1, 40)));
    const dueOn = addDays(issuedOn, 14);
    const returned = rand() < 0.4;
    const active = onLoan.get(book.id) ?? 0;
    if (!returned && active >= book.copies) continue;
    if (!returned) onLoan.set(book.id, active + 1);
    const returnedOn = returned ? [addDays(issuedOn, between(3, 13)), TODAY].sort()[0] : null;
    issues.push({ id: id(), schoolId, bookId: book.id, studentId: pick(students).id, issuedOn, dueOn, returnedOn });
  }

  console.log(`Adding dummy data to ${school.name}…`);
  await prisma.$transaction(
    [
      prisma.academicYear.createMany({ data: newYears }),
      prisma.class.createMany({ data: classes }),
      prisma.subject.createMany({ data: subjects }),
      prisma.staff.createMany({ data: staff }),
      prisma.section.createMany({ data: sections }),
      prisma.classSubject.createMany({ data: classSubjects }),
      prisma.busRoute.createMany({ data: routes }),
      prisma.busStop.createMany({ data: stops }),
      prisma.vehicle.createMany({ data: vehicles }),
      prisma.guardian.createMany({ data: guardians }),
      prisma.student.createMany({ data: students }),
      prisma.attendance.createMany({ data: attendance }),
      prisma.exam.createMany({ data: exams }),
      prisma.examSchedule.createMany({ data: schedules }),
      prisma.mark.createMany({ data: marks }),
      prisma.feeStructure.createMany({ data: structures }),
      prisma.feeInvoice.createMany({ data: invoices }),
      prisma.feePayment.createMany({ data: payments }),
      prisma.timetableSlot.createMany({ data: timetable }),
      prisma.homework.createMany({ data: homework }),
      prisma.notice.createMany({ data: notices }),
      prisma.schoolEvent.createMany({ data: events }),
      prisma.book.createMany({ data: books }),
      prisma.bookIssue.createMany({ data: issues }),
    ],
  );

  console.table({
    classes: classes.length, sections: sections.length, subjects: subjects.length, staff: staff.length, students: students.length,
    guardians: guardians.length, attendance: attendance.length, exams: exams.length, papers: schedules.length, marks: marks.length,
    invoices: invoices.length, payments: payments.length, timetable: timetable.length, routes: routes.length, stops: stops.length,
    homework: homework.length, notices: notices.length, events: events.length, books: books.length, loans: issues.length,
  });
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
