
import { UserStats } from "../types";

/**
 * kvdb.io 稳定版存储服务
 */
const BUCKET_ID = "GaokaoSync_ZC_Final_2025"; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const generateSyncId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const uploadToCloud = async (syncId: string, stats: UserStats) => {
  if (!syncId) throw new Error("SYNC_ID_MISSING");
  
  const syncData = {
    ...stats,
    syncId, // 确保 syncId 也包含在数据中
    lastSyncTime: Date.now()
  };

  try {
    const response = await fetch(`${API_BASE}/${syncId}`, {
      method: 'PUT',
      body: JSON.stringify(syncData),
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Cloud connection failed (${response.status})`);
    }

    return syncData.lastSyncTime;
  } catch (error: any) {
    console.error("Cloud Upload Error:", error);
    if (error.message.includes('fetch')) {
      throw new Error("网络受限：无法连接到云服务器，请检查网络或VPN设置");
    }
    throw error;
  }
};

export const downloadFromCloud = async (syncId: string): Promise<UserStats | null> => {
  if (!syncId) return null;

  try {
    // 强制不使用缓存，获取最新云端快照
    const response = await fetch(`${API_BASE}/${syncId}?nocache=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    });
    
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }

    const data = await response.json();
    
    // 严格数据结构校验
    if (data && typeof data === 'object' && (Array.isArray(data.wrongHistory) || Array.isArray(data.savedHistory))) {
      return data as UserStats;
    }
    
    return null;
  } catch (error: any) {
    console.error("Cloud Download Error:", error);
    if (error.message.includes('fetch')) {
      throw new Error("连接云端超时：请确认设备网络正常且未屏蔽外部接口");
    }
    throw error;
  }
};
