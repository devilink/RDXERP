"use server";

import { revalidatePath } from "next/cache";
import { actionGuard } from "@/lib/auth";
import type { TenantDb } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { ACADEMIC } from "@/lib/constants";
import { isDate, isHttpsUrl, learnerForCourse } from "@/lib/lms";
import { canTeachSection } from "@/lib/permissions";
import { failed, num, optStr, str, type ActionState } from "@/lib/utils";

// Every /app/lms page reads this data, and they all sit under the /app layout.
const refresh = () => revalidatePath("/app", "layout");

/** The course, if this user teaches its section. Every staff action goes through this. */
async function managedCourse(db: TenantDb, user: CurrentUser, courseId: string) {
  const course = await db.course.findFirst({ where: { id: courseId } });
  return course && (await canTeachSection(db, user, course.sectionId)) ? course : null;
}

const NOT_YOURS = { ok: false, message: "You do not teach this course." };

// ------------------------------------------------------------ Courses

export async function createCourse(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(ACADEMIC);
    const sectionId = str(fd, "sectionId");
    const title = str(fd, "title");
    if (!title) return { ok: false, message: "Title is required." };
    if (!(await canTeachSection(db, user, sectionId))) return { ok: false, message: "You are not assigned to this section." };
    const subjectId = optStr(fd, "subjectId");
    if (subjectId && !(await db.subject.findFirst({ where: { id: subjectId } }))) return { ok: false, message: "Invalid subject." };
    let teacherId: string | null;
    if (user.role === "TEACHER") {
      teacherId = (await db.staff.findFirst({ where: { userId: user.id } }))?.id ?? null;
    } else {
      teacherId = optStr(fd, "teacherId");
      if (teacherId && !(await db.staff.findFirst({ where: { id: teacherId } }))) return { ok: false, message: "Invalid teacher." };
    }
    await db.course.create({ data: { schoolId, sectionId, subjectId, teacherId, title, description: optStr(fd, "description") } });
    refresh();
    return { ok: true, message: "Course created as a draft. Publish it when it is ready for students." };
  } catch (e) {
    return failed(e);
  }
}

export async function setCoursePublished(fd: FormData) {
  const { db, user } = await actionGuard(ACADEMIC);
  const course = await managedCourse(db, user, str(fd, "id"));
  if (!course) return;
  await db.course.update({ where: { id: course.id }, data: { published: str(fd, "published") === "true" } });
  refresh();
}

export async function deleteCourse(fd: FormData) {
  const { db, user } = await actionGuard(ACADEMIC);
  const course = await managedCourse(db, user, str(fd, "id"));
  if (course) await db.course.delete({ where: { id: course.id } });
  refresh();
}

// ------------------------------------------------------------ Lessons

