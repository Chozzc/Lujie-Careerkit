import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "next-intl": path.resolve(__dirname, "src/lib/next-intl-shim.ts"),
    },
  },
});
