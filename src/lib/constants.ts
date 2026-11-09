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

export type NavItem = { href: string; label: string; icon: string; roles: Role[] };

export const NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: "🏠", roles: ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] },
  { href: "/app/my", label: "My Child / Me", icon: "🎒", roles: ["STUDENT", "PARENT"] },
  { href: "/app/driver", label: "Trip & GPS", icon: "🛰️", roles: ["DRIVER"] },
  { href: "/app/students", label: "Students", icon: "🧑‍🎓", roles: ["ADMIN", "TEACHER", "ACCOUNTANT"] },
  { href: "/app/staff", label: "Staff", icon: "👩‍🏫", roles: ["ADMIN"] },
  { href: "/app/academics", label: "Classes & Subjects", icon: "🏫", roles: ["ADMIN"] },
  { href: "/app/attendance", label: "Attendance", icon: "✅", roles: ["ADMIN", "TEACHER"] },
  { href: "/app/attendance/report", label: "Attendance Report", icon: "📊", roles: ["ADMIN", "TEACHER"] },
  { href: "/app/exams", label: "Exams & Results", icon: "📝", roles: ["ADMIN", "TEACHER"] },
  { href: "/app/timetable", label: "Timetable", icon: "🗓️", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
  { href: "/app/homework", label: "Homework", icon: "📚", roles: ["ADMIN", "TEACHER", "STUDENT", "PARENT"] },
  { href: "/app/fees", label: "Fees", icon: "💰", roles: ["ADMIN", "ACCOUNTANT"] },
  { href: "/app/transport", label: "Transport", icon: "🚌", roles: ["ADMIN"] },
  { href: "/app/transport/live", label: "Live Bus Map", icon: "📍", roles: ["ADMIN", "PARENT", "STUDENT"] },
  { href: "/app/library", label: "Library", icon: "📖", roles: ["ADMIN", "TEACHER"] },
  { href: "/app/notices", label: "Notices", icon: "📢", roles: ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] },
  { href: "/app/calendar", label: "Calendar", icon: "📅", roles: ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] },
  { href: "/app/settings", label: "Settings", icon: "⚙️", roles: ["ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT", "DRIVER"] },
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
