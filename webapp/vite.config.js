import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

let gitSha = 'dev';
let fullGitSha = 'dev-build';
try {
  fullGitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  gitSha = fullGitSha.substring(0, 7);
} catch (e) {
  if (process.env.GIT_SHA || process.env.COMMIT_SHA) {
    fullGitSha = process.env.GIT_SHA || process.env.COMMIT_SHA;
    gitSha = fullGitSha.substring(0, 7);
  }
}

const builtAt = new Date().toISOString();

// Build-only plugin: writes build-info.json into dist/ (not public/)
function buildInfoPlugin() {
  let resolvedConfig;

  return {
    name: 'vbai-build-info',
    apply: 'build',

    configResolved(config) {
      resolvedConfig = config;
    },

    closeBundle() {
      const outDir = resolvedConfig.build.outDir;
      const absOutDir = path.isAbsolute(outDir)
        ? outDir
        : path.resolve(resolvedConfig.root, outDir);
      const buildInfo = JSON.stringify(
        {
          product: 'VBAI Legal Pro',
          version: '2',
          gitSha: fullGitSha,
          shortSha: gitSha,
          builtAt: builtAt,
        },
        null,
        2
      ) + '\n';
      fs.writeFileSync(path.join(absOutDir, 'build-info.json'), buildInfo);
    },
  };
}

export default defineConfig({
  plugins: [buildInfoPlugin()],
  define: {
    __VBAI_GIT_SHA__: JSON.stringify(gitSha),
    __VBAI_FULL_GIT_SHA__: JSON.stringify(fullGitSha),
    __VBAI_BUILT_AT__: JSON.stringify(builtAt),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/docx')) return 'docx';
          if (id.includes('node_modules/file-saver')) return 'file-saver';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
});
