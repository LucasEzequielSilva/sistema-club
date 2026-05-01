import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

async function getAccountId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session?.accountId ?? null;
}

// GET /api/price-lists — listar
export async function GET(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const lists = await db.priceList.findMany({
    where: { accountId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true, sales: true } } },
  });
  return NextResponse.json(lists);
}

// POST /api/price-lists — crear
export async function POST(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, isDefault } = body as { name: string; isDefault?: boolean };

  if (!name?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  try {
    // Si es default, quitar el flag de las demás
    if (isDefault) {
      await db.priceList.updateMany({ where: { accountId }, data: { isDefault: false } });
    }

    const list = await db.priceList.create({
      data: { accountId, name: name.trim(), isDefault: isDefault ?? false },
    });

    // Auto-crear PriceListItems para todos los productos activos (markup 0%)
    const products = await db.product.findMany({
      where: { accountId, isActive: true },
      select: { id: true },
    });
    if (products.length > 0) {
      await db.priceListItem.createMany({
        data: products.map((p) => ({ priceListId: list.id, productId: p.id, markupPct: 0 })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(list, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: `Ya existe una lista llamada "${name}"` }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear la lista" }, { status: 500 });
  }
}

// PATCH /api/price-lists — actualizar (renombrar, cambiar default)
export async function PATCH(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, name, isDefault, isActive, roundingMode } = body as {
    id: string;
    name?: string;
    isDefault?: boolean;
    isActive?: boolean;
    roundingMode?: string;
  };

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Verificar que pertenece a este account
  const existing = await db.priceList.findFirst({ where: { id, accountId } });
  if (!existing) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });

  if (
    roundingMode !== undefined &&
    !["none", "up10", "up50", "up100"].includes(roundingMode)
  ) {
    return NextResponse.json(
      { error: "roundingMode inválido" },
      { status: 400 }
    );
  }

  if (isDefault) {
    await db.priceList.updateMany({ where: { accountId }, data: { isDefault: false } });
  }

  const updated = await db.priceList.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(isDefault !== undefined && { isDefault }),
      ...(isActive !== undefined && { isActive }),
      ...(roundingMode !== undefined && { roundingMode }),
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/price-lists?id=xxx — eliminar
export async function DELETE(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const existing = await db.priceList.findFirst({ where: { id, accountId } });
  if (!existing) return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  if (existing.isDefault) return NextResponse.json({ error: "No podés eliminar la lista predeterminada" }, { status: 400 });

  await db.priceList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
