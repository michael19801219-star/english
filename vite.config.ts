
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 加载当前环境的所有变量
  // Fix: cast process to any to resolve 'Property cwd does not exist on type Process' error in some environments
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // 这里的注入顺序确保了无论在 Vercel 设置还是本地 .env 都能拿到 Key
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY)
    },
    server: {
      host: true
    }
  };
});
