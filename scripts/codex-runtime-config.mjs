import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SECRET_BYTES = 32;
const PLACEHOLDER = /^(replace-with|change-me)/i;

export async function ensureLocalAppEnvironment(root, baseEnvironment = process.env) {
  return ensureLocalEnvironment({
    root,
    fileName: ".env.local",
    templateName: ".env.example",
    baseEnvironment,
    includeBridge: false,
  });
}

export async function ensureLocalCodexEnvironment(root, baseEnvironment = process.env) {
  return ensureLocalEnvironment({
    root,
    fileName: ".env.codex",
    templateName: ".env.codex.example",
    fallbackName: ".env.local",
    baseEnvironment,
    includeBridge: true,
  });
}

export async function ensureDockerRuntimeSecrets(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "runtime-secrets.json");

  try {
    return validateRuntimeSecrets(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const generated = {
    LUJIE_SETTINGS_SECRET: generateSecret(),
    CODEX_BRIDGE_TOKEN: generateSecret(),
  };

  try {
    await writeFile(path, `${JSON.stringify(generated)}\n`, { flag: "wx", mode: 0o600 });
    return generated;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  return readRuntimeSecretsWithRetry(path);
}

export function parseEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    values[match[1]] = unquote(match[2]);
  }
  return values;
}

async function ensureLocalEnvironment({
  root,
  fileName,
  templateName,
  fallbackName,
  baseEnvironment,
  includeBridge,
}) {
  const path = join(root, fileName);
  const existing = await readOptional(path);
  const template = existing ?? (await readOptional(join(root, templateName))) ?? "";
  const fallback = fallbackName ? parseEnv((await readOptional(join(root, fallbackName))) ?? "") : {};
  const current = parseEnv(template);

  const settingsSecret = firstSecure(
    baseEnvironment.LUJIE_SETTINGS_SECRET,
    current.LUJIE_SETTINGS_SECRET,
    fallback.LUJIE_SETTINGS_SECRET,
  ) ?? generateSecret();
  let content = setEnvValue(template, "LUJIE_SETTINGS_SECRET", settingsSecret);

  let bridgeToken;
  if (includeBridge) {
    bridgeToken = firstSecure(baseEnvironment.CODEX_BRIDGE_TOKEN, current.CODEX_BRIDGE_TOKEN) ?? generateSecret();
    content = setEnvValue(content, "CODEX_BRIDGE_TOKEN", bridgeToken);
  }

  if (content !== existing) {
    await writeFile(path, content, { mode: 0o600 });
    await chmod(path, 0o600);
    console.log(`Created ${fileName} with automatically generated local encryption secrets.`);
  } else {
    await chmod(path, 0o600);
  }

  const fileValues = parseEnv(content);
  return {
    ...fileValues,
    ...baseEnvironment,
    DATABASE_URL:
      baseEnvironment.DATABASE_URL?.trim() ||
      fileValues.DATABASE_URL?.trim() ||
      fallback.DATABASE_URL?.trim() ||
      "file:./dev.db",
    LUJIE_SETTINGS_SECRET: settingsSecret,
    ...(includeBridge
      ? {
          CODEX_BRIDGE_HOST: "127.0.0.1",
          CODEX_BRIDGE_URL:
            baseEnvironment.CODEX_BRIDGE_URL?.trim() ||
            fileValues.CODEX_BRIDGE_URL?.trim() ||
            "http://127.0.0.1:4318",
          CODEX_BRIDGE_TOKEN: bridgeToken,
        }
      : {}),
  };
}

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, "m");
  if (pattern.test(content)) return ensureTrailingNewline(content.replace(pattern, line));
  return `${content.trimEnd()}${content.trim() ? "\n" : ""}${line}\n`;
}

function firstSecure(...values) {
  return values.find(isSecureSecret);
}

function isSecureSecret(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length >= 24 && !PLACEHOLDER.test(normalized);
}

function generateSecret() {
  return randomBytes(SECRET_BYTES).toString("hex");
}

function unquote(value) {
  if (value.length < 2) return value;
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function ensureTrailingNewline(value) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function readRuntimeSecretsWithRetry(path) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return validateRuntimeSecrets(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError;
}

function validateRuntimeSecrets(value) {
  if (!isSecureSecret(value?.LUJIE_SETTINGS_SECRET) || !isSecureSecret(value?.CODEX_BRIDGE_TOKEN)) {
    throw new Error("The persisted Docker runtime secrets are invalid.");
  }
  return value;
}
