import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
    },
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 30000,
    globalSetup: "./test/setup.ts",
    include: ["test/**/*.e2e.test.ts"],
    exclude: ["node_modules", "dist"],
    typecheck: {
      include: ["templates-builder/*.test-d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./test"),
    },
  },
});
