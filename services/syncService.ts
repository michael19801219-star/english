
import { UserStats, WrongQuestion } from "../types";

/**
 * 离线备份方案：采用 Base64 编码将错题数据转为可复制的字符串
 */

/**
 * 数据压缩：极限压缩体积，确保 100% 兼容文本传输
 */
const compressData = (stats: UserStats): string => {
  const simplify = (q: WrongQuestion) => [
    q.question.slice(0, 150),
    q.options,
    q.answerIndex,
    q.explanation.slice(0, 200),
    q.grammarPoint,
    q.userAnswerIndex,
    q.timestamp,
    q.translation
  ];
  
  const payload = {
    c: stats.wrongCounts,
    w: stats.wrongHistory.slice(0, 50).map(simplify),
    s: stats.savedHistory.slice(0, 30).map(simplify),
    tqa: stats.totalQuestionsAttempted,
    tca: stats.totalCorrectAnswers,
    tst: stats.totalStudyTime,
    ds: stats.dailyStats,
    v: "5.0_MANUAL",
    t: Date.now()
  };
  
  try {
    const jsonString = JSON.stringify(payload);
    // 使用健壮的 Unicode 安全 Base64 方案
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
      timestamp: q[6],
      translation: q[7]
    });

    return {
      wrongCounts: data.c || {},
      wrongHistory: (data.w || []).map(restore),
      savedHistory: (data.s || []).map(restore),
      totalQuestionsAttempted: data.tqa || 0,
      totalCorrectAnswers: data.tca || 0,
      totalStudyTime: data.tst || 0,
      dailyStats: data.ds || {},
      lastSyncTime: data.t
    };
  } catch (e) {
    console.error("Decompression failed", e);
    return null;
  }
};

export const getManualBackupCode = (stats: UserStats) => compressData(stats);
export const importFromManualCode = (code: string) => decompressData(code);
