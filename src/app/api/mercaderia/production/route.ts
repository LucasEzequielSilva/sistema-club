import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

function parseLocalDateInput(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Evita corrimiento por timezone al parsear fecha sin hora
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

async function getAccountId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session?.accountId ?? null;
}

/**
 * POST /api/mercaderia/production
 * Registra una orden de producción: sube el stock del producto fabricado.
 * Body: { productId, quantity, movementDate, notes? }
 */
export async function POST(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { productId, quantity, movementDate, notes } = body as {
    productId: string;
    quantity: number;
    movementDate: string;
    notes?: string;
  };

  if (!productId)
    return NextResponse.json({ error: "productId requerido" }, { status: 400 });
  if (!quantity || quantity <= 0)
    return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 });
  if (!movementDate)
    return NextResponse.json({ error: "movementDate requerido" }, { status: 400 });

  // Verificar que el producto pertenece a esta cuenta y es fabricado
  const product = await db.product.findFirst({
    where: { id: productId, accountId },
  });
  if (!product)
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  if (product.origin !== "fabricado")
    return NextResponse.json(
      { error: "Solo se puede registrar producción para productos con origen 'fabricado'" },
      { status: 400 }
    );

  const unitCost =
    (product.acquisitionCost ?? 0) +
    (product.rawMaterialCost ?? 0) +
    (product.laborCost ?? 0) +
    (product.packagingCost ?? 0);

  const movement = await db.stockMovement.create({
    data: {
      accountId,
      productId,
      movementType: "production",
      quantity,
      unitCost: unitCost > 0 ? unitCost : null,
      referenceType: "production",
      movementDate: parseLocalDateInput(movementDate),
      notes: notes || null,
    },
  });

  return NextResponse.json(movement, { status: 201 });
}
