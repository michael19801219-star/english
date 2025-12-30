
import React, { useState } from 'react';
import { WrongQuestion } from '../types';

interface ReviewViewProps {
  history: WrongQuestion[];
  onBack: () => void;
  onClear: () => void;
}

const ReviewView: React.FC<ReviewViewProps> = ({ history, onBack, onClear }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <header className="p-6 bg-white border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-2xl">←</button>
          <h1 className="text-xl font-black">历史错题本</h1>
        </div>
        {history.length > 0 && (
          <button onClick={onClear} className="text-xs text-red-500 font-bold">清空</button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <span className="text-6xl mb-4">🎉</span>
            <p className="font-medium">暂时没有错题，继续保持！</p>
          </div>
        ) : (
          history.map((q, idx) => (
            <div 
              key={`${q.id}-${idx}`}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div 
                className="p-5 cursor-pointer" 
                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-500 rounded-md">
                    {q.grammarPoint}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(q.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-800 font-medium leading-relaxed">{q.question}</p>
                <div className="mt-4 flex gap-4 text-xs font-bold">
                  <span className="text-red-500">❌ 你的选择: {String.fromCharCode(65 + q.userAnswerIndex)}</span>
                  <span className="text-green-600">✅ 正确答案: {String.fromCharCode(65 + q.answerIndex)}</span>
                </div>
              </div>

              {expandedId === q.id && (
                <div className="px-5 pb-5 animate-fadeIn border-t border-gray-50 pt-4">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <h4 className="text-sm font-bold text-gray-900 mb-2">详细解析：</h4>
                    <p className="text-xs text-gray-600 leading-loose whitespace-pre-wrap">
                      {q.explanation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default ReviewView;
