// vite.config.ts
import { resolve as resolve2 } from "path";
import { defineConfig } from "file:///D:/Projects/siyuan-douban-2.3.1/node_modules/vite/dist/node/index.js";
import { viteStaticCopy } from "file:///D:/Projects/siyuan-douban-2.3.1/node_modules/vite-plugin-static-copy/dist/index.js";
import livereload from "file:///D:/Projects/siyuan-douban-2.3.1/node_modules/rollup-plugin-livereload/dist/index.cjs.js";
import { svelte } from "file:///D:/Projects/siyuan-douban-2.3.1/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import zipPack from "file:///D:/Projects/siyuan-douban-2.3.1/node_modules/vite-plugin-zip-pack/dist/esm/index.mjs";
import fg from "file:///D:/Projects/siyuan-douban-2.3.1/node_modules/fast-glob/out/index.js";

// yaml-plugin.js
import fs from "fs";
import yaml from "file:///D:/Projects/siyuan-douban-2.3.1/node_modules/js-yaml/dist/js-yaml.mjs";
import { resolve } from "path";
function vitePluginYamlI18n(options = {}) {
  const DefaultOptions = {
    inDir: "src/i18n",
    outDir: "dist/i18n"
  };
  const finalOptions = { ...DefaultOptions, ...options };
  return {
    name: "vite-plugin-yaml-i18n",
    buildStart() {
      console.log("\u{1F308} Parse I18n: YAML to JSON..");
      const inDir = finalOptions.inDir;
      const outDir = finalOptions.outDir;
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const files = fs.readdirSync(inDir);
      for (const file of files) {
        if (file.endsWith(".yaml") || file.endsWith(".yml")) {
          console.log(`-- Parsing ${file}`);
          const jsonFile = file.replace(/\.(yaml|yml)$/, ".json");
          if (files.includes(jsonFile)) {
            console.log(`---- File ${jsonFile} already exists, skipping...`);
            continue;
          }
          try {
            const filePath = resolve(inDir, file);
            const fileContents = fs.readFileSync(filePath, "utf8");
            const parsed = yaml.load(fileContents);
            const jsonContent = JSON.stringify(parsed, null, 2);
            const outputFilePath = resolve(outDir, file.replace(/\.(yaml|yml)$/, ".json"));
            console.log(`---- Writing to ${outputFilePath}`);
            fs.writeFileSync(outputFilePath, jsonContent);
          } catch (error) {
            this.error(`---- Error parsing YAML file ${file}: ${error.message}`);
          }
        }
      }
    }
  };
}

