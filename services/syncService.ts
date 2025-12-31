
import { UserStats, WrongQuestion } from "../types";

/**
 * 切换至更轻量的 keyvalue 服务，并采用更隐蔽的数据传输格式
 */
const API_BASE = "https://api.keyvalue.xyz";
const TOKEN = "gk_zkc_pro_2025"; // 固定 Token 简化路径

export const generateSyncId = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; 
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 将对象转为 Base64 字符串，穿透网络防火墙
 */
const statsToBase64 = (stats: UserStats): string => {
  const simplify = (q: WrongQuestion) => [
    q.question, q.options, q.answerIndex, q.explanation, q.grammarPoint, q.userAnswerIndex, q.timestamp
  ];
  const payload = {
    c: stats.wrongCounts,
    w: stats.wrongHistory.slice(0, 40).map(simplify), // 进一步缩减体积以适配极端网络
    s: stats.savedHistory.slice(0, 20).map(simplify),
    t: Date.now()
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
};

/**
 * 从 Base64 恢复
 */
const base64ToStats = (base64: string, syncId: string): UserStats => {
  const json = decodeURIComponent(escape(atob(base64)));
  const data = JSON.parse(json);
  const restore = (q: any[]): WrongQuestion => ({
    id: `q_${q[6]}`, question: q[0], options: q[1], answerIndex: q[2], explanation: q[3], grammarPoint: q[4], difficulty: '中等', userAnswerIndex: q[5], timestamp: q[6]
  });

  return {
    wrongCounts: data.c || {},
    wrongHistory: (data.w || []).map(restore),
    savedHistory: (data.s || []).map(restore),
    syncId: syncId,
    lastSyncTime: data.t
  };
};

/**
 * 云端上传：改用 POST 协议提升安卓兼容性
 */
export const uploadToCloud = async (syncId: string, stats: UserStats) => {
  const dataString = statsToBase64(stats);
  
  try {
    const response = await fetch(`${API_BASE}/${TOKEN}/${syncId}`, {
      method: 'POST',
      body: dataString,
      headers: { 'Content-Type': 'text/plain' }, // 伪装成纯文本
      mode: 'cors'
    });

    if (!response.ok) throw new Error(`ERR_${response.status}`);
    return Date.now();
  } catch (error: any) {
    console.error("Upload failed", error);
    throw new Error("云端连接受阻：请尝试切换 5G 流量或使用下方的'手动同步'功能。");
  }
};

/**
 * 云端下载
 */
export const downloadFromCloud = async (syncId: string): Promise<UserStats | null> => {
  try {
    const response = await fetch(`${API_BASE}/${TOKEN}/${syncId}?cb=${Date.now()}`, {
      method: 'GET',
      mode: 'cors'
    });
    
    if (response.status === 404 || !response.ok) return null;
    const base64 = await response.text();
    if (base64.length < 10) return null;
    return base64ToStats(base64, syncId);
  } catch (error: any) {
    throw new Error("读取失败：网络请求被拦截，建议使用手动同步代码。");
  }
};

/**
 * 手动备份代码：完全不走云端存储，仅通过文本传递
 */
export const getManualBackupCode = (stats: UserStats): string => {
  return statsToBase64(stats);
};

export const importFromManualCode = (code: string): UserStats | null => {
  try {
    return base64ToStats(code, "MANUAL_" + Date.now().toString().slice(-4));
  } catch (e) {
    return null;
  }
};
