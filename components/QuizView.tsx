
import React, { useState, useRef, useEffect } from 'react';
import { Question, ChatMessage } from '../types';
import { askFollowUpQuestion } from '../services/geminiService';

interface QuizViewProps {
  questions: Question[];
  onFinish: (answers: number[]) => void;
  onCancel: () => void;
  onQuotaError: () => void;
}

const QuizView: React.FC<QuizViewProps> = ({ questions, onFinish, onCancel, onQuotaError }) => {
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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

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
        alert(err.message);
      }
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

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn h-screen relative bg-gray-50">
      {isExiting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-fadeIn text-center">
            <div className="text-5xl mb-6">⚠️</div>
            <h3 className="text-2xl font-black text-gray-900 mb-3">要退出练习吗？</h3>
            <p className="text-gray-500 text-sm mb-8 font-medium italic">当前进度将不会保存到错题本。</p>
            <div className="flex flex-col gap-3">
              <button onClick={onCancel} className="w-full py-4.5 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-100">确定退出</button>
              <button onClick={() => setIsExiting(false)} className="w-full py-4.5 bg-gray-100 text-gray-600 rounded-2xl font-bold">继续练习</button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-6 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest mb-1 uppercase">Grammar Master Pro</span>
            <span className="text-sm font-black text-indigo-600">第 {currentIndex + 1} 题 / 共 {questions.length} 题</span>
          </div>
          <button onClick={() => setIsExiting(true)} className="px-5 py-2 bg-white text-gray-400 rounded-full text-xs font-black shadow-sm border border-gray-100 active:scale-95">退出</button>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <div className="h-full bg-indigo-500 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pr-1 flex flex-col no-scrollbar">
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 mb-6 relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-30"></div>
          <p className="text-[19px] font-bold leading-relaxed text-gray-800 tracking-tight">{questions[currentIndex].question}</p>
        </div>

        <div className="space-y-3.5 flex-shrink-0 mb-8">
          {questions[currentIndex].options.map((option, idx) => {
            let style = "border-gray-100 bg-white text-gray-700 hover:border-indigo-200";
            if (selectedOption === idx) style = "border-indigo-600 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-500/10";
            if (showFeedback) {
              if (idx === questions[currentIndex].answerIndex) style = "border-green-500 bg-green-50 text-green-700 font-bold ring-4 ring-green-500/10";
              else if (selectedOption === idx) style = "border-red-500 bg-red-50 text-red-700 ring-4 ring-red-500/10";
              else style = "opacity-40 border-gray-100 bg-white scale-95 grayscale";
            }
            return (
              <button key={idx} disabled={showFeedback} onClick={() => setSelectedOption(idx)} className={`w-full p-5 rounded-[24px] text-left transition-all border-2 flex items-center group active:scale-[0.98] ${style}`}>
                <span className={`flex-shrink-0 w-9 h-9 rounded-xl text-center leading-9 mr-4 font-black text-[15px] transition-colors ${selectedOption === idx ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-500'}`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-[16px] font-semibold">{option}</span>
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div className="flex flex-col gap-6 animate-fadeIn pb-12">
            <div className="p-7 bg-white rounded-[36px] border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-sm ${selectedOption === questions[currentIndex].answerIndex ? 'bg-green-100' : 'bg-red-100'}`}>
                  {selectedOption === questions[currentIndex].answerIndex ? '✅' : '❌'}
                </div>
                <div>
                  <h4 className={`font-black tracking-tight text-lg ${selectedOption === questions[currentIndex].answerIndex ? 'text-green-700' : 'text-red-700'}`}>
                    {selectedOption === questions[currentIndex].answerIndex ? '回答正确' : '回答错误'}
                  </h4>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Analysis & Insight</p>
                </div>
              </div>
              <div className="text-[14px] text-gray-600 leading-[1.8] bg-gray-50/80 p-6 rounded-[28px] font-medium border border-gray-50 italic">
                {questions[currentIndex].explanation}
              </div>
            </div>

            <div className="p-7 bg-indigo-50/50 rounded-[40px] border border-indigo-100/50 flex flex-col relative overflow-hidden backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-indigo-600 rounded-[18px] flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-indigo-200 ring-4 ring-white">AI</div>
                   <div>
                     <h4 className="text-[15px] font-black text-indigo-900 tracking-tight">AI 助教答疑</h4>
                     <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">Real-time Tutor</p>
                   </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 mb-8 max-h-[500px] overflow-y-auto no-scrollbar">
                {chatHistory.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-[12px] text-indigo-300 font-bold italic">对这道题还有不理解的地方？在下方问问我吧！</p>
                  </div>
                )}
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                    <div className={`max-w-[88%] p-5 rounded-[28px] text-[15px] font-medium leading-relaxed relative shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none border border-indigo-50'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-white p-5 rounded-3xl border border-indigo-50 flex gap-2 animate-pulse shadow-sm">
                      <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="relative flex items-center gap-2 sticky bottom-0">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={followUpQuery}
                    onChange={(e) => setFollowUpQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskTutor()}
                    placeholder={isRecognizing ? "我正在听..." : "输入你的语法疑问..."}
                    className={`w-full py-5 pl-6 pr-14 bg-white rounded-[24px] border-none text-[15px] font-bold shadow-lg transition-all focus:ring-4 focus:ring-indigo-500/10 placeholder:text-gray-300 ${isRecognizing ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                  />
                  <button 
                    onClick={() => {
                      if (isRecognizing) recognitionRef.current?.stop();
                      else recognitionRef.current?.start();
                    }} 
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isRecognizing ? 'bg-indigo-600 text-white animate-pulse' : 'text-gray-300 hover:text-indigo-400'}`}
                  >
                    🎙️
                  </button>
                </div>
                <button 
                  onClick={handleAskTutor} 
                  disabled={!followUpQuery.trim() || isAsking} 
                  className={`w-14 h-14 rounded-[22px] shadow-xl transition-all flex items-center justify-center ${!followUpQuery.trim() || isAsking ? 'bg-gray-100 text-gray-300' : 'bg-indigo-600 text-white active:scale-90 hover:bg-indigo-700'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 flex-shrink-0 safe-area-bottom">
        {!showFeedback ? (
          <button 
            disabled={selectedOption === null} 
            onClick={() => setShowFeedback(true)} 
            className={`w-full py-5 rounded-[28px] font-black text-xl shadow-2xl transition-all ${selectedOption === null ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white active:scale-[0.98] shadow-indigo-200 hover:bg-indigo-700'}`}
          >
            确认提交
          </button>
        ) : (
          <button onClick={handleNext} className="w-full bg-gray-900 text-white py-5 rounded-[28px] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:bg-black">
            <span>{currentIndex === questions.length - 1 ? '查看测试报告' : '下一题'}</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        )}
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default QuizView;
