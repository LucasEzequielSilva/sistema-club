// Use default Prisma client configuration
// For Prisma 7, configuration comes from prisma.config.ts and .env
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const db = global.prisma || new PrismaClient({} as any);

if (process.env.NODE_ENV !== "production") global.prisma = db;

export { db };
