import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, COOKIE_NAME } from "@/lib/session";
import { db } from "@/server/db";

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 días en segundos

export async function POST(req: NextRequest) {
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

    if (!user || user.password !== password) {
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(user.accountId, email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
