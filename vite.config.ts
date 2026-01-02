
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 强制将环境变量注入到前端运行环境
    // 即使 process.env 消失，代码中也会保留具体的 Key 字符串
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY || process.env.API_KEY || "")
  },
  server: {
    // 允许通过手机局域网访问
    host: true
  }
});
