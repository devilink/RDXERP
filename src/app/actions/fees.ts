"use server";

import { revalidatePath } from "next/cache";
import { actionGuard } from "@/lib/auth";
import type { TenantDb } from "@/lib/db";
import { failed, num, optStr, str, today, type ActionState } from "@/lib/utils";

const FIN = ["ADMIN", "ACCOUNTANT"] as const;

type NumberReader = Pick<TenantDb, "feeInvoice" | "feePayment">;

/**
 * Runs fee work one at a time per school. Numbers are "highest + 1" and payments
 * check the balance first, so simultaneous requests must not interleave.
 */
async function feeTransaction<T>(db: TenantDb, schoolId: string, work: (tx: NumberReader) => Promise<T>) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${schoolId}))`;
      return work(tx);
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

async function nextNo(db: NumberReader, kind: "INV" | "RCP") {
  // Highest existing number + 1 (per school).
  if (kind === "INV") {
    const last = await db.feeInvoice.findFirst({ orderBy: { invoiceNo: "desc" }, select: { invoiceNo: true } });
    return Number(last?.invoiceNo.replace(/\D/g, "") ?? 0) + 1;
  }
  const last = await db.feePayment.findFirst({ orderBy: { receiptNo: "desc" }, select: { receiptNo: true } });
  return Number(last?.receiptNo.replace(/\D/g, "") ?? 0) + 1;
}
const fmtNo = (p: string, n: number) => `${p}-${String(n).padStart(5, "0")}`;

export async function addFeeStructure(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard([...FIN]);
    const classId = optStr(fd, "classId");
    if (classId && !(await db.class.findFirst({ where: { id: classId } }))) return { ok: false, message: "Invalid class." };
    const amount = num(fd, "amount");
    if (!str(fd, "name") || amount <= 0) return { ok: false, message: "Name and a positive amount are required." };
    await db.feeStructure.create({ data: { schoolId, classId, name: str(fd, "name"), amount } });
    revalidatePath("/app/fees");
    return { ok: true, message: "Fee head added." };
  } catch (e) {
    return failed(e);
  }
}

export async function deleteFeeStructure(fd: FormData) {
  const { db } = await actionGuard([...FIN]);
  await db.feeStructure.deleteMany({ where: { id: str(fd, "id") } });
  revalidatePath("/app/fees");
}

/** Bulk-generate invoices from a fee head for every active student in its class (or the whole school). */
export async function generateInvoices(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard([...FIN]);
    const fs = await db.feeStructure.findFirst({ where: { id: str(fd, "structureId") }, include: { class: true } });
    if (!fs) return { ok: false, message: "Choose a fee head." };
    const dueDate = str(fd, "dueDate");
    if (!dueDate) return { ok: false, message: "Due date is required." };
    const title = `${fs.name}${str(fd, "period") ? ` — ${str(fd, "period")}` : ""}`;
    const students = await db.student.findMany({ where: { status: "ACTIVE", ...(fs.classId ? { section: { classId: fs.classId } } : {}) }, select: { id: true } });
    // Skip students who already have an invoice with the same title (safe to re-run).
    const existing = new Set((await db.feeInvoice.findMany({ where: { title }, select: { studentId: true } })).map((i) => i.studentId));
    const pending = students.filter((s) => !existing.has(s.id));
    const created = await feeTransaction(db, schoolId, async (tx) => {
      const first = await nextNo(tx, "INV");
      const rows = pending.map((s, i) => ({ schoolId, studentId: s.id, invoiceNo: fmtNo("INV", first + i), title, amount: fs.amount, dueDate }));
      return (await tx.feeInvoice.createMany({ data: rows })).count;
    });
    revalidatePath("/app/fees");
    return { ok: true, message: `${created} invoices generated${existing.size ? ` (${existing.size} already existed)` : ""}.` };
  } catch (e) {
    return failed(e);
  }
}

export async function createInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard([...FIN]);
    const student = await db.student.findFirst({ where: { OR: [{ id: str(fd, "studentId") }, { admissionNo: str(fd, "studentId") }] } });
    if (!student) return { ok: false, message: "Student not found (use admission no)." };
    const amount = num(fd, "amount");
    if (amount <= 0) return { ok: false, message: "Amount must be positive." };
    await feeTransaction(db, schoolId, async (tx) => {
      const n = await nextNo(tx, "INV");
      await tx.feeInvoice.create({ data: { schoolId, studentId: student.id, invoiceNo: fmtNo("INV", n), title: str(fd, "title") || "Fee", amount, discount: num(fd, "discount"), dueDate: str(fd, "dueDate") || today() } });
    });
    revalidatePath("/app/fees");
    return { ok: true, message: `Invoice created for ${student.firstName}.` };
  } catch (e) {
    return failed(e);
  }
}

export async function recordPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db, schoolId } = await actionGuard([...FIN]);
    const result = await feeTransaction(db, schoolId, async (tx) => {
      const inv = await tx.feeInvoice.findFirst({ where: { id: str(fd, "invoiceId") }, include: { payments: true } });
      if (!inv) return { ok: false, message: "Invoice not found." };
      const due = inv.amount - inv.discount - inv.payments.reduce((a, p) => a + p.amount, 0);
      const amount = num(fd, "amount", due);
      if (amount <= 0) return { ok: false, message: "Amount must be positive." };
      if (amount > due + 0.001) return { ok: false, message: `Amount exceeds the balance due (${due}).` };
      const receiptNo = fmtNo("RCP", await nextNo(tx, "RCP"));
      await tx.feePayment.create({
        data: { schoolId, invoiceId: inv.id, receiptNo, amount, method: str(fd, "method") || "CASH", reference: optStr(fd, "reference"), paidOn: str(fd, "paidOn") || today() },
      });
      return { ok: true, message: `Payment recorded. Receipt ${receiptNo}.` };
    });
    revalidatePath("/app/fees");
    return result;
  } catch (e) {
    return failed(e);
  }
}

export async function setDiscount(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { db } = await actionGuard(["ADMIN"]);
    const inv = await db.feeInvoice.findFirst({ where: { id: str(fd, "invoiceId") } });
    if (!inv) return { ok: false, message: "Invoice not found." };
    const discount = num(fd, "discount");
    if (discount < 0 || discount > inv.amount) return { ok: false, message: "Invalid discount." };
    await db.feeInvoice.update({ where: { id: inv.id }, data: { discount } });
    revalidatePath("/app/fees");
    return { ok: true, message: "Discount applied." };
  } catch (e) {
    return failed(e);
  }
}
