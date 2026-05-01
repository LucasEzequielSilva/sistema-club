import { NextRequest, NextResponse } from "next/server";
import { requireApiToken } from "@/lib/api-auth";
import { db } from "@/server/db";
import { adminApiLimiter, clientId, rateLimitedResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const { success, reset } = await adminApiLimiter.limit(clientId(req));
  if (!success) return rateLimitedResponse(reset);

  const auth = requireApiToken(req);
  if (!auth.ok) return auth.response;

  const [
    accounts,
    users,
    products,
    sales,
    purchases,
    openBugs,
    criticalBugs,
  ] = await Promise.all([
    db.account.count(),
    db.user.count(),
    db.product.count(),
    db.sale.count(),
    db.purchase.count(),
    db.bugReport.count({ where: { status: "open" } }),
    db.bugReport.count({
      where: { severity: "critical", status: { not: "resolved" } },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    counts: {
      accounts,
      users,
      products,
      sales,
      purchases,
      openBugs,
      criticalBugs,
    },
    timestamp: new Date().toISOString(),
  });
}
