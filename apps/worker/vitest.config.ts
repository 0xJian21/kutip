import { defineConfig } from "vitest/config";

// Integration tests boot PGlite and replay every @kutip/db migration per test (5–8 s under load).
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
