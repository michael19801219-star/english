
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // 仅定义 process.env 对象，不预填充 API_KEY
      // 这样运行时会查找环境中的真实 API_KEY
      'process.env': {}
    },
    server: {
      host: true
    }
  };
});
