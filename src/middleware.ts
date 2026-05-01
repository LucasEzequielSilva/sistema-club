import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";

// Rutas públicas que no requieren sesión
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/api/admin/bug-capture", // Error capture público — cualquiera puede reportar un crash
  "/api/support", // Canal de soporte público — sesión opcional, logueamos email si hay
  "/api/admin/v1", // API REST pública: auth con Bearer token dentro de cada handler, NO via cookie. Cubre /api/admin/v1 (index) y /api/admin/v1/...
  "/brand/", // Assets de branding (logos, favicon render) — accesibles desde /login
  "/fonts/", // Fuentes locales — accesibles desde todas las pantallas públicas
  "/_next/",
  "/favicon.ico",
  "/icon", // Next.js dynamic favicon (icon.svg, icon.png, etc.)
  "/apple-icon", // Apple touch icon
  "/opengraph-image", // OG miniatura para WhatsApp / FB / IG / X
  "/twitter-image", // Twitter card image
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
];

const ONBOARDING_PATH = "/onboarding";
const ONBOARDING_COOKIE = "sc_onboarding_done";
const ADMIN_PREFIX = "/admin";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Dejar pasar rutas públicas
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (pathname === "/login") {
      const token = req.cookies.get(COOKIE_NAME)?.value;
      if (token) {
        const session = await verifySessionToken(token);
        if (session) {
          // Logueado visitando /login → mandarlo al onboarding o al tablero
          const onboarded = req.cookies.get(ONBOARDING_COOKIE)?.value === "1";
          return NextResponse.redirect(
            new URL(onboarded ? "/tablero" : ONBOARDING_PATH, req.url)
          );
        }
      }
    }
    return NextResponse.next();
  }

  // Verificar sesión
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    // Requests de API → 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    // Páginas → redirigir al login
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
    const res = NextResponse.redirect(loginUrl);
    if (token) res.cookies.delete(COOKIE_NAME);
    return res;
  }

  // ── Admin gate ──────────────────────────────────────────────
  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (!isAdminEmail(session.email)) {
      // No sos admin → redirect al tablero
      return NextResponse.redirect(new URL("/tablero", req.url));
    }
    // Admin autorizado — NO aplicar chequeo de onboarding
    return NextResponse.next();
  }

  // Usuario autenticado — verificar onboarding
  const onboarded = req.cookies.get(ONBOARDING_COOKIE)?.value === "1";

  // Si ya hizo el onboarding y vuelve a /onboarding → mandarlo al tablero
  if (pathname.startsWith(ONBOARDING_PATH) && onboarded) {
    return NextResponse.redirect(new URL("/tablero", req.url));
  }

  // Si NO hizo el onboarding y trata de ir a otra página (no onboarding, no API) → /onboarding
  if (
    !onboarded &&
    !pathname.startsWith(ONBOARDING_PATH) &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Matchear todo excepto archivos estáticos de Next.js
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
