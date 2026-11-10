import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { LMS_ROLES } from "@/lib/constants";
import { Badge, Card, PageHeader } from "@/components/ui";
import { setLessonDone } from "@/app/actions/lms";
import { lmsAudience, youTubeId } from "@/lib/lms";

export default async function LessonPage({ params, searchParams }: PageProps<"/app/lms/courses/[id]/lessons/[lessonId]">) {
  const { db, user } = await requireSchoolUser(LMS_ROLES);
  const { id, lessonId } = await params;
  const sp = await searchParams;
  const audience = await lmsAudience(db, user, sp.child);
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, courseId: id, course: audience.courseWhere }, include: { course: true } });
  if (!lesson) notFound();

  const done = audience.child ? !!(await db.lessonProgress.findFirst({ where: { lessonId: lesson.id, studentId: audience.child.id } })) : false;
  const q = audience.childQuery;
  const video = youTubeId(lesson.videoUrl);

  return (
    <div className="space-y-6">
      <PageHeader
        title={lesson.title}
        subtitle={lesson.course.title}
        actions={
          <>
            <Link className="btn-secondary" href={`/app/lms/courses/${id}${q}`}>Back to course</Link>
            {user.role === "STUDENT" && (
              <form action={setLessonDone}>
                <input type="hidden" name="id" value={lesson.id} />
                <input type="hidden" name="done" value={String(!done)} />
                <button className={done ? "btn-secondary" : "btn-primary"}>{done ? "Mark as not done" : "Mark as done"}</button>
              </form>
            )}
            {user.role === "PARENT" && <Badge color={done ? "green" : "gray"}>{done ? "Done" : "Not done yet"}</Badge>}
          </>
        }
      />
      {video && (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video}`}
          title={lesson.title}
          className="aspect-video w-full rounded-xl border border-slate-200"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
        />
      )}
      {lesson.body && (
        <Card>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{lesson.body}</div>
        </Card>
      )}
      {(lesson.resourceUrl || (lesson.videoUrl && !video)) && (
        <div className="flex flex-wrap gap-2">
          {lesson.videoUrl && !video && <a className="btn-secondary" href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">Watch video</a>}
          {lesson.resourceUrl && <a className="btn-secondary" href={lesson.resourceUrl} target="_blank" rel="noopener noreferrer">Open resource</a>}
        </div>
      )}
    </div>
  );
}
