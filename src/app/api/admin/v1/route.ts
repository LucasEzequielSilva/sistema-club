import { NextRequest, NextResponse } from "next/server";
import { requireApiToken } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = requireApiToken(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    service: "Acelerator Admin API",
    version: "v1",
    endpoints: {
      "GET /api/admin/v1": "Este índice",
      "GET /api/admin/v1/health":
        "Health check (no requiere token si se quiere público)",
      "GET /api/admin/v1/stats": "Stats agregadas del sistema (counts)",
      "GET /api/admin/v1/bugs":
        "Lista bugs — query params: status, severity, source, search, limit",
      "POST /api/admin/v1/bugs":
        "Crear bug manualmente — body: { title, description?, severity?, source? }",
      "GET /api/admin/v1/bugs/:id": "Detalle de un bug (incluye screenshot)",
      "PATCH /api/admin/v1/bugs/:id":
        "Actualizar bug — body: { status?, severity? }",
      "DELETE /api/admin/v1/bugs/:id": "Eliminar bug",
    },
    auth: "Authorization: Bearer <token> — token en ADMIN_API_TOKENS (coma-separados)",
  });
}
