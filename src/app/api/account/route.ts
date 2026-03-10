import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

async function getAccountId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session?.accountId ?? null;
}

// GET /api/account — obtener configuración del negocio
export async function GET(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, taxStatus: true, ivaRate: true, includeIvaInCost: true },
  });
  if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  return NextResponse.json(account);
}

// PATCH /api/account — actualizar configuración del negocio
export async function PATCH(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, taxStatus, ivaRate, includeIvaInCost } = body as {
    name?: string;
    taxStatus?: "monotributista" | "responsable_inscripto";
    ivaRate?: number;
    includeIvaInCost?: boolean;
  };

  const updated = await db.account.update({
    where: { id: accountId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(taxStatus !== undefined && { taxStatus }),
      ...(ivaRate !== undefined && { ivaRate }),
      ...(includeIvaInCost !== undefined && { includeIvaInCost }),
    },
    select: { id: true, name: true, taxStatus: true, ivaRate: true, includeIvaInCost: true },
  });

  return NextResponse.json(updated);
}
