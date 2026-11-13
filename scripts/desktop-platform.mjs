export const nodeVersion = "v22.23.4";

// Official Node release SHA256 values. Build native dependencies on the target OS/CPU too.
const targets = {
  "win32-x64": ["win-x64/node.exe", "dccc52de28d8df2ee22d2062424f8c563070d95d8ad70c54c4bf01d590dec14f", "x86_64-pc-windows-msvc"],
  "darwin-arm64": [`node-${nodeVersion}-darwin-arm64.tar.gz`, "c9e1dbc748b33ed2d14f42445191ecaf14c56259c7a9a26d0042c49ec2b66428", "aarch64-apple-darwin"],
  "darwin-x64": [`node-${nodeVersion}-darwin-x64.tar.gz`, "efcc2b0db6f94bf53eddb038fe2b370277a042bd29e4f19b8f8e23598795b819", "x86_64-apple-darwin"],
  "linux-x64": [`node-${nodeVersion}-linux-x64.tar.gz`, "b8492284c76a54baf58d61668dd0e41ee0fc98adabf9503d30f05d08f55b4406", "x86_64-unknown-linux-gnu"],
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
