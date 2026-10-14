import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { BorrowerPayoutChannel, BorrowerRiskRating, BorrowerStatus } from "@/generated/prisma/enums";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

// Client regeneration can leave a previous schema's client in the dev cache.
const cachedPrisma = globalForPrisma.prisma;
const schemaFingerprint = [BorrowerPayoutChannel, BorrowerRiskRating, BorrowerStatus]
  .map((values) => Object.values(values).join(","))
  .join("|") + "|borrowersCode-v1|repayment-v1";
export const prisma =
  cachedPrisma?.banking &&
  cachedPrisma?.borrowers &&
  globalForPrisma.prismaSchemaFingerprint === schemaFingerprint
    ? cachedPrisma
    : new PrismaClient({ adapter });

if (cachedPrisma && cachedPrisma !== prisma) {
  void cachedPrisma.$disconnect().catch(() => {});
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaFingerprint = schemaFingerprint;
}
