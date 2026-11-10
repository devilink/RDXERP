export const ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "School Admin",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
  DRIVER: "Driver",
};

export const STAFF_ROLES: Role[] = ["ADMIN", "ACCOUNTANT", "TEACHER"];
export const ADMIN: Role[] = ["ADMIN"];
export const ACADEMIC: Role[] = ["ADMIN", "TEACHER"];
export const FINANCE: Role[] = ["ADMIN", "ACCOUNTANT"];
export const FAMILY: Role[] = ["STUDENT", "PARENT"];

export const TONES = ["blue", "teal", "violet", "amber", "pink", "green"] as const;
export type Tone = (typeof TONES)[number];

/** A stable accent colour for a piece of text, so a card keeps its colour between visits. */
export const toneFor = (text: string): Tone => TONES[[...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];

export type NavItem = { href: string; label: string; icon: string; tone: Tone; roles: Role[] };


export const NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: "🏠", tone: "blue", roles: ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] },
  { href: "/app/my", label: "My Child / Me", icon: "🎒", tone: "violet", roles: ["STUDENT", "PARENT"] },
  { href: "/app/driver", label: "Trip & GPS", icon: "🛰️", tone: "teal", roles: ["DRIVER"] },
  { href: "/app/students", label: "Students", icon: "🧑‍🎓", tone: "violet", roles: ["ADMIN", "TEACHER", "ACCOUNTANT"] },
  { href: "/app/staff", label: "Staff", icon: "👩‍🏫", tone: "pink", roles: ["ADMIN"] },
  { href: "/app/academics", label: "Classes & Subjects", icon: "🏫", tone: "teal", roles: ["ADMIN"] },
  { href: "/app/attendance", label: "Attendance", icon: "✅", tone: "green", roles: ["ADMIN", "TEACHER"] },
  { href: "/app/attendance/report", label: "Attendance Report", icon: "📊", tone: "blue", roles: ["ADMIN", "TEACHER"] },
  { href: "/app/exams", label: "Exams & Results", icon: "📝", tone: "amber", roles: ["ADMIN", "TEACHER"] },
  { href: "/app/timetable", label: "Timetable", icon: "🗓️", tone: "violet", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
  { href: "/app/homework", label: "Homework", icon: "📚", tone: "pink", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
  { href: "/app/fees", label: "Fees", icon: "💰", tone: "green", roles: ["ADMIN", "ACCOUNTANT"] },
  { href: "/app/transport", label: "Transport", icon: "🚌", tone: "teal", roles: ["ADMIN"] },
  { href: "/app/transport/live", label: "Live Bus Map", icon: "📍", tone: "blue", roles: ["ADMIN", "PARENT", "STUDENT"] },
  { href: "/app/library", label: "Library", icon: "📖", tone: "amber", roles: ["ADMIN", "TEACHER"] },
  { href: "/app/notices", label: "Notices", icon: "📢", tone: "pink", roles: ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] },
  { href: "/app/calendar", label: "Calendar", icon: "📅", tone: "violet", roles: ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] },
  { href: "/app/settings", label: "Settings", icon: "⚙️", tone: "blue", roles: ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] },
];

export const LMS_ROLES: Role[] = ["ADMIN", "TEACHER", "STUDENT", "PARENT"];

export const LMS_NAV: NavItem[] = [
  { href: "/app/lms", label: "Overview", icon: "🏠", tone: "blue", roles: LMS_ROLES },
  { href: "/app/lms/courses", label: "Courses", icon: "📘", tone: "violet", roles: LMS_ROLES },
  { href: "/app/lms/assignments", label: "Assignments", icon: "📝", tone: "amber", roles: LMS_ROLES },
  { href: "/app/lms/quizzes", label: "Quizzes", icon: "❓", tone: "teal", roles: LMS_ROLES },
];

export const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ATTENDANCE_STATUS = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;

export const DEFAULT_GRADES = [
  { grade: "A+", minPercent: 90, gradePoint: 10, remark: "Outstanding" },
  { grade: "A", minPercent: 80, gradePoint: 9, remark: "Excellent" },
  { grade: "B+", minPercent: 70, gradePoint: 8, remark: "Very Good" },
  { grade: "B", minPercent: 60, gradePoint: 7, remark: "Good" },
  { grade: "C", minPercent: 50, gradePoint: 6, remark: "Average" },
  { grade: "D", minPercent: 33, gradePoint: 5, remark: "Pass" },
  { grade: "F", minPercent: 0, gradePoint: 0, remark: "Needs Improvement" },
];
