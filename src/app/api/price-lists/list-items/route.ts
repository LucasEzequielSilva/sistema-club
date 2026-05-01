import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import {
  deriveMarkup,
  normalizeRoundingMode,
  roundPrice,
} from "@/lib/rounding";

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

  const isRI = account.taxStatus === "responsable_inscripto";
  const roundingMode = normalizeRoundingMode(priceList.roundingMode);

  const enriched = items
    .filter((it) => it.product?.isActive)
    .map((it) => {
      const unitCost = calcUnitCost(it.product);
      const rawSalePrice = unitCost * (1 + it.markupPct / 100);
      const rawSalePriceWithIva = isRI
        ? rawSalePrice * (1 + account.ivaRate / 100)
        : null;

      let effectiveSalePrice = rawSalePrice;
      let effectiveSalePriceWithIva = rawSalePriceWithIva;
      let markupPctEffective = it.markupPct;
      let rounded = false;

      if (roundingMode !== "none" && unitCost > 0) {
        const targetGross = isRI ? rawSalePriceWithIva ?? 0 : rawSalePrice;
        if (targetGross > 0) {
          const roundedGross = roundPrice(targetGross, roundingMode);
          if (roundedGross !== targetGross) {
            rounded = true;
            if (isRI) {
              effectiveSalePriceWithIva = roundedGross;
              effectiveSalePrice = roundedGross / (1 + account.ivaRate / 100);
            } else {
              effectiveSalePrice = roundedGross;
            }
            markupPctEffective = deriveMarkup(unitCost, effectiveSalePrice);
          }
        }
      }

      const contributionMargin = effectiveSalePrice - unitCost;
      const marginPct =
        effectiveSalePrice > 0
          ? (contributionMargin / effectiveSalePrice) * 100
          : 0;

      return {
        productId: it.productId,
        productName: it.product.name,
        markupPct: it.markupPct,
        markupPctEffective: Math.round(markupPctEffective * 100) / 100,
        unitCost: Math.round(unitCost * 100) / 100,
        salePrice: Math.round(effectiveSalePrice * 100) / 100,
        salePriceWithIva:
          effectiveSalePriceWithIva !== null
            ? Math.round(effectiveSalePriceWithIva * 100) / 100
            : null,
        rawSalePrice: Math.round(rawSalePrice * 100) / 100,
        rawSalePriceWithIva:
          rawSalePriceWithIva !== null
            ? Math.round(rawSalePriceWithIva * 100) / 100
            : null,
        contributionMargin: Math.round(contributionMargin * 100) / 100,
        marginPct: Math.round(marginPct * 100) / 100,
        roundingMode,
        rounded,
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
