
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 强制将环境变量注入到前端运行环境
    // 优先使用环境变量，否则回退到指定的公共 API Key
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY || process.env.API_KEY || "AIzaSyBnDmOI3K3uuJ7qxpfhYgqWjuXysnDq-40")
  },
  server: {
    // 允许通过手机局域网访问
    host: true
  }
});
