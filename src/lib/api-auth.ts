import { NextRequest, NextResponse } from "next/server";

function parseTokens(): string[] {
  return (process.env.ADMIN_API_TOKENS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function requireApiToken(
  req: NextRequest
): { ok: true } | { ok: false; response: NextResponse } {
  const authHeader = req.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : "";
  const validTokens = parseTokens();

  if (!token || validTokens.length === 0 || !validTokens.includes(token)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Unauthorized",
          hint: "Include header `Authorization: Bearer <ADMIN_API_TOKEN>`",
        },
        { status: 401 }
      ),
    };
  }
  return { ok: true };
}
