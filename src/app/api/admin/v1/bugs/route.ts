import { NextRequest, NextResponse } from "next/server";
import { requireApiToken } from "@/lib/api-auth";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

const VALID_STATUS = new Set(["open", "investigating", "resolved", "wontfix"]);
const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"]);

export async function GET(req: NextRequest) {
  const auth = requireApiToken(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const source = searchParams.get("source") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const limitRaw = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(200, limitRaw))
    : 50;

  const where: Prisma.BugReportWhereInput = {};
  if (status && status !== "all") {
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${[...VALID_STATUS].join(", ")}` },
        { status: 400 }
      );
    }
    where.status = status;
  }
  if (severity && severity !== "all") {
    if (!VALID_SEVERITY.has(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${[...VALID_SEVERITY].join(", ")}` },
        { status: 400 }
      );
    }
    where.severity = severity;
  }
  if (source) where.source = source;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { userEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  const bugs = await db.bugReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      accountId: true,
      userEmail: true,
      source: true,
      severity: true,
      status: true,
      title: true,
      description: true,
      url: true,
      userAgent: true,
      stackTrace: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, bugs, count: bugs.length });
}

export async function POST(req: NextRequest) {
  const auth = requireApiToken(req);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Field `title` is required" },
      { status: 400 }
    );
  }

  const description =
    typeof body?.description === "string" ? body.description : null;
  const severity =
    typeof body?.severity === "string" && VALID_SEVERITY.has(body.severity)
      ? body.severity
      : "medium";
  const source =
    typeof body?.source === "string" && body.source.trim()
      ? body.source.trim()
      : "external-api";
  const metadata =
    body?.metadata && typeof body.metadata === "object"
      ? (body.metadata as Prisma.InputJsonValue)
      : undefined;

  const bug = await db.bugReport.create({
    data: {
      title,
      description,
      severity,
      source,
      status: "open",
      ...(metadata !== undefined ? { metadata } : {}),
    },
  });

  return NextResponse.json({ ok: true, id: bug.id, bug }, { status: 201 });
}
