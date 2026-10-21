import { getCurrentAccess } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { matchesBusinessSystem } from "@/lib/company-system";
import { authorizeCentralFinanceRequest } from "@/lib/central-finance-access";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorizeCentralFinanceRequest(request, "write");
  if (denied) return denied;
  const access = await getCurrentAccess();
  if (!access) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const system = new URL(request.url).searchParams.get("system");
  if (system !== "NETFLIX" && system !== "YOUTUBE") return Response.json({ error: "การเปลี่ยนสถานะรายการนี้ยังไม่รองรับ" }, { status: 400 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;
  if (action !== "approve" && action !== "pay" && action !== "receive") return Response.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  const { id } = await params;
  if (system === "NETFLIX" && id.startsWith("netflix-")) {
    const netflixId = id.slice("netflix-".length);
    const netflixEntry = await prisma.netflixLedgerEntry.findUnique({ where: { id: netflixId } });
    if (!netflixEntry) return Response.json({ error: "ไม่พบรายการรับ–จ่าย" }, { status: 404 });
    if (action === "receive") {
      if (netflixEntry.type !== "INCOME" || netflixEntry.status !== "PENDING_RECEIPT") return Response.json({ error: "รายการนี้ไม่ได้อยู่ในสถานะรอยืนยันรับเงิน" }, { status: 409 });
      const receivedOn = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
      const result = await prisma.$transaction(async (tx) => {
        if (netflixEntry.source === "MEMBER_INVOICE" && netflixEntry.profileId) {
          const billingMonth = netflixEntry.sourceKey.split(":").at(-1) ?? "";
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)) throw new Error("ข้อมูลเดือนในใบแจ้งหนี้ไม่ถูกต้อง");
          await tx.netflixPayment.upsert({
            where: { profileId_billingMonth: { profileId: netflixEntry.profileId, billingMonth } },
            create: { profileId: netflixEntry.profileId, groupId: netflixEntry.groupId, groupName: netflixEntry.groupName ?? "Netflix", profileName: netflixEntry.profileName ?? "สมาชิก", billingMonth, amountSatang: netflixEntry.amountSatang, paidOn: receivedOn },
            update: { groupId: netflixEntry.groupId, groupName: netflixEntry.groupName ?? "Netflix", profileName: netflixEntry.profileName ?? "สมาชิก", amountSatang: netflixEntry.amountSatang, paidOn: receivedOn },
          });
        }
        const updated = await tx.netflixLedgerEntry.update({ where: { id: netflixId }, data: { status: "PAID", transactionOn: receivedOn, paidAt: new Date(), paidBy: access.session.user.id } });
        return updated;
      });
      return Response.json({ entry: result });
    }
    if (action === "pay") {
      if (netflixEntry.type !== "EXPENSE" || !["APPROVED", "PENDING_PAYMENT"].includes(netflixEntry.status)) return Response.json({ error: "รายการนี้ยังไม่พร้อมยืนยันการจ่ายเงินจริง" }, { status: 409 });
      const paidOn = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
      const updated = await prisma.netflixLedgerEntry.update({ where: { id: netflixId }, data: { status: "PAID", transactionOn: paidOn, paidAt: new Date(), paidBy: access.session.user.id } });
      return Response.json({ entry: updated });
    }
    if (netflixEntry.type !== "EXPENSE" || netflixEntry.status !== "PENDING_APPROVAL") return Response.json({ error: "รายการนี้ไม่อยู่ในสถานะรออนุมัติ" }, { status: 409 });
    const updated = await prisma.netflixLedgerEntry.update({ where: { id: netflixId }, data: { status: "APPROVED", approvedAt: new Date(), approvedBy: access.session.user.id } });
    return Response.json({ entry: updated });
  }
  if (action === "receive" && system !== "NETFLIX") return Response.json({ error: "การยืนยันรับเงินยังไม่รองรับในระบบนี้" }, { status: 400 });
  const entry = await prisma.companyLedgerEntry.findUnique({ where: { id } });
  if (!entry) return Response.json({ error: "ไม่พบรายการรับ–จ่าย" }, { status: 404 });
  if (!entry.companyCode || !entry.branchCode || (access.accessConfigured && !access.companyCodes.includes(entry.companyCode))) return Response.json({ error: "ไม่มีสิทธิ์เข้าถึงรายการนี้" }, { status: 403 });
  const company = await prisma.companySequence.findFirst({ where: { companycode: entry.companyCode, type: "COMPANY", status: "ACTIVE" }, select: { nameTH: true, nameEN: true } });
  const branch = entry.branchCode === entry.companyCode ? null : await prisma.branchCodeSequence.findFirst({ where: { companycode: entry.companyCode, branchcode: entry.branchCode, type: "BRANCH", status: "ACTIVE" }, select: { nameTH: true, nameEN: true } });
  const matchesSystem = entry.branchCode === entry.companyCode
    ? Boolean(company && matchesBusinessSystem(system, company.nameTH, company.nameEN))
    : Boolean(branch && matchesBusinessSystem(system, branch.nameTH, branch.nameEN));
  if (!matchesSystem) return Response.json({ error: `รายการนี้ไม่ใช่ของระบบ ${system}` }, { status: 403 });

  const expectedStatus = action === "approve" ? "PENDING_APPROVAL" : action === "receive" ? "PENDING_RECEIPT" : "APPROVED";
  const data = action === "approve"
    ? { settlementStatus: "APPROVED", approvedAt: new Date(), approvedBy: access.session.user.id }
    : { settlementStatus: "PAID", transactionDate: new Date(), timeRecorded: true, paidAt: new Date(), paidBy: access.session.user.id };
  const updated = await prisma.companyLedgerEntry.updateMany({ where: { id, type: action === "receive" ? "INCOME" : "EXPENSE", settlementStatus: expectedStatus }, data });
  if (updated.count !== 1) return Response.json({ error: action === "approve" ? "รายการนี้ไม่อยู่ในสถานะรออนุมัติ" : action === "receive" ? "รายการนี้ไม่ได้อยู่ในสถานะรอยืนยันรับเงิน" : "ต้องอนุมัติรายการก่อนบันทึกจ่าย" }, { status: 409 });
  const updatedEntry = await prisma.companyLedgerEntry.findUnique({ where: { id } });
  return Response.json({ entry: updatedEntry });
}
