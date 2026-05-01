import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, COOKIE_NAME } from "@/lib/session";
import { hashPassword, isHashed, verifyPassword } from "@/lib/password";
import { db } from "@/server/db";
import { loginLimiter, clientId, rateLimitedResponse } from "@/lib/rate-limit";
import { makeLogger } from "@/lib/logger";

const logger = makeLogger("auth");

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 días en segundos

export async function POST(req: NextRequest) {
  const { success, reset } = await loginLimiter.limit(clientId(req));
  if (!success) return rateLimitedResponse(reset);

  try {
    const body = await req.json();
    const email: string = body.email ?? "";
    const password: string = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Validar contra DB
    const user = await db.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        isActive: true,
      },
    });

    const passwordOk = user
      ? isHashed(user.password)
        ? await verifyPassword(user.password, password)
        : user.password === password
      : false;

    if (!user || !passwordOk) {
      logger.warn("Login fallido", {
        email: email.trim().toLowerCase(),
        ip: clientId(req),
        reason: !user ? "user_not_found" : "bad_password",
      });
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Lazy migration: si el password en DB todavía está en plain text, migralo ahora que validamos.
    if (!isHashed(user.password)) {
      const newHash = await hashPassword(password);
      await db.user.update({ where: { id: user.id }, data: { password: newHash } });
    }

    const token = await createSessionToken(user.accountId, email);

    // Determinar si la cuenta ya completó el onboarding (tiene productos)
    const productCount = await db.product.count({
      where: { accountId: user.accountId, isActive: true },
    });
    const onboarded = productCount > 0;

    // Devolver el redirect destino para que el frontend lo use
    const res = NextResponse.json({ ok: true, redirect: onboarded ? "/tablero" : "/onboarding" });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    if (onboarded) {
      const ONE_YEAR_S = 365 * 24 * 60 * 60;
      res.cookies.set("sc_onboarding_done", "1", {
        path: "/",
        maxAge: ONE_YEAR_S,
        sameSite: "lax",
        httpOnly: true,
      });
    }

    return res;
  } catch (err) {
    logger.error("Falló POST /api/auth/login", err, { ip: clientId(req) });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
