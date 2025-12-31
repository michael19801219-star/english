
import { UserStats } from "../types";

// 使用一个公共的免费 KV 存储服务进行模拟演示 (实际生产环境建议使用 Firebase/Supabase)
const BASE_SYNC_API = "https://kv.now.sh"; // 这是一个演示性质的 KV API 示例

export const generateSyncId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const uploadToCloud = async (syncId: string, stats: UserStats) => {
  try {
    // 实际场景下这里会调用具体的后端接口
    // 这里使用 localStorage 模拟一个“云端”环境，方便在同一浏览器多标签测试
    // 如果需要真实跨设备，需要对接具体的 DB
    const syncData = {
      ...stats,
      lastSyncTime: Date.now()
    };
    localStorage.setItem(`cloud_sync_${syncId}`, JSON.stringify(syncData));
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 800));
    return syncData.lastSyncTime;
  } catch (error) {
    console.error("Upload failed", error);
    throw new Error("云端上传失败，请检查网络");
  }
};

export const downloadFromCloud = async (syncId: string): Promise<UserStats | null> => {
  try {
    const data = localStorage.getItem(`cloud_sync_${syncId}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error("Download failed", error);
    throw new Error("同步码无效或网络异常");
  }
};
