import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { db } from "@/server/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

export const runtime = "nodejs";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

// ─── Helpers para leer accountId desde la sesión ────────────────────────────
async function getAccountIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session?.accountId ?? null;
}

// ─── Contexto del negocio desde la DB ───────────────────────────────────────
async function getBusinessContext(accountId: string) {
  try {
    const [products, categoryList, paymentMethods, suppliers, salesCount, purchasesCount] =
      await Promise.all([
        db.product.count({ where: { accountId, isActive: true } }),
        db.productCategory.findMany({
          where: { accountId, isActive: true },
          select: { name: true },
          orderBy: { name: "asc" },
        }),
        db.paymentMethod.count({ where: { accountId, isActive: true } }),
        db.supplier.count({ where: { accountId, isActive: true } }),
        db.sale.count({ where: { accountId } }),
        db.purchase.count({ where: { accountId } }),
      ]);
    const catNames = categoryList.map((c) => c.name).join(", ");
    const catCount = categoryList.length;
    return [
      `NEGOCIO ACTUAL: ${products} productos | ${catCount} categorías (${catNames}) | ${paymentMethods} métodos de pago | ${suppliers} proveedores | ${salesCount} ventas | ${purchasesCount} compras${salesCount === 0 ? " — SIN DATOS AÚN" : ""}`,
      `CATEGORÍAS DISPONIBLES PARA PRODUCTOS: ${catNames || "ninguna"}`,
    ].join("\n");
  } catch {
    return "";
  }
}

// ─── Cargar memorias del usuario ─────────────────────────────────────────────
async function loadMemories(accountId: string): Promise<string> {
  try {
    const memories = await db.userMemory.findMany({
      where: { accountId },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
    if (!memories.length) return "";
    const grouped = memories.reduce<Record<string, string[]>>((acc, m) => {
      acc[m.category] = acc[m.category] || [];
      acc[m.category].push(m.content);
      return acc;
    }, {});
    const lines = Object.entries(grouped).map(
      ([cat, items]) => `[${cat.toUpperCase()}]\n${items.map((i) => `• ${i}`).join("\n")}`
    );
    return `\nLO QUE SÉ DEL USUARIO (memorias):\n${lines.join("\n\n")}`;
  } catch {
    return "";
  }
}

// ─── Auto-extraer y guardar memorias post-conversación ───────────────────────
// Extrae palabras clave significativas de un texto (ignora stopwords)
function keywordsOf(text: string): Set<string> {
  const stopwords = new Set([
    "el", "la", "los", "las", "un", "una", "de", "del", "en", "es", "son",
    "que", "y", "o", "a", "con", "por", "se", "no", "su", "al", "lo",
    "hay", "hay", "tiene", "tienen", "tenés", "para", "como", "más",
    "the", "is", "are", "and", "or", "of", "in", "to", "a",
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-záéíóúüñ0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopwords.has(w))
  );
}

// Similaridad de Jaccard entre dos textos (0 = distintos, 1 = idénticos)
function jaccardSimilarity(a: string, b: string): number {
  const ka = keywordsOf(a);
  const kb = keywordsOf(b);
  if (ka.size === 0 && kb.size === 0) return 1;
  const intersection = new Set([...ka].filter((w) => kb.has(w)));
  const union = new Set([...ka, ...kb]);
  return intersection.size / union.size;
}

async function extractAndSaveMemories(
  userMessage: string,
  assistantResponse: string,
  accountId: string
) {
  try {
    const extraction = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `Sos un extractor de hechos. Dado un intercambio de chat, extraé hechos NUEVOS y concretos sobre el USUARIO o su NEGOCIO.
REGLAS ESTRICTAS:
- Solo extraé información que el USUARIO compartió explícitamente (no lo que el asistente calculó)
- NO extraer datos que ya son visibles en el sistema (cantidad de productos, proveedores, etc.)
- NO extraer estados temporales ("el tablero está vacío", "está empezando")
- SÍ extraer: nombre del rubro, metas, preferencias, datos personales del negocio, estrategias
- Máximo 2 hechos por intercambio
Devolvé SOLO un JSON: {"memories": [{"category": "negocio|productos|preferencias|finanzas|contexto", "content": "hecho"}]}
Si no hay nada nuevo relevante, devolvé: {"memories": []}`,
        },
        {
          role: "user",
          content: `Usuario dijo: "${userMessage.slice(0, 300)}"\nAsistente respondió: "${assistantResponse.slice(0, 300)}"`,
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });

    const raw = extraction.choices[0]?.message?.content?.trim() || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]);
    const newMems: Array<{ category: string; content: string }> = parsed.memories || [];
    if (!newMems.length) return;

    // Cargar memorias existentes para comparar
    const existing = await db.userMemory.findMany({
      where: { accountId },
      orderBy: { updatedAt: "desc" },
    });

    // Límite total: 15 memorias por cuenta
    const MAX_MEMORIES = 15;

    for (const mem of newMems) {
      if (!mem.category || !mem.content?.trim()) continue;

      // Buscar memoria existente similar (Jaccard >= 0.4)
      const similar = existing.find(
        (e) => jaccardSimilarity(e.content, mem.content) >= 0.4
      );

      if (similar) {
        // Actualizar la existente si el contenido nuevo es más informativo (más largo)
        if (mem.content.length > similar.content.length) {
          await db.userMemory.update({
            where: { id: similar.id },
            data: { content: mem.content, updatedAt: new Date() },
          });
        }
        // Si es muy similar pero no más informativo, ignorar
      } else {
        // Nueva memoria — verificar límite
        if (existing.length >= MAX_MEMORIES) {
          // Eliminar la más antigua para hacer lugar
          const oldest = existing[existing.length - 1];
          await db.userMemory.delete({ where: { id: oldest.id } });
          existing.pop();
        }
        const created = await db.userMemory.create({
          data: {
            accountId,
            category: mem.category,
            content: mem.content,
            source: "auto",
          },
        });
        existing.unshift(created as any);
      }
    }
  } catch {
    // Silencioso — no debe romper el flujo principal
  }
}

