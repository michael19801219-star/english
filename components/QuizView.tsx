
import React, { useState, useRef, useEffect } from 'react';
import { Question, ChatMessage, WrongQuestion } from '../types';
import { askFollowUpQuestion } from '../services/geminiService';

interface QuizViewProps {
  questions: Question[];
  onFinish: (answers: number[]) => void;
  onCancel: () => void;
  onQuotaError: () => void;
  onAnswerSubmitted: (question: Question, userAnswerIndex: number) => void;
  onToggleSave: (question: Question, userAnswerIndex: number) => void;
  savedHistory: WrongQuestion[];
}

const QuizView: React.FC<QuizViewProps> = ({ questions, onFinish, onCancel, onQuotaError, onAnswerSubmitted, onToggleSave, savedHistory }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const recognitionRef = useRef<any>(null);

  const isCurrentQuestionSaved = savedHistory.some(q => q.question === questions[currentIndex].question);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

  useEffect(() => {
    if (showFeedback && feedbackRef.current) {
      setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showFeedback]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;
      recognition.onstart = () => setIsRecognizing(true);
      recognition.onend = () => setIsRecognizing(false);
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('');
        setFollowUpQuery(transcript);
      };
      recognitionRef.current = recognition;
    }
  }, []);

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
      if (err.message === "QUOTA_EXCEEDED") {
        onQuotaError();
      } else {
        alert("追问失败，请稍后再试");
      }
    } finally {
      setIsAsking(false);
    }
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setShowFeedback(true);
    onAnswerSubmitted(questions[currentIndex], selectedOption);
  };

  const handleNext = () => {
    const newAnswers = [...userAnswers, selectedOption!];
    setUserAnswers(newAnswers);
    setSelectedOption(null);
    setShowFeedback(false);
    setFollowUpQuery('');
    setChatHistory([]);
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
    else onFinish(newAnswers);
  };

  const toggleSave = () => {
    onToggleSave(questions[currentIndex], selectedOption!);
  };

  return (
    <div className="flex-1 flex flex-col p-5 animate-fadeIn h-full bg-gray-50 overflow-hidden">
      {isExiting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-fadeIn text-center">
            <div className="text-5xl mb-6">⚠️</div>
            <h3 className="text-2xl font-black text-gray-900 mb-3">要退出练习吗？</h3>
            <p className="text-gray-500 text-sm mb-8 font-medium italic">未完成的题目将不会被记录。</p>
            <div className="flex flex-col gap-3">
              <button onClick={onCancel} className="w-full py-4.5 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-100">确定退出</button>
              <button onClick={() => setIsExiting(false)} className="w-full py-4.5 bg-gray-100 text-gray-600 rounded-2xl font-bold">继续练习</button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-4 flex-shrink-0">
        <div className="flex justify-between items-center mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest mb-0.5 uppercase">Grammar Master Pro</span>
            <span className="text-sm font-black text-indigo-600">第 {currentIndex + 1} 题 / 共 {questions.length} 题</span>
          </div>
          <button onClick={() => setIsExiting(true)} className="px-4 py-1.5 bg-white text-gray-400 rounded-full text-xs font-black shadow-sm border border-gray-100 active:scale-95">退出</button>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <div className="h-full bg-indigo-500 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(79,70,229,0.5)]" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </header>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto pr-1 flex flex-col no-scrollbar">
        <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100 mb-4 relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-30"></div>
          <p className="text-[17px] font-bold leading-relaxed text-gray-800 tracking-tight">{questions[currentIndex].question}</p>
        </div>

        <div className={`space-y-2.5 flex-shrink-0 mb-6 transition-all duration-300 ${showFeedback ? 'opacity-80 scale-[0.98]' : ''}`}>
          {questions[currentIndex].options.map((option, idx) => {
            let style = "border-gray-100 bg-white text-gray-700 hover:border-indigo-200";
            if (selectedOption === idx) style = "border-indigo-600 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-500/10";
            if (showFeedback) {
              if (idx === questions[currentIndex].answerIndex) style = "border-green-500 bg-green-50 text-green-700 font-bold ring-4 ring-green-500/10";
              else if (selectedOption === idx) style = "border-red-500 bg-red-50 text-red-700 ring-4 ring-red-500/10";
              else style = "opacity-30 border-gray-50 bg-white scale-95 grayscale";
            }
            return (
              <button 
                key={idx} 
                disabled={showFeedback} 
                onClick={() => setSelectedOption(idx)} 
                className={`w-full ${showFeedback ? 'p-3' : 'p-4.5'} rounded-[20px] text-left transition-all border-2 flex items-center group active:scale-[0.98] ${style}`}
              >
                <span className={`flex-shrink-0 ${showFeedback ? 'w-7 h-7 leading-7 text-xs' : 'w-8 h-8 leading-8 text-[14px]'} rounded-lg text-center mr-3 font-black transition-colors ${selectedOption === idx ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-500'}`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className={`${showFeedback ? 'text-[14px]' : 'text-[15px]'} font-semibold truncate`}>{option}</span>
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div ref={feedbackRef} className="flex flex-col gap-5 animate-fadeIn pb-8">
            <div className="p-6 bg-white rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
              <button 
                onClick={toggleSave}
                className={`absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 border shadow-sm ${isCurrentQuestionSaved ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white border-gray-100 text-gray-300'}`}
              >
                <span className="text-lg leading-none">{isCurrentQuestionSaved ? '⭐' : '☆'}</span>
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm ${selectedOption === questions[currentIndex].answerIndex ? 'bg-green-100' : 'bg-red-100'}`}>
                  {selectedOption === questions[currentIndex].answerIndex ? '✅' : '❌'}
                </div>
                <div>
                  <h4 className={`font-black tracking-tight text-[16px] ${selectedOption === questions[currentIndex].answerIndex ? 'text-green-700' : 'text-red-700'}`}>
                    {selectedOption === questions[currentIndex].answerIndex ? '回答正确' : '回答错误'}
                  </h4>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Analysis & Insight</p>
                </div>
              </div>

              {/* 中文翻译区域 */}
              {questions[currentIndex].translation && (
                <div className="mb-4 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                  <span className="text-[10px] font-black text-amber-600 uppercase mb-1 block">中文翻译</span>
                  <p className="text-[13px] text-amber-900 font-bold italic">{questions[currentIndex].translation}</p>
                </div>
              )}

              <div className="text-[13px] text-gray-600 leading-[1.7] bg-gray-50/80 p-5 rounded-[24px] font-medium border border-gray-50">
                <span className="text-[10px] font-black text-indigo-500 uppercase mb-1 block">考点深度解析</span>
                {questions[currentIndex].explanation}
              </div>
            </div>

            <div className="p-6 bg-indigo-50/50 rounded-[36px] border border-indigo-100/50 flex flex-col relative overflow-hidden backdrop-blur-sm">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 bg-indigo-600 rounded-[16px] flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-indigo-200 ring-2 ring-white">AI</div>
                   <div>
                     <h4 className="text-[14px] font-black text-indigo-900 tracking-tight">AI 助教答疑</h4>
                     <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">Real-time Tutor</p>
                   </div>
                </div>
              </div>

              <div className="flex flex-col gap-3.5 mb-6 max-h-[300px] overflow-y-auto no-scrollbar">
                {chatHistory.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-[11px] text-indigo-300 font-bold italic">这道题还有不理解的地方？在下方问问我吧！</p>
                  </div>
                )}
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                    <div className={`max-w-[90%] p-4 rounded-[24px] text-[14px] font-medium leading-relaxed relative shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none border border-indigo-50'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-white p-4 rounded-2xl border border-indigo-50 flex gap-1.5 animate-pulse shadow-sm">
                      <div className="w-1 h-1 bg-indigo-200 rounded-full"></div>
                      <div className="w-1 h-1 bg-indigo-300 rounded-full"></div>
                      <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={followUpQuery}
                    onChange={(e) => setFollowUpQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskTutor()}
                    placeholder={isRecognizing ? "我正在听..." : "输入语法疑问..."}
                    className={`w-full py-4 pl-5 pr-12 bg-white rounded-[20px] border-none text-[14px] font-bold shadow-lg transition-all focus:ring-4 focus:ring-indigo-500/10 placeholder:text-gray-300 ${isRecognizing ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                  />
                  <button 
                    onClick={() => isRecognizing ? recognitionRef.current?.stop() : recognitionRef.current?.start()} 
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isRecognizing ? 'bg-indigo-600 text-white animate-pulse' : 'text-gray-300 hover:text-indigo-400'}`}
                  >
                    🎙️
                  </button>
                </div>
                <button 
                  onClick={handleAskTutor} 
                  disabled={!followUpQuery.trim() || isAsking} 
                  className={`w-12 h-12 rounded-[18px] shadow-xl transition-all flex items-center justify-center ${!followUpQuery.trim() || isAsking ? 'bg-gray-100 text-gray-300' : 'bg-indigo-600 text-white active:scale-90'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="pt-4 pb-2 flex-shrink-0 safe-area-bottom">
        {!showFeedback ? (
          <button 
            disabled={selectedOption === null} 
            onClick={handleSubmit} 
            className={`w-full py-4.5 rounded-[24px] font-black text-[18px] shadow-2xl transition-all ${selectedOption === null ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white shadow-indigo-200'}`}
          >
            确认提交
          </button>
        ) : (
          <button onClick={handleNext} className="w-full bg-gray-900 text-white py-4.5 rounded-[24px] font-black text-[18px] shadow-2xl flex items-center justify-center gap-2 active:scale-[0.98]">
            <span>{currentIndex === questions.length - 1 ? '查看测试报告' : '下一题'}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        )}
      </footer>
    </div>
  );
};

export default QuizView;
