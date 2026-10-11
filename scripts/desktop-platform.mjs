export const nodeVersion = "v22.23.3";

// Official Node release SHA256 values. Build native dependencies on the target OS/CPU too.
const targets = {
  "win32-x64": ["win-x64/node.exe", "9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e", "x86_64-pc-windows-msvc"],
  "darwin-arm64": [`node-${nodeVersion}-darwin-arm64.tar.gz`, "23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53", "aarch64-apple-darwin"],
  "darwin-x64": [`node-${nodeVersion}-darwin-x64.tar.gz`, "8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8", "x86_64-apple-darwin"],
  "linux-x64": [`node-${nodeVersion}-linux-x64.tar.gz`, "1084aa36196bba4c3a5e69a1ee388a6e4ff729dad09445fbcd434b28fe3c24af", "x86_64-unknown-linux-gnu"],
};

export function desktopTarget(platform = process.platform, arch = process.arch, rustTarget) {
  const id = `${platform}-${arch}`;
  const target = targets[id];
  if (!target) throw new Error(`Unsupported desktop target: ${id}`);
  const [download, sha256, triple] = target;
  if (rustTarget && rustTarget !== triple) {
    throw new Error(`Build ${rustTarget} on a matching OS/CPU runner; this backend is ${id}.`);
  }
  return { id, download, sha256, triple, executable: platform === "win32" ? "node.exe" : "node" };
}
