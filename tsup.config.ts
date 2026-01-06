import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/client.ts",
    "src/traceable.ts",
    "src/run_trees.ts",
    "src/schemas.ts",
    "src/wrappers/index.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["langsmith", "openai", "@anthropic-ai/sdk"],
});