export async function addLesson(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(ACADEMIC);
    const course = await managedCourse(db, user, str(fd, "courseId"));
    if (!course) return NOT_YOURS;
    const title = str(fd, "title");
    const videoUrl = optStr(fd, "videoUrl");
    const resourceUrl = optStr(fd, "resourceUrl");
    if (!title) return { ok: false, message: "Title is required." };
    if (!isHttpsUrl(videoUrl) || !isHttpsUrl(resourceUrl)) return { ok: false, message: "Links must start with https://." };
    const order = (await db.lesson.count({ where: { courseId: course.id } })) + 1;
    await db.lesson.create({ data: { schoolId, courseId: course.id, title, body: optStr(fd, "body"), videoUrl, resourceUrl, order } });
    refresh();
    return { ok: true, message: "Lesson added." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteLesson(fd: FormData) {
  const { db, user } = await actionGuard(ACADEMIC);
  const lesson = await db.lesson.findFirst({ where: { id: str(fd, "id") } });
  if (lesson && (await managedCourse(db, user, lesson.courseId))) await db.lesson.delete({ where: { id: lesson.id } });
  refresh();
}

export async function setLessonDone(fd: FormData) {
  const { db, schoolId, user } = await actionGuard(["STUDENT"]);
  const lesson = await db.lesson.findFirst({ where: { id: str(fd, "id") } });
  if (!lesson) return;
  const student = await learnerForCourse(db, user, lesson.courseId);
  if (!student) return;
  if (str(fd, "done") === "true") {
    await db.lessonProgress.upsert({
      where: { lessonId_studentId: { lessonId: lesson.id, studentId: student.id } },
      create: { schoolId, lessonId: lesson.id, studentId: student.id },
      update: {},
    });
  } else {
    await db.lessonProgress.deleteMany({ where: { lessonId: lesson.id, studentId: student.id } });
  }
  refresh();
}

// ------------------------------------------------------------ Assignments

export async function addAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(ACADEMIC);
    const course = await managedCourse(db, user, str(fd, "courseId"));
    if (!course) return NOT_YOURS;
    const title = str(fd, "title");
    const dueDate = str(fd, "dueDate");
    const maxMarks = num(fd, "maxMarks", 100);
    if (!title) return { ok: false, message: "Title is required." };
    if (!isDate(dueDate)) return { ok: false, message: "Choose a due date." };
    if (maxMarks <= 0) return { ok: false, message: "Maximum marks must be more than 0." };
    await db.assignment.create({ data: { schoolId, courseId: course.id, title, instructions: optStr(fd, "instructions"), dueDate, maxMarks } });
    refresh();
    return { ok: true, message: "Assignment added." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteAssignment(fd: FormData) {
  const { db, user } = await actionGuard(ACADEMIC);
  const assignment = await db.assignment.findFirst({ where: { id: str(fd, "id") } });
  if (assignment && (await managedCourse(db, user, assignment.courseId))) await db.assignment.delete({ where: { id: assignment.id } });
  refresh();
}

export async function submitAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(["STUDENT"]);
    const assignment = await db.assignment.findFirst({ where: { id: str(fd, "assignmentId") } });
    if (!assignment) return { ok: false, message: "Assignment not found." };
    const student = await learnerForCourse(db, user, assignment.courseId);
    if (!student) return { ok: false, message: "This assignment is not part of your courses." };
    const text = optStr(fd, "text");
    const linkUrl = optStr(fd, "linkUrl");
    if (!text && !linkUrl) return { ok: false, message: "Write an answer or add a link." };
    if (!isHttpsUrl(linkUrl)) return { ok: false, message: "Links must start with https://." };
    const key = { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } };
    const existing = await db.submission.findUnique({ where: key });
    if (existing?.gradedAt) return { ok: false, message: "This work has already been marked." };
    await db.submission.upsert({
      where: key,
      create: { schoolId, assignmentId: assignment.id, studentId: student.id, text, linkUrl },
      update: { text, linkUrl, submittedAt: new Date() },
    });
    refresh();
    return { ok: true, message: "Submitted." };
  } catch (e) {
    return failed(e);
  }
}

export async function gradeSubmission(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, user } = await actionGuard(ACADEMIC);
    const submission = await db.submission.findFirst({ where: { id: str(fd, "id") }, include: { assignment: true } });
    if (!submission) return { ok: false, message: "Submission not found." };
    if (!(await managedCourse(db, user, submission.assignment.courseId))) return NOT_YOURS;
    const marks = num(fd, "marks", -1);
    if (marks < 0 || marks > submission.assignment.maxMarks) return { ok: false, message: `Marks must be between 0 and ${submission.assignment.maxMarks}.` };
    await db.submission.update({ where: { id: submission.id }, data: { marks, feedback: optStr(fd, "feedback"), gradedAt: new Date() } });
    refresh();
    return { ok: true, message: "Saved." };
  } catch (e) {
    return failed(e);
  }
}

// ------------------------------------------------------------ Quizzes

export async function addQuiz(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(ACADEMIC);
    const course = await managedCourse(db, user, str(fd, "courseId"));
    if (!course) return NOT_YOURS;
    const title = str(fd, "title");
    if (!title) return { ok: false, message: "Title is required." };
    await db.quiz.create({ data: { schoolId, courseId: course.id, title } });
    refresh();
    return { ok: true, message: "Quiz created. Open it to add questions." };
  } catch (e) {
    return failed(e);
  }
}

