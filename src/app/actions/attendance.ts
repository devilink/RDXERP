"use server";

import { revalidatePath } from "next/cache";
import { actionGuard } from "@/lib/auth";
import { ATTENDANCE_STATUS } from "@/lib/constants";
import { failed, str, today, type ActionState } from "@/lib/utils";
import { canTeachSection } from "@/lib/permissions";

export async function saveAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(["ADMIN", "TEACHER"]);
    const sectionId = str(fd, "sectionId");
    const date = str(fd, "date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Invalid date." };
    if (date > today()) return { ok: false, message: "Cannot mark attendance for a future date." };
    if (!(await canTeachSection(db, user, sectionId))) return { ok: false, message: "You are not assigned to this section." };

    // Only students actually in this section can be marked (ids from the form are not trusted).
    const students = await db.student.findMany({ where: { sectionId, status: "ACTIVE" }, select: { id: true } });
    let n = 0;
    for (const s of students) {
      const status = str(fd, `s_${s.id}`);
      if (!ATTENDANCE_STATUS.includes(status as (typeof ATTENDANCE_STATUS)[number])) continue;
      const note = str(fd, `n_${s.id}`) || null;
      await db.attendance.upsert({
        where: { studentId_date: { studentId: s.id, date } },
        create: { schoolId, studentId: s.id, sectionId, date, status, note, markedBy: user.name },
        update: { status, note, sectionId, markedBy: user.name },
      });
      n++;
    }
    revalidatePath("/app/attendance");
    return { ok: true, message: `Attendance saved for ${n} students.` };
  } catch (e) {
    return failed(e);
  }
}
