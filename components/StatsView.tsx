
import React, { useMemo } from 'react';
import { UserStats } from '../types';
import { getManualBackupCode, importFromManualCode } from '../services/syncService';

interface StatsViewProps {
  stats: UserStats;
  onBack: () => void;
  onImportStats: (stats: UserStats) => void;
}

const StatsView: React.FC<StatsViewProps> = ({ stats, onBack, onImportStats }) => {
  const overallAccuracy = stats.totalQuestionsAttempted > 0 
    ? Math.round((stats.totalCorrectAnswers / stats.totalQuestionsAttempted) * 100) 
    : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}小时${mins % 60}分`;
    return `${mins}分钟`;
  };

  const dailyHistory = useMemo(() => {
    return Object.entries(stats.dailyStats)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30);
  }, [stats.dailyStats]);

  const knowledgeWeakPoints = useMemo(() => {
    return Object.entries(stats.wrongCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5);
  }, [stats.wrongCounts]);

  const recent7Days = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const record = stats.dailyStats[key] || { attempted: 0, correct: 0 };
      data.push({
        label: (d.getMonth() + 1) + '/' + d.getDate(),
        ...record
      });
    }
    return data;
  }, [stats.dailyStats]);

  const maxDailyAttempted = Math.max(...recent7Days.map(d => d.attempted), 5);

  const handleExport = () => {
    const code = getManualBackupCode(stats);
    // 使用 prompt 方便手机端长按复制
    window.prompt("请长按下方代码并复制，妥善保存：", code);
  };

  const handleImport = () => {
    const code = window.prompt("请粘贴您的恢复代码：");
    if (!code) return;
    const newStats = importFromManualCode(code);
    if (newStats) {
      onImportStats(newStats);
    } else {
      alert("无效的代码，请重试。");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-screen overflow-hidden">
      <header className="px-6 pt-10 pb-4 bg-white border-b border-gray-100 flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 active:scale-90 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">学习数据看板</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-12">
        {/* 核心指标 */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">总体正确率</p>
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="48" cy="48" r="40" stroke="#4f46e5" strokeWidth="8" fill="transparent" 
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - overallAccuracy / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <span className="absolute text-xl font-black text-gray-900">{overallAccuracy}%</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">累计练题</p>
              <p className="text-2xl font-black text-gray-900">{stats.totalQuestionsAttempted}<span className="text-[10px] ml-1 text-gray-400">题</span></p>
            </div>
            <div className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">专注时长</p>
              <p className="text-lg font-black text-gray-900">{formatDuration(stats.totalStudyTime)}</p>
            </div>
          </div>
        </section>

        {/* 训练趋势图 */}
        <section className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <h3 className="text-[11px] font-black text-gray-400 mb-6 uppercase tracking-widest">近7日训练量与正确率</h3>
          <div className="flex items-end justify-between h-32 gap-2">
            {recent7Days.map((day, i) => {
              const height = (day.attempted / maxDailyAttempted) * 100;
              const accuracy = day.attempted > 0 ? (day.correct / day.attempted) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full relative h-24 flex flex-col justify-end">
                    <div 
                      className="w-full bg-indigo-100 rounded-t-lg transition-all duration-700"
                      style={{ height: `${height}%` }}
                    >
                      {day.attempted > 0 && (
                        <div 
                          className="w-full bg-indigo-600 rounded-t-lg"
                          style={{ height: `${accuracy}%` }}
                        />
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-gray-400 mt-2">{day.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 手工数据管理 */}
        <section className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[32px] shadow-lg shadow-indigo-100 text-white">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">☁️</span>
            <div>
              <h3 className="font-black text-sm">手工数据中心</h3>
              <p className="text-[9px] opacity-70 uppercase font-bold tracking-widest">Manual Data Backup & Restore</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleExport}
              className="py-3.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl text-[12px] font-black border border-white/10 active:scale-95 transition-all"
            >
              生成备份代码
            </button>
            <button 
              onClick={handleImport}
              className="py-3.5 bg-white text-indigo-600 rounded-2xl text-[12px] font-black active:scale-95 transition-all shadow-xl"
            >
              恢复备份数据
            </button>
          </div>
          <p className="text-[9px] mt-4 opacity-50 text-center leading-relaxed">
            * 备份代码包含您的错题本、收藏及学习统计。<br/>请在更换手机或清理浏览器缓存前进行备份。
          </p>
        </section>

        {/* 薄弱考点排行榜 */}
        <section className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> 知识点薄弱排行
          </h3>
          <div className="space-y-5">
            {knowledgeWeakPoints.length > 0 ? knowledgeWeakPoints.map(([point, val]) => (
              <div key={point}>
                <div className="flex justify-between text-xs font-black text-gray-700 mb-1.5">
                  <span>{point}</span>
                  <span className="text-red-500">累计错 {val as number} 次</span>
                </div>
                <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-400 to-amber-400 rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.min((val as number) * 5, 100)}%` }} 
                  />
                </div>
              </div>
            )) : (
              <div className="text-center py-6 text-gray-300 italic text-sm">暂无错误记录，继续保持！</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default StatsView;
