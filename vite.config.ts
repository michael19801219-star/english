
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 允许在前端代码中使用 process.env.API_KEY
    // 增加对 VITE_ 命名前缀的兼容，这是 Vite 的标准做法
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || process.env.VITE_API_KEY)
  }
});
