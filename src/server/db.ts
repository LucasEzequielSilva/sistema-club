// Prisma 7 with client engine requires an adapter for SQLite
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  // Prisma CLI creates dev.db at the project root (cwd).
  // The libsql adapter also resolves relative to cwd.
  // So we use "file:dev.db" to match where `prisma migrate dev` puts the DB.
  const adapter = new PrismaLibSql({ url: "file:dev.db" });
  return new PrismaClient({ adapter } as any);
}

const db = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = db;

export { db };
