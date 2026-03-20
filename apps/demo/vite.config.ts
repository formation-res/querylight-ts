import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { writeDemoDataFile } from "./build/demo-data";

function demoDataPlugin(): Plugin {
  const workspaceRoot = path.resolve(__dirname, "../..");
  const generatedDataPath = path.resolve(__dirname, "src/generated/demo-data.json");
  const docsDir = path.resolve(workspaceRoot, "docs") + path.sep;
  const refresh = () => {
    writeDemoDataFile(workspaceRoot, generatedDataPath);
  };

  return {
    name: "querylight-demo-data",
    buildStart() {
      refresh();
    },
    configureServer() {
      refresh();
    },
    handleHotUpdate(context) {
      if (!context.file.startsWith(docsDir) || !context.file.endsWith(".md")) {
        return;
      }
      refresh();
      const module = context.server.moduleGraph.getModuleById(generatedDataPath);
      if (!module) {
        return;
      }
      context.server.moduleGraph.invalidateModule(module);
      return [module];
    }
  };
}

export default defineConfig({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString())
  },
  resolve: {
    alias: {
      "@tryformation/querylight-ts": path.resolve(__dirname, "../../packages/querylight/src/index.ts")
    }
  },
  plugins: [demoDataPlugin(), tailwindcss()],
  server: {
    port: 4173,
    fs: {
      allow: [path.resolve(__dirname, "../..")]
    }
  }
});
