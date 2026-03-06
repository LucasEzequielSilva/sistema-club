import { NextRequest } from "next/server";
import { db } from "@/server/db";

const ACCOUNT_ID = "test-account-id";

const VALID_UNITS = ["unidad", "kg", "litro", "metro", "par"] as const;
type ValidUnit = (typeof VALID_UNITS)[number];

// ─────────────────────────────────────────────────────────────
// POST /api/chat/action
// Ejecuta acciones en nombre del usuario vía Clubi
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tipo } = body;

    // ── CREAR PRODUCTO ────────────────────────────────────────
    if (tipo === "crear_producto") {
      const { nombre, costo = 0, precio_venta, categoria, unidad = "unidad" } = body;

      if (!nombre?.trim()) {
        return Response.json({ error: "El nombre es obligatorio" }, { status: 400 });
      }

      // Resolver categoría por nombre (fuzzy, case-insensitive)
      const categories = await db.productCategory.findMany({
        where: { accountId: ACCOUNT_ID, isActive: true },
      });

      if (!categories.length) {
        return Response.json(
          { error: "No hay categorías disponibles. Creá una primero en Clasificaciones." },
          { status: 400 }
        );
      }

      const term = (categoria || "").toLowerCase().trim();
      const catMatch =
        categories.find((c) => c.name.toLowerCase() === term) ||
        categories.find((c) => c.name.toLowerCase().includes(term)) ||
        categories[0];

      // Verificar duplicado
      const existing = await db.product.findFirst({
        where: { accountId: ACCOUNT_ID, name: nombre.trim() },
      });
      if (existing) {
        return Response.json(
          { error: `Ya existe un producto con el nombre "${nombre}"` },
          { status: 409 }
        );
      }

      const safeUnit: ValidUnit = VALID_UNITS.includes(unidad as ValidUnit)
        ? (unidad as ValidUnit)
        : "unidad";

      const costoNum = Math.max(0, Number(costo) || 0);
      const pvNum = Math.max(0, Number(precio_venta) || 0);

      // Crear producto
      const product = await db.product.create({
        data: {
          accountId: ACCOUNT_ID,
          categoryId: catMatch.id,
          name: nombre.trim(),
          unit: safeUnit,
          origin: "comprado",
          initialStock: 0,
          minStock: 0,
          acquisitionCost: costoNum,
          rawMaterialCost: 0,
          laborCost: 0,
          packagingCost: 0,
          lastCostUpdate: new Date(),
        },
      });

      // Crear PriceListItems con markup calculado desde precio_venta
      const priceLists = await db.priceList.findMany({
        where: { accountId: ACCOUNT_ID, isActive: true },
      });

      let markupDefault = 0;
      if (pvNum > 0 && costoNum > 0) {
        markupDefault = Math.round(((pvNum / costoNum - 1) * 100) * 100) / 100;
      }

      if (priceLists.length > 0) {
        const defaultList = priceLists.find((l) => l.isDefault) ?? priceLists[0];
        await db.priceListItem.createMany({
          data: priceLists.map((list) => ({
            priceListId: list.id,
            productId: product.id,
            markupPct: list.id === defaultList.id ? markupDefault : 0,
          })),
        });
      }

      // Calcular margen de contribución para devolver al frontend (Clubi lo puede mostrar)
      const marginPct = pvNum > 0 ? Math.round(((pvNum - costoNum) / pvNum) * 100) : null;

      return Response.json({
        ok: true,
        id: product.id,
        nombre: product.name,
        categoria: catMatch.name,
        unidad: safeUnit,
        costo: costoNum,
        precio_venta: pvNum || null,
        markup: markupDefault,
        margen_pct: marginPct,
      });
    }

    // ── REGISTRAR COBRO ──────────────────────────────────────
    if (tipo === "registrar_cobro") {
      const { sale_id, monto } = body;
      const montoNum = Math.max(0, Number(monto) || 0);

      if (montoNum <= 0) {
        return Response.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
      }

      // Buscar venta: por ID si viene, si no la más reciente pendiente
      let sale;
      if (sale_id) {
        sale = await db.sale.findFirst({
          where: { id: sale_id, accountId: ACCOUNT_ID },
          include: { payments: true },
        });
      } else {
        sale = await db.sale.findFirst({
          where: { accountId: ACCOUNT_ID, status: { in: ["pending", "partial"] } },
          orderBy: { saleDate: "desc" },
          include: { payments: true },
        });
      }

      if (!sale) {
        return Response.json({ error: "No se encontró venta pendiente de cobro" }, { status: 404 });
      }

      // Buscar método de pago para el campo obligatorio paymentMethodId
      const paymentMethod = await db.paymentMethod.findFirst({
        where: { accountId: ACCOUNT_ID, isActive: true },
      });

      if (!paymentMethod) {
        return Response.json(
          { error: "No hay métodos de pago configurados." },
          { status: 400 }
        );
      }

      // Registrar pago
      await db.salePayment.create({
        data: {
          saleId: sale.id,
          paymentMethodId: paymentMethod.id,
          amount: montoNum,
          paymentDate: new Date(),
          notes: "Registrado por Clubi",
        },
      });

      // Recalcular status — totalAmount = unitPrice * quantity * (1 - discountPct/100)
      const saleTotal = sale.unitPrice * sale.quantity * (1 - sale.discountPct / 100);
      const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0) + montoNum;
      const newStatus = totalPaid >= saleTotal ? "paid" : "partial";

      await db.sale.update({
        where: { id: sale.id },
        data: { status: newStatus },
      });

      return Response.json({
        ok: true,
        venta_id: sale.id,
        concepto: sale.notes ?? "Venta",
        monto_cobrado: montoNum,
        nuevo_estado: newStatus === "paid" ? "Cobrada" : "Parcial",
      });
    }

    // ── TIPO DESCONOCIDO ──────────────────────────────────────
    return Response.json({ error: `Acción "${tipo}" no reconocida` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al ejecutar la acción";
    return Response.json({ error: msg }, { status: 500 });
  }
}
