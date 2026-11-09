import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, Field, PageHeader } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { ConfirmForm } from "@/components/confirm-form";
import { deleteNotice, postNotice } from "@/app/actions/misc";
import { fmtDate } from "@/lib/utils";

export default async function NoticesPage() {
  const { db, user } = await requireSchoolUser();
  const role = user.role;
  const canPost = ["ADMIN", "TEACHER", "ACCOUNTANT"].includes(role);
  const audiences = role === "ADMIN" ? undefined : ["ALL", ...(["TEACHER", "ACCOUNTANT", "DRIVER"].includes(role) ? ["STAFF"] : role === "PARENT" ? ["PARENTS"] : ["STUDENTS"])];
  const notices = await db.notice.findMany({
    where: audiences ? { OR: [{ audience: { in: audiences } }, { createdById: user.id }] } : {},
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Notice board" />
      {canPost && (
        <Card title="Post a notice">
          <ActionForm action={postNotice} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Title" className="sm:col-span-2"><input name="title" className="input" required /></Field>
              <Field label="Audience">
                <select name="audience" className="input">
                  <option value="ALL">Everyone</option><option value="PARENTS">Parents</option><option value="STUDENTS">Students</option><option value="STAFF">Staff only</option>
                </select>
              </Field>
            </div>
            <Field label="Message"><textarea name="body" rows={3} className="input" required /></Field>
            <div><Submit>Publish</Submit></div>
          </ActionForm>
        </Card>
      )}
      {notices.length ? (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card key={n.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{n.title}</h3>
                  <div className="mt-0.5 text-xs text-slate-500">{fmtDate(n.createdAt)} · {n.createdBy?.name ?? "School"} · <Badge color="indigo">{n.audience}</Badge></div>
                </div>
                {(role === "ADMIN" || n.createdById === user.id) && (
                  <ConfirmForm action={deleteNotice} message="Delete this notice?">
                    <input type="hidden" name="id" value={n.id} />
                    <button className="text-xs text-rose-600 hover:underline">Delete</button>
                  </ConfirmForm>
                )}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{n.body}</p>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>No notices.</Empty>
      )}
    </div>
  );
}
