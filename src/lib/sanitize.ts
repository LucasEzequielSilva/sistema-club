/**
 * Sanitización defensiva para inputs free-text de usuarios.
 * NO sustituye el escape de React — es una capa extra para campos que:
 *  - Se inyectan en HTML (ticket POS, emails, Discord embeds)
 *  - Se exponen en API REST
 *  - Se renderizan en Markdown / dangerouslySetInnerHTML (raros pero existen)
 */

const SCRIPT_TAG_RE = /<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi;
const ON_EVENT_RE = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_PROTOCOL_RE = /\b(javascript|data|vbscript)\s*:/gi;
const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/gi;

/**
 * Strip de HTML completo: deja solo texto plano.
 * Usar cuando el campo NUNCA debe contener HTML (nombre de producto, email, etc).
 */
export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(SCRIPT_TAG_RE, "")
    .replace(HTML_TAG_RE, "")
    .replace(JS_PROTOCOL_RE, "")
    .trim();
}

/**
 * Sanitización suave: quita scripts, on-events y protocolos peligrosos
 * pero deja markup inocuo (b/i/em). Usar para descripciones / notas.
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input
    .replace(SCRIPT_TAG_RE, "")
    .replace(ON_EVENT_RE, "")
    .replace(JS_PROTOCOL_RE, "")
    .trim();
}

/**
 * Detecta si un string parece tener intento de inyección.
 * Útil para flagging o reject explícito.
 */
export function looksMalicious(input: string): boolean {
  if (!input) return false;
  // Use fresh regex instances — globals share lastIndex across .test() calls.
  return (
    /<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/i.test(input) ||
    /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.test(input) ||
    /\bjavascript\s*:/i.test(input)
  );
}

/**
 * Refinement de Zod listo para usar:
 *   z.string().refine(noScripts, "Texto contiene scripts no permitidos")
 */
export function noScripts(value: string): boolean {
  return !looksMalicious(value);
}
