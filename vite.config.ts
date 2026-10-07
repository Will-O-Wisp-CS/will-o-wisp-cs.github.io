import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  // HTML・ソース・テストはすべて src/ に置く。メインは src/index.html、各ページは src/<名前>/index.html（公開URLは /<名前>/）
  root: src(''),
  base: '/',
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        home: src('index.html'),
        finals: src('finals/index.html'),
        points: src('points/index.html'),
        schedule: src('schedule/index.html'),
        tax: src('tax/index.html'),
      },
    },
  },
});
