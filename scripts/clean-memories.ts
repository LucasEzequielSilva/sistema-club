/**
 * Limpieza manual de memorias redundantes o desactualizadas
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter } as any);

  // Memorias a eliminar por ser: redundantes, de estado temporal, o info que el sistema ya conoce
  const toDelete = [
    // test-account-id: datos que el sistema ya calcula dinámicamente + redundancias
    "No hay ingresos registrados",           // duplicado con "No hay ingresos registrados aún"
    "El negocio está en el módulo de Ventas", // estado temporal irrelevante
    "Puede registrar una venta, agregar un producto o un proveedor", // consejo genérico
    "Tiene acceso a otros módulos como Compras o Finanzas", // obvio del sistema
    "No hay ingresos registrados aún",        // info dinámica que el sistema ya ve
    "No hay ventas ni compras registradas aún", // info dinámica
    "El negocio tiene 4 proveedores registrados", // info dinámica
    "El negocio tiene 13 métodos de pago configurados", // info dinámica
    "El negocio tiene 7 productos cargados, divididos en 6 categorías: Alimentos, Bebidas, Celulares, Limpieza, Living y Varios", // info dinámica
    "Los productos están distribuidos en 6 categorías", // redundante
    // mati-account-id: datos dinámicos
    "1 producto cargado",
    "6 categorías disponibles: Bikinis, Calzado, Mano de obra, Pantalones, Remeras, Ropa interior",
    "3 métodos de pago configurados",
    "1 proveedor registrado",
    "No hay ventas ni compras registradas aún",
    "La lista de precios de los productos se puede ver en la sección de Productos y Punto de Venta",
  ];

  let deleted = 0;
  for (const content of toDelete) {
    const result = await db.userMemory.deleteMany({ where: { content } });
    if (result.count > 0) {
      console.log(`✓ Eliminada: "${content}"`);
      deleted += result.count;
    }
  }

  console.log(`\nEliminadas: ${deleted} memorias`);

  // Ver qué quedó
  const remaining = await db.userMemory.findMany({ orderBy: [{ accountId: "asc" }, { category: "asc" }] });
  console.log("\nMemorias restantes:");
  remaining.forEach((m: any) => console.log(`  [${m.accountId}] [${m.category}] ${m.content}`));
  console.log("Total:", remaining.length);

  await db.$disconnect();
}

main().catch(console.error);
