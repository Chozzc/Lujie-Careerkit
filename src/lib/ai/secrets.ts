import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "v1";
const ALGORITHM = "aes-256-gcm";

export function encryptLocalSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getLocalKey(), iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptLocalSecret(value: string | null | undefined) {
  if (!value) return "";

  try {
    const [version, iv, tag, encrypted] = value.split(".");
    if (version !== PREFIX || !iv || !tag || !encrypted) return "";

    const decipher = createDecipheriv(ALGORITHM, getLocalKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export function previewSecret(value: string) {
  if (!value) return "";
  if (value.length < 12) return "已保存";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getLocalKey() {
  return createHash("sha256")
    .update(process.env.LUJIE_SETTINGS_SECRET ?? process.env.DATABASE_URL ?? "lujie-careerkit-local")
    .digest();
}
