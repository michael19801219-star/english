
import { UserStats, WrongQuestion } from "../types";

/**
 * 采用全新的、复杂的专属存储桶 ID，避免与公共请求冲突
 */
const BUCKET_ID = "gaokao_english_pro_sync_v2_final"; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const generateSyncId = () => {
  // 增加字符复杂度
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 极限压缩：只保留最核心的考试数据，去除所有冗余描述
 */
const compressStats = (stats: UserStats): any => {
  const simplify = (q: WrongQuestion) => [
    q.question,        // 0
    q.options,         // 1
    q.answerIndex,     // 2
    q.explanation,     // 3
    q.grammarPoint,    // 4
    q.userAnswerIndex, // 5
    q.timestamp        // 6
  ];

  return {
    c: stats.wrongCounts,
    w: stats.wrongHistory.slice(0, 50).map(simplify), // 减少条数以确保成功率
    s: stats.savedHistory.slice(0, 30).map(simplify),
    id: stats.syncId,
    t: Date.now()
  };
};

/**
 * 数据解压还原
 */
const decompressStats = (data: any): UserStats => {
  const restore = (q: any[]): WrongQuestion => ({
    id: `q_${q[6]}`,
    question: q[0],
    options: q[1],
    answerIndex: q[2],
    explanation: q[3],
    grammarPoint: q[4],
    difficulty: '中等',
    userAnswerIndex: q[5],
    timestamp: q[6]
  });

  return {
    wrongCounts: data.c || {},
    wrongHistory: (data.w || []).map(restore),
    savedHistory: (data.s || []).map(restore),
    syncId: data.id,
    lastSyncTime: data.t
  };
};

export const uploadToCloud = async (syncId: string, stats: UserStats) => {
  if (!syncId) throw new Error("SYNC_ID_MISSING");
  
  const body = JSON.stringify(compressStats(stats));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(`${API_BASE}/${syncId}`, {
      method: 'PUT',
      body: body,
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return Date.now();
  } catch (error: any) {
    console.error("Sync Error:", error);
    if (error.name === 'AbortError') throw new Error("连接超时：请尝试切换移动 5G 网络");
    throw new Error("同步受限：请确认未开启广告拦截插件，并建议切换网络环境重试。");
  }
};

export const downloadFromCloud = async (syncId: string): Promise<UserStats | null> => {
  if (!syncId) return null;

  try {
    const response = await fetch(`${API_BASE}/${syncId}?nocache=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    });
    
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    const data = await response.json();
    return decompressStats(data);
  } catch (error: any) {
    console.error("Download Error:", error);
    throw new Error("云端数据读取失败，请检查网络。");
  }
};
