import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4174";
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? "npm run generate:site && npm run build:client && npm run serve:e2e";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL
  },
  webServer: {
    command: webServerCommand,
    cwd: __dirname,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
