import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/wrappers/index.ts",
    "src/wrappers/openai.ts",
    "src/wrappers/anthropic.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["langsmith", "openai", "@anthropic-ai/sdk"],
});
