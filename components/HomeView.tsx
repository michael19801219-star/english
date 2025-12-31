
import React, { useState } from 'react';
import { UserStats, Difficulty, GRAMMAR_POINTS } from '../types';
import { getManualBackupCode, importFromManualCode } from '../services/syncService';

interface HomeViewProps {
  onStart: (count: number, difficulty: Difficulty, points: string[]) => void;
  stats: UserStats;
  onGoToReview: (tab?: 'summary' | 'details' | 'saved') => void;
  onUpdateStats: (newStats: UserStats) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onStart, stats, onGoToReview, onUpdateStats }) => {
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
    }).catch(() => {
      alert("自动复制失败，请手动选择下方文本框内容复制。");
    });
  };

  const handleManualImport = () => {
    const data = importFromManualCode(manualCode);
    if (data) {
      setDownloadConfirm({ isOpen: true, data: data });
    } else {
      alert("❌ 备份代码格式无效，请检查是否复制完整。");
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

  // 获取错题最多的前3个考点
  // Fix: Explicitly cast counts to number for arithmetic comparison to satisfy TypeScript
  const topWrongPoints = Object.entries(stats.wrongCounts || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3)
    .map(entry => entry[0]);

  return (
    <div className="flex-1 flex flex-col bg-gray-50 animate-fadeIn relative">
      <div className="absolute top-[-80px] left-[-40px] w-72 h-72 bg-indigo-200 rounded-full blur-[90px] opacity-30 -z-10"></div>
      
      <div className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar">
        <header className="py-8 flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase mb-1">周琮钦专属定制版</span>
            <h1 className="text-[30px] font-black text-gray-900 leading-[1.1]">英语语法<br/><span className="text-indigo-600">通关大师</span></h1>
            <button onClick={() => setIsSyncOpen(true)} className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-all">
              <span className="text-xs font-bold text-gray-500">💾 数据备份与迁移</span>
              <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
            </button>
          </div>
          <div className="flex gap-2">
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
           {/* 错题巩固专区 - 仅当有错题时显示 */}
           {topWrongPoints.length > 0 && (
             <section className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[32px] shadow-lg shadow-indigo-100 animate-fadeIn relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
               <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                   <div>
                     <h3 className="text-white font-black text-lg tracking-tight">薄弱环节专项巩固</h3>
                     <p className="text-indigo-100 text-[11px] font-medium opacity-80">根据你的历史错题，AI 已锁定高频失分点</p>
                   </div>
                   <span className="text-2xl">🔥</span>
                 </div>
                 <div className="flex flex-wrap gap-2 mb-6">
                   {topWrongPoints.map(p => (
                     <span key={p} className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] text-white font-bold border border-white/10">#{p}</span>
                   ))}
                 </div>
                 <button 
                  onClick={() => onStart(10, '中等', topWrongPoints)}
                  className="w-full py-3.5 bg-white text-indigo-600 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all"
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
               <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">专项考点</h3>
               <button onClick={() => setIsModalOpen(true)} className="text-[10px] font-black text-indigo-600">自定义</button>
             </div>
             <div className="flex flex-wrap gap-1.5">
               {selectedPoints.length === 0 ? <span className="text-xs text-gray-300 italic">全考点混合随机出题</span> : selectedPoints.map(p => <span key={p} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold">#{p}</span>)}
             </div>
           </section>
        </div>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 p-6 z-10 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
        <button onClick={() => onStart(count, difficulty, selectedPoints)} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black text-lg shadow-[0_12px_24px_rgba(79,70,229,0.3)] active:scale-95 transition-all">🚀 启动练习</button>
      </footer>

      {/* 离线迁移中心 */}
      {isSyncOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn" onClick={() => setIsSyncOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[44px] p-8 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">数据迁移中心</h3>
              <button onClick={() => setIsSyncOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-400">✕</button>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-amber-50 rounded-[28px] border border-amber-100/50">
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span> 离线备份 (不限网络)
                </h4>
                <div className="space-y-4">
                  <button onClick={handleManualExport} className="w-full py-4 bg-amber-500 text-white rounded-2xl text-[14px] font-black shadow-lg shadow-amber-200 active:scale-95 transition-all">生成并复制备份代码</button>
                  <div className="relative">
                    <p className="text-[10px] text-gray-400 mb-2 font-bold px-1">从其他设备导入：</p>
                    <textarea 
                      placeholder="请将备份代码粘贴至此处..." 
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value)}
                      className="w-full h-24 p-4 bg-white rounded-2xl text-[10px] font-mono border-none shadow-inner resize-none mb-3"
                    />
                    <button 
                      disabled={!manualCode}
                      onClick={handleManualImport} 
                      className={`w-full py-4 rounded-2xl text-[14px] font-black transition-all ${manualCode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-300'}`}
                    >
                      立即导入数据
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-2">
                <p className="text-[10px] text-gray-400 leading-relaxed text-center">
                  注意：由于安卓系统的网络限制，我们已采用离线同步方案。只需复制这段代码通过微信发给新手机粘贴即可同步练习记录。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {downloadConfirm.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-2xl flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">🧬</div>
            <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">确认覆盖？</h3>
            <p className="text-sm text-gray-400 mb-10 leading-relaxed font-medium">导入新数据会 <span className="text-red-500 font-black underline">清空</span> 本机当前的错题记录。建议在导入前先手动备份一次当前记录。</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeDownload} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-lg shadow-xl shadow-indigo-100 active:scale-95 transition-all">确认同步</button>
              <button onClick={() => setDownloadConfirm({ isOpen: false, data: null })} className="w-full py-4.5 bg-gray-50 text-gray-400 rounded-[24px] font-bold active:scale-95">取消</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
             <h3 className="text-xl font-black mb-6">考点范围</h3>
             <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto no-scrollbar mb-8">
               {GRAMMAR_POINTS.map(p => (
                 <button key={p} onClick={() => togglePoint(p)} className={`p-4 rounded-2xl text-[11px] font-black border-2 transition-all ${selectedPoints.includes(p) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-transparent text-gray-400'}`}>{p}</button>
               ))}
             </div>
             <button onClick={() => setIsModalOpen(false)} className="w-full py-4 bg-gray-900 text-white rounded-[20px] font-black">完成配置</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
