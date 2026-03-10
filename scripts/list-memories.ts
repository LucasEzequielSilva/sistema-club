import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter } as any);
  const mems = await db.userMemory.findMany({ orderBy: [{ category: "asc" }, { createdAt: "asc" }] });
  mems.forEach((m: any) => console.log(`[${m.accountId}] [${m.category}] ${m.content}`));
  console.log("\nTotal:", mems.length);
  await db.$disconnect();
}

main().catch(console.error);
