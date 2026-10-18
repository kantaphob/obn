import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { BorrowerPayoutChannel, BorrowerRiskRating, BorrowerStatus, ContractStatus } from "@/generated/prisma/enums";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

// Prisma clients survive HMR through globalThis, so bump the fingerprint when
// schema fields change to replace a cached client with the regenerated model.
const cachedPrisma = globalForPrisma.prisma;
const schemaFingerprint = [BorrowerPayoutChannel, BorrowerRiskRating, BorrowerStatus, ContractStatus]
  .map((values) => Object.values(values).join(","))
  .join("|") + "|borrowersCode-v1|repayment-v1|draft-doc-v1|personal-lender-v1|company-owner-doc-v2|company-owner-v7|company-address-v3|company-sequence-v1|company-ledger-v1|company-finance-categories-v1|loanlogs-v2|loan-applications-v1|borrower-recycle-bin-v1|contract-renumber-v1|auth-rbac-v1|user-profiles-v1";
export const prisma =
  cachedPrisma?.loanApplication &&
  cachedPrisma?.banking &&
  cachedPrisma?.borrowers &&
  cachedPrisma?.companySequence &&
  cachedPrisma?.companyFinanceCategory &&
  cachedPrisma?.user &&
  cachedPrisma?.role &&
    globalForPrisma.prismaSchemaFingerprint === `${schemaFingerprint}|auth-rbac-v1|user-profiles-v1`
    ? cachedPrisma
    : new PrismaClient({ adapter });

if (cachedPrisma && cachedPrisma !== prisma) {
  void cachedPrisma.$disconnect().catch(() => {});
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaFingerprint = `${schemaFingerprint}|auth-rbac-v1|user-profiles-v1`;
}
