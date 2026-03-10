/**
 * Script para deduplicar y consolidar memorias de Clubi IA.
 * Estrategia:
 * 1. Leer todas las memorias de la DB
 * 2. Usar Groq para consolidarlas en un conjunto mínimo sin redundancias
 * 3. Borrar las viejas y crear las nuevas consolidadas
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Groq from "groq-sdk";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter } as any);
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

  // Leer todas las memorias agrupadas por accountId
  const allMems = await db.userMemory.findMany({
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });

  const byAccount = new Map<string, typeof allMems>();
  for (const m of allMems) {
    if (!byAccount.has(m.accountId)) byAccount.set(m.accountId, []);
    byAccount.get(m.accountId)!.push(m);
  }

  for (const [accountId, mems] of byAccount) {
    console.log(`\n── Procesando account: ${accountId} (${mems.length} memorias) ──`);

    const memText = mems
      .map((m, i) => `${i + 1}. [${m.category}] ${m.content}`)
      .join("\n");

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Sos un asistente que consolida y deduplica memorias de un sistema de IA.
Tu tarea: dado un listado de memorias sobre un usuario/negocio, devolvé un JSON con las memorias CONSOLIDADAS:
- Eliminá duplicados exactos o casi exactos
- Fusioná memorias que digan lo mismo con distintas palabras en UNA sola
- Mantené solo información concreta y útil (datos numéricos, hechos específicos del negocio)
- Eliminá información vaga o temporal (ej: "el tablero está vacío", "está empezando desde cero")
- Máximo 10 memorias por cuenta
- Usá categorías: negocio, productos, proveedores, finanzas, preferencias, contexto

Devolvé SOLO este JSON válido:
{"memories": [{"category": "categoria", "content": "contenido consolidado"}]}`
        },
        {
          role: "user",
          content: `Memorias actuales:\n${memText}\n\nConsolidá estas memorias eliminando redundancias.`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.log("  ⚠ No se pudo parsear respuesta de Groq");
      continue;
    }

    const parsed = JSON.parse(match[0]);
    const consolidated: Array<{ category: string; content: string }> = parsed.memories || [];

    console.log(`  Consolidadas: ${mems.length} → ${consolidated.length} memorias`);
    consolidated.forEach((m) => console.log(`  ✓ [${m.category}] ${m.content}`));

    // Borrar las viejas
    const ids = mems.map((m) => m.id);
    await db.userMemory.deleteMany({ where: { id: { in: ids } } });

    // Crear las nuevas consolidadas
    if (consolidated.length > 0) {
      await db.userMemory.createMany({
        data: consolidated.map((m) => ({
          accountId,
          category: m.category,
          content: m.content,
          source: "auto",
        })),
      });
    }

    console.log(`  ✅ Memoria consolidada para ${accountId}`);
  }

  await db.$disconnect();
  console.log("\n✅ Deduplicación completada.");
}

main().catch(console.error);
