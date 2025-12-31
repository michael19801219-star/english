
import React, { useState, useEffect } from 'react';
import { UserStats, Difficulty, GRAMMAR_POINTS } from '../types';
import { uploadToCloud, downloadFromCloud, getManualBackupCode, importFromManualCode } from '../services/syncService';

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
  const [syncIdInput, setSyncIdInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [manualCode, setManualCode] = useState('');
  const [downloadConfirm, setDownloadConfirm] = useState<{ isOpen: boolean; data: UserStats | null }>({ isOpen: false, data: null });

  const togglePoint = (point: string) => {
    setSelectedPoints(prev => prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]);
  };

  // 云端同步逻辑
  const handleUpload = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const docId = await uploadToCloud(stats.syncId || "new", stats);
      onUpdateStats({ ...stats, syncId: docId, lastSyncTime: Date.now() });
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e: any) {
      setSyncStatus('error');
      setErrorMsg("网络防火墙拦截。建议改用下方“手动备份”");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchRemote = async () => {
    const code = syncIdInput.trim();
    if (code.length < 5) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const remoteData = await downloadFromCloud(code);
      if (remoteData) {
        setDownloadConfirm({ isOpen: true, data: remoteData });
      } else {
        setSyncStatus('error');
        setErrorMsg("存档不存在或已过期");
      }
    } catch (e: any) {
      setSyncStatus('error');
      setErrorMsg("下载受阻，请检查 5G 信号");
    } finally {
      setIsSyncing(false);
    }
  };

  // 手动同步逻辑
  const handleManualExport = () => {
    const code = getManualBackupCode(stats);
    setManualCode(code);
    navigator.clipboard.writeText(code).then(() => {
      alert("✅ 备份代码已复制到剪贴板！\n请通过微信发送给另一台手机。");
    }).catch(() => {
      alert("复制失败，请手动长按下方文本框全选复制。");
    });
  };

  const handleManualImport = () => {
    const data = importFromManualCode(manualCode);
    if (data) {
      setDownloadConfirm({ isOpen: true, data: data });
    } else {
      alert("❌ 代码无效，请确认已完整复制备份码。");
    }
  };

  const executeDownload = () => {
    if (downloadConfirm.data) {
      onUpdateStats(downloadConfirm.data);
      setDownloadConfirm({ isOpen: false, data: null });
      setIsSyncOpen(false);
      alert("🎉 数据同步成功！");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 animate-fadeIn relative">
      <div className="absolute top-[-80px] left-[-40px] w-72 h-72 bg-indigo-200 rounded-full blur-[90px] opacity-30 -z-10"></div>
      
      <div className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar">
        <header className="py-8 flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase mb-1">PRO v3.0</span>
            <h1 className="text-[30px] font-black text-gray-900 leading-[1.1]">英语语法<br/><span className="text-indigo-600">通关大师</span></h1>
            <button onClick={() => setIsSyncOpen(true)} className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-all">
              <span className="text-xs font-bold text-gray-500">{stats.syncId ? `已绑定: ${stats.syncId}` : '☁️ 开启同步 (解决跨机同步)'}</span>
              <div className={`w-2 h-2 rounded-full ${stats.syncId ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`}></div>
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
           {/* 核心训练面板 */}
           <section className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
             <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">题量设置</h3>
             <div className="grid grid-cols-4 gap-2">
               {[5, 10, 20, 30].map(c => (
                 <button key={c} onClick={() => setCount(c)} className={`py-3 rounded-2xl text-sm font-black transition-all ${count === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 border border-transparent'}`}>{c}</button>
               ))}
             </div>
           </section>

           <section className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
             <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">难度选择</h3>
             <div className="flex bg-gray-50 p-1 rounded-2xl gap-1">
               {(['简单', '中等', '较难'] as Difficulty[]).map(d => (
                 <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${difficulty === d ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>{d}</button>
               ))}
             </div>
           </section>

           <section className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">考点范围</h3>
               <button onClick={() => setIsModalOpen(true)} className="text-[10px] font-black text-indigo-600">编辑</button>
             </div>
             <div className="flex flex-wrap gap-1.5">
               {selectedPoints.length === 0 ? <span className="text-xs text-gray-300 italic">全考点随机混合出题</span> : selectedPoints.map(p => <span key={p} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold">#{p}</span>)}
             </div>
           </section>
        </div>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 p-6 z-10 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
        <button onClick={() => onStart(count, difficulty, selectedPoints)} className="w-full bg-indigo-600 text-white py-5 rounded-[28px] font-black text-lg shadow-[0_12px_24px_rgba(79,70,229,0.3)] active:scale-95 transition-all">🚀 开始练习</button>
      </footer>

      {/* 同步中心弹窗 */}
      {isSyncOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn" onClick={() => setIsSyncOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[44px] p-8 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">同步实验室</h3>
              <button onClick={() => setIsSyncOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-400">✕</button>
            </div>

            <div className="space-y-6">
              {/* 模块1：手动备份（最高优先级） */}
              <div className="p-5 bg-amber-50 rounded-[28px] border border-amber-100/50">
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span> 物理同步 (100% 成功)
                </h4>
                <div className="space-y-3">
                  <button onClick={handleManualExport} className="w-full py-3.5 bg-amber-500 text-white rounded-2xl text-[13px] font-black shadow-lg shadow-amber-200 active:scale-95 transition-all">复制我的备份代码</button>
                  <div className="relative">
                    <textarea 
                      placeholder="粘贴另一台设备的备份码..." 
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value)}
                      className="w-full h-20 p-4 bg-white rounded-2xl text-[10px] font-mono border-none shadow-inner resize-none mb-2"
                    />
                    <button 
                      disabled={!manualCode}
                      onClick={handleManualImport} 
                      className={`w-full py-3 rounded-2xl text-[13px] font-black transition-all ${manualCode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-300'}`}
                    >
                      从代码导入并覆盖
                    </button>
                  </div>
                </div>
              </div>

              {/* 模块2：云端同步 */}
              <div className="p-5 bg-indigo-50/50 rounded-[28px] border border-indigo-100/50">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">云端快传</h4>
                {stats.syncId ? (
                   <div className="text-center">
                     <p className="text-2xl font-black text-indigo-600 mb-3 tracking-widest">{stats.syncId}</p>
                     <button disabled={isSyncing} onClick={handleUpload} className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg active:scale-95">
                        {isSyncing ? '传输中...' : '更新云端备份'}
                     </button>
                   </div>
                ) : (
                  <button disabled={isSyncing} onClick={handleUpload} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black active:scale-95">
                    {isSyncing ? '连接中...' : '开启云端存储'}
                  </button>
                )}
                
                <div className="mt-5 pt-5 border-t border-indigo-100/50">
                  <input 
                    type="text" 
                    placeholder="输入同步码" 
                    value={syncIdInput} 
                    onChange={e => setSyncIdInput(e.target.value)} 
                    className="w-full p-4 bg-white rounded-2xl text-center font-black text-gray-700 border-none mb-3 shadow-sm" 
                  />
                  <button 
                    disabled={isSyncing || syncIdInput.length < 5} 
                    onClick={handleFetchRemote} 
                    className="w-full py-3 bg-gray-200 text-gray-600 rounded-2xl text-xs font-black active:scale-95"
                  >
                    从云端下载同步
                  </button>
                </div>
              </div>
            </div>

            {syncStatus === 'error' && (
              <div className="mt-6 p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-[10px] text-red-600 font-bold text-center mb-2">连接异常：{errorMsg}</p>
                <div className="text-[9px] text-red-400 leading-relaxed font-medium">
                  • 建议开启 5G 流量并关闭 WiFi<br/>
                  • 请检查是否开启了浏览器广告拦截<br/>
                  • 终极方案：使用上方的“复制/粘贴”备份码
                </div>
              </div>
            )}
            
            <p className="mt-8 text-[9px] text-gray-300 text-center font-medium leading-relaxed uppercase tracking-tighter">
              数据仅用于周琮钦同学个人学习练习使用<br/>所有记录均经过 Base64 加密处理
            </p>
          </div>
        </div>
      )}

      {/* 下载覆盖确认 */}
      {downloadConfirm.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-2xl flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[48px] p-10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">🧬</div>
            <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">确认同步？</h3>
            <p className="text-sm text-gray-400 mb-10 leading-relaxed font-medium">即将导入存档。这会 <span className="text-red-500 font-black underline">永久删除并覆盖</span> 本机当前的所有错题。建议操作前先手动备份一次。</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeDownload} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-lg shadow-xl shadow-indigo-100 active:scale-95 transition-all">确认并覆盖</button>
              <button onClick={() => setDownloadConfirm({ isOpen: false, data: null })} className="w-full py-4.5 bg-gray-50 text-gray-400 rounded-[24px] font-bold active:scale-95">再等等</button>
            </div>
          </div>
        </div>
      )}

      {/* 考点选择弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
             <h3 className="text-xl font-black mb-6">专项考点</h3>
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
