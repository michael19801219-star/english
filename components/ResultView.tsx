
import React, { useState } from 'react';
import { QuizResults } from '../types';

interface ResultViewProps {
  results: QuizResults;
  onRestart: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ results, onRestart }) => {
  const [showExplanation, setShowExplanation] = useState<number | null>(null);
  const percentage = (results.score / results.total) * 100;

  const getEmoji = () => {
    if (percentage === 100) return '🏆';
    if (percentage >= 80) return '🔥';
    if (percentage >= 60) return '💪';
    return '📚';
  };

  const getFeedback = () => {
    if (percentage === 100) return '满分！高考英语难不倒你！';
    if (percentage >= 80) return '非常出色，继续保持！';
    if (percentage >= 60) return '及格啦，查漏补缺更上一层楼。';
    return '语法基础需要夯实，多看解析哦。';
  };

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn bg-gray-50 min-h-screen overflow-y-auto">
      <header className="py-8 text-center bg-white rounded-3xl shadow-sm border border-gray-100 mb-8">
        <div className="text-6xl mb-4">{getEmoji()}</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">测试报告</h1>
        <div className="text-4xl font-extrabold text-indigo-600 mb-4">
          {results.score} <span className="text-gray-300 text-xl font-normal">/ {results.total}</span>
        </div>
        <p className="text-gray-500 font-medium px-6">{getFeedback()}</p>
      </header>

      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-bold text-gray-800 flex items-center">
          <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
          题目回顾与解析
        </h2>
        
        {results.questions.map((q, idx) => {
          const isCorrect = results.answers[idx] === q.answerIndex;
          const isExpanded = showExplanation === idx;

          return (
            <div 
              key={q.id || idx} 
              className={`rounded-2xl border transition-all ${
                isCorrect ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'
              }`}
            >
              <button 
                onClick={() => setShowExplanation(isExpanded ? null : idx)}
                className="w-full p-4 text-left flex justify-between items-start gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {isCorrect ? '正确' : '错误'}
                    </span>
                    <span className="text-xs text-gray-500">#{idx + 1} · {q.grammarPoint}</span>
                  </div>
                  <p className="text-sm text-gray-800 font-medium leading-relaxed">
                    {q.question}
                  </p>
                </div>
                <div className="text-gray-400 mt-1">
                  <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="p-4 pt-0 border-t border-gray-100 mt-2 bg-white/50 rounded-b-2xl">
                  <div className="space-y-2 mt-3">
                    <div className="text-xs font-bold text-gray-400">你的回答</div>
                    <div className={`text-sm p-3 rounded-xl border ${
                      isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}>
                      {String.fromCharCode(65 + results.answers[idx])}. {q.options[results.answers[idx]]}
                    </div>
                    
                    {!isCorrect && (
                      <>
                        <div className="text-xs font-bold text-gray-400">正确答案</div>
                        <div className="text-sm p-3 rounded-xl border border-green-200 bg-green-50">
                          {String.fromCharCode(65 + q.answerIndex)}. {q.options[q.answerIndex]}
                        </div>
                      </>
                    )}

                    <div className="text-xs font-bold text-gray-400 mt-4">答案解析</div>
                    <div className="text-sm text-gray-700 bg-indigo-50/50 p-4 rounded-xl leading-relaxed">
                      {q.explanation}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="py-6 safe-area-bottom space-y-3">
        <button
          onClick={onRestart}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 active:scale-95 transition-transform"
        >
          重新练习
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-white text-gray-600 py-4 rounded-2xl font-bold text-lg border border-gray-200 active:scale-95 transition-transform"
        >
          返回首页
        </button>
      </footer>
    </div>
  );
};

export default ResultView;
