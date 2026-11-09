import "server-only";
import type { TenantDb } from "./db";
import { DEFAULT_GRADES } from "./constants";

type Scale = { grade: string; minPercent: number; gradePoint: number; remark: string | null }[];

export async function getScale(db: TenantDb): Promise<Scale> {
  const rows = await db.gradeScale.findMany({ orderBy: { minPercent: "desc" } });
  return rows.length ? rows : DEFAULT_GRADES;
}

export function gradeFor(percent: number, scale: Scale) {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find((g) => percent >= g.minPercent) ?? sorted[sorted.length - 1];
}

export type SubjectResult = {
  scheduleId: string;
  subject: string;
  maxMarks: number;
  passMarks: number;
  obtained: number | null;
  absent: boolean;
  passed: boolean;
  grade: string;
};

export type StudentResult = {
  studentId: string;
  name: string;
  admissionNo: string;
  rollNo: number | null;
  section: string;
  subjects: SubjectResult[];
  total: number;
  max: number;
  percent: number;
  grade: string;
  gradePoint: number;
  remark: string;
  passed: boolean;
  rank: number | null;
};

/** Full tabulation of an exam for one class: every student, every subject, ranked. */
export async function computeClassResults(db: TenantDb, examId: string, classId: string) {
  const [schedules, students, scale] = await Promise.all([
    db.examSchedule.findMany({
      where: { examId, classId },
      include: { subject: true, marks: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.student.findMany({
      where: { status: "ACTIVE", section: { classId } },
      include: { section: true },
      orderBy: [{ section: { name: "asc" } }, { rollNo: "asc" }, { firstName: "asc" }],
    }),
    getScale(db),
  ]);

  const results: StudentResult[] = students.map((st) => {
    let total = 0;
    let max = 0;
    let allPassed = true;
    const subjects = schedules.map((sc) => {
      const m = sc.marks.find((x) => x.studentId === st.id);
      const obtained = m && !m.absent ? m.marksObtained : null;
      const absent = !!m?.absent;
      const passed = obtained !== null && obtained >= sc.passMarks;
      if (!passed) allPassed = false;
      total += obtained ?? 0;
      max += sc.maxMarks;
      const g = gradeFor(obtained === null ? 0 : (obtained / sc.maxMarks) * 100, scale);
      return {
        scheduleId: sc.id,
        subject: sc.subject.name,
        maxMarks: sc.maxMarks,
        passMarks: sc.passMarks,
        obtained,
        absent,
        passed,
        grade: obtained === null ? (absent ? "AB" : "—") : g.grade,
      };
    });
    const percent = max ? Math.round((total / max) * 10000) / 100 : 0;
    const g = gradeFor(percent, scale);
    return {
      studentId: st.id,
      name: `${st.firstName} ${st.lastName}`,
      admissionNo: st.admissionNo,
      rollNo: st.rollNo,
      section: st.section?.name ?? "",
      subjects,
      total,
      max,
      percent,
      grade: g.grade,
      gradePoint: g.gradePoint,
      remark: g.remark ?? "",
      passed: allPassed && schedules.length > 0,
      rank: null,
    };
  });

  // Competition ranking ("1224") among students who passed all subjects.
  const ranked = results.filter((r) => r.passed).sort((a, b) => b.total - a.total);
  ranked.forEach((r, i) => {
    r.rank = i > 0 && ranked[i - 1].total === r.total ? ranked[i - 1].rank : i + 1;
  });

  return { schedules, results, scale };
}
