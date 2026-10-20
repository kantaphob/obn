import {
  ArrowDownRight, ArrowUpRight, CalendarClock, Check, CircleDollarSign, Clock3,
  Mail, Search, UsersRound, WalletCards,
} from "lucide-react";
import { Suspense } from "react";
import CreateGroupButton from "./CreateGroupButton";
import { prisma } from "@/lib/prisma";
import "./youtube.css";

export const instant = false;

const styles = new Proxy<Record<string, string>>({}, {
  get: (_target, name) => `yt-${String(name)}`,
});
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const money = (satang: number) => (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cycleText = (months: number[]) => {
  const unique = [...new Set(months)].sort((a, b) => a - b);
  if (!unique.length) return "ยังไม่กำหนดรอบ";
  if (unique.length === 1) return `ทุก ${unique[0]} เดือน`;
  return `หลายรอบ (${unique.map((month) => `${month} เดือน`).join(", ")})`;
};
const shortGroupId = (importKey: string, id: string) => {
  const imported = importKey.match(/youtube-csv-group-(\d+)/);
  return imported ? `กลุ่ม ${imported[1]}` : `YT-${id.slice(-5).toUpperCase()}`;
};

function Baht({ children }: { children: React.ReactNode }) {
  return <><span className={styles.currency}>฿</span>{children}</>;
}

export default function YouTubeGroupsPage() {
  return (
    <Suspense fallback={<main className={styles.page} aria-live="polite">กำลังโหลดข้อมูล YouTube…</main>}>
      <YouTubeGroupsContent />
    </Suspense>
  );
}

async function YouTubeGroupsContent() {
  const groups = await prisma.youtubeBillingGroup.findMany({
    include: { seats: { orderBy: { position: "asc" } } },
    orderBy: [{ createdAt: "desc" }, { name: "asc" }],
  });
  const selected = groups[0] ?? null;
  const allSeats = groups.flatMap((group) => group.seats);
  const knownSeats = allSeats.filter((seat) => seat.displayName || seat.email);
  const directory = await prisma.youtubeMember.findMany({ include: { accounts: true }, orderBy: { name: "asc" } });
  const seatByAccountId = new Map(allSeats.filter((seat) => seat.accountId).map((seat) => [seat.accountId!, seat]));
  const memberOptions = directory.flatMap((member) => [
    { value: `member:${member.id}`, memberId: member.id, accountId: "", name: member.name, email: "", billingMonths: null, priceSatang: null },
    ...member.accounts.map((account) => {
      const existingSeat = seatByAccountId.get(account.id);
      return {
        value: `account:${account.id}`,
        memberId: member.id,
        accountId: account.id,
        name: member.name,
        email: account.email,
        billingMonths: existingSeat?.billingMonths ?? null,
        priceSatang: existingSeat?.priceSatang ?? null,
      };
    }),
  ]);
  const paidSeats = allSeats.filter((seat) => seat.paymentStatus === "PAID");
  const pendingSeats = allSeats.filter((seat) => seat.paymentStatus === "PENDING");
  const unrecordedCount = allSeats.filter((seat) => seat.paymentStatus === "UNRECORDED").length;
  const paidAmount = paidSeats.reduce((total, seat) => total + (seat.priceSatang ?? 0), 0);
  const pendingAmount = pendingSeats.reduce((total, seat) => total + (seat.priceSatang ?? 0), 0);
  const selectedMembers = selected?.seats.filter((seat) => seat.displayName || seat.email) ?? [];
  const selectedMonths = selected?.seats.map((seat) => seat.billingMonths).filter((month): month is number => month !== null) ?? [];
  const selectedPrices = [...new Set(selected?.seats.map((seat) => seat.priceSatang).filter((price): price is number => price !== null) ?? [])];
  const activeGroups = groups.filter((group) => group.status === "ACTIVE").length;
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.breadcrumb}>ระบบสมาชิก <span>/</span> YouTube</div>
          <div className={styles.titleRow}>
            <div className={styles.titleIcon}><WalletCards size={23} /></div>
            <div><h1>จัดการกลุ่ม YouTube</h1><p>จัดการบัญชีสมาชิก รอบเรียกเก็บ และติดตามยอดชำระในหน้าเดียว</p></div>
          </div>
        </div>
        <CreateGroupButton memberOptions={memberOptions} />
      </header>

      <section className={styles.metrics} aria-label="ภาพรวม">
        <article className={styles.metricCard}><div className={cx(styles.metricIcon, styles.purple)}><UsersRound size={19} /></div><div className={styles.metricLabel}>กลุ่มที่ใช้งาน</div><div className={styles.metricValue}>{activeGroups} <small>กลุ่ม</small></div><div className={styles.metricFoot}>มีข้อมูลสมาชิก {knownSeats.length} ช่อง</div></article>
        <article className={styles.metricCard}><div className={cx(styles.metricIcon, styles.green)}><CircleDollarSign size={19} /></div><div className={styles.metricLabel}>ยอดที่บันทึกว่าชำระแล้ว</div><div className={styles.metricValue}><Baht>{money(paidAmount)}</Baht></div><div className={cx(styles.metricFoot, styles.positive)}><ArrowUpRight size={14} /> {paidSeats.length} ช่อง</div></article>
        <article className={styles.metricCard}><div className={cx(styles.metricIcon, styles.orange)}><Clock3 size={19} /></div><div className={styles.metricLabel}>ยอดรอชำระ</div><div className={styles.metricValue}><Baht>{money(pendingAmount)}</Baht></div><div className={cx(styles.metricFoot, styles.warning)}><ArrowDownRight size={14} /> ยังไม่บันทึก {unrecordedCount} ช่อง</div></article>
        <article className={styles.metricCard}><div className={cx(styles.metricIcon, styles.blue)}><CalendarClock size={19} /></div><div className={styles.metricLabel}>วันเรียกเก็บกลุ่มล่าสุด</div><div className={styles.metricValue}>{selected?.dueDay ?? "—"} <small>{selected?.dueDay ? "ของเดือน" : ""}</small></div><div className={styles.metricFoot}>{selected?.name ?? "ยังไม่มีกลุ่ม"}</div></article>
      </section>

      <section className={styles.workspace}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>กลุ่มของฉัน</h2><p>กลุ่มที่บันทึกไว้ในฐานข้อมูล</p></div></div>
          <label className={styles.searchBox}><Search size={16} /><input aria-label="ค้นหากลุ่ม" placeholder="ค้นหาชื่อกลุ่ม..." /></label>
          <div className={styles.groupList}>
            {groups.map((group, index) => {
              const memberCount = group.seats.filter((seat) => seat.displayName || seat.email).length;
              const months = group.seats.map((seat) => seat.billingMonths).filter((month): month is number => month !== null);
              const prices = [...new Set(group.seats.map((seat) => seat.priceSatang).filter((price): price is number => price !== null))];
              const totalSatang = group.seats.reduce((total, seat) => total + ((seat.displayName || seat.email) ? (seat.priceSatang ?? 0) : 0), 0);
              return <article key={group.id} className={cx(styles.groupItem, index === 0 && styles.selectedGroup)}>
                <div className={styles.groupLogo}>YT</div>
                <div className={styles.groupInfo}>
                  <div className={styles.groupNameLine}><h3>{group.name}</h3><span className={group.status === "ACTIVE" ? styles.statusActive : styles.statusPending}>{group.status === "ACTIVE" ? "กำลังใช้งาน" : "ข้อมูลไม่ครบ"}</span></div>
                  <div className={styles.groupMeta}>{shortGroupId(group.importKey, group.id)} <span>·</span> {cycleText(months)} <span>·</span> {memberCount} / 6 ช่อง</div>
                  <div className={styles.groupBottom}><span>รวม <Baht>{money(totalSatang)}</Baht></span><span>{prices.length === 1 ? <><Baht>{money(prices[0])}</Baht> / ช่อง</> : prices.length ? `${prices.length} อัตราราคา` : "ยังไม่ระบุราคา"}</span><span>{group.dueDay ? `เก็บทุกวันที่ ${group.dueDay}` : "ยังไม่กำหนดวัน"}</span></div>
                </div>
              </article>;
            })}
            {!groups.length && <div className={styles.emptyGroups}>ยังไม่มีกลุ่ม YouTube กด “สร้างกลุ่มใหม่” เพื่อเริ่มต้น</div>}
          </div>
          <div className={styles.panelFooter}>แสดง {groups.length} กลุ่ม</div>
        </div>

        <div className={cx(styles.panel, styles.detailPanel)}>
          {selected ? <>
            <div className={styles.detailHeader}><div><div className={styles.detailEyebrow}>รายละเอียดกลุ่ม <span>{shortGroupId(selected.importKey, selected.id)}</span></div><h2>{selected.name}</h2><p>{selected.status === "ACTIVE" ? <span className={styles.statusActive}>กำลังใช้งาน</span> : <span className={styles.statusPending}>ข้อมูลไม่ครบ</span>}</p></div></div>
            <div className={styles.billingSummary}>
              <div><span>รอบเรียกเก็บ</span><strong>{cycleText(selectedMonths)}</strong></div><div><span>วันเรียกเก็บ</span><strong>{selected.dueDay ? `ทุกวันที่ ${selected.dueDay}` : "ยังไม่ระบุ"}</strong></div>
              <div><span>ราคาต่อช่อง</span><strong>{selectedPrices.length === 1 ? <><Baht>{money(selectedPrices[0])}</Baht></> : selectedPrices.length ? `${selectedPrices.length} ราคา` : "ยังไม่ระบุ"}</strong></div><div><span>ช่องมีข้อมูล</span><strong>{selectedMembers.length} <small>/ 6 ช่อง</small></strong></div>
            </div>
            <div className={styles.subsectionHeading}><div><h3>บัญชีอีเมลในกลุ่ม</h3><p>บัญชีหลัก 1 บัญชี และบัญชีรองได้สูงสุด 5 บัญชี</p></div><span className={styles.capacity}>{selectedMembers.length} / 6 มีข้อมูล</span></div>
            <div className={styles.accountGrid}>
              {selected.seats.map((seat) => {
                const active = seat.sourceStatus === "ใช้งาน" || Boolean(seat.email);
                return <div key={seat.id} className={cx(styles.accountCard, !active && styles.emptyAccount)}>
                  <div className={styles.accountIcon}><Mail size={15} /></div><div className={styles.accountInfo}><span>{seat.position === 1 ? "บัญชีหลัก" : `บัญชีรอง ${seat.position - 1}`}</span><strong>{seat.email || seat.displayName || "ยังไม่ได้กำหนดอีเมล"}</strong></div>
                  <span className={active ? styles.accountActive : styles.accountVacant}>{active ? <Check size={12} /> : null}{active ? "มีข้อมูล" : "ว่าง"}</span>
                </div>;
              })}
            </div>
            <div className={styles.nextCollection}><div className={styles.collectionIcon}><CalendarClock size={17} /></div><div><strong>{selected.dueDay ? `เรียกเก็บทุกวันที่ ${selected.dueDay}` : "ยังไม่กำหนดวันเรียกเก็บ"}</strong><span>ข้อมูลการชำระยังไม่ถูกบันทึกจากไฟล์นำเข้า</span></div></div>
          </> : <div className={styles.emptyGroups}>เลือกสร้างกลุ่มใหม่เพื่อเริ่มจัดการข้อมูล YouTube</div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>สมาชิกและสถานะชำระ</h2><p>{selected ? `${selected.name} · คิดยอดแยกตามช่องและรอบ` : "ยังไม่มีกลุ่ม"}</p></div></div>
        <div className={styles.tableWrap}><table className={styles.memberTable}>
          <thead><tr><th>สมาชิก / บัญชี</th><th>ช่อง</th><th>ยอดต่อรอบ</th><th>สถานะชำระ</th><th>สถานะบัญชี</th></tr></thead>
          <tbody>{selectedMembers.map((seat) => {
            const label = seat.displayName || seat.email || "ไม่ระบุชื่อ";
            const paymentClass = seat.paymentStatus === "PAID" ? styles.paidBadge : seat.paymentStatus === "PENDING" ? styles.unpaidBadge : styles.unrecordedBadge;
            const paymentLabel = seat.paymentStatus === "PAID" ? "ชำระแล้ว" : seat.paymentStatus === "PENDING" ? "รอชำระ" : "ยังไม่บันทึก";
            return <tr key={seat.id}>
              <td><div className={styles.memberCell}><div className={styles.avatar}>{label.trim().slice(0, 1)}</div><div><strong>{label}</strong><span>{seat.email || seat.contactMethod || "ไม่มีอีเมลในไฟล์"}</span></div></div></td>
              <td>{seat.position === 1 ? "บัญชีหลัก" : `บัญชีรอง ${seat.position - 1}`}</td>
              <td>{seat.priceSatang === null ? <span className={styles.tableHint}>ยังไม่ระบุราคา</span> : <><strong><Baht>{money(seat.priceSatang)}</Baht></strong><span className={styles.tableHint}>{seat.billingMonths ? `ทุก ${seat.billingMonths} เดือน` : "ไม่ระบุรอบ"}</span></>}</td>
              <td><span className={paymentClass}><i />{paymentLabel}</span></td>
              <td>{seat.sourceStatus || (seat.email ? "มีอีเมล" : "ข้อมูลไม่ครบ")}</td>
            </tr>;
          })}</tbody>
        </table></div>
        <div className={styles.tableFooter}><span>แสดง {selectedMembers.length} ช่องที่มีข้อมูล จาก 6 ช่อง</span><span>บันทึกชำระแล้ว {selected?.seats.filter((seat) => seat.paymentStatus === "PAID").length ?? 0} ช่อง</span></div>
      </section>

      <div className={styles.draftNote}><span>ข้อมูลฐานข้อมูล</span> สถานะชำระเริ่มต้นเป็น “ยังไม่บันทึก” จนกว่าจะบันทึกรายการชำระ</div>
    </main>
  );
}
