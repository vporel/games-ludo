import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig keeps JSX as is for Next; tests need it compiled.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"] },
});
