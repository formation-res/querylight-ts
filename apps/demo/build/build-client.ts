import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const filePath = fileURLToPath(import.meta.url);
const buildDir = path.dirname(filePath);
const appDir = path.resolve(buildDir, "..");
const workspaceRoot = path.resolve(appDir, "../..");

const baseConfig = {
  bundle: true,
  format: "esm" as const,
  logLevel: "info" as const,
  minify: true,
  platform: "browser" as const,
  sourcemap: false,
  target: ["es2022"],
  alias: {
    "@tryformation/querylight-ts": path.resolve(workspaceRoot, "packages/querylight/src/index.ts")
  },
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString())
  }
};

await build({
  ...baseConfig,
  entryPoints: [
    path.resolve(appDir, "src/site-search.ts"),
    path.resolve(appDir, "src/site-dashboard.ts")
  ],
  outdir: path.resolve(appDir, "static/js")
});
