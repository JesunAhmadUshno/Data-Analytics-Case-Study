import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';

let commit = 'unknown';
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* not a git checkout */ }

// The site reads ../data and ../results at build time, so every number on the page is generated, never typed.
export default defineConfig({
  base: '/Data-Analytics-Case-Study/',
  plugins: [react()],
  define: { __COMMIT__: JSON.stringify(commit) },
  server: { fs: { allow: ['..'] } },
});
