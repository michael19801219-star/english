
import React, { useState } from 'react';
import { UserStats, Difficulty, GRAMMAR_POINTS } from '../types';
import { getManualBackupCode, importFromManualCode } from '../services/syncService';

interface HomeViewProps {
  onStart: (count: number, difficulty: Difficulty, points: string[]) => void;
  stats: UserStats;
  onGoToReview: (tab?: 'summary' | 'details' | 'saved') => void;
  onGoToStats: () => void;
  onUpdateStats: (newStats: UserStats) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, stats, onGoToReview, onGoToStats, onUpdateStats }) => {
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('中等');
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [downloadConfirm, setDownloadConfirm] = useState<{ isOpen: boolean; data: UserStats | null }>({ isOpen: false, data: null });

  const togglePoint = (point: string) => {
    setSelectedPoints(prev => prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]);
  };

  const handleManualExport = () => {
    const code = getManualBackupCode(stats);
    setManualCode(code);
    navigator.clipboard.writeText(code).then(() => {
      alert("✅ 备份代码已成功复制！\n请通过微信发送给另一台手机粘贴。");
    });
  };

  const handleManualImport = () => {
    const data = importFromManualCode(manualCode);
    if (data) {
      setDownloadConfirm({ isOpen: true, data: data });
    } else {
      alert("❌ 备份代码格式无效。");
    }
  };

  const executeDownload = () => {
    if (downloadConfirm.data) {
      onUpdateStats(downloadConfirm.data);
      setDownloadConfirm({ isOpen: false, data: null });
      setIsSyncOpen(false);
      alert("🎉 离线数据迁移完成！");
    }
  };

  const topWrongPoints = Object.entries(stats.wrongCounts || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3)
    .map(entry => entry[0]);

  return (
    <div className="flex-1 flex flex-col bg-gray-50 animate-fadeIn h-full overflow-hidden">
      <div className="absolute top-[-80px] left-[-40px] w-72 h-72 bg-indigo-200 rounded-full blur-[90px] opacity-30 -z-10"></div>
      
      {/* 内容滚动区域 */}
      <div className="flex-1 overflow-y-auto px-6 no-scrollbar pb-10">
        <header className="py-8 flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase mb-1">周琮钦专属定制版</span>
            <h1 className="text-[30px] font-black text-gray-900 leading-[1.1]">英语语法<br/><span className="text-indigo-600">通关大师</span></h1>
            <button onClick={() => setIsSyncOpen(true)} className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-all">
              <span className="text-xs font-bold text-gray-500">💾 数据同步</span>
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={onGoToStats} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center active:scale-90 transition-all">
              <span className="text-xl">📊</span>
              <span className="text-[8px] font-black text-gray-400 mt-1 uppercase">统计</span>
            </button>
            <button onClick={() => onGoToReview('saved')} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center active:scale-90 transition-all">
              <span className="text-xl">⭐</span>
              <span className="text-[8px] font-black text-gray-400 mt-1 uppercase">收藏</span>
            </button>
            <button onClick={() => onGoToReview('details')} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center active:scale-90 transition-all">
              <span className="text-xl">📕</span>
              <span className="text-[8px] font-black text-gray-400 mt-1 uppercase">错题</span>
            </button>
          </div>
        </header>

        <div className="space-y-6">
           {topWrongPoints.length > 0 && (
             <section className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[32px] shadow-lg shadow-indigo-100 relative overflow-hidden group">
               <div className="relative z-10">
                 <h3 className="text-white font-black text-lg mb-1 tracking-tight">薄弱环节专项突破</h3>
                 <p className="text-indigo-100 text-[10px] opacity-80 mb-4">AI 已为您锁定高频失分点</p>
                 <div className="flex flex-wrap gap-2 mb-6">
                   {topWrongPoints.map(p => (
                     <span key={p} className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] text-white font-bold border border-white/10">#{p}</span>
                   ))}
                 </div>
                 <button 
                  onClick={() => onStart(10, '中等', topWrongPoints)}
                  className="w-full py-3.5 bg-white text-indigo-600 rounded-2xl font-black text-sm active:scale-95 transition-all"
                 >
                   立即开启针对性训练
                 </button>
               </div>
             </section>
           )}

           <section className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
             <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">练习题量</h3>
             <div className="grid grid-cols-4 gap-2">
               {[5, 10, 20, 30].map(c => (
                 <button key={c} onClick={() => setCount(c)} className={`py-3 rounded-2xl text-sm font-black transition-all ${count === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 border border-transparent'}`}>{c}</button>
               ))}
             </div>
           </section>

           <section className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
             <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">难度等级</h3>
             <div className="flex bg-gray-50 p-1 rounded-2xl gap-1">
               {(['简单', '中等', '较难'] as Difficulty[]).map(d => (
                 <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${difficulty === d ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>{d}</button>
               ))}
             </div>
           </section>

           <section className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">考点范围</h3>
               <button onClick={() => setIsModalOpen(true)} className="text-[10px] font-black text-indigo-600">配置</button>
             </div>
             <div className="flex flex-wrap gap-1.5">
               {selectedPoints.length === 0 ? <span className="text-xs text-gray-300 italic">全考点混合随机出题</span> : selectedPoints.map(p => <span key={p} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold">#{p}</span>)}
             </div>
           </section>
        </div>
      </div>

      {/* 固定底部的操作栏 */}
      <footer className="p-6 bg-white border-t border-gray-100 safe-area-bottom shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)]">
        <button onClick={() => onStart(count, difficulty, selectedPoints)} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black text-lg shadow-xl active:scale-95 transition-all">🚀 启动练习</button>
      </footer>

      {isSyncOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setIsSyncOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[44px] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tight">数据同步中心</h3>
            <div className="space-y-6">
              <button onClick={handleManualExport} className="w-full py-4 bg-amber-500 text-white rounded-2xl text-[14px] font-black">生成备份代码</button>
              <textarea 
                placeholder="粘贴备份代码..." 
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                className="w-full h-24 p-4 bg-gray-50 rounded-2xl text-[10px] border-none shadow-inner resize-none"
              />
              <button disabled={!manualCode} onClick={handleManualImport} className="w-full py-4 bg-gray-900 text-white rounded-2xl text-[14px] font-black">立即导入数据</button>
            </div>
          </div>
        </div>
      )}

      {downloadConfirm.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-8">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-10 text-center">
            <h3 className="text-2xl font-black text-gray-900 mb-6">确认覆盖？</h3>
            <p className="text-sm text-gray-400 mb-10 leading-relaxed font-medium">导入新数据会清空本机记录。</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeDownload} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black">确认同步</button>
              <button onClick={() => setDownloadConfirm({ isOpen: false, data: null })} className="w-full py-4.5 bg-gray-50 text-gray-400 rounded-[24px]">取消</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
             <h3 className="text-xl font-black mb-6">考点范围</h3>
             <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto no-scrollbar mb-8">
               {GRAMMAR_POINTS.map(p => (
                 <button key={p} onClick={() => togglePoint(p)} className={`p-4 rounded-2xl text-[11px] font-black border-2 transition-all ${selectedPoints.includes(p) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-transparent text-gray-400'}`}>{p}</button>
               ))}
             </div>
             <button onClick={() => setIsModalOpen(false)} className="w-full py-4 bg-gray-900 text-white rounded-[20px] font-black">完成</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
