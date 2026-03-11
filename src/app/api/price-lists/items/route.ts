import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

async function getAccountId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session?.accountId ?? null;
}

/**
 * POST /api/price-lists/items
 * Upsert del markup de un producto en la lista default.
 * Si no existe ninguna lista, crea "Lista General" como default.
 * Body: { productId, markupPct }
 */
export async function POST(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { productId, markupPct } = body as {
    productId: string;
    markupPct: number;
  };

  if (!productId)
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });
  if (markupPct === undefined || markupPct === null)
    return NextResponse.json({ error: "markupPct requerido" }, { status: 400 });

  // Verificar que el producto pertenece a esta cuenta
  const product = await db.product.findFirst({
    where: { id: productId, accountId },
  });
  if (!product)
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  // Buscar lista default; si no hay ninguna, crear "Lista General"
  let priceList = await db.priceList.findFirst({
    where: { accountId, isDefault: true },
  });

  if (!priceList) {
    priceList = await db.priceList.create({
      data: {
        accountId,
        name: "Lista General",
        isDefault: true,
      },
    });
  }

  // Upsert del item
  const item = await db.priceListItem.upsert({
    where: {
      priceListId_productId: {
        priceListId: priceList.id,
        productId,
      },
    },
    create: {
      priceListId: priceList.id,
      productId,
      markupPct,
    },
    update: {
      markupPct,
    },
  });

  return NextResponse.json({ item, priceListName: priceList.name });
}

/**
 * GET /api/price-lists/items?productId=xxx
 * Devuelve el markup del producto en la lista default (si existe).
 */
export async function GET(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId)
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });

  const priceList = await db.priceList.findFirst({
    where: { accountId, isDefault: true },
  });

  if (!priceList) {
    return NextResponse.json({ markupPct: null, priceListName: null });
  }

  const item = await db.priceListItem.findUnique({
    where: {
      priceListId_productId: {
        priceListId: priceList.id,
        productId,
      },
    },
  });

  return NextResponse.json({
    markupPct: item?.markupPct ?? null,
    priceListName: priceList.name,
  });
}
