
import React from 'react';

interface LoadingViewProps {
  message: string;
  onCancel?: () => void;
}

const LoadingView: React.FC<LoadingViewProps> = ({ message, onCancel }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white relative">
      <div className="relative mb-12">
        {/* 外圈旋转 */}
        <div className="w-28 h-28 border-[6px] border-indigo-50 rounded-full"></div>
        <div className="w-28 h-28 border-t-[6px] border-indigo-600 rounded-full absolute top-0 left-0 animate-spin"></div>
        {/* 内圈脉冲 */}
        <div className="absolute inset-4 bg-indigo-600/10 rounded-full animate-pulse flex items-center justify-center">
          <span className="text-xl font-black text-indigo-600 tracking-tighter">AI</span>
        </div>
      </div>
      
      <div className="text-center space-y-4 max-w-[280px]">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">专属定制出题中</h2>
        <p className="text-[13px] text-gray-400 font-medium leading-relaxed">
          {message || '正在为周琮钦同学生成个性化语法挑战卷...'}
        </p>
      </div>

      <div className="mt-16 w-full max-w-[200px] space-y-3">
        <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-200 animate-[loading_2s_infinite]"></div>
        </div>
        <p className="text-[10px] text-gray-300 text-center font-bold uppercase tracking-widest">
          Exclusive Version for Zhou Congqin
        </p>
      </div>

      {onCancel && (
        <button 
          onClick={onCancel}
          className="mt-24 px-8 py-3 bg-gray-50 text-gray-400 rounded-2xl text-xs font-black border border-gray-100 active:scale-95 transition-all"
        >
          取消并返回
        </button>
      )}

      <style>{`
        @keyframes loading {
          0% { width: 0%; transform: translateX(0%); }
          50% { width: 70%; transform: translateX(20%); }
          100% { width: 0%; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default LoadingView;
