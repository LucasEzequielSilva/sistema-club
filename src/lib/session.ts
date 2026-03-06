// Web Crypto API — compatible con Edge Runtime y Node.js 18+
// No usa el módulo 'crypto' de Node.js para poder correr en el middleware Edge

export const COOKIE_NAME = "sc_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function fromb64url(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function getKey(): Promise<CryptoKey> {
  const secret =
    process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me-in-prod";
  return globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signToken(payload: string): Promise<string> {
  const key = await getKey();
  const payloadBytes = enc.encode(payload);
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, payloadBytes);
  return `${b64url(payloadBytes)}.${b64url(new Uint8Array(sig))}`;
}

async function verifyToken(token: string): Promise<string | null> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  try {
    const payloadBytes = fromb64url(token.slice(0, dot));
    const sigBytes = fromb64url(token.slice(dot + 1));
    const key = await getKey();
    const valid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      payloadBytes.buffer as ArrayBuffer
    );
    if (!valid) return null;
    return dec.decode(payloadBytes);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────

export type SessionPayload = {
  accountId: string;
  email: string;
  exp: number;
};

export async function createSessionToken(
  accountId: string,
  email: string
): Promise<string> {
  const payload: SessionPayload = {
    accountId,
    email: email.trim().toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  return signToken(JSON.stringify(payload));
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  const raw = await verifyToken(token);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export type UserEntry = {
  email: string;
  password: string;
  accountId: string;
};

/** Parsea AUTH_USERS="email:pass:accountId,..." */
export function parseUsers(): UserEntry[] {
  const raw = process.env.AUTH_USERS ?? "";
  if (!raw) {
    // Fallback single-user
    const email = process.env.AUTH_EMAIL ?? "";
    const password = process.env.AUTH_PASSWORD ?? "";
    if (email && password) return [{ email: email.toLowerCase(), password, accountId: "test-account-id" }];
    return [];
  }
  return raw.split(",").map((u) => {
    const parts = u.trim().split(":");
    return {
      email: parts[0].trim().toLowerCase(),
      password: parts[1].trim(),
      accountId: parts[2]?.trim() ?? "test-account-id",
    };
  });
}

/** Solo para API routes (Node.js runtime) — no usar en middleware */
export function checkCredentials(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return parseUsers().some(
    (u) => u.email === normalizedEmail && u.password === password
  );
}

/** Devuelve el accountId correspondiente al email */
export function getAccountIdForEmail(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  return parseUsers().find((u) => u.email === normalizedEmail)?.accountId ?? "test-account-id";
}
