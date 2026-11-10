import { notFound } from "next/navigation";
import { requireSchoolUser } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { fmtDate, money } from "@/lib/utils";

export default async function Receipt({ params }: PageProps<"/app/fees/receipt/[id]">) {
  const { db, school } = await requireSchoolUser(["ADMIN", "ACCOUNTANT"]);
  const { id } = await params;
  const p = await db.feePayment.findFirst({
    where: { id },
    include: { invoice: { include: { payments: true, student: { include: { section: { include: { class: true } }, guardian: true } } } } },
  });
  if (!p) notFound();
  const inv = p.invoice;
  const paidTotal = inv.payments.reduce((a, x) => a + x.amount, 0);
  const balance = Math.max(0, inv.amount - inv.discount - paidTotal);

  return (
    <div className="mx-auto max-w-xl">
      <div className="no-print mb-4 flex justify-end"><PrintButton label="Print receipt" /></div>
      <div className="card p-8">
        <div className="border-b pb-4 text-center">
          <h1 className="text-brand text-xl font-bold">{school.name}</h1>
          <p className="text-xs text-slate-500">{school.address} {school.phone ? `· ${school.phone}` : ""}</p>
          <p className="mt-2 font-semibold uppercase tracking-wide">Fee Receipt</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">Receipt no</dt><dd className="font-mono">{p.receiptNo}</dd>
          <dt className="text-slate-500">Date</dt><dd>{fmtDate(p.paidOn)}</dd>
          <dt className="text-slate-500">Student</dt><dd>{inv.student.firstName} {inv.student.lastName}</dd>
          <dt className="text-slate-500">Admission no</dt><dd>{inv.student.admissionNo}</dd>
          <dt className="text-slate-500">Class</dt><dd>{inv.student.section ? `${inv.student.section.class.name} – ${inv.student.section.name}` : "—"}</dd>
          <dt className="text-slate-500">Guardian</dt><dd>{inv.student.guardian?.name ?? "—"}</dd>
          <dt className="text-slate-500">Towards</dt><dd>{inv.title} <span className="text-xs text-slate-400">({inv.invoiceNo})</span></dd>
          <dt className="text-slate-500">Mode</dt><dd>{p.method}{p.reference ? ` · ${p.reference}` : ""}</dd>
        </dl>
        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-center">
          <div className="text-xs text-slate-500">Amount received</div>
          <div className="text-3xl font-bold">{money(p.amount)}</div>
          <div className="mt-1 text-xs text-slate-500">Balance on invoice: {money(balance)}</div>
        </div>
        <div className="mt-12 text-right text-xs text-slate-500"><span className="border-t px-8 pt-2">Authorised signatory</span></div>
      </div>
    </div>
  );
}
