import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

const ONE_YEAR_S = 365 * 24 * 60 * 60;
export const ONBOARDING_COOKIE = "sc_onboarding_done";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ONBOARDING_COOKIE, "1", {
    path: "/",
    maxAge: ONE_YEAR_S,
    sameSite: "lax",
    httpOnly: true,
  });
  return res;
}
