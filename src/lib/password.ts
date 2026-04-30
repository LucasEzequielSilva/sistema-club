import argon2 from "argon2";

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB (OWASP minimum)
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Detecta si un string ya es un hash argon2 (empieza con $argon2id$, $argon2i$, $argon2d$). */
export function isHashed(value: string): boolean {
  return /^\$argon2(id|i|d)\$/.test(value);
}
