const HARDCODED_ADMIN_EMAILS = [
  "luxassilva@gmail.com",
  "damatojoel25@gmail.com",
];

function parseEnvEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function adminEmails(): string[] {
  return Array.from(
    new Set([...HARDCODED_ADMIN_EMAILS, ...parseEnvEmails()].map((e) => e.toLowerCase()))
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
