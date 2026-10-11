import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { desktopTarget, nodeVersion } from "./desktop-platform.mjs";
import { configurePrismaEngines } from "./desktop-runtime.mjs";

const target = desktopTarget(process.platform, process.arch, process.env.TAURI_ENV_TARGET_TRIPLE || process.env.CARGO_BUILD_TARGET);
const { getBinaryTargetForCurrentPlatform } = createRequire(import.meta.url)("@prisma/get-platform");
const prismaTarget = await getBinaryTargetForCurrentPlatform();
if (process.platform === "linux" && prismaTarget !== "debian-openssl-3.0.x") {
  throw new Error(`Build Linux desktop packages on Ubuntu 22.04/24.04 x64 with OpenSSL 3 (glibc); Prisma detected ${prismaTarget}.`);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "src-tauri", "backend");
const cache = path.join(root, "tmp", "desktop-downloads");
mkdirSync(cache, { recursive: true });

function run(script, args, env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root, env: { ...process.env, ...env }, stdio: "inherit", windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Desktop build failed: ${path.basename(script)} (${result.status})`);
}

run("node_modules/prisma/build/index.js", ["generate"]);
run("node_modules/next/dist/bin/next", ["build"], {
  LUJIE_DESKTOP_BUILD: "1",
  DATABASE_URL: `file:${path.join(cache, "build-only.db").replaceAll("\\", "/")}`,
  NEXT_TELEMETRY_DISABLED: "1",
});

// Only these generated files are replaced. Never copy the working tree, .env files, or user databases.
if (backend !== path.join(root, "src-tauri", "backend")) throw new Error("Unexpected staging path.");
rmSync(backend, { recursive: true, force: true });
mkdirSync(backend, { recursive: true });
const standalone = path.join(root, ".next", "standalone");
// Node 22.23.3 native recursive copy retains nested symlinks despite dereference.
// A filter selects its JS copy path; reject any leftover links in the audit below.
const copyOptions = { recursive: true, dereference: true, filter: () => true };
for (const entry of ["server.js", "package.json", "node_modules", ".next"]) {
  cpSync(path.join(standalone, entry), path.join(backend, entry), copyOptions);
}
cpSync(path.join(root, ".next", "static"), path.join(backend, ".next", "static"), copyOptions);
cpSync(path.join(root, "public"), path.join(backend, "public"), {
  ...copyOptions,
  // Only README media is excluded; runtime brand SVGs and other assets remain.
  filter: (source) => !/^(?:images(?:\/|$)|brand\/lujie-(?:promo\..*\.mp4|(?:cover_16x9|video-poster)(?:\.en)?\.png)$)/.test(path.relative(path.join(root, "public"), source).replaceAll("\\", "/")),
});
// Copy only the reviewed public catalog, never intake files or source archives.
const catalog = readFileSync(path.join(root, "data", "campus", "current.json"), "utf8");
JSON.parse(catalog, (key, value) => {
  if (key === "sourceUrl") throw new Error("Original source URLs must not enter the desktop catalog.");
  return value;
});
mkdirSync(path.join(backend, "data", "campus"), { recursive: true });
writeFileSync(path.join(backend, "data", "campus", "current.json"), catalog);
mkdirSync(path.join(backend, "scripts"));
mkdirSync(path.join(backend, "prisma"));
cpSync(path.join(root, "scripts", "migrate.mjs"), path.join(backend, "scripts", "migrate.mjs"));
cpSync(path.join(root, "scripts", "desktop-runtime.mjs"), path.join(backend, "desktop-runtime.mjs"));
cpSync(path.join(root, "scripts", "desktop-platform.mjs"), path.join(backend, "desktop-platform.mjs"));
cpSync(path.join(root, "prisma", "schema.prisma"), path.join(backend, "prisma", "schema.prisma"));
cpSync(path.join(root, "prisma", "migrations"), path.join(backend, "prisma", "migrations"), copyOptions);

// Next's tracing does not discover the migration CLI or every dynamically loaded PDF worker/native asset.
const copied = new Set();
function copyPackage(name, from = path.join(root, "package.json"), optional = false) {
  const lookup = createRequire(from).resolve.paths(name) ?? [];
  const source = lookup.map((base) => path.join(base, name)).find((candidate) => existsSync(path.join(candidate, "package.json")));
  if (!source) {
    if (optional) return;
    throw new Error(`Missing desktop dependency: ${name}`);
  }
  if (copied.has(source)) return;
  const relative = path.relative(root, source);
  if (!relative.startsWith(`node_modules${path.sep}`)) throw new Error(`Dependency outside project: ${name}`);
  copied.add(source);
  cpSync(source, path.join(backend, relative), copyOptions);
  const manifest = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8"));
  for (const dependency of Object.keys(manifest.dependencies ?? {})) copyPackage(dependency, path.join(source, "package.json"));
  for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) copyPackage(dependency, path.join(source, "package.json"), true);
}
for (const name of ["prisma", "@prisma/client", "@prisma/get-platform", "pdf-parse", "word-extractor", "sharp"]) copyPackage(name);
cpSync(path.join(root, "node_modules", ".prisma", "client"), path.join(backend, "node_modules", ".prisma", "client"), copyOptions);

// The CLI's download cache and duplicate engine copies are build artifacts. Keep the
// generated client's native engine and the CLI's @prisma/engines installation intact.
for (const relative of [
  "node_modules/@prisma/engines/node_modules/.cache",
  "node_modules/prisma/engines",
  "node_modules/prisma/query_engine-windows.dll.node",
  // npm also installs musl optional binaries; this Linux target is glibc only.
  // linuxdeploy scans all ELF files, including these otherwise-unused modules.
  ...(process.platform === "linux" ? [
    "node_modules/@napi-rs/canvas-linux-x64-musl",
    "node_modules/@img/sharp-linuxmusl-x64",
    "node_modules/@img/sharp-libvips-linuxmusl-x64",
  ] : []),
]) {
  rmSync(path.join(backend, relative), { recursive: true, force: true });
}

// Pinned Node 22 LTS runtime, verified against the official release checksum.
const nodeFile = path.join(cache, process.platform === "win32" ? `node-${nodeVersion}-win-x64.exe` : target.download);
if (!existsSync(nodeFile)) {
  console.log(`Downloading Node ${nodeVersion} for the desktop payload…`);
  const response = await fetch(`https://nodejs.org/dist/${nodeVersion}/${target.download}`, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`Node download failed: ${response.status}`);
  writeFileSync(nodeFile, Buffer.from(await response.arrayBuffer()));
}
if (createHash("sha256").update(readFileSync(nodeFile)).digest("hex") !== target.sha256) {
  throw new Error(`Node checksum mismatch. Remove the invalid cache file: ${nodeFile}`);
}
if (process.platform === "win32") {
  cpSync(nodeFile, path.join(backend, target.executable));
} else {
  const member = target.download.replace(/\.tar\.gz$/, "") + "/bin/node";
  execFileSync("tar", ["-xzf", nodeFile, "-C", backend, "--strip-components=2", member]);
  chmodSync(path.join(backend, target.executable), 0o755);
  if (process.platform === "darwin") {
    // Anonymous preview signing; no hardened runtime, Developer ID or notarization is claimed.
    execFileSync("codesign", ["--force", "--sign", "-", path.join(backend, target.executable)], { stdio: "inherit" });
  }
}
const license = await fetch(`https://raw.githubusercontent.com/nodejs/node/${nodeVersion}/LICENSE`, { signal: AbortSignal.timeout(30_000) });
if (!license.ok) throw new Error("Cannot download the bundled Node license.");
writeFileSync(path.join(backend, "NODE-LICENSE.txt"), await license.text());
cpSync(path.join(root, "LICENSE"), path.join(backend, "LICENSE"));

