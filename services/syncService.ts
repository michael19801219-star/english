
import { UserStats } from "../types";

/**
 * 使用 api.keyvalue.xyz 提供真实跨设备 KV 存储
 * 注意：这是一个公开的存储服务，建议仅用于非敏感的学习进度同步
 */
const API_BASE = "https://api.keyvalue.xyz";
const APP_PREFIX = "GK_GRAMMAR_V2";

export const generateSyncId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < 6; i++) { // 6位够用了
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const uploadToCloud = async (syncId: string, stats: UserStats) => {
  const key = `${APP_PREFIX}_${syncId}`;
  const syncData = {
    ...stats,
    lastSyncTime: Date.now()
  };

  try {
    // 步骤 1: 尝试创建/更新这个 key 对应的内容
    // 使用 POST 提交数据
    const response = await fetch(`${API_BASE}/${key}`, {
      method: 'POST',
      body: JSON.stringify(syncData),
      headers: {
        'Content-Type': 'text/plain', // 该 API 接收纯文本作为值
      }
    });

    if (!response.ok) {
      throw new Error("HTTP_ERROR");
    }

    return syncData.lastSyncTime;
  } catch (error) {
    console.error("Upload failed", error);
    throw new Error("云端上传失败，请检查网络连接");
  }
};

export const downloadFromCloud = async (syncId: string): Promise<UserStats | null> => {
  const key = `${APP_PREFIX}_${syncId}`;
  
  try {
    // 步骤 2: 从 API 获取数据
    const response = await fetch(`${API_BASE}/${key}`);
    
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("NETWORK_ERROR");
    }

    const text = await response.text();
    if (!text || text.trim() === "") return null;

    const data = JSON.parse(text);
    return data;
  } catch (error) {
    console.error("Download failed", error);
    throw new Error("同步失败：请检查同步码是否输入正确或网络是否可用");
  }
};
