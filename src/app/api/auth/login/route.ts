import { NextRequest, NextResponse } from "next/server";
import {
  checkCredentials,
  createSessionToken,
  COOKIE_NAME,
} from "@/lib/session";

const ACCOUNT_ID = "test-account-id";
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

    if (!checkCredentials(email, password)) {
      // Delay de 500ms para dificultar brute-force
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(ACCOUNT_ID, email);
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
