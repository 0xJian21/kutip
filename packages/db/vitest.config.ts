import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // seed/ imports Session 2's mock fixtures, which use the web app's "@/" alias.
  resolve: { alias: { "@": fileURLToPath(new URL("../../apps/web", import.meta.url)) } },
  // Each test boots a fresh PGlite and replays every migration: ~1 s alone, 5–8 s under `pnpm -r test` load.
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
