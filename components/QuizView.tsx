
import React, { useState, useRef, useEffect } from 'react';
import { Question, ChatMessage, WrongQuestion } from '../types';
import { askFollowUpQuestion } from '../services/geminiService';

interface QuizViewProps {
  questions: Question[];
  onFinish: (answers: number[]) => void;
  onCancel: () => void;
  onQuotaError: () => void;
  onToggleSave: (q: Question, userAnswerIndex?: number) => void;
  onAnswerSubmitted: (q: Question, ans: number) => void;
  savedHistory: WrongQuestion[];
}

const QuizView: React.FC<QuizViewProps> = ({ questions, onFinish, onCancel, onQuotaError, onToggleSave, onAnswerSubmitted, savedHistory }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

  const handleAskTutor = async () => {
    if (!followUpQuery.trim() || isAsking) return;
    const query = followUpQuery.trim();
    setChatHistory(prev => [...prev, { role: 'user', content: query }]);
    setFollowUpQuery('');
    setIsAsking(true);

    try {
      const response = await askFollowUpQuestion(questions[currentIndex], chatHistory, query);
      setChatHistory(prev => [...prev, { role: 'model', content: response }]);
    } catch (err: any) {
      onQuotaError();
    } finally {
      setIsAsking(false);
    }
  };

  const handleNext = () => {
    const newAnswers = [...userAnswers, selectedOption!];
    setUserAnswers(newAnswers);
    setSelectedOption(null);
    setShowFeedback(false);
    setFollowUpQuery('');
    setChatHistory([]);
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
    else onFinish(newAnswers);
  };

  const handleSubmit = () => {
    if (selectedOption !== null) {
      onAnswerSubmitted(questions[currentIndex], selectedOption);
      setShowFeedback(true);
    }
  };

  const isSaved = savedHistory.some(s => s.question === questions[currentIndex].question);

  return (
    <div className="flex-1 flex flex-col h-screen relative bg-gray-50 overflow-hidden">
      {isExiting && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center animate-fadeIn">
            <div className="text-5xl mb-6">⚠️</div>
            <h3 className="text-2xl font-black mb-3 text-gray-900">要退出练习吗？</h3>
            <p className="text-gray-500 text-sm mb-8 font-medium italic">当前进度将不会保存到错题本。</p>
            <div className="flex flex-col gap-3">
              <button onClick={onCancel} className="w-full py-4.5 bg-red-500 text-white rounded-2xl font-black shadow-lg">确定退出</button>
              <button onClick={() => setIsExiting(false)} className="w-full py-4.5 bg-gray-100 text-gray-600 rounded-2xl font-bold">继续练习</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-10 left-0 right-0 flex justify-center z-[400] pointer-events-none px-6">
        <div className="pointer-events-auto max-w-md w-full flex justify-center">
          {showFeedback ? (
            <button onClick={handleNext} className="px-10 py-5 bg-[#0f172a] text-white rounded-full text-[16px] font-black shadow-[0_25px_60px_rgba(0,0,0,0.4)] active:scale-95 transition-all flex items-center gap-3 border border-white/20 whitespace-nowrap animate-fadeIn">
              <span>{currentIndex === questions.length - 1 ? '查看测试报告' : '下一题'}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          ) : (
            <button disabled={selectedOption === null} onClick={handleSubmit} className={`px-12 py-5 rounded-full text-[16px] font-black shadow-[0_25px_60px_rgba(79,70,229,0.3)] transition-all border border-white/10 whitespace-nowrap ${selectedOption === null ? 'bg-gray-200 text-gray-400 opacity-50 shadow-none' : 'bg-indigo-600 text-white active:scale-95'}`}>
              确认提交
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        <header className="mb-4 flex-shrink-0 animate-fadeIn">
          <div className="flex justify-between items-center mb-3 min-h-[40px]">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">Grammar Master Pro</span>
              <span className="text-xs font-black text-indigo-600">第 {currentIndex + 1} 题 / 共 {questions.length} 题</span>
            </div>
            <button onClick={() => setIsExiting(true)} className="px-4 py-1.5 bg-white text-gray-400 rounded-full text-[10px] font-black shadow-sm border border-gray-100 active:scale-95">退出</button>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-indigo-500 transition-all duration-700 ease-out" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pr-1 flex flex-col no-scrollbar pb-48 animate-fadeIn">
          <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100 mb-4 relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-30"></div>
            <p className="text-[17px] font-bold leading-relaxed text-gray-800 tracking-tight">{questions[currentIndex].question}</p>
          </div>

          <div className="space-y-2.5 flex-shrink-0 mb-6">
            {questions[currentIndex].options.map((option, idx) => {
              let style = "border-gray-100 bg-white text-gray-700";
              if (selectedOption === idx) style = "border-indigo-600 bg-indigo-50 text-indigo-700";
              if (showFeedback) {
                if (idx === questions[currentIndex].answerIndex) style = "border-green-500 bg-green-50 text-green-700 font-bold";
                else if (selectedOption === idx) style = "border-red-500 bg-red-50 text-red-700";
                else style = "opacity-40 border-gray-100 bg-white scale-95";
              }
              return (
                <button key={idx} disabled={showFeedback} onClick={() => setSelectedOption(idx)} className={`w-full p-4 rounded-[20px] text-left transition-all border-2 flex items-center group active:scale-[0.98] ${style}`}>
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg text-center leading-8 mr-3 font-black text-[13px] transition-colors ${selectedOption === idx ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-[14px] font-semibold">{option}</span>
                </button>
              );
            })}
          </div>

          {showFeedback && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="p-5 bg-white rounded-[28px] border border-gray-100 shadow-sm relative">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm ${selectedOption === questions[currentIndex].answerIndex ? 'bg-green-100' : 'bg-red-100'}`}>
                      {selectedOption === questions[currentIndex].answerIndex ? '✅' : '❌'}
                    </div>
                    <h4 className={`font-black text-sm ${selectedOption === questions[currentIndex].answerIndex ? 'text-green-700' : 'text-red-700'}`}>
                      {selectedOption === questions[currentIndex].answerIndex ? '回答正确' : '回答错误'}
                    </h4>
                  </div>
                  <button onClick={() => onToggleSave(questions[currentIndex], selectedOption!)} className={`px-3 py-1.5 rounded-xl transition-all active:scale-90 text-[10px] font-black ${isSaved ? 'bg-amber-100 text-amber-600' : 'bg-gray-50 text-gray-300'}`}>
                    {isSaved ? '★ 已收藏' : '☆ 收藏'}
                  </button>
                </div>
                <div className="mb-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100/30">
                  <p className="text-[12px] text-amber-900 font-medium italic leading-relaxed">【译文】{questions[currentIndex].translation}</p>
                </div>
                <div className="text-[13px] text-gray-600 leading-relaxed bg-gray-50/80 p-4 rounded-[20px] font-medium border border-gray-100 shadow-inner">
                  <span className="text-[9px] font-black text-indigo-600 block mb-1 uppercase tracking-widest">中文解析</span>
                  {questions[currentIndex].explanation}
                </div>
              </div>

              <div className="p-5 bg-indigo-50/50 rounded-[32px] border border-indigo-100/50 flex flex-col backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-[9px] font-black">AI</div>
                  <h4 className="text-[13px] font-black text-indigo-900 tracking-tight">AI 助教答疑</h4>
                </div>
                <div className="flex flex-col gap-3 mb-4 max-h-[300px] overflow-y-auto no-scrollbar">
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                      <div className={`max-w-[88%] p-3.5 rounded-[20px] text-[13px] font-medium leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none border border-indigo-50'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isAsking && (
                    <div className="flex justify-start">
                      <div className="bg-white p-3 rounded-2xl border border-indigo-50 flex gap-1.5 animate-pulse shadow-sm">
                        <div className="w-1 h-1 bg-indigo-200 rounded-full"></div>
                        <div className="w-1 h-1 bg-indigo-300 rounded-full"></div>
                        <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="relative flex items-center gap-2">
                  <input type="text" value={followUpQuery} onChange={(e) => setFollowUpQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAskTutor()} placeholder="输入你的语法疑问..." className="flex-1 py-3.5 px-5 bg-white rounded-[18px] border-none text-[13px] font-bold shadow-lg outline-none focus:ring-2 focus:ring-indigo-100" />
                  <button onClick={handleAskTutor} disabled={!followUpQuery.trim() || isAsking} className="w-11 h-11 bg-indigo-600 text-white rounded-[16px] shadow-xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default QuizView;
