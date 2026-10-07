import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [vue()],
    server: { port: 5174, proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } }
  };
});
