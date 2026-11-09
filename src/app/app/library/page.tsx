import { requireSchoolUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { addBook, issueBook, returnBook } from "@/app/actions/misc";
import { fmtDate, today } from "@/lib/utils";

export default async function LibraryPage({ searchParams }: PageProps<"/app/library">) {
  const { db } = await requireSchoolUser(["ADMIN", "TEACHER"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const [books, issues] = await Promise.all([
    db.book.findMany({
      where: q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { author: { contains: q, mode: "insensitive" } }, { isbn: { contains: q, mode: "insensitive" } }] } : {},
      include: { issues: { where: { returnedOn: null } } },
      orderBy: { title: "asc" },
    }),
    db.bookIssue.findMany({ where: { returnedOn: null }, include: { book: true, student: { include: { section: { include: { class: true } } } } }, orderBy: { dueOn: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Library" subtitle={`${books.reduce((a, b) => a + b.copies, 0)} copies · ${issues.length} issued · ${issues.filter((i) => i.dueOn < today()).length} overdue`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Add book">
          <ActionForm action={addBook} className="grid grid-cols-2 gap-2">
            <input name="title" placeholder="Title" className="input col-span-2" required />
            <input name="author" placeholder="Author" className="input" />
            <input name="isbn" placeholder="ISBN" className="input" />
            <input name="copies" type="number" min={1} defaultValue={1} className="input" />
            <Submit>Add</Submit>
          </ActionForm>
        </Card>
        <Card title="Issue book">
          <ActionForm action={issueBook} className="grid grid-cols-2 gap-2">
            <select name="bookId" className="input col-span-2" required>
              {books.map((b) => <option key={b.id} value={b.id} disabled={b.issues.length >= b.copies}>{b.title} ({b.copies - b.issues.length}/{b.copies} available)</option>)}
            </select>
            <input name="admissionNo" placeholder="Student admission no" className="input" required />
            <input name="days" type="number" defaultValue={14} className="input" title="Loan days" />
            <Submit>Issue</Submit>
          </ActionForm>
        </Card>
      </div>
      <Card title="Currently issued">
        {issues.length ? (
          <Table head={["Book", "Student", "Class", "Issued", "Due", ""]}>
            {issues.map((i) => (
              <tr key={i.id}>
                <td>{i.book.title}</td>
                <td>{i.student.firstName} {i.student.lastName}</td>
                <td>{i.student.section ? `${i.student.section.class.name}-${i.student.section.name}` : "—"}</td>
                <td>{fmtDate(i.issuedOn)}</td>
                <td>{i.dueOn < today() ? <Badge color="red">Overdue {fmtDate(i.dueOn)}</Badge> : fmtDate(i.dueOn)}</td>
                <td className="text-right">
                  <form action={returnBook}><input type="hidden" name="id" value={i.id} /><button className="btn-secondary btn-sm">Mark returned</button></form>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No books issued.</Empty>
        )}
      </Card>
      <Card title="Catalogue">
        <form className="mb-3 flex gap-2"><input name="q" defaultValue={q} placeholder="Search title, author, ISBN" className="input max-w-xs" /><button className="btn-secondary">Search</button></form>
        <Table head={["Title", "Author", "ISBN", "Available"]}>
          {books.map((b) => (
            <tr key={b.id}><td>{b.title}</td><td>{b.author ?? "—"}</td><td className="font-mono text-xs">{b.isbn ?? "—"}</td><td>{b.copies - b.issues.length}/{b.copies}</td></tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
