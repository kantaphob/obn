import GroupManagementPanel from "./GroupManagementPanel";
import { prisma } from "@/lib/prisma";

export default async function YouTubeGroupManagementPage() {
  const [groups, directory] = await Promise.all([
    prisma.youtubeBillingGroup.findMany({
      include: { seats: { orderBy: { position: "asc" } } },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
    }),
    prisma.youtubeMember.findMany({ include: { accounts: true }, orderBy: { name: "asc" } }),
  ]);
  const allSeats = groups.flatMap((group) => group.seats);
  const seatByAccountId = new Map(allSeats.filter((seat) => seat.accountId).map((seat) => [seat.accountId!, seat]));
  const memberOptions = directory.flatMap((member) => member.accounts.map((account) => {
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
  }).concat([
    { value: `member:${member.id}`, memberId: member.id, accountId: "", name: member.name, email: "", billingMonths: null, priceSatang: null },
  ]));
  return <GroupManagementPanel groups={groups} memberOptions={memberOptions} />;
}
