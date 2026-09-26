import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // seed/ imports Session 2's mock fixtures, which use the web app's "@/" alias.
  resolve: { alias: { "@": fileURLToPath(new URL("../../apps/web", import.meta.url)) } },
});
