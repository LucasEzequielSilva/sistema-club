// Twitter card reusa la misma imagen que Open Graph.
// Las consts (runtime/alt/size/contentType) tienen que estar declaradas
// literalmente en este archivo — Next no parsea re-exports.
import OpengraphImage from "./opengraph-image";

export const runtime = "edge";
export const alt = "Acelerator — Método Acelerador de Ganancias by Matías Randazzo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OpengraphImage;
