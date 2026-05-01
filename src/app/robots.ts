import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://acelerator.matirandazzook.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: [
          "/admin/",
          "/api/",
          "/onboarding",
          "/tablero",
          "/ventas",
          "/compras",
          "/pos",
          "/productos",
          "/proveedores",
          "/clasificaciones",
          "/mercaderia",
          "/facturacion",
          "/cashflow",
          "/cuadro-resumen",
          "/cuentas",
          "/estados-resultados",
          "/resumen",
          "/settings",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