// vite.config.ts
var __vite_injected_original_dirname = "D:\\Projects\\siyuan-douban-2.3.1";
var env = process.env;
var isSrcmap = env.VITE_SOURCEMAP === "inline";
var isDev = env.NODE_ENV === "development";
var outputDir = isDev ? "dev" : "dist";
console.log("isDev=>", isDev);
console.log("isSrcmap=>", isSrcmap);
console.log("outputDir=>", outputDir);
var vite_config_default = defineConfig({
  resolve: {
    alias: {
      "@": resolve2(__vite_injected_original_dirname, "src")
    }
  },
  plugins: [
    svelte(),
    vitePluginYamlI18n({
      inDir: "public/i18n",
      outDir: `${outputDir}/i18n`
    }),
    viteStaticCopy({
      targets: [
        { src: "./plugin.json", dest: "./" }
      ]
    })
  ],
  define: {
    "process.env.DEV_MODE": JSON.stringify(isDev),
    "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV)
  },
  build: {
    outDir: outputDir,
    emptyOutDir: false,
    minify: true,
    sourcemap: isSrcmap ? "inline" : false,
    lib: {
      entry: resolve2(__vite_injected_original_dirname, "src/index.ts"),
      fileName: "index",
      formats: ["cjs"]
    },
    rollupOptions: {
      plugins: [
        ...isDev ? [
          livereload(outputDir),
          {
            name: "watch-external",
            async buildStart() {
              const files = await fg([
                "public/i18n/**",
                "./plugin.json"
              ]);
              for (let file of files) {
                this.addWatchFile(file);
              }
            }
          }
        ] : [
          // Clean up unnecessary files under dist dir
          cleanupDistFiles({
            patterns: ["i18n/*.yaml", "i18n/*.md"],
            distDir: outputDir
          }),
          zipPack({
            inDir: "./dist",
            outDir: "./",
            outFileName: "package.zip"
          })
        ]
      ],
      external: ["siyuan", "process"],
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") {
            return "index.css";
          }
          return assetInfo.name;
        }
      }
    }
  }
});
function cleanupDistFiles(options) {
  const {
    patterns,
    distDir
  } = options;
  return {
    name: "rollup-plugin-cleanup",
    enforce: "post",
    writeBundle: {
      sequential: true,
      order: "post",
      async handler() {
        const fg2 = await import("file:///D:/Projects/siyuan-douban-2.3.1/node_modules/fast-glob/out/index.js");
        const fs2 = await import("fs");
        const distPatterns = patterns.map((pat) => `${distDir}/${pat}`);
        console.debug("Cleanup searching patterns:", distPatterns);
        const files = await fg2.default(distPatterns, {
          dot: true,
          absolute: true,
          onlyFiles: false
        });
        for (const file of files) {
          try {
            if (fs2.default.existsSync(file)) {
              const stat = fs2.default.statSync(file);
              if (stat.isDirectory()) {
                fs2.default.rmSync(file, { recursive: true });
              } else {
                fs2.default.unlinkSync(file);
              }
              console.log(`Cleaned up: ${file}`);
            }
          } catch (error) {
            console.error(`Failed to clean up ${file}:`, error);
          }
        }
      }
    }
  };
}
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAieWFtbC1wbHVnaW4uanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxzaXl1YW4tZG91YmFuLTIuMy4xXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxzaXl1YW4tZG91YmFuLTIuMy4xXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Qcm9qZWN0cy9zaXl1YW4tZG91YmFuLTIuMy4xL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCJcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gXCJ2aXRlXCJcbmltcG9ydCB7IHZpdGVTdGF0aWNDb3B5IH0gZnJvbSBcInZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5XCJcbmltcG9ydCBsaXZlcmVsb2FkIGZyb20gXCJyb2xsdXAtcGx1Z2luLWxpdmVyZWxvYWRcIlxuaW1wb3J0IHsgc3ZlbHRlIH0gZnJvbSBcIkBzdmVsdGVqcy92aXRlLXBsdWdpbi1zdmVsdGVcIlxuaW1wb3J0IHppcFBhY2sgZnJvbSBcInZpdGUtcGx1Z2luLXppcC1wYWNrXCI7XG5pbXBvcnQgZmcgZnJvbSAnZmFzdC1nbG9iJztcblxuaW1wb3J0IHZpdGVQbHVnaW5ZYW1sSTE4biBmcm9tICcuL3lhbWwtcGx1Z2luJztcblxuY29uc3QgZW52ID0gcHJvY2Vzcy5lbnY7XG5jb25zdCBpc1NyY21hcCA9IGVudi5WSVRFX1NPVVJDRU1BUCA9PT0gJ2lubGluZSc7XG5jb25zdCBpc0RldiA9IGVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50JztcblxuY29uc3Qgb3V0cHV0RGlyID0gaXNEZXYgPyBcImRldlwiIDogXCJkaXN0XCI7XG5cbmNvbnNvbGUubG9nKFwiaXNEZXY9PlwiLCBpc0Rldik7XG5jb25zb2xlLmxvZyhcImlzU3JjbWFwPT5cIiwgaXNTcmNtYXApO1xuY29uc29sZS5sb2coXCJvdXRwdXREaXI9PlwiLCBvdXRwdXREaXIpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICAgIHJlc29sdmU6IHtcbiAgICAgICAgYWxpYXM6IHtcbiAgICAgICAgICAgIFwiQFwiOiByZXNvbHZlKF9fZGlybmFtZSwgXCJzcmNcIiksXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgcGx1Z2luczogW1xuICAgICAgICBzdmVsdGUoKSxcblxuICAgICAgICB2aXRlUGx1Z2luWWFtbEkxOG4oe1xuICAgICAgICAgICAgaW5EaXI6ICdwdWJsaWMvaTE4bicsXG4gICAgICAgICAgICBvdXREaXI6IGAke291dHB1dERpcn0vaTE4bmBcbiAgICAgICAgfSksXG5cbiAgICAgICAgdml0ZVN0YXRpY0NvcHkoe1xuICAgICAgICAgICAgdGFyZ2V0czogW1xuICAgICAgICAgICAgICAgIHsgc3JjOiBcIi4vcGx1Z2luLmpzb25cIiwgZGVzdDogXCIuL1wiIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuXG4gICAgXSxcblxuICAgIGRlZmluZToge1xuICAgICAgICBcInByb2Nlc3MuZW52LkRFVl9NT0RFXCI6IEpTT04uc3RyaW5naWZ5KGlzRGV2KSxcbiAgICAgICAgXCJwcm9jZXNzLmVudi5OT0RFX0VOVlwiOiBKU09OLnN0cmluZ2lmeShlbnYuTk9ERV9FTlYpXG4gICAgfSxcblxuICAgIGJ1aWxkOiB7XG4gICAgICAgIG91dERpcjogb3V0cHV0RGlyLFxuICAgICAgICBlbXB0eU91dERpcjogZmFsc2UsXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcbiAgICAgICAgc291cmNlbWFwOiBpc1NyY21hcCA/ICdpbmxpbmUnIDogZmFsc2UsXG5cbiAgICAgICAgbGliOiB7XG4gICAgICAgICAgICBlbnRyeTogcmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL2luZGV4LnRzXCIpLFxuICAgICAgICAgICAgZmlsZU5hbWU6IFwiaW5kZXhcIixcbiAgICAgICAgICAgIGZvcm1hdHM6IFtcImNqc1wiXSxcbiAgICAgICAgfSxcbiAgICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgICAgICAgIC4uLihpc0RldiA/IFtcbiAgICAgICAgICAgICAgICAgICAgbGl2ZXJlbG9hZChvdXRwdXREaXIpLFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnd2F0Y2gtZXh0ZXJuYWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXN5bmMgYnVpbGRTdGFydCgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZnKFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3B1YmxpYy9pMThuLyoqJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJy4vcGx1Z2luLmpzb24nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFkZFdhdGNoRmlsZShmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdIDogW1xuICAgICAgICAgICAgICAgICAgICAvLyBDbGVhbiB1cCB1bm5lY2Vzc2FyeSBmaWxlcyB1bmRlciBkaXN0IGRpclxuICAgICAgICAgICAgICAgICAgICBjbGVhbnVwRGlzdEZpbGVzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdHRlcm5zOiBbJ2kxOG4vKi55YW1sJywgJ2kxOG4vKi5tZCddLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzdERpcjogb3V0cHV0RGlyXG4gICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICB6aXBQYWNrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluRGlyOiAnLi9kaXN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dERpcjogJy4vJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dEZpbGVOYW1lOiAncGFja2FnZS56aXAnXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgIF0sXG5cbiAgICAgICAgICAgIGV4dGVybmFsOiBbXCJzaXl1YW5cIiwgXCJwcm9jZXNzXCJdLFxuXG4gICAgICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICAgICAgICBlbnRyeUZpbGVOYW1lczogXCJbbmFtZV0uanNcIixcbiAgICAgICAgICAgICAgICBhc3NldEZpbGVOYW1lczogKGFzc2V0SW5mbykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRJbmZvLm5hbWUgPT09IFwic3R5bGUuY3NzXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcImluZGV4LmNzc1wiXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFzc2V0SW5mby5uYW1lXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgfVxufSk7XG5cblxuLyoqXG4gKiBDbGVhbiB1cCBzb21lIGRpc3QgZmlsZXMgYWZ0ZXIgY29tcGlsZWRcbiAqIEBhdXRob3IgZnJvc3RpbWVcbiAqIEBwYXJhbSBvcHRpb25zOlxuICogQHJldHVybnMgXG4gKi9cbmZ1bmN0aW9uIGNsZWFudXBEaXN0RmlsZXMob3B0aW9uczogeyBwYXR0ZXJuczogc3RyaW5nW10sIGRpc3REaXI6IHN0cmluZyB9KSB7XG4gICAgY29uc3Qge1xuICAgICAgICBwYXR0ZXJucyxcbiAgICAgICAgZGlzdERpclxuICAgIH0gPSBvcHRpb25zO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogJ3JvbGx1cC1wbHVnaW4tY2xlYW51cCcsXG4gICAgICAgIGVuZm9yY2U6ICdwb3N0JyxcbiAgICAgICAgd3JpdGVCdW5kbGU6IHtcbiAgICAgICAgICAgIHNlcXVlbnRpYWw6IHRydWUsXG4gICAgICAgICAgICBvcmRlcjogJ3Bvc3QnIGFzICdwb3N0JyxcbiAgICAgICAgICAgIGFzeW5jIGhhbmRsZXIoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmcgPSBhd2FpdCBpbXBvcnQoJ2Zhc3QtZ2xvYicpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZzID0gYXdhaXQgaW1wb3J0KCdmcycpO1xuICAgICAgICAgICAgICAgIC8vIGNvbnN0IHBhdGggPSBhd2FpdCBpbXBvcnQoJ3BhdGgnKTtcblxuICAgICAgICAgICAgICAgIC8vIFx1NEY3Rlx1NzUyOCBnbG9iIFx1OEJFRFx1NkNENVx1RkYwQ1x1Nzg2RVx1NEZERFx1ODBGRFx1NTMzOVx1OTE0RFx1NTIzMFx1NjU4N1x1NEVGNlxuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3RQYXR0ZXJucyA9IHBhdHRlcm5zLm1hcChwYXQgPT4gYCR7ZGlzdERpcn0vJHtwYXR9YCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5kZWJ1ZygnQ2xlYW51cCBzZWFyY2hpbmcgcGF0dGVybnM6JywgZGlzdFBhdHRlcm5zKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgZmcuZGVmYXVsdChkaXN0UGF0dGVybnMsIHtcbiAgICAgICAgICAgICAgICAgICAgZG90OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBhYnNvbHV0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgb25seUZpbGVzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5pbmZvKCdGaWxlcyB0byBiZSBjbGVhbmVkIHVwOicsIGZpbGVzKTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZzLmRlZmF1bHQuZXhpc3RzU3luYyhmaWxlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5kZWZhdWx0LnN0YXRTeW5jKGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMuZGVmYXVsdC5ybVN5bmMoZmlsZSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMuZGVmYXVsdC51bmxpbmtTeW5jKGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQ2xlYW5lZCB1cDogJHtmaWxlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGNsZWFuIHVwICR7ZmlsZX06YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcUHJvamVjdHNcXFxcc2l5dWFuLWRvdWJhbi0yLjMuMVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcUHJvamVjdHNcXFxcc2l5dWFuLWRvdWJhbi0yLjMuMVxcXFx5YW1sLXBsdWdpbi5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUHJvamVjdHMvc2l5dWFuLWRvdWJhbi0yLjMuMS95YW1sLXBsdWdpbi5qc1wiOy8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjQgYnkgZnJvc3RpbWUuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKiBAQXV0aG9yICAgICAgIDogZnJvc3RpbWVcbiAqIEBEYXRlICAgICAgICAgOiAyMDI0LTA0LTA1IDIxOjI3OjU1XG4gKiBARmlsZVBhdGggICAgIDogL3lhbWwtcGx1Z2luLmpzXG4gKiBATGFzdEVkaXRUaW1lIDogMjAyNC0wNC0wNSAyMjo1MzozNFxuICogQERlc2NyaXB0aW9uICA6IFx1NTNCQlx1NTlBRVx1NzM5Qlx1NzY4NCBqc29uIFx1NjgzQ1x1NUYwRlx1RkYwQ1x1NjIxMVx1NUMzMVx1NjYyRlx1ODk4MVx1NzUyOCB5YW1sIFx1NTE5OSBpMThuXG4gKi9cbi8vIHBsdWdpbnMvdml0ZS1wbHVnaW4tcGFyc2UteWFtbC5qc1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCB5YW1sIGZyb20gJ2pzLXlhbWwnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB2aXRlUGx1Z2luWWFtbEkxOG4ob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gRGVmYXVsdCBvcHRpb25zIHdpdGggYSBmYWxsYmFja1xuICAgIGNvbnN0IERlZmF1bHRPcHRpb25zID0ge1xuICAgICAgICBpbkRpcjogJ3NyYy9pMThuJyxcbiAgICAgICAgb3V0RGlyOiAnZGlzdC9pMThuJyxcbiAgICB9O1xuXG4gICAgY29uc3QgZmluYWxPcHRpb25zID0geyAuLi5EZWZhdWx0T3B0aW9ucywgLi4ub3B0aW9ucyB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogJ3ZpdGUtcGx1Z2luLXlhbWwtaTE4bicsXG4gICAgICAgIGJ1aWxkU3RhcnQoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnXHVEODNDXHVERjA4IFBhcnNlIEkxOG46IFlBTUwgdG8gSlNPTi4uJyk7XG4gICAgICAgICAgICBjb25zdCBpbkRpciA9IGZpbmFsT3B0aW9ucy5pbkRpcjtcbiAgICAgICAgICAgIGNvbnN0IG91dERpciA9IGZpbmFsT3B0aW9ucy5vdXREaXJcblxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKG91dERpcikpIHtcbiAgICAgICAgICAgICAgICBmcy5ta2RpclN5bmMob3V0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9QYXJzZSB5YW1sIGZpbGUsIG91dHB1dCB0byBqc29uXG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGluRGlyKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgICAgIGlmIChmaWxlLmVuZHNXaXRoKCcueWFtbCcpIHx8IGZpbGUuZW5kc1dpdGgoJy55bWwnKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgLS0gUGFyc2luZyAke2ZpbGV9YClcbiAgICAgICAgICAgICAgICAgICAgLy9cdTY4QzBcdTY3RTVcdTY2MkZcdTU0MjZcdTY3MDlcdTU0MENcdTU0MERcdTc2ODRqc29uXHU2NTg3XHU0RUY2XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGpzb25GaWxlID0gZmlsZS5yZXBsYWNlKC9cXC4oeWFtbHx5bWwpJC8sICcuanNvbicpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZXMuaW5jbHVkZXMoanNvbkZpbGUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgLS0tLSBGaWxlICR7anNvbkZpbGV9IGFscmVhZHkgZXhpc3RzLCBza2lwcGluZy4uLmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcmVzb2x2ZShpbkRpciwgZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudHMgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSB5YW1sLmxvYWQoZmlsZUNvbnRlbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGpzb25Db250ZW50ID0gSlNPTi5zdHJpbmdpZnkocGFyc2VkLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG91dHB1dEZpbGVQYXRoID0gcmVzb2x2ZShvdXREaXIsIGZpbGUucmVwbGFjZSgvXFwuKHlhbWx8eW1sKSQvLCAnLmpzb24nKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgLS0tLSBXcml0aW5nIHRvICR7b3V0cHV0RmlsZVBhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dEZpbGVQYXRoLCBqc29uQ29udGVudCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKGAtLS0tIEVycm9yIHBhcnNpbmcgWUFNTCBmaWxlICR7ZmlsZX06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFxUixTQUFTLFdBQUFBLGdCQUFlO0FBQzdTLFNBQVMsb0JBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBQy9CLE9BQU8sZ0JBQWdCO0FBQ3ZCLFNBQVMsY0FBYztBQUN2QixPQUFPLGFBQWE7QUFDcEIsT0FBTyxRQUFROzs7QUNHZixPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFDakIsU0FBUyxlQUFlO0FBRVQsU0FBUixtQkFBb0MsVUFBVSxDQUFDLEdBQUc7QUFFckQsUUFBTSxpQkFBaUI7QUFBQSxJQUNuQixPQUFPO0FBQUEsSUFDUCxRQUFRO0FBQUEsRUFDWjtBQUVBLFFBQU0sZUFBZSxFQUFFLEdBQUcsZ0JBQWdCLEdBQUcsUUFBUTtBQUVyRCxTQUFPO0FBQUEsSUFDSCxNQUFNO0FBQUEsSUFDTixhQUFhO0FBQ1QsY0FBUSxJQUFJLHNDQUErQjtBQUMzQyxZQUFNLFFBQVEsYUFBYTtBQUMzQixZQUFNLFNBQVMsYUFBYTtBQUU1QixVQUFJLENBQUMsR0FBRyxXQUFXLE1BQU0sR0FBRztBQUN4QixXQUFHLFVBQVUsUUFBUSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsTUFDNUM7QUFHQSxZQUFNLFFBQVEsR0FBRyxZQUFZLEtBQUs7QUFDbEMsaUJBQVcsUUFBUSxPQUFPO0FBQ3RCLFlBQUksS0FBSyxTQUFTLE9BQU8sS0FBSyxLQUFLLFNBQVMsTUFBTSxHQUFHO0FBQ2pELGtCQUFRLElBQUksY0FBYyxJQUFJLEVBQUU7QUFFaEMsZ0JBQU0sV0FBVyxLQUFLLFFBQVEsaUJBQWlCLE9BQU87QUFDdEQsY0FBSSxNQUFNLFNBQVMsUUFBUSxHQUFHO0FBQzFCLG9CQUFRLElBQUksYUFBYSxRQUFRLDhCQUE4QjtBQUMvRDtBQUFBLFVBQ0o7QUFDQSxjQUFJO0FBQ0Esa0JBQU0sV0FBVyxRQUFRLE9BQU8sSUFBSTtBQUNwQyxrQkFBTSxlQUFlLEdBQUcsYUFBYSxVQUFVLE1BQU07QUFDckQsa0JBQU0sU0FBUyxLQUFLLEtBQUssWUFBWTtBQUNyQyxrQkFBTSxjQUFjLEtBQUssVUFBVSxRQUFRLE1BQU0sQ0FBQztBQUNsRCxrQkFBTSxpQkFBaUIsUUFBUSxRQUFRLEtBQUssUUFBUSxpQkFBaUIsT0FBTyxDQUFDO0FBQzdFLG9CQUFRLElBQUksbUJBQW1CLGNBQWMsRUFBRTtBQUMvQyxlQUFHLGNBQWMsZ0JBQWdCLFdBQVc7QUFBQSxVQUNoRCxTQUFTLE9BQU87QUFDWixpQkFBSyxNQUFNLGdDQUFnQyxJQUFJLEtBQUssTUFBTSxPQUFPLEVBQUU7QUFBQSxVQUN2RTtBQUFBLFFBQ0o7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDSjs7O0FEM0RBLElBQU0sbUNBQW1DO0FBVXpDLElBQU0sTUFBTSxRQUFRO0FBQ3BCLElBQU0sV0FBVyxJQUFJLG1CQUFtQjtBQUN4QyxJQUFNLFFBQVEsSUFBSSxhQUFhO0FBRS9CLElBQU0sWUFBWSxRQUFRLFFBQVE7QUFFbEMsUUFBUSxJQUFJLFdBQVcsS0FBSztBQUM1QixRQUFRLElBQUksY0FBYyxRQUFRO0FBQ2xDLFFBQVEsSUFBSSxlQUFlLFNBQVM7QUFFcEMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDeEIsU0FBUztBQUFBLElBQ0wsT0FBTztBQUFBLE1BQ0gsS0FBS0MsU0FBUSxrQ0FBVyxLQUFLO0FBQUEsSUFDakM7QUFBQSxFQUNKO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDTCxPQUFPO0FBQUEsSUFFUCxtQkFBbUI7QUFBQSxNQUNmLE9BQU87QUFBQSxNQUNQLFFBQVEsR0FBRyxTQUFTO0FBQUEsSUFDeEIsQ0FBQztBQUFBLElBRUQsZUFBZTtBQUFBLE1BQ1gsU0FBUztBQUFBLFFBQ0wsRUFBRSxLQUFLLGlCQUFpQixNQUFNLEtBQUs7QUFBQSxNQUN2QztBQUFBLElBQ0osQ0FBQztBQUFBLEVBRUw7QUFBQSxFQUVBLFFBQVE7QUFBQSxJQUNKLHdCQUF3QixLQUFLLFVBQVUsS0FBSztBQUFBLElBQzVDLHdCQUF3QixLQUFLLFVBQVUsSUFBSSxRQUFRO0FBQUEsRUFDdkQ7QUFBQSxFQUVBLE9BQU87QUFBQSxJQUNILFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxJQUNSLFdBQVcsV0FBVyxXQUFXO0FBQUEsSUFFakMsS0FBSztBQUFBLE1BQ0QsT0FBT0EsU0FBUSxrQ0FBVyxjQUFjO0FBQUEsTUFDeEMsVUFBVTtBQUFBLE1BQ1YsU0FBUyxDQUFDLEtBQUs7QUFBQSxJQUNuQjtBQUFBLElBQ0EsZUFBZTtBQUFBLE1BQ1gsU0FBUztBQUFBLFFBQ0wsR0FBSSxRQUFRO0FBQUEsVUFDUixXQUFXLFNBQVM7QUFBQSxVQUNwQjtBQUFBLFlBQ0ksTUFBTTtBQUFBLFlBQ04sTUFBTSxhQUFhO0FBQ2Ysb0JBQU0sUUFBUSxNQUFNLEdBQUc7QUFBQSxnQkFDbkI7QUFBQSxnQkFDQTtBQUFBLGNBQ0osQ0FBQztBQUNELHVCQUFTLFFBQVEsT0FBTztBQUNwQixxQkFBSyxhQUFhLElBQUk7QUFBQSxjQUMxQjtBQUFBLFlBQ0o7QUFBQSxVQUNKO0FBQUEsUUFDSixJQUFJO0FBQUE7QUFBQSxVQUVBLGlCQUFpQjtBQUFBLFlBQ2IsVUFBVSxDQUFDLGVBQWUsV0FBVztBQUFBLFlBQ3JDLFNBQVM7QUFBQSxVQUNiLENBQUM7QUFBQSxVQUNELFFBQVE7QUFBQSxZQUNKLE9BQU87QUFBQSxZQUNQLFFBQVE7QUFBQSxZQUNSLGFBQWE7QUFBQSxVQUNqQixDQUFDO0FBQUEsUUFDTDtBQUFBLE1BQ0o7QUFBQSxNQUVBLFVBQVUsQ0FBQyxVQUFVLFNBQVM7QUFBQSxNQUU5QixRQUFRO0FBQUEsUUFDSixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0IsQ0FBQyxjQUFjO0FBQzNCLGNBQUksVUFBVSxTQUFTLGFBQWE7QUFDaEMsbUJBQU87QUFBQSxVQUNYO0FBQ0EsaUJBQU8sVUFBVTtBQUFBLFFBQ3JCO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQ0osQ0FBQztBQVNELFNBQVMsaUJBQWlCLFNBQWtEO0FBQ3hFLFFBQU07QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLEVBQ0osSUFBSTtBQUVKLFNBQU87QUFBQSxJQUNILE1BQU07QUFBQSxJQUNOLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxNQUNULFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLE1BQU0sVUFBVTtBQUNaLGNBQU1DLE1BQUssTUFBTSxPQUFPLDZFQUFXO0FBQ25DLGNBQU1DLE1BQUssTUFBTSxPQUFPLElBQUk7QUFJNUIsY0FBTSxlQUFlLFNBQVMsSUFBSSxTQUFPLEdBQUcsT0FBTyxJQUFJLEdBQUcsRUFBRTtBQUM1RCxnQkFBUSxNQUFNLCtCQUErQixZQUFZO0FBRXpELGNBQU0sUUFBUSxNQUFNRCxJQUFHLFFBQVEsY0FBYztBQUFBLFVBQ3pDLEtBQUs7QUFBQSxVQUNMLFVBQVU7QUFBQSxVQUNWLFdBQVc7QUFBQSxRQUNmLENBQUM7QUFJRCxtQkFBVyxRQUFRLE9BQU87QUFDdEIsY0FBSTtBQUNBLGdCQUFJQyxJQUFHLFFBQVEsV0FBVyxJQUFJLEdBQUc7QUFDN0Isb0JBQU0sT0FBT0EsSUFBRyxRQUFRLFNBQVMsSUFBSTtBQUNyQyxrQkFBSSxLQUFLLFlBQVksR0FBRztBQUNwQixnQkFBQUEsSUFBRyxRQUFRLE9BQU8sTUFBTSxFQUFFLFdBQVcsS0FBSyxDQUFDO0FBQUEsY0FDL0MsT0FBTztBQUNILGdCQUFBQSxJQUFHLFFBQVEsV0FBVyxJQUFJO0FBQUEsY0FDOUI7QUFDQSxzQkFBUSxJQUFJLGVBQWUsSUFBSSxFQUFFO0FBQUEsWUFDckM7QUFBQSxVQUNKLFNBQVMsT0FBTztBQUNaLG9CQUFRLE1BQU0sc0JBQXNCLElBQUksS0FBSyxLQUFLO0FBQUEsVUFDdEQ7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQ0o7IiwKICAibmFtZXMiOiBbInJlc29sdmUiLCAicmVzb2x2ZSIsICJmZyIsICJmcyJdCn0K