let bytes = 0;
let files = 0;
function audit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (/^\.env(?:\.|$)|\.(?:db|sqlite|sqlite3)(?:-|$)|^AGENTS\.md$/.test(entry.name)) {
      throw new Error(`Private file in desktop payload: ${path.relative(backend, file)}`);
    }
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link in desktop payload: ${path.relative(backend, file)}`);
    if (entry.isDirectory()) audit(file);
    // Source maps are debugging metadata; retain code, native assets and license notices.
    else if (entry.name.endsWith('.map')) rmSync(file);
    else { bytes += readFileSync(file).length; files += 1; }
  }
}
audit(backend);
writeFileSync(path.join(backend, "desktop-build.json"), JSON.stringify({ nodeVersion, platform: target.id, prismaTarget, files, bytes }, null, 2));
configurePrismaEngines(backend);
const runtime = JSON.parse(execFileSync(path.join(backend, target.executable), ["-p", "JSON.stringify({version:process.version,platform:process.platform+'-'+process.arch})"], {
  env: { ...process.env, NODE_OPTIONS: "", NODE_PATH: "" }, encoding: "utf8", windowsHide: true,
}));
if (runtime.version !== nodeVersion || runtime.platform !== target.id) throw new Error("Bundled Node does not match the build target.");
console.log(`Desktop payload ready: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB. No user database or .env files included.`);
