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

const MAX_SCREENSHOT_BYTES = 800_000; // ~600KB png base64
const MAX_DESCRIPTION_CHARS = 5000;
const MAX_METADATA_BYTES = 4000;

function escapeDiscord(s: string): string {
  return s
    .replace(/@(everyone|here)/gi, "@​$1")    // zero-width space
    .replace(/<@!?\d+>/g, (m) => m.replace(/^</, "<​"))  // user/role pings
    .replace(/\]\(/g, "]​(")                  // markdown links
    .replace(/```/g, "`​``")                  // code block escape
    .slice(0, 1900);                                // hard truncate
}

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

  const safeTitle = escapeDiscord(payload.title);
  const safeDescription = payload.description ? escapeDiscord(payload.description) : null;
  const safeUserEmail = payload.userEmail ? escapeDiscord(payload.userEmail) : null;
  const safeUrl = payload.url ? escapeDiscord(payload.url) : null;
  const safeUserAgent = payload.userAgent ? escapeDiscord(payload.userAgent) : null;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  if (safeUserEmail) {
    fields.push({ name: "Usuario", value: safeUserEmail, inline: true });
  }
  if (safeUrl) {
    fields.push({
      name: "Página",
      value: safeUrl.length > 200 ? safeUrl.slice(0, 200) + "…" : safeUrl,
      inline: true,
    });
  }
  fields.push({
    name: "Captura",
    value: payload.hasScreenshot ? "Sí" : "No",
    inline: true,
  });
  if (safeDescription) {
    fields.push({
      name: "Descripción",
      value:
        safeDescription.length > 1000
          ? safeDescription.slice(0, 1000) + "…"
          : safeDescription,
    });
  }
  if (safeUserAgent) {
    fields.push({
      name: "User-Agent",
      value:
        safeUserAgent.length > 200
          ? safeUserAgent.slice(0, 200) + "…"
          : safeUserAgent,
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
        title: `${meta.emoji} ${meta.label} — ${safeTitle}`,
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

    if (typeof body.screenshot === "string" && body.screenshot.length > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ error: "Screenshot demasiado grande (máx 600KB)" }, { status: 413 });
    }
    if (typeof body.description === "string" && body.description.length > MAX_DESCRIPTION_CHARS) {
      return NextResponse.json({ error: "Descripción demasiado larga" }, { status: 413 });
    }
    if (body.metadata && JSON.stringify(body.metadata).length > MAX_METADATA_BYTES) {
      return NextResponse.json({ error: "Metadata demasiado grande" }, { status: 413 });
    }

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
