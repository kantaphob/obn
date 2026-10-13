import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

// Client regeneration can leave a previous schema's client in the dev cache.
const cachedPrisma = globalForPrisma.prisma;
export const prisma =
  cachedPrisma?.classifier ? cachedPrisma : new PrismaClient({ adapter });

if (cachedPrisma && cachedPrisma !== prisma) {
  void cachedPrisma.$disconnect().catch(() => {});
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
