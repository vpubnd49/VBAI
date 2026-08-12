import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Fail production builds if SHA is dev/empty/non-40-hex
const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
if (isProduction && !/^[0-9a-f]{40}$/i.test(fullGitSha)) {
  throw new Error(
    `[VBAI BUILD] Production build requires a valid 40-character Git SHA. Got: "${fullGitSha}". ` +
    'Set GIT_SHA or COMMIT_SHA environment variable.'
  );
}

const builtAt = new Date().toISOString();

/**
 * Length-prefixed binary serialization helper to avoid escape ambiguities:
 * Writes BigUInt64BE length + raw Buffer bytes to Hash instance.
 */
function updateHashField(hash, value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(String(value), 'utf8');

  const lenBuf = Buffer.alloc(8);
  lenBuf.writeBigUInt64BE(BigInt(bytes.length));

  hash.update(lenBuf);
  hash.update(bytes);
}

/**
 * Shared, deterministic sourceTreeHash calculation (V6.2.1):
 * sha256(sorted-tracked-and-untracked-nonignored-paths-and-bytes-v1)
 */
export function computeSourceTreeHash(repoRoot = path.resolve(__dirname, '..')) {
  if (process.env.SOURCE_TREE_HASH && /^[0-9a-f]{64}$/i.test(process.env.SOURCE_TREE_HASH)) {
    return process.env.SOURCE_TREE_HASH;
  }

  const hash = createHash('sha256');
  updateHashField(hash, 'v1-tree-hash');

  try {
    const lsOutput = execSync('git ls-files -c -o --exclude-standard -z', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const relFiles = lsOutput.split('\0').filter(Boolean).sort();

    for (const relPath of relFiles) {
      const normPath = relPath.replace(/\\/g, '/');
      const absPath = path.join(repoRoot, relPath);

      if (!fs.existsSync(absPath)) {
        updateHashField(hash, 'DELETED');
        updateHashField(hash, normPath);
        updateHashField(hash, Buffer.alloc(0));
        continue;
      }

      const stat = fs.lstatSync(absPath);
      if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(absPath);
        updateHashField(hash, 'SYMLINK');
        updateHashField(hash, normPath);
        updateHashField(hash, linkTarget);
      } else if (stat.isFile()) {
        const bytes = fs.readFileSync(absPath);
        updateHashField(hash, 'FILE');
        updateHashField(hash, normPath);
        updateHashField(hash, bytes);
      }
    }
  } catch (_) {
    updateHashField(hash, 'fallback-empty');
  }

  return hash.digest('hex');
}

// Build-only plugin: cleans dist and emits single dist/build-info.json asset in Rollup generateBundle
export function buildInfoPlugin() {
  return {
    name: 'vbai-build-info',
    apply: 'build',

    buildStart() {
      // Clean dist directory to prevent stale artifact false-positives
      const distDir = path.resolve(__dirname, 'dist');
      if (fs.existsSync(distDir)) {
        try {
          fs.rmSync(distDir, { recursive: true, force: true });
        } catch (_) {}
      }
    },

    generateBundle() {
      const repoRoot = path.resolve(__dirname, '..');

      let currentGitSha = process.env.GIT_SHA || process.env.COMMIT_SHA || '';
      if (!/^[0-9a-f]{40}$/i.test(currentGitSha)) {
        try {
          currentGitSha = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
        } catch (_) {
          currentGitSha = '';
        }
      }
      if (!/^[0-9a-f]{40}$/i.test(currentGitSha)) {
        throw new Error('[VBAI BUILD] Refusing to emit build-info.json without an exact 40-character Git SHA.');
      }
      const shortSha = currentGitSha.substring(0, 7);

      let dirty = false;
      if (process.env.SOURCE_TREE_DIRTY !== undefined) {
        dirty = process.env.SOURCE_TREE_DIRTY === 'true';
      } else {
        try {
          const status = execSync('git status --porcelain=v1', { cwd: repoRoot, encoding: 'utf8' }).trim();
          dirty = status.length > 0;
        } catch (_) {}
      }

      if (process.env.REQUIRE_CLEAN_BUILD === 'true' && dirty) {
        throw new Error('[VBAI BUILD] REQUIRE_CLEAN_BUILD policy failed: Working tree is dirty.');
      }

      const sourceTreeHash = computeSourceTreeHash(repoRoot);
      const releaseEligible = !dirty;

      const buildInfo = {
        product: 'VBAI Legal Pro V2',
        service: 'vbai',
        environment: 'production',
        gitSha: currentGitSha,
        shortSha,
        dirty,
        sourceTreeHash,
        sourceTreeHashAlgorithm: 'sha256(sorted-tracked-and-untracked-nonignored-paths-and-bytes-v1)',
        builtAt: new Date().toISOString(),
        releaseEligible
      };

      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: JSON.stringify(buildInfo, null, 2) + '\n'
      });
    }
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
