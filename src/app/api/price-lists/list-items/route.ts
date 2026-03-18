import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

async function getAccountId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session?.accountId ?? null;
}

function calcUnitCost(p: {
  acquisitionCost: number;
  rawMaterialCost: number;
  laborCost: number;
  packagingCost: number;
}) {
  return (
    (p.acquisitionCost || 0) +
    (p.rawMaterialCost || 0) +
    (p.laborCost || 0) +
    (p.packagingCost || 0)
  );
}

export async function GET(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const priceListId = new URL(req.url).searchParams.get("priceListId");
  if (!priceListId) {
    return NextResponse.json({ error: "priceListId requerido" }, { status: 400 });
  }

  const priceList = await db.priceList.findFirst({ where: { id: priceListId, accountId } });
  if (!priceList) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { taxStatus: true, ivaRate: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const items = await db.priceListItem.findMany({
    where: { priceListId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          isActive: true,
          acquisitionCost: true,
          rawMaterialCost: true,
          laborCost: true,
          packagingCost: true,
        },
      },
    },
    orderBy: { product: { name: "asc" } },
  });

  const enriched = items
    .filter((it) => it.product?.isActive)
    .map((it) => {
      const unitCost = calcUnitCost(it.product);
      const salePrice = unitCost * (1 + it.markupPct / 100);
      const contributionMargin = salePrice - unitCost;
      const marginPct = salePrice > 0 ? (contributionMargin / salePrice) * 100 : 0;
      const salePriceWithIva =
        account.taxStatus === "responsable_inscripto"
          ? salePrice * (1 + account.ivaRate / 100)
          : null;

      return {
        productId: it.productId,
        productName: it.product.name,
        markupPct: it.markupPct,
        unitCost: Math.round(unitCost * 100) / 100,
        salePrice: Math.round(salePrice * 100) / 100,
        salePriceWithIva:
          salePriceWithIva !== null ? Math.round(salePriceWithIva * 100) / 100 : null,
        contributionMargin: Math.round(contributionMargin * 100) / 100,
        marginPct: Math.round(marginPct * 100) / 100,
      };
    });

  return NextResponse.json(enriched);
}

export async function PATCH(req: NextRequest) {
  const accountId = await getAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { priceListId, productId, markupPct } = body as {
    priceListId?: string;
    productId?: string;
    markupPct?: number;
  };

  if (!priceListId || !productId || markupPct === undefined || markupPct === null) {
    return NextResponse.json(
      { error: "priceListId, productId y markupPct son requeridos" },
      { status: 400 }
    );
  }

  const priceList = await db.priceList.findFirst({ where: { id: priceListId, accountId } });
  if (!priceList) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  const item = await db.priceListItem.upsert({
    where: {
      priceListId_productId: {
        priceListId,
        productId,
      },
    },
    create: {
      priceListId,
      productId,
      markupPct,
    },
    update: {
      markupPct,
    },
  });

  return NextResponse.json(item);
}
