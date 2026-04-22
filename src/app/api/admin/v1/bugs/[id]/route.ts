import { NextRequest, NextResponse } from "next/server";
import { requireApiToken } from "@/lib/api-auth";
import { db } from "@/server/db";

const VALID_STATUS = new Set(["open", "investigating", "resolved", "wontfix"]);
const VALID_SEVERITY = new Set(["low", "medium", "high", "critical"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiToken(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const bug = await db.bugReport.findUnique({ where: { id } });
  if (!bug) {
    return NextResponse.json({ error: "Bug not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, bug });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiToken(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { status?: string; severity?: string } = {};
  if (body?.status !== undefined) {
    if (typeof body.status !== "string" || !VALID_STATUS.has(body.status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${[...VALID_STATUS].join(", ")}`,
        },
        { status: 400 }
      );
    }
    data.status = body.status;
  }
  if (body?.severity !== undefined) {
    if (
      typeof body.severity !== "string" ||
      !VALID_SEVERITY.has(body.severity)
    ) {
      return NextResponse.json(
        {
          error: `Invalid severity. Must be one of: ${[...VALID_SEVERITY].join(", ")}`,
        },
        { status: 400 }
      );
    }
    data.severity = body.severity;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update. Provide `status` and/or `severity`." },
      { status: 400 }
    );
  }

  try {
    const bug = await db.bugReport.update({ where: { id }, data });
    return NextResponse.json({ ok: true, bug });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Bug not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireApiToken(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await db.bugReport.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Bug not found" }, { status: 404 });
    }
    throw err;
  }
}