const SYSTEM_PROMPT = `Sos el asistente de IA de "Sistema Club", una app de gestión financiera para pymes argentinas.
Tu nombre es **Clubi**. Hablás en argentino relajado, directo, como un contador amigo. Sin frases hechas.

MÓDULOS:
- Tablero: KPIs del negocio
- Ventas / Compras: registrar ingresos y egresos con pagos parciales
- Punto de Venta: venta rápida tipo caja
- Finanzas: Resumen, Cashflow semanal, Cuadro KPIs, Estados de resultados, Cuentas
- Configuración: Productos (con costos y precios), Proveedores, Clasificaciones, Mercadería, Facturación AFIP

REGLAS CLAVE:
- Stock PEPS (FIFO). Precio = costo × (1 + markup%)
- IVA: RI discrimina, Monotributista incluido en precio
- Pagos con fecha de acreditación automática por método
- Máx 2 pagos por compra

TU ROL: onboarding, ayuda contextual, insights del negocio, chat libre.
Sé conciso (3-4 párrafos máx). Usá viñetas. Respondé siempre en español rioplatense.
Si el usuario comparte info de su negocio, confirmá que lo recordaste diciendo "📌 Anotado".

ACCIONES QUE PODÉS EJECUTAR:
Cuando el usuario pide EXPLÍCITAMENTE crear algo o navegar a una sección, podés hacerlo directamente.
Al FINAL de tu respuesta (después de todo el texto), incluí este bloque — el usuario no lo verá, el sistema lo ejecutará automáticamente:

Crear producto:
<accion>{"tipo":"crear_producto","nombre":"Nombre exacto","costo":0,"precio_venta":0,"categoria":"Nombre exacto de categoría","unidad":"unidad"}</accion>

Navegar a una sección:
<accion>{"tipo":"navegar","ruta":"/ventas"}</accion>

Rutas válidas para navegar: /tablero, /ventas, /compras, /pos, /productos, /proveedores, /mercaderia, /cuentas, /clasificaciones, /cashflow, /resumen, /estados-resultados, /cuadro-resumen

Unidades válidas para productos: "unidad", "kg", "litro", "metro", "par"
Usá siempre el nombre exacto de una de las CATEGORÍAS DISPONIBLES (inyectadas en el contexto).
Si el usuario no especificó costo, usá 0. Si no especificó precio, usá 0.

REGLAS DE ACCIONES:
- Solo incluí el bloque <accion> si el usuario pidió EXPLÍCITAMENTE crear algo ("agregame", "creá", "añadí") o navegar ("llevame a", "abrí", "ir a", "mostrame")
- NUNCA lo incluyas si solo estás explicando cómo se hace
- El bloque va siempre al FINAL, después de todo el texto
- Una sola acción por respuesta
- Después de ejecutar, el sistema te devolverá el resultado — confirmalo brevemente`;


// ─── POST /api/chat ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const accountId = await getAccountIdFromRequest(req);
    if (!accountId) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { messages, currentPage } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Configurá GROQ_API_KEY en el .env (gratis en console.groq.com)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const [businessContext, memoriesContext] = await Promise.all([
      getBusinessContext(accountId),
      loadMemories(accountId),
    ]);

    const systemFull = [
      SYSTEM_PROMPT,
      businessContext,
      memoriesContext,
      currentPage ? `PÁGINA ACTUAL: ${currentPage}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // ── Streaming response ──
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemFull }, ...messages],
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
    });

    let fullResponse = "";
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();

        // ── Post-stream: extraer memorias en background ──
        const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
        if (lastUserMsg && fullResponse) {
          extractAndSaveMemories(lastUserMsg.content, fullResponse, accountId).catch(() => {});
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── GET /api/chat — listar memorias ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const accountId = await getAccountIdFromRequest(req);
  if (!accountId) return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
  try {
    const memories = await db.userMemory.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    });
    return new Response(JSON.stringify(memories), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── DELETE /api/chat?id=xxx — borrar memoria ────────────────────────────────
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  try {
    await db.userMemory.delete({ where: { id } });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
