import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { LMS_ROLES } from "@/lib/constants";
import { Badge, Card, Empty, Field, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { addQuestion, deleteQuestion, setQuizPublished, submitQuiz } from "@/app/actions/lms";
import { lmsAudience } from "@/lib/lms";
import { fmtDate, fullName } from "@/lib/utils";

export default async function QuizPage({ params, searchParams }: PageProps<"/app/lms/quizzes/[id]">) {
  const { db, user } = await requireSchoolUser(LMS_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  const audience = await lmsAudience(db, user, sp.child);
  const quiz = await db.quiz.findFirst({
    where: { id, course: audience.courseWhere, ...(audience.family ? { published: true } : {}) },
    include: { course: true, questions: { orderBy: [{ order: "asc" }, { id: "asc" }] } },
  });
  if (!quiz) notFound();

  const header = (extra?: React.ReactNode) => (
    <PageHeader
      title={quiz.title}
      subtitle={`${quiz.course.title} · ${quiz.questions.length} questions`}
      actions={
        <>
          <Link className="btn-secondary" href={`/app/lms/courses/${quiz.courseId}${audience.childQuery}`}>Back to course</Link>
          {extra}
        </>
      }
    />
  );

  if (audience.family) {
    if (!audience.child) notFound();
    const attempt = await db.quizAttempt.findFirst({ where: { quizId: quiz.id, studentId: audience.child.id } });

    if (!attempt) {
      if (user.role === "PARENT") return <div>{header()}<Empty>{audience.child.firstName} has not taken this quiz yet.</Empty></div>;
      // Only the prompts and options are rendered here. The correct answers stay on the server.
      return (
        <div>
          {header()}
          <ActionForm action={submitQuiz} reset={false} className="space-y-4">
            <input type="hidden" name="quizId" value={quiz.id} />
            <p className="text-sm text-slate-500">You get one attempt, so check your answers before submitting.</p>
            {quiz.questions.map((question, i) => (
              <Card key={question.id}>
                <fieldset>
                  <legend className="mb-2 font-medium">{i + 1}. {question.prompt}</legend>
                  {question.options.map((option, n) => (
                    <label key={n} className="flex items-center gap-2 py-1 text-sm">
                      <input type="radio" name={`q_${question.id}`} value={n} required />
                      {option}
                    </label>
                  ))}
                </fieldset>
              </Card>
            ))}
            <Submit pendingText="Submitting…">Submit quiz</Submit>
          </ActionForm>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {header()}
        <Card title="Result">
          <div className="text-2xl font-semibold">{attempt.score} / {attempt.total}</div>
          <div className="text-xs text-slate-500">Taken on {fmtDate(attempt.submittedAt)}</div>
        </Card>
        {quiz.questions.map((question, i) => (
          <Card key={question.id}>
            <div className="mb-2 font-medium">{i + 1}. {question.prompt}</div>
            <ul className="space-y-1 text-sm">
              {question.options.map((option, n) => (
                <li key={n} className="flex items-center gap-2">
                  {option}
                  {n === question.correctIndex && <Badge color="green">Correct answer</Badge>}
                  {n === attempt.answers[i] && n !== question.correctIndex && <Badge color="red">Chosen</Badge>}
                  {n === attempt.answers[i] && n === question.correctIndex && <Badge color="blue">Chosen</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    );
  }

  const attempts = await db.quizAttempt.findMany({ where: { quizId: quiz.id }, include: { student: true }, orderBy: { submittedAt: "desc" } });
  const locked = attempts.length > 0;

  return (
    <div className="space-y-6">
      {header(
        !(quiz.published && locked) && (
          <ActionForm action={setQuizPublished} reset={false}>
            <input type="hidden" name="id" value={quiz.id} />
            <input type="hidden" name="published" value={String(!quiz.published)} />
            <Submit>{quiz.published ? "Move to draft" : "Publish"}</Submit>
          </ActionForm>
        ),
      )}
      <Card title="Questions">
        {quiz.questions.length ? (
          <ol className="divide-y divide-slate-100">
            {quiz.questions.map((question, i) => (
              <li key={question.id} className="py-3">
                <div className="flex justify-between gap-3">
                  <div className="font-medium">{i + 1}. {question.prompt}</div>
                  {!quiz.published && (
                    <ConfirmForm action={deleteQuestion} message="Delete this question?">
                      <input type="hidden" name="id" value={question.id} />
                      <button className="text-xs text-rose-600 hover:underline">Delete</button>
                    </ConfirmForm>
                  )}
                </div>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                  {question.options.map((option, n) => (
                    <li key={n} className="flex items-center gap-2">{option}{n === question.correctIndex && <Badge color="green">Correct</Badge>}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>No questions yet.</Empty>
        )}
        {quiz.published ? (
          <p className="mt-3 text-sm text-slate-500">{locked ? "Students have taken this quiz, so its questions are locked." : "Move the quiz to draft to change its questions."}</p>
        ) : (
          <ActionForm action={addQuestion} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <input type="hidden" name="quizId" value={quiz.id} />
            <Field label="Question" className="sm:col-span-2"><input name="prompt" className="input" required /></Field>
            {[1, 2, 3, 4].map((n) => (
              <Field key={n} label={`Option ${n}${n > 2 ? " (optional)" : ""}`}><input name={`option${n}`} className="input" required={n <= 2} /></Field>
            ))}
            <Field label="Correct option"><select name="correct" className="input">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>Option {n}</option>)}</select></Field>
            <div className="sm:col-span-2"><Submit>Add question</Submit></div>
          </ActionForm>
        )}
      </Card>
      <Card title={`Results (${attempts.length})`}>
        {attempts.length ? (
          <Table head={["Student", "Score", "Taken on"]}>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>{fullName(a.student)}</td>
                <td>{a.score} / {a.total}</td>
                <td>{fmtDate(a.submittedAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No one has taken this quiz yet.</Empty>
        )}
      </Card>
    </div>
  );
}
