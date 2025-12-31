
import React, { useState, useRef, useEffect } from 'react';
import { Question, ChatMessage } from '../types';
import { askFollowUpQuestion, generateTTS } from '../services/geminiService';

interface QuizViewProps {
  questions: Question[];
  onFinish: (answers: number[]) => void;
  onCancel: () => void;
}

function decodeBase64(base64: string): Uint8Array {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return new Uint8Array(0);
  }
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number): Promise<AudioBuffer | null> {
  if (data.length < 2) return null;
  try {
    const length = Math.floor(data.byteLength / 2) * 2;
    const buffer = ctx.createBuffer(1, length / 2, sampleRate);
    const channelData = buffer.getChannelData(0);
    const dataView = new DataView(data.buffer, data.byteOffset, length);
    for (let i = 0; i < length / 2; i++) {
      channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
    }
    return buffer;
  } catch (e) {
    return null;
  }
}

const QuizView: React.FC<QuizViewProps> = ({ questions, onFinish, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const [followUpQuery, setFollowUpQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  
  // 音频状态
  const [playingMsgIdx, setPlayingMsgIdx] = useState<number | null>(null);
  const [isTTSLoading, setIsTTSLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // 断点续传核心引用
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const stopRequestedRef = useRef<boolean>(false);
  // 记录每个消息播放到的分片索引
  const playbackProgressRef = useRef<Map<number, number>>(new Map());

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
    return () => stopAllAudio(true);
  }, []);

  const stopAllAudio = (resetProgress = false) => {
    stopRequestedRef.current = true;
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
      } catch (e) {}
      activeSourceRef.current = null;
    }
    if (resetProgress) {
      playbackProgressRef.current.clear();
    }
    setPlayingMsgIdx(null);
    setIsTTSLoading(false);
  };

  /**
   * 文本切分：每段控制在100字左右，确保TTS返回快且断点精准
   */
  const splitTextIntoChunks = (text: string): string[] => {
    // 按句号、问号、感叹号、换行符切分，同时保留标点
    const segments = text.split(/([.?!。？！\n]+)/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (let i = 0; i < segments.length; i++) {
      currentChunk += segments[i];
      // 如果当前累计超过 100 字，或者到了最后，则封为一个包
      if (currentChunk.length > 100 || i === segments.length - 1) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = "";
      }
    }
    return chunks;
  };

  const playTTS = async (fullText: string, msgIdx: number) => {
    // 如果正在播放当前点击的消息，则视为“暂停”
    if (playingMsgIdx === msgIdx) {
      stopAllAudio(false); // 停止播放，但不重置进度指针
      return;
    }
    
    // 如果点击新消息，或者在暂停后点击播放
    stopAllAudio(false); 
    stopRequestedRef.current = false;
    setPlayingMsgIdx(msgIdx);
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const chunks = splitTextIntoChunks(fullText);
      // 获取当前播放进度指针 (如果该消息没播过，从0开始)
      let startIndex = playbackProgressRef.current.get(msgIdx) || 0;
      
      // 如果上次已经播完了，则重新从0开始
      if (startIndex >= chunks.length) {
        startIndex = 0;
      }

      // 递归顺序播放函数
      const playSequential = async (index: number) => {
        if (index >= chunks.length || stopRequestedRef.current) {
          if (index >= chunks.length) {
            playbackProgressRef.current.set(msgIdx, 0); // 全部播完，重置指针
            setPlayingMsgIdx(null);
          }
          return;
        }

        const text = chunks[index];
        let buffer: AudioBuffer | null = null;

        // 记录当前尝试播放的索引
        playbackProgressRef.current.set(msgIdx, index);

        // 缓存检测
        if (audioCacheRef.current.has(text)) {
          buffer = audioCacheRef.current.get(text)!;
        } else {
          setIsTTSLoading(true);
          try {
            const base64 = await generateTTS(text);
            if (stopRequestedRef.current) return;
            const bytes = decodeBase64(base64);
            buffer = await decodeAudioData(bytes, ctx, 24000);
            if (buffer) audioCacheRef.current.set(text, buffer);
          } catch (err) {
            console.error("Chunk synthesis failed", err);
          }
        }

        setIsTTSLoading(false);

        if (buffer && !stopRequestedRef.current) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          activeSourceRef.current = source;
          
          source.onended = () => {
            if (!stopRequestedRef.current) {
              playSequential(index + 1); // 自动进入下一段
            }
          };
          source.start(0);
        } else if (!stopRequestedRef.current) {
          // 如果某一段加载失败，跳过播下一段
          playSequential(index + 1);
        }
      };

      await playSequential(startIndex);

    } catch (e) {
      setIsTTSLoading(false);
      setPlayingMsgIdx(null);
    }
  };

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
      alert(err.message);
    } finally {
      setIsAsking(false);
    }
  };

  const handleNext = () => {
    stopAllAudio(true);
    const newAnswers = [...userAnswers, selectedOption!];
    setUserAnswers(newAnswers);
    setSelectedOption(null);
    setShowFeedback(false);
    setFollowUpQuery('');
    setChatHistory([]);
    audioCacheRef.current.clear();
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
    else onFinish(newAnswers);
  };

  // 计算是否有播放进度
  const getProgressLabel = (msgIdx: number, fullText: string) => {
    const chunks = splitTextIntoChunks(fullText);
    const progress = playbackProgressRef.current.get(msgIdx) || 0;
    if (progress > 0 && progress < chunks.length) {
      return `已读 ${Math.round((progress / chunks.length) * 100)}%`;
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col p-6 animate-fadeIn h-screen relative bg-gray-50">
      {isExiting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl">
            <div className="text-5xl mb-6">⚠️</div>
            <h3 className="text-2xl font-black text-gray-900 mb-3">要退出练习吗？</h3>
            <div className="flex flex-col gap-3 mt-8">
              <button onClick={() => { stopAllAudio(true); onCancel(); }} className="w-full py-4.5 bg-red-500 text-white rounded-2xl font-black">确定退出</button>
              <button onClick={() => setIsExiting(false)} className="w-full py-4.5 bg-gray-100 text-gray-600 rounded-2xl font-bold">继续练习</button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-6 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">GAOKAO MASTER</span>
            <span className="text-sm font-black text-indigo-600">第 {currentIndex + 1} 题 / 共 {questions.length} 题</span>
          </div>
          <button onClick={() => setIsExiting(true)} className="px-4 py-2 bg-gray-100 text-gray-500 rounded-full text-xs font-black">退出</button>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pr-1 flex flex-col">
        <div className="bg-white rounded-[32px] p-7 shadow-sm border border-gray-100 mb-6 relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-20"></div>
          <p className="text-lg font-bold leading-relaxed text-gray-800">{questions[currentIndex].question}</p>
        </div>

        <div className="space-y-3.5 flex-shrink-0 mb-6">
          {questions[currentIndex].options.map((option, idx) => {
            let style = "border-gray-100 bg-white text-gray-700";
            if (selectedOption === idx) style = "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/10";
            if (showFeedback) {
              if (idx === questions[currentIndex].answerIndex) style = "border-green-500 bg-green-50 text-green-700 font-bold ring-2 ring-green-500/10";
              else if (selectedOption === idx) style = "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/10";
              else style = "opacity-40 border-gray-100 bg-white";
            }
            return (
              <button key={idx} disabled={showFeedback} onClick={() => setSelectedOption(idx)} className={`w-full p-4 rounded-[20px] text-left transition-all border-2 flex items-center ${style}`}>
                <span className={`flex-shrink-0 w-8 h-8 rounded-lg text-center leading-8 mr-4 font-black text-sm ${selectedOption === idx ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-[15px] font-medium">{option}</span>
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div className="flex flex-col gap-6 animate-fadeIn pb-8">
            <div className="p-6 bg-white rounded-[28px] border border-indigo-50 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${selectedOption === questions[currentIndex].answerIndex ? 'bg-green-100' : 'bg-red-100'}`}>
                  {selectedOption === questions[currentIndex].answerIndex ? '✨' : '📖'}
                </div>
                <h4 className={`font-black tracking-tight ${selectedOption === questions[currentIndex].answerIndex ? 'text-green-700' : 'text-red-700'}`}>解析详情</h4>
              </div>
              <p className="text-[14px] text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl font-medium">{questions[currentIndex].explanation}</p>
            </div>

            <div className="p-6 bg-indigo-50 rounded-[32px] border border-indigo-100 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-black">AI</div>
                   <h4 className="text-sm font-black text-indigo-900 tracking-tight">AI 助教答疑</h4>
                </div>
                {playingMsgIdx !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white/60 rounded-full border border-indigo-200">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                      {isTTSLoading ? "正在合成..." : "朗读中..."}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 mb-6 max-h-[400px] overflow-y-auto">
                {chatHistory.map((msg, idx) => {
                  const progressLabel = getProgressLabel(idx, msg.content);
                  return (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium relative ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-700 rounded-bl-none border border-indigo-100'}`}>
                        {msg.content}
                        {msg.role === 'model' && (
                          <div className="absolute -right-2 -bottom-2 flex flex-col items-end gap-1">
                            {progressLabel && playingMsgIdx !== idx && (
                              <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black shadow-sm mb-1">{progressLabel}</span>
                            )}
                            <button 
                              onClick={() => playTTS(msg.content, idx)}
                              className={`w-8 h-8 bg-white border border-indigo-100 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all ${playingMsgIdx === idx ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
                            >
                              {playingMsgIdx === idx ? (
                                isTTSLoading ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <span className="text-red-500 text-xs font-black">■</span>
                              ) : (
                                <span className="text-[14px]">{progressLabel ? '▶️' : '🔊'}</span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-white p-4 rounded-2xl border border-indigo-100 flex gap-1.5 animate-pulse">
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-300 rounded-full"></div>
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
                    placeholder={isRecognizing ? "正在聆听..." : "有疑问？问问 AI..."}
                    className={`w-full py-4 pl-5 pr-12 bg-white rounded-2xl border-none text-sm font-black shadow-sm transition-all ${isRecognizing ? 'ring-2 ring-red-400' : ''}`}
                  />
                  <button onClick={() => recognitionRef.current?.start()} className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isRecognizing ? 'bg-red-500 text-white animate-bounce' : 'text-gray-400'}`}>🎙️</button>
                </div>
                <button onClick={handleAskTutor} disabled={!followUpQuery.trim() || isAsking} className={`p-4 rounded-2xl shadow-md transition-all ${!followUpQuery.trim() || isAsking ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white active:scale-90'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 flex-shrink-0 safe-area-bottom">
        {!showFeedback ? (
          <button disabled={selectedOption === null} onClick={() => setShowFeedback(true)} className={`w-full py-4.5 rounded-[24px] font-black text-lg shadow-xl ${selectedOption === null ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white'}`}>确认提交</button>
        ) : (
          <button onClick={handleNext} className="w-full bg-gray-900 text-white py-4.5 rounded-[24px] font-black text-lg shadow-xl flex items-center justify-center gap-2">
            <span>{currentIndex === questions.length - 1 ? '完成测试' : '下一题'}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        )}
      </footer>
    </div>
  );
};

export default QuizView;
