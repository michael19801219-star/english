
import React, { useState, useEffect } from 'react';
import { UserStats, Difficulty, GRAMMAR_POINTS } from '../types';
import { generateSyncId, uploadToCloud, downloadFromCloud, getManualBackupCode, importFromManualCode } from '../services/syncService';

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
  
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [downloadConfirm, setDownloadConfirm] = useState<{ isOpen: boolean; data: UserStats | null }>({ isOpen: false, data: null });

  const togglePoint = (point: string) => {
    setSelectedPoints(prev => prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]);
  };

  const handleCreateSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    const newId = generateSyncId();
    try {
      await uploadToCloud(newId, stats);
      onUpdateStats({ ...stats, syncId: newId, lastSyncTime: Date.now() });
      setSyncStatus('success');
    } catch (e: any) {
      setSyncStatus('error');
      setErrorMsg(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpload = async () => {
    if (!stats.syncId) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      await uploadToCloud(stats.syncId, stats);
      onUpdateStats({ ...stats, lastSyncTime: Date.now() });
      setSyncStatus('success');
    } catch (e: any) {
      setSyncStatus('error');
      setErrorMsg(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchRemote = async () => {
    const code = syncIdInput.trim().toUpperCase();
    if (code.length < 6) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const remoteData = await downloadFromCloud(code);
      if (remoteData) setDownloadConfirm({ isOpen: true, data: remoteData });
      else { setSyncStatus('error'); setErrorMsg("未找到该代码对应的存档"); }
    } catch (e: any) {
      setSyncStatus('error'); setErrorMsg(e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualExport = () => {
    const code = getManualBackupCode(stats);
    setManualCode(code);
    navigator.clipboard.writeText(code);
    alert("备份代码已复制！您可以将其通过微信发给其他设备粘贴同步。");
  };

  const handleManualImport = () => {
    const data = importFromManualCode(manualCode);
    if (data) setDownloadConfirm({ isOpen: true, data: data });
    else alert("备份代码格式错误，请重新输入。");
  };

  const executeDownload = () => {
    if (downloadConfirm.data) {
      onUpdateStats(downloadConfirm.data);
      setDownloadConfirm({ isOpen: false, data: null });
      setIsSyncOpen(false);
      setSyncStatus('success');
      alert("同步成功！");
    }
  };

  const sortedWrongEntries = Object.entries(stats.wrongCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
  const hasWrongStats = sortedWrongEntries.length > 0;
  const topWrongPoint = hasWrongStats ? sortedWrongEntries[0][0] : null;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 animate-fadeIn relative">
      <div className="absolute top-[-80px] left-[-40px] w-72 h-72 bg-indigo-200 rounded-full blur-[90px] opacity-30 -z-10"></div>
      
      <div className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar">
        <header className="py-8 flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-tighter mb-1">周琮钦专属定制版</span>
            <h1 className="text-[30px] font-black text-gray-900 leading-[1.1]">英语语法<br/><span className="text-indigo-600">通关大师</span></h1>
            <button onClick={() => setIsSyncOpen(true)} className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 active:scale-95 transition-all">
              <span className="text-xs font-medium text-gray-600">{stats.syncId ? `☁️ 同步码: ${stats.syncId}` : '☁️ 开启备份同步'}</span>
              <div className={`w-2 h-2 rounded-full ${stats.syncId ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onGoToReview('saved')} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center active:scale-90 transition-all">
              <span className="text-xl">⭐</span>
              <span className="text-[8px] font-black text-gray-400 mt-1">收藏本</span>
            </button>
            <button onClick={() => onGoToReview('details')} className="bg-white p-3 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center active:scale-90 transition-all">
              <span className="text-xl">📕</span>
              <span className="text-[8px] font-black text-gray-400 mt-1">错题集</span>
            </button>
          </div>
        </header>

        <div className="space-y-8">
          <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] border border-white">
            <h3 className="text-[11px] font-black text-gray-400 mb-5 uppercase tracking-widest">训练题量</h3>
            <div className="grid grid-cols-4 gap-3">
              {[5, 10, 20, 30].map(c => (
                <button key={c} onClick={() => setCount(c)} className={`py-3.5 rounded-[20px] text-sm font-black ${count === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{c}</button>
              ))}
            </div>
          </section>

          <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] border border-white">
            <h3 className="text-[11px] font-black text-gray-400 mb-5 uppercase tracking-widest">难度等级</h3>
            <div className="flex bg-gray-100/50 p-1 rounded-[24px] gap-1">
              {(['简单', '中等', '较难'] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-3.5 rounded-[18px] text-sm font-black ${difficulty === d ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 opacity-60'}`}>{d}</button>
              ))}
            </div>
          </section>

          <section className="bg-white/70 backdrop-blur-sm p-6 rounded-[36px] border border-white">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">专项练习</h3>
              <button onClick={() => setIsModalOpen(true)} className="text-[10px] font-black text-indigo-600 px-3 py-1 bg-indigo-50 rounded-lg">修改</button>
            </div>
            <div className="p-4 bg-white/50 rounded-[24px] border border-dashed border-gray-200">
              {selectedPoints.length === 0 ? <span className="text-sm text-gray-400 italic">全考点随机覆盖</span> : selectedPoints.map(p => <span key={p} className="inline-block px-3 py-1.5 bg-white border border-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black mr-2 mb-2 shadow-sm">#{p}</span>)}
            </div>
          </section>
        </div>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
        <button onClick={() => onStart(count, difficulty, selectedPoints)} className="w-full bg-indigo-600 text-white py-5 rounded-[30px] font-black text-xl shadow-xl active:scale-[0.97] transition-all">🚀 开始训练</button>
      </footer>

      {isSyncOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn" onClick={() => setIsSyncOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">备份同步中心</h3>
              <button onClick={() => setIsSyncOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-400">✕</button>
            </div>

            <div className="space-y-6">
              {/* 云端方案 */}
              <div className="p-6 bg-indigo-50/50 rounded-[30px] border border-indigo-100">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">云端同步（需网络畅通）</h4>
                {stats.syncId ? (
                  <div className="text-center">
                    <p className="text-2xl font-black text-indigo-600 tracking-[0.3em] mb-4">{stats.syncId}</p>
                    <button disabled={isSyncing} onClick={handleUpload} className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg">
                      {isSyncing ? '连接中...' : '备份当前数据到云端'}
                    </button>
                  </div>
                ) : (
                  <button disabled={isSyncing} onClick={handleCreateSync} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black active:scale-95 transition-all">
                    {isSyncing ? '正在开启...' : '开启云端同步'}
                  </button>
                )}
                
                <div className="mt-6 pt-6 border-t border-indigo-100/50">
                   <input type="text" placeholder="输入6位同步码" value={syncIdInput} maxLength={6} onChange={e => setSyncIdInput(e.target.value.toUpperCase())} className="w-full p-4 bg-white rounded-2xl text-center font-black text-gray-700 border-none mb-3 shadow-inner" />
                   <button disabled={isSyncing || syncIdInput.length < 6} onClick={handleFetchRemote} className="w-full py-3 bg-gray-900 text-white rounded-2xl font-black text-sm active:scale-95 transition-all">从云端下载覆盖</button>
                </div>
              </div>

              {/* 终极方案：手动备份 */}
              <div className="p-6 bg-amber-50/50 rounded-[30px] border border-amber-100">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest">手动备份（不限网络 100% 成功）</h4>
                  <button onClick={() => setShowManual(!showManual)} className="text-[10px] font-black text-amber-600 bg-white px-2 py-1 rounded-md border border-amber-100">{showManual ? '收起' : '展开'}</button>
                </div>
                
                {showManual && (
                  <div className="space-y-4 animate-fadeIn">
                    <button onClick={handleManualExport} className="w-full py-3 bg-amber-500 text-white rounded-2xl font-black text-sm shadow-md active:scale-95">导出并复制我的备份码</button>
                    <div className="relative">
                      <textarea placeholder="粘贴备份码到此处..." value={manualCode} onChange={e => setManualCode(e.target.value)} className="w-full h-24 p-4 bg-white rounded-2xl text-[10px] font-mono border-none shadow-inner resize-none mb-2" />
                      <button onClick={handleManualImport} disabled={!manualCode} className="w-full py-3 bg-gray-900 text-white rounded-2xl font-black text-sm active:scale-95">立即从代码导入覆盖</button>
                    </div>
                    <p className="text-[9px] text-amber-500 font-bold text-center italic">手动同步原理：将数据转为文本，通过微信/QQ等任何方式传递给另一台设备粘贴即可。</p>
                  </div>
                )}
              </div>
            </div>

            {syncStatus === 'error' && (
              <div className="mt-6 p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-[10px] text-red-600 font-black text-center mb-1">同步受阻：{errorMsg}</p>
                <p className="text-[8px] text-red-400 text-center">建议切换 5G 网络或使用下方的“手动备份”功能，该功能不依赖云端 API。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {downloadConfirm.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xl flex items-center justify-center p-8 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🧩</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">发现备份数据！</h3>
            <p className="text-xs text-gray-400 mb-8 leading-relaxed">即将导入云端记录。这会<span className="text-red-500 font-black">清空并覆盖</span>当前本机所有的练习记录。确定吗？</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeDownload} className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-black active:scale-95 shadow-lg">确认覆盖同步</button>
              <button onClick={() => setDownloadConfirm({ isOpen: false, data: null })} className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-bold active:scale-95">取消</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
             <h3 className="text-xl font-black mb-6">考点选择</h3>
             <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto no-scrollbar mb-8">
               {GRAMMAR_POINTS.map(p => (
                 <button key={p} onClick={() => togglePoint(p)} className={`p-4 rounded-2xl text-[10px] font-black border-2 transition-all ${selectedPoints.includes(p) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-transparent text-gray-400'}`}>{p}</button>
               ))}
             </div>
             <button onClick={() => setIsModalOpen(false)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black">确定修改</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
