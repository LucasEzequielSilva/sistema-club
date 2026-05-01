import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { supportLimiter, clientId, rateLimitedResponse } from "@/lib/rate-limit";
import { makeLogger } from "@/lib/logger";
import { stripHtml } from "@/lib/sanitize";

const logger = makeLogger("support");

type SupportType = "bug" | "suggestion" | "question";

type SupportBody = {
  title?: string;
  description?: string;
  type?: SupportType;
  screenshot?: string;
  metadata?: Record<string, unknown>;
};

const TYPE_META: Record<SupportType, { label: string; emoji: string; color: number }> = {
  bug: { label: "Bug", emoji: "🐛", color: 0xe11d48 }, // rojo
  suggestion: { label: "Sugerencia", emoji: "💡", color: 0x0052fe }, // azul eléctrico Acelerator
  question: { label: "Consulta", emoji: "❓", color: 0x00bcd1 }, // turquesa
};

async function notifyDiscord(payload: {
  id: string;
  type: SupportType;
  title: string;
  description: string | null;
  url: string | null;
  userEmail: string | null;
  userAgent: string | null;
  hasScreenshot: boolean;
}) {
  const webhookUrl = process.env.DISCORD_SUPPORT_WEBHOOK_URL;
  if (!webhookUrl) return; // No configurado — no hacemos nada

  const meta = TYPE_META[payload.type];

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  if (payload.userEmail) {
    fields.push({ name: "Usuario", value: payload.userEmail, inline: true });
  }
  if (payload.url) {
    fields.push({
      name: "Página",
      value: payload.url.length > 200 ? payload.url.slice(0, 200) + "…" : payload.url,
      inline: true,
    });
  }
  fields.push({
    name: "Captura",
    value: payload.hasScreenshot ? "Sí" : "No",
    inline: true,
  });
  if (payload.description) {
    fields.push({
      name: "Descripción",
      value:
        payload.description.length > 1000
          ? payload.description.slice(0, 1000) + "…"
          : payload.description,
    });
  }
  if (payload.userAgent) {
    fields.push({
      name: "User-Agent",
      value:
        payload.userAgent.length > 200
          ? payload.userAgent.slice(0, 200) + "…"
          : payload.userAgent,
    });
  }
  fields.push({
    name: "ID reporte",
    value: `\`${payload.id}\``,
    inline: true,
  });

  const body = {
    username: "Acelerator Support",
    avatar_url: "https://matiasrandazzo.com/brand/icon-app.png", // opcional
    embeds: [
      {
        title: `${meta.emoji} ${meta.label} — ${payload.title}`,
        color: meta.color,
        fields,
        footer: { text: "Acelerator · by Matías Randazzo" },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // No fallar el request principal — solo loggear (warn, no error: no rompe la respuesta).
    logger.warn("Discord webhook failed", {
      error: err instanceof Error ? err.message : String(err),
      reportId: payload.id,
    });
  }
}

export async function POST(req: NextRequest) {
  const { success, reset } = await supportLimiter.limit(clientId(req));
  if (!success) return rateLimitedResponse(reset);

  try {
    const body = (await req.json()) as SupportBody;
    const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
    // Sanitizar: el título se inyecta en Discord embeds y se devuelve por API.
    const title = stripHtml(rawTitle).slice(0, 200);
    if (!title) {
      return NextResponse.json(
        { error: "Falta el título del reporte" },
        { status: 400 }
      );
    }

    const type: SupportType =
      body.type === "bug" || body.type === "suggestion" || body.type === "question"
        ? body.type
        : "bug";

    // Sesión opcional — si hay cookie válida, logueamos email + accountId
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    // Headers automáticos
    const url =
      req.headers.get("referer") ?? req.nextUrl?.origin ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;

    const rawDescription =
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : null;
    // Sanitizar descripción — también se reenvía a Discord.
    const description = rawDescription
      ? stripHtml(rawDescription).slice(0, 5000)
      : null;

    const screenshot =
      typeof body.screenshot === "string" && body.screenshot.length > 0
        ? body.screenshot
        : null;

    // Sanitizar valores de metadata (solo strings shallow). El screenshot
    // intencionalmente NO está acá: se procesa por separado.
    const rawMetadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const cleanMetadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawMetadata)) {
      cleanMetadata[key] =
        typeof value === "string" ? stripHtml(value).slice(0, 1000) : value;
    }
    const metadata = {
      type,
      ...cleanMetadata,
    };

    const report = await db.bugReport.create({
      data: {
        accountId: session?.accountId ?? null,
        userEmail: session?.email ?? null,
        source: "manual",
        severity: "medium",
        status: "open",
        title,
        description,
        url,
        userAgent,
        metadata,
        screenshot,
      },
      select: { id: true },
    });

    // Notificar al canal de Discord en paralelo (fire-and-forget, no bloqueante)
    void notifyDiscord({
      id: report.id,
      type,
      title,
      description,
      url,
      userEmail: session?.email ?? null,
      userAgent,
      hasScreenshot: !!screenshot,
    });

    return NextResponse.json({ ok: true, id: report.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo guardar el reporte";
    logger.error("Falló POST /api/support", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
