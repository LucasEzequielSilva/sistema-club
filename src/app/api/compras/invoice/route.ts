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
 * GET /api/compras/invoice?purchaseId=xxx
 * Dado un purchaseId, devuelve todos los ítems de esa misma factura
 * (mismo invoiceNumber + supplierId + accountId).
 * Si la compra no tiene invoiceNumber, devuelve solo ese ítem.
 */
export async function GET(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const purchaseId = new URL(req.url).searchParams.get("purchaseId");
  if (!purchaseId)
    return NextResponse.json({ error: "purchaseId requerido" }, { status: 400 });

  // Cargar la compra pivot
  const pivot = await db.purchase.findFirst({
    where: { id: purchaseId, accountId },
    include: {
      supplier: { select: { id: true, name: true } },
      payments: {
        include: { paymentMethod: { select: { id: true, name: true } } },
        orderBy: { paymentDate: "asc" },
      },
    },
  });

  if (!pivot)
    return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });

  // Si tiene invoiceNumber, buscar todos los ítems de esa factura
  let items;
  if (pivot.invoiceNumber) {
    items = await db.purchase.findMany({
      where: {
        accountId,
        invoiceNumber: pivot.invoiceNumber,
        supplierId: pivot.supplierId ?? undefined,
      },
      include: {
        product: { select: { id: true, name: true, unit: true } },
        costCategory: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  } else {
    // Sin número de factura: solo este ítem
    items = await db.purchase.findMany({
      where: { id: purchaseId, accountId },
      include: {
        product: { select: { id: true, name: true, unit: true } },
        costCategory: { select: { id: true, name: true } },
      },
    });
  }

  // Calcular totales
  const totals = items.reduce(
    (acc, item) => {
      const subtotal = item.unitCost * item.quantity * (1 - item.discountPct / 100);
      const total = subtotal + item.ivaAmount;
      return {
        subtotal: acc.subtotal + subtotal,
        iva: acc.iva + item.ivaAmount,
        total: acc.total + total,
      };
    },
    { subtotal: 0, iva: 0, total: 0 }
  );

  const totalPaid = pivot.payments.reduce((s, p) => s + p.amount, 0);

  return NextResponse.json({
    // Encabezado de la factura
    header: {
      invoiceNumber: pivot.invoiceNumber,
      invoiceDate: pivot.invoiceDate,
      dueDate: pivot.dueDate,
      supplier: pivot.supplier,
      status: pivot.status,
      notes: pivot.notes,
    },
    // Ítems
    items: items.map((item) => ({
      id: item.id,
      concept: item.product?.name ?? item.description ?? "—",
      productUnit: item.product?.unit ?? null,
      costCategory: item.costCategory.name,
      quantity: item.quantity,
      unitCost: item.unitCost,
      discountPct: item.discountPct,
      ivaAmount: item.ivaAmount,
      subtotal: item.unitCost * item.quantity * (1 - item.discountPct / 100),
      total:
        item.unitCost * item.quantity * (1 - item.discountPct / 100) +
        item.ivaAmount,
    })),
    // Pagos
    payments: pivot.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod.name,
    })),
    // Totales
    totals: {
      ...totals,
      paid: totalPaid,
      pending: Math.max(0, totals.total - totalPaid),
    },
  });
}
