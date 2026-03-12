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
 * GET /api/productos/purchases?productId=xxx
 * Devuelve todas las compras de un producto ordenadas por fecha desc.
 */
export async function GET(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId)
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });

  // Verificar que el producto pertenece a esta cuenta
  const product = await db.product.findFirst({
    where: { id: productId, accountId },
    select: { id: true },
  });
  if (!product)
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  const purchases = await db.purchase.findMany({
    where: { productId, accountId },
    orderBy: { invoiceDate: "desc" },
    include: {
      supplier: { select: { id: true, name: true } },
      costCategory: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(purchases);
}
