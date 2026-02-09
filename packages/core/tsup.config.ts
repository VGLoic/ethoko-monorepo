import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/cli-client/index.ts",
    "src/storage-provider/index.ts",
    "src/cli-ui/index.ts",
    "src/local-storage.ts",
  ],
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: true,
  dts: true,
  clean: true,
  publicDir: "templates",
});
