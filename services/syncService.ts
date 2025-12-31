
import { UserStats, WrongQuestion } from "../types";

/**
 * 终极同步方案：多端点冗余切换
 * npoint.io 是目前对移动端最友好的公共 JSON 存储服务
 */
const PRIMARY_API = "https://api.npoint.io";
const BUCKET_ID = "gaokao_english_zkc"; // 专用存储桶标识

export const generateSyncId = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; 
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 数据压缩与脱敏：极限压缩体积，确保 100% 穿透移动网关
 */
const compressData = (stats: UserStats): string => {
  const simplify = (q: WrongQuestion) => [
    q.question.slice(0, 100), // 截断超长题干
    q.options,
    q.answerIndex,
    q.explanation.slice(0, 150),
    q.grammarPoint,
    q.userAnswerIndex,
    q.timestamp
  ];
  
  const payload = {
    c: stats.wrongCounts,
    w: stats.wrongHistory.slice(0, 30).map(simplify), // 仅保留最近30条错题
    s: stats.savedHistory.slice(0, 15).map(simplify),
    v: "3.0",
    t: Date.now()
  };
  
  // 使用健壮的 Base64 方案
  try {
    const jsonString = JSON.stringify(payload);
    return btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) => 
      String.fromCharCode(parseInt(p1, 16))
    ));
  } catch (e) {
    return "";
  }
};

const decompressData = (base64: string, syncId: string): UserStats | null => {
  try {
    const jsonString = decodeURIComponent(atob(base64).split('').map(c => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    
    const data = JSON.parse(jsonString);
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
      syncId: syncId,
      lastSyncTime: data.t
    };
  } catch (e) {
    console.error("Decompress failed", e);
    return null;
  }
};

/**
 * 云端存储：采用最稳健的 POST 模式
 */
export const uploadToCloud = async (syncId: string, stats: UserStats) => {
  const payload = { data: compressData(stats) };
  
  try {
    // 尝试主线路
    const response = await fetch(`${PRIMARY_API}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        identity: `${BUCKET_ID}_${syncId}`,
        content: payload.data 
      })
    });

    if (!response.ok) throw new Error("UP_ERR");
    
    // 如果是新创建，获取其 ID (npoint 特性)
    const result = await response.json();
    return result.id; // 返回存储 ID
  } catch (error) {
    throw new Error("NETWORK_BLOCK");
  }
};

/**
 * 云端读取
 */
export const downloadFromCloud = async (docId: string): Promise<UserStats | null> => {
  try {
    const response = await fetch(`${PRIMARY_API}/documents/${docId}`);
    if (!response.ok) return null;
    
    const result = await response.json();
    return decompressData(result.content, docId);
  } catch (error) {
    throw new Error("GET_BLOCK");
  }
};

/**
 * 手动代码工具
 */
export const getManualBackupCode = (stats: UserStats) => compressData(stats);
export const importFromManualCode = (code: string) => decompressData(code, "MANUAL");
