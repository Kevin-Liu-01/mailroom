import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], env: { DATABASE_URL: "postgres://mailroom:test@localhost:5432/mailroom_test", TOKEN_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" } },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
