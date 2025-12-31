
import React, { useState, useRef, useEffect } from 'react';
import { Question, ChatMessage } from '../types';
import { askFollowUpQuestion } from '../services/geminiService';

interface QuizViewProps {
  questions: Question[];
  onFinish: (answers: number[]) => void;
  onCancel: () => void;
}

const QuizView: React.FC<QuizViewProps> = ({ questions, onFinish, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Continuous Chat state
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isCorrect = selectedOption === currentQuestion.answerIndex;

  // 每次聊天历史更新或正在询问时，自动滚动聊天区域
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

  const handleConfirm = () => {
    if (selectedOption === null) return;
    setShowFeedback(true);
  };

  const handleNext = () => {
    const newAnswers = [...userAnswers, selectedOption!];
    setUserAnswers(newAnswers);
    setSelectedOption(null);
    setShowFeedback(false);
    setFollowUpQuery('');
    setChatHistory([]);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onFinish(newAnswers);
    }
  };

  const handleAskTutor = async () => {
    if (!followUpQuery.trim() || isAsking) return;
    
    const query = followUpQuery.trim();
    const newUserMsg: ChatMessage = { role: 'user', content: query };
    
    setChatHistory(prev => [...prev, newUserMsg]);
    setFollowUpQuery('');
    setIsAsking(true);

    try {
      const response = await askFollowUpQuestion(currentQuestion, chatHistory, query);
      const newAiMsg: ChatMessage = { role: 'model', content: response };
      setChatHistory(prev => [...prev, newAiMsg]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAsking(false);
    }
  };

  const triggerExit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExiting(true);
  };

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn h-screen relative bg-gray-50">
      {isExiting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-fadeIn text-center border border-gray-100">
            <div className="text-5xl mb-6">⚠️</div>
            <h3 className="text-2xl font-black text-gray-900 mb-3">要退出练习吗？</h3>
            <p className="text-gray-500 text-sm mb-10 leading-relaxed">
              本次训练的进度将无法保存，建议完成测试再离开哦。
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={onCancel}
                className="w-full py-4.5 bg-red-500 text-white rounded-2xl font-black shadow-xl shadow-red-200 active:scale-95 transition-all"
              >
                确定退出
              </button>
              <button 
                onClick={() => setIsExiting(false)}
                className="w-full py-4.5 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-all"
              >
                继续练习
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-6 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              GAOKAO MASTER
            </span>
            <span className="text-sm font-black text-indigo-600">
              第 {currentIndex + 1} 题 / 共 {questions.length} 题
            </span>
          </div>
          <button 
            onClick={triggerExit}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full text-xs font-black transition-all active:scale-90 border border-transparent"
          >
            <span>退出</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-500 shadow-[0_0_8px_rgba(79,70,229,0.3)]" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">
            {currentQuestion.grammarPoint}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pr-1 flex flex-col scroll-smooth" ref={mainScrollRef}>
        <div className="bg-white rounded-[32px] p-7 shadow-sm border border-gray-100 mb-6 relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-20"></div>
          <p className="text-lg font-bold leading-relaxed text-gray-800">
            {currentQuestion.question}
          </p>
        </div>

        <div className="space-y-3.5 flex-shrink-0 mb-6">
          {currentQuestion.options.map((option, idx) => {
            let style = "border-gray-100 bg-white text-gray-700";
            if (selectedOption === idx) {
              style = "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/10";
            }
            if (showFeedback) {
              if (idx === currentQuestion.answerIndex) {
                style = "border-green-500 bg-green-50 text-green-700 font-bold ring-2 ring-green-500/10";
              } else if (selectedOption === idx) {
                style = "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/10";
              } else {
                style = "opacity-40 border-gray-100 bg-white";
              }
            }

            return (
              <button
                key={idx}
                disabled={showFeedback}
                onClick={() => setSelectedOption(idx)}
                className={`w-full p-4 rounded-[20px] text-left transition-all border-2 relative flex items-center group ${style}`}
              >
                <span className={`flex-shrink-0 w-8 h-8 rounded-lg text-center leading-8 mr-4 font-black text-sm transition-colors ${
                  selectedOption === idx ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-[15px] font-medium leading-snug">{option}</span>
                {showFeedback && idx === currentQuestion.answerIndex && (
                  <div className="ml-auto bg-green-500 text-white rounded-full p-1 scale-90">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {showFeedback && selectedOption === idx && idx !== currentQuestion.answerIndex && (
                  <div className="ml-auto bg-red-500 text-white rounded-full p-1 scale-90">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div className="flex flex-col gap-6 animate-fadeIn pb-8">
            {/* Standard Explanation */}
            <div className="p-6 bg-white rounded-[28px] border border-indigo-50 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                  {isCorrect ? '✨' : '📖'}
                </div>
                <h4 className={`font-black tracking-tight ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {isCorrect ? '回答正确！' : '错点突破'}
                </h4>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl">
                <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-wrap font-medium">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>

            {/* AI Tutor Chat Flow */}
            <div className="p-6 bg-indigo-50 rounded-[32px] border border-indigo-100 shadow-inner flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg shadow-indigo-200">AI</div>
                <h4 className="text-sm font-black text-indigo-900 tracking-tight">AI 助教 · 深度追问</h4>
              </div>

              {/* Chat Messages */}
              <div className="flex flex-col gap-3 mb-6 max-h-[400px] overflow-y-auto">
                {chatHistory.length === 0 && !isAsking && (
                  <p className="text-center text-[11px] text-indigo-300 font-bold py-4 bg-white/40 rounded-2xl border border-white/60">
                    对题目有任何疑惑？在这里告诉我吧 ✍️
                  </p>
                )}
                {chatHistory.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium shadow-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-white text-gray-700 rounded-bl-none border border-indigo-100'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isAsking && (
                  <div className="flex justify-start animate-fadeIn">
                    <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-indigo-100 shadow-sm flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce delay-150"></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="relative group">
                <input
                  type="text"
                  value={followUpQuery}
                  onChange={(e) => setFollowUpQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAskTutor()}
                  placeholder="针对考点继续追问..."
                  className="w-full py-4 pl-5 pr-14 bg-white rounded-2xl border-none text-sm font-black focus:ring-2 focus:ring-indigo-300 transition-all shadow-sm"
                  disabled={isAsking}
                />
                <button
                  onClick={handleAskTutor}
                  disabled={!followUpQuery.trim() || isAsking}
                  className={`absolute right-2 top-2 bottom-2 px-3 rounded-xl transition-all ${
                    !followUpQuery.trim() || isAsking 
                      ? 'text-gray-300' 
                      : 'bg-indigo-600 text-white shadow-md active:scale-90'
                  }`}
                >
                  {isAsking ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-indigo-300 text-center mt-3 font-bold">
                AI 老师会结合上下文和题目为你精准答疑
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 flex-shrink-0 safe-area-bottom">
        {!showFeedback ? (
          <button
            disabled={selectedOption === null}
            onClick={handleConfirm}
            className={`w-full py-4.5 rounded-[24px] font-black text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
              selectedOption === null
                ? 'bg-gray-200 text-gray-400'
                : 'bg-indigo-600 text-white active:scale-[0.97] shadow-indigo-200'
            }`}
          >
            确认提交
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full bg-gray-900 text-white py-4.5 rounded-[24px] font-black text-lg shadow-xl active:scale-[0.97] transition-all flex items-center justify-center gap-2"
          >
            <span>{currentIndex === questions.length - 1 ? '完成测试' : '下一题'}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        )}
      </footer>
    </div>
  );
};

export default QuizView;
