
import { UserStats, WrongQuestion } from "../types";

/**
 * kvdb.io 稳定版存储服务 - 采用更短的存储桶
 */
const BUCKET_ID = "gk_v1"; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const generateSyncId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 核心：数据瘦身处理，防止体积过大导致同步失败
 */
const compressStats = (stats: UserStats): any => {
  const simplify = (q: WrongQuestion) => ({
    q: q.question,
    o: q.options,
    a: q.answerIndex,
    e: q.explanation,
    p: q.grammarPoint,
    u: q.userAnswerIndex,
    t: q.timestamp
  });

  return {
    wc: stats.wrongCounts,
    wh: stats.wrongHistory.slice(0, 80).map(simplify), // 限制上传最近80条错题
    sh: stats.savedHistory.slice(0, 50).map(simplify), // 限制上传最近50条收藏
    sid: stats.syncId,
    ts: Date.now()
  };
};

/**
 * 核心：数据解压还原
 */
const decompressStats = (data: any): UserStats => {
  const restore = (q: any): WrongQuestion => ({
    id: `q_${q.t}`,
    question: q.q,
    options: q.o,
    answerIndex: q.a,
    explanation: q.e,
    grammarPoint: q.p,
    difficulty: '中等',
    userAnswerIndex: q.u,
    timestamp: q.t
  });

  return {
    wrongCounts: data.wc || {},
    wrongHistory: (data.wh || []).map(restore),
    savedHistory: (data.sh || []).map(restore),
    syncId: data.sid,
    lastSyncTime: data.ts
  };
};

export const uploadToCloud = async (syncId: string, stats: UserStats) => {
  if (!syncId) throw new Error("SYNC_ID_MISSING");
  
  // 1. 数据瘦身
  const payload = compressStats(stats);
  const body = JSON.stringify(payload);

  // 2. 检查体积（调试用）
  console.log(`Payload size: ${(body.length / 1024).toFixed(2)} KB`);

  try {
    const response = await fetch(`${API_BASE}/${syncId}`, {
      method: 'PUT',
      body: body,
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      cache: 'no-store',
      referrerPolicy: "no-referrer"
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    return payload.ts;
  } catch (error: any) {
    console.error("Cloud Upload Error:", error);
    throw new Error("同步失败：请检查网络连接或尝试缩减错题数量");
  }
};

export const downloadFromCloud = async (syncId: string): Promise<UserStats | null> => {
  if (!syncId) return null;

  try {
    const response = await fetch(`${API_BASE}/${syncId}?t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    });
    
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Fetch error ${response.status}`);

    const data = await response.json();
    return decompressStats(data);
  } catch (error: any) {
    console.error("Cloud Download Error:", error);
    throw new Error("获取失败：云端连接不稳定，请稍后重试");
  }
};
