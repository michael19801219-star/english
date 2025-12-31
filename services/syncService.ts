
import { UserStats, WrongQuestion } from "../types";

/**
 * 极限压缩备份方案：为了兼容微信发送，对非核心数据进行大幅截断和精简
 */

/**
 * 数据压缩
 */
const compressData = (stats: UserStats): string => {
  const simplify = (q: WrongQuestion) => [
    q.question.slice(0, 80), // 深度截断题目
    q.options,
    q.answerIndex,
    q.explanation.slice(0, 100), // 深度截断解析
    q.grammarPoint,
    q.userAnswerIndex,
    Math.floor(q.timestamp / 1000), // 降级为秒级时间戳
    q.translation?.slice(0, 40) // 深度截断翻译
  ];
  
  // 仅保留最近 14 天的每日数据，防止长年累月的数据导致代码无限增长
  const dailyKeys = Object.keys(stats.dailyStats || {}).sort().reverse().slice(0, 14);
  const miniDaily: Record<string, any> = {};
  dailyKeys.forEach(k => {
    miniDaily[k] = stats.dailyStats[k];
  });

  const payload = {
    c: stats.wrongCounts,
    w: stats.wrongHistory.slice(0, 12).map(simplify), // 仅保留最近 12 条错题
    s: stats.savedHistory.slice(0, 8).map(simplify),  // 仅保留最近 8 条收藏
    qa: stats.totalQuestionsAttempted,
    ca: stats.totalCorrectAnswers,
    st: stats.totalStudyTime,
    ds: miniDaily,
    v: "6.0_MINI", // 版本标记
    t: Math.floor(Date.now() / 1000)
  };
  
  try {
    const jsonString = JSON.stringify(payload);
    // 使用 Unicode 安全的 Base64 编码
    return btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) => 
      String.fromCharCode(parseInt(p1, 16))
    ));
  } catch (e) {
    console.error("Compression error", e);
    return "";
  }
};

/**
 * 数据解压
 */
const decompressData = (base64: string): UserStats | null => {
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
      timestamp: q[6] * 1000, // 还原为毫秒
      translation: q[7]
    });

    return {
      wrongCounts: data.c || {},
      wrongHistory: (data.w || []).map(restore),
      savedHistory: (data.s || []).map(restore),
      totalQuestionsAttempted: data.qa || 0,
      totalCorrectAnswers: data.ca || 0,
      totalStudyTime: data.st || 0,
      dailyStats: data.ds || {},
      lastSyncTime: data.t * 1000
    };
  } catch (e) {
    console.error("Decompression failed", e);
    return null;
  }
};

export const getManualBackupCode = (stats: UserStats) => compressData(stats);
export const importFromManualCode = (code: string) => decompressData(code);