export async function setQuizPublished(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, user } = await actionGuard(ACADEMIC);
    const quiz = await db.quiz.findFirst({ where: { id: str(fd, "id") }, include: { _count: { select: { questions: true, attempts: true } } } });
    if (!quiz || !(await managedCourse(db, user, quiz.courseId))) return NOT_YOURS;
    const published = str(fd, "published") === "true";
    if (published && quiz._count.questions === 0) return { ok: false, message: "Add at least one question first." };
    // Attempts store answers by question position, so the questions must not change after one exists.
    if (!published && quiz._count.attempts > 0) return { ok: false, message: "Students have already taken this quiz, so it can no longer be edited." };
    await db.quiz.update({ where: { id: quiz.id }, data: { published } });
    refresh();
    return { ok: true, message: published ? "Quiz published." : "Quiz moved back to draft." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteQuiz(fd: FormData) {
  const { db, user } = await actionGuard(ACADEMIC);
  const quiz = await db.quiz.findFirst({ where: { id: str(fd, "id") } });
  if (quiz && (await managedCourse(db, user, quiz.courseId))) await db.quiz.delete({ where: { id: quiz.id } });
  refresh();
}

export async function addQuestion(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(ACADEMIC);
    const quiz = await db.quiz.findFirst({ where: { id: str(fd, "quizId") } });
    if (!quiz || !(await managedCourse(db, user, quiz.courseId))) return NOT_YOURS;
    if (quiz.published) return { ok: false, message: "Move the quiz back to draft to change its questions." };
    const prompt = str(fd, "prompt");
    if (!prompt) return { ok: false, message: "Write the question." };
    const typed = [1, 2, 3, 4].map((n) => str(fd, `option${n}`));
    const options = typed.filter(Boolean);
    if (options.length < 2) return { ok: false, message: "Give at least two options." };
    const chosen = num(fd, "correct", 0) - 1;
    if (!typed[chosen]) return { ok: false, message: "The correct answer must be one of the options you filled in." };
    const correctIndex = typed.slice(0, chosen).filter(Boolean).length;
    const order = (await db.quizQuestion.count({ where: { quizId: quiz.id } })) + 1;
    await db.quizQuestion.create({ data: { schoolId, quizId: quiz.id, prompt, options, correctIndex, order } });
    refresh();
    return { ok: true, message: "Question added." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteQuestion(fd: FormData) {
  const { db, user } = await actionGuard(ACADEMIC);
  const question = await db.quizQuestion.findFirst({ where: { id: str(fd, "id") }, include: { quiz: true } });
  if (question && !question.quiz.published && (await managedCourse(db, user, question.quiz.courseId))) {
    await db.quizQuestion.delete({ where: { id: question.id } });
  }
  refresh();
}

export async function submitQuiz(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId, user } = await actionGuard(["STUDENT"]);
    const quiz = await db.quiz.findFirst({
      where: { id: str(fd, "quizId"), published: true },
      include: { questions: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
    });
    if (!quiz) return { ok: false, message: "Quiz not found." };
    const student = await learnerForCourse(db, user, quiz.courseId);
    if (!student) return { ok: false, message: "This quiz is not part of your courses." };
    if (await db.quizAttempt.findFirst({ where: { quizId: quiz.id, studentId: student.id } })) return { ok: false, message: "You have already taken this quiz." };
    const answers = quiz.questions.map((q) => {
      const a = num(fd, `q_${q.id}`, -1);
      return Number.isInteger(a) && a >= 0 && a < q.options.length ? a : -1;
    });
    if (answers.includes(-1)) return { ok: false, message: "Answer every question before submitting." };
    const score = quiz.questions.filter((q, i) => q.correctIndex === answers[i]).length;
    await db.quizAttempt.create({ data: { schoolId, quizId: quiz.id, studentId: student.id, answers, score, total: quiz.questions.length } });
    refresh();
    return { ok: true, message: `You scored ${score} out of ${quiz.questions.length}.` };
  } catch (e) {
    return failed(e);
  }
}
