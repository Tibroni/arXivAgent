'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, HelpCircle, Loader2, BookOpen, Menu, Trash2, Plus, MessageSquare, X } from 'lucide-react';
import type { EvaluationMetrics, VerificationReport } from '@/components/QualityAuditPanel';
import { apiUrl } from '@/lib/api';
import { hasLLMKey, type ServerKeyStatus } from '@/lib/keys';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
  retrieved_chunks?: any[];
  traces?: any[];
  verification_report?: {
    claims: Array<{
      sentence: string;
      is_grounded: boolean;
      supporting_chunk_ids: string[];
      explanation: string;
    }>;
    confidence_score: number;
    summary: string;
  };
  evaluation_metrics?: {
    faithfulness: number;
    relevance: number;
    context_precision: number;
    context_recall: number;
    hallucination_risk: number;
    justification: string;
  };
}

interface PaperChatProps {
  activeWorkspaceId: string | null;
  selectedPaperIds: string[];
  apiHeaders: Record<string, string>;
  serverKeyStatus: ServerKeyStatus;
  onNewTrace: (traces: any[]) => void;
  onNewChunks?: (chunks: any[]) => void;
  onNewQualityAudit?: (data: {
    verification_report?: VerificationReport;
    evaluation_metrics?: EvaluationMetrics;
  }) => void;
  papers: any[];
}

export default function PaperChat({ activeWorkspaceId, selectedPaperIds, apiHeaders, serverKeyStatus, onNewTrace, onNewChunks, onNewQualityAudit, papers }: PaperChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeCitation, setActiveCitation] = useState<{
    msgId: string;
    index: number;
    chunk: any;
    top: number;
    left: number;
  } | null>(null);
  
  // Threads state variables
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [creatingThread, setCreatingThread] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchThreads();
    } else {
      setThreads([]);
      setActiveThreadId(null);
      setMessages([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (activeThreadId) {
      fetchMessagesForThread(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const publishMessageInspectData = (msg: Message) => {
    if (msg.retrieved_chunks && onNewChunks) {
      onNewChunks(msg.retrieved_chunks);
    }
    if (msg.traces && onNewTrace) {
      onNewTrace(msg.traces);
    }
    if (onNewQualityAudit) {
      onNewQualityAudit({
        verification_report: msg.verification_report,
        evaluation_metrics: msg.evaluation_metrics,
      });
    }
  };

  const fetchThreads = async () => {
    try {
      const res = await fetch(apiUrl(`/api/workspaces/${activeWorkspaceId}/threads`));
      if (res.ok) {
        const data = await res.json();
        setThreads(data);
        if (data.length > 0) {
          const stillExists = data.some((t: any) => t.id === activeThreadId);
          if (!stillExists) {
            setActiveThreadId(data[0].id);
          }
        } else {
          setActiveThreadId(null);
        }
      }
    } catch (e) {
      console.error("Failed to fetch threads", e);
    }
  };

  const fetchMessagesForThread = async (threadId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/threads/${threadId}/messages`));
      if (res.ok) {
        const data = await res.json();
        const historyMsgs: Message[] = [];
        data.forEach((conv: any) => {
          historyMsgs.push({
            role: 'user',
            content: conv.question,
            id: conv.id + '_q'
          });
          historyMsgs.push({
            role: 'assistant',
            content: conv.answer,
            id: conv.id + '_a',
            retrieved_chunks: conv.retrieved_chunks || [],
            traces: conv.traces || [],
            verification_report: conv.verification_report,
            evaluation_metrics: conv.evaluation ? {
              faithfulness: conv.evaluation.faithfulness,
              relevance: conv.evaluation.relevance,
              context_precision: conv.evaluation.context_precision,
              context_recall: conv.evaluation.context_recall,
              hallucination_risk: conv.evaluation.hallucination_score || conv.evaluation.hallucination_risk,
              justification: conv.evaluation.justification || ''
            } : undefined
          });
        });
        setMessages(historyMsgs);

        // Auto-populate parent panels with the last assistant message's data
        const assistantMsgs = historyMsgs.filter(m => m.role === 'assistant');
        if (assistantMsgs.length > 0) {
          publishMessageInspectData(assistantMsgs[assistantMsgs.length - 1]);
        } else {
          if (onNewChunks) onNewChunks([]);
          if (onNewTrace) onNewTrace([]);
          if (onNewQualityAudit) onNewQualityAudit({});
        }
      }
    } catch (e) {
      console.error("Failed to fetch messages for thread", e);
    }
  };

  const handleCreateThread = async () => {
    if (!activeWorkspaceId || creatingThread) return;
    setCreatingThread(true);

    const getThreadTitle = () => {
      const selectedPapers = papers.filter(p => selectedPaperIds.includes(p.id));
      if (selectedPapers.length === 0) return 'New Chat';
      if (selectedPapers.length === 1) {
        const t = selectedPapers[0].title;
        return t.length > 40 ? `${t.substring(0, 37)}...` : t;
      }
      if (selectedPapers.length === 2) {
        const t1 = selectedPapers[0].title;
        const t2 = selectedPapers[1].title;
        const name1 = t1.length > 18 ? `${t1.substring(0, 15)}...` : t1;
        const name2 = t2.length > 18 ? `${t2.substring(0, 15)}...` : t2;
        return `${name1} & ${name2}`;
      }
      return `Compare: ${selectedPapers.length} Papers`;
    };

    const threadTitle = getThreadTitle();

    try {
      const res = await fetch(apiUrl(`/api/workspaces/${activeWorkspaceId}/threads`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: threadTitle })
      });
      if (res.ok) {
        const newThread = await res.json();
        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(newThread.id);
      }
    } catch (e) {
      console.error("Failed to create thread", e);
    } finally {
      setCreatingThread(false);
    }
  };

  const handleDeleteThread = async (threadId: string, threadTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete the chat conversation "${threadTitle}"?`)) return;
    
    try {
      const res = await fetch(apiUrl(`/api/threads/${threadId}`), {
        method: 'DELETE'
      });
      if (res.ok) {
        const updatedThreads = threads.filter(t => t.id !== threadId);
        setThreads(updatedThreads);
        
        if (activeThreadId === threadId) {
          if (updatedThreads.length > 0) {
            setActiveThreadId(updatedThreads[0].id);
          } else {
            setActiveThreadId(null);
            setMessages([]);
          }
        }
      }
    } catch (e) {
      console.error("Failed to delete thread", e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeWorkspaceId || sending) return;

    if (!hasLLMKey(apiHeaders, serverKeyStatus)) {
      alert("Please enter your API keys (OpenAI or Gemini) in Settings first.");
      return;
    }

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    const chatHistory = messages.slice(-8).map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const openaiModel = localStorage.getItem('openai_model') || 'gpt-4o-mini';
      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';

      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiHeaders
        },
        body: JSON.stringify({
          workspace_id: activeWorkspaceId,
          paper_ids: selectedPaperIds.length > 0 ? selectedPaperIds : null,
          question: userMsg.content,
          history: chatHistory,
          openai_model: openaiModel,
          gemini_model: geminiModel,
          thread_id: activeThreadId
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        if (data.thread_id && activeThreadId !== data.thread_id) {
          setActiveThreadId(data.thread_id);
        }
        
        const assistantMsg: Message = {
          role: 'assistant',
          content: data.answer,
          id: data.conversation_id,
          retrieved_chunks: data.retrieved_chunks,
          verification_report: data.verification_report,
          evaluation_metrics: data.evaluation_metrics
        };

        setMessages(prev => [...prev, assistantMsg]);
        publishMessageInspectData(assistantMsg);
        
        // Refresh the threads list to update the title in the sidebar
        fetchThreads();
      } else {
        const err = await res.json();
        alert(`Chat failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Chat error", err);
      alert("Failed to submit question to backend.");
    } finally {
      setSending(false);
    }
  };

  const parseInlineMarkdown = (text: string, retrievedChunksList?: any[], msgId?: string, traces?: any[]) => {
    let parts: React.ReactNode[] = [text];
    let keyCounter = 0;

    // 1. Process Bold: **text**
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const subParts = part.split(/(\*\*[^*]+\*\*)/g);
      return subParts.map((sub) => {
        keyCounter++;
        if (sub.startsWith('**') && sub.endsWith('**')) {
          return <strong key={`bold-${keyCounter}`} className="font-bold text-slate-100">{sub.slice(2, -2)}</strong>;
        }
        return sub;
      });
    });

    // 2. Process Inline Code: `code`
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const subParts = part.split(/(`[^`]+`)/g);
      return subParts.map((sub) => {
        keyCounter++;
        if (sub.startsWith('`') && sub.endsWith('`')) {
          return <code key={`code-${keyCounter}`} className="bg-black/45 border border-slate-850 px-1 py-0.5 rounded text-[10px] text-indigo-300 font-mono">{sub.slice(1, -1)}</code>;
        }
        return sub;
      });
    });

    // 3. Process Citations: [1]
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const subParts = part.split(/(\[\d+\])/g);
      return subParts.map((sub) => {
        keyCounter++;
        const match = sub.match(/^\[(\d+)\]$/);
        if (match) {
          const citeIndex = parseInt(match[1], 10);
          const chunk = retrievedChunksList ? retrievedChunksList[citeIndex - 1] : null;
          
          if (chunk) {
            return (
              <span 
                key={`cite-${keyCounter}`} 
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const parentRect = containerRef.current?.getBoundingClientRect();
                  if (parentRect) {
                    setActiveCitation({
                      msgId: msgId || 'unknown',
                      index: citeIndex,
                      chunk,
                      top: rect.top - parentRect.top,
                      left: rect.left - parentRect.left + (rect.width / 2),
                    });
                  }
                  if (retrievedChunksList && onNewChunks) {
                    onNewChunks(retrievedChunksList);
                  }
                  if (traces && onNewTrace) {
                    onNewTrace(traces);
                  }
                }}
                className="inline-flex items-center justify-center px-1.5 py-0.2 text-[9px] font-bold bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded cursor-pointer hover:bg-indigo-500/40 transition-colors mx-0.5 align-middle select-none"
                title={`View passage from: ${chunk.title || 'arXiv Paper'}`}
              >
                {sub}
              </span>
            );
          }
          
          return (
            <span 
              key={`cite-${keyCounter}`} 
              onClick={(e) => {
                e.stopPropagation();
                if (retrievedChunksList && onNewChunks) {
                  onNewChunks(retrievedChunksList);
                }
                if (traces && onNewTrace) {
                  onNewTrace(traces);
                }
              }}
              className="inline-flex items-center justify-center px-1.5 py-0.2 text-[9px] font-bold bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded cursor-pointer hover:bg-indigo-500/40 transition-colors mx-0.5 align-middle select-none"
              title="Grounding citation"
            >
              {sub}
            </span>
          );
        }
        return sub;
      });
    });

    return parts;
  };

  const parseMarkdown = (text: string, msgKey: string, retrievedChunksList?: any[], msgId?: string, traces?: any[]) => {
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeContent: string[] = [];
    
    return lines.map((line, lineIdx) => {
      const lineKey = `${msgKey}-line-${lineIdx}`;
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const content = codeContent.join('\n');
          codeContent = [];
          return (
            <pre key={lineKey} className="bg-black/45 border border-slate-850 rounded-xl p-3.5 my-2.5 font-mono text-xs overflow-x-auto text-slate-200 select-text">
              <code>{content}</code>
            </pre>
          );
        } else {
          inCodeBlock = true;
          return null;
        }
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return null;
      }

      if (line.trim().startsWith('### ')) {
        return <h4 key={lineKey} className="text-sm font-bold text-slate-100 mt-3 mb-1.5">{parseInlineMarkdown(line.substring(4), retrievedChunksList, msgId, traces)}</h4>;
      }
      if (line.trim().startsWith('## ')) {
        return <h3 key={lineKey} className="text-base font-bold text-slate-100 mt-3 mb-2">{parseInlineMarkdown(line.substring(3), retrievedChunksList, msgId, traces)}</h3>;
      }

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={lineKey} className="list-disc list-inside pl-2 text-xs leading-relaxed text-slate-355 my-1 font-medium">
            {parseInlineMarkdown(line.trim().substring(2), retrievedChunksList, msgId, traces)}
          </li>
        );
      }
      const matchNumbered = line.trim().match(/^(\d+)\.\s(.*)/);
      if (matchNumbered) {
        return (
          <li key={lineKey} className="list-decimal list-inside pl-2 text-xs leading-relaxed text-slate-355 my-1 font-medium">
            {parseInlineMarkdown(matchNumbered[2], retrievedChunksList, msgId, traces)}
          </li>
        );
      }

      if (!line.trim()) {
        return <div key={lineKey} className="h-2" />;
      }

      return (
        <p key={lineKey} className="text-xs leading-relaxed text-slate-300 my-1 font-medium">
          {parseInlineMarkdown(line, retrievedChunksList, msgId, traces)}
        </p>
      );
    }).filter(Boolean);
  };

  return (
    <div 
      ref={containerRef} 
      onClick={() => setActiveCitation(null)}
      className="glass-panel flex h-full overflow-hidden relative"
    >
      {/* Sidebar Panel (Collapsible Drawer Overlay on mobile) */}
      {isSidebarOpen && (
        <>
          {/* Backdrop overlay for mobile to dismiss the history panel */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-56 z-40 md:relative border-r border-white/10 bg-black flex flex-col h-full shrink-0 shadow-2xl md:shadow-none">
            <div className="p-3.5 border-b border-white/10">
              <button
                onClick={handleCreateThread}
                disabled={creatingThread || !activeWorkspaceId}
                type="button"
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-white/10 hover:bg-white hover:text-black text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                <span>New Chat</span>
              </button>
            </div>
            
            {/* Threads List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 console-scrollbar">
              {threads.map((t) => {
                const isActive = activeThreadId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setActiveThreadId(t.id);
                      if (window.innerWidth < 768) {
                        setIsSidebarOpen(false); // Close drawer on selection on mobile
                      }
                    }}
                    className={`group relative flex items-center justify-between px-3 py-2.5 border text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all ${
                      isActive
                        ? 'bg-white text-black border-white'
                        : 'bg-black border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-4">
                      <MessageSquare size={12} className={isActive ? "text-indigo-400" : "text-slate-505"} />
                      <span className="truncate leading-normal">{t.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteThread(t.id, t.title, e)}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-450 p-0.5 rounded transition-all cursor-pointer hover:bg-slate-900/40"
                      title="Delete Chat"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
              {threads.length === 0 && (
                <p className="text-[10px] text-slate-500 text-center py-4">No conversations yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 p-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              type="button"
              className="p-1.5 border border-white/10 bg-black text-gray-400 hover:bg-white hover:text-black transition-all cursor-pointer"
              title={isSidebarOpen ? "Hide chat history" : "Show chat history"}
            >
              <Menu size={15} />
            </button>
            <h2 className="text-sm font-black tracking-tighter uppercase text-white">Grounded Dialogue</h2>
          </div>
          {selectedPaperIds.length > 0 && (
            <span className="text-[9px] font-mono font-bold text-indigo-400 px-3 py-1 border border-indigo-500/30 uppercase tracking-widest">
              {selectedPaperIds.length} papers
            </span>
          )}
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 select-text">
        {messages.map((msg, idx) => (
          <div key={msg.id ? `msg-${msg.id}` : `idx-${idx}`} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* Message bubble */}
            <div 
              onClick={() => {
                if (msg.role === 'assistant') {
                  publishMessageInspectData(msg);
                }
              }}
              className={`max-w-[85%] p-4 text-xs leading-relaxed border border-white/15 bg-black text-white transition-all ${
                msg.role === 'assistant' ? 'cursor-pointer hover:border-white/25' : 'font-semibold'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="font-semibold text-xs leading-relaxed">{msg.content}</p>
              ) : (
                <div className="space-y-1">{parseMarkdown(msg.content, msg.id ? `msg-${msg.id}` : `idx-${idx}`, msg.retrieved_chunks, msg.id, msg.traces)}</div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex flex-col items-start animate-pulse">
            <div className="max-w-[85%] p-4 text-xs leading-relaxed border border-white/10 bg-black text-gray-400 flex items-center gap-2 font-mono">
              <Loader2 className="animate-spin text-indigo-400" size={15} />
              <span>Orchestrating agents via LangGraph...</span>
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center select-none">
            <div className="p-4 border border-white/10 text-indigo-400 mb-4">
              <BookOpen size={30} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-tighter text-white">Workspace Chat</h3>
            <p className="text-[10px] font-mono text-gray-600 max-w-sm mt-1.5 mx-auto leading-relaxed">
              Select papers in the sidebar, then ask questions grounded by citations.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full pt-8">
              {[
                "What are the main methodologies and findings?",
                "Identify any limitations or research gaps.",
                "How does this research compare to current state of the art?",
                "Provide a bulleted summary of key contributions."
              ].map((suggestion, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="p-3 border border-white/10 bg-black hover:bg-white hover:text-black text-left text-[10px] font-mono font-bold text-gray-500 transition-all cursor-pointer uppercase tracking-wide"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form Footer */}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-white/10 pt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={activeWorkspaceId ? "Ask a research question..." : "Select or create a workspace..."}
          disabled={!activeWorkspaceId || sending}
          className="flex-1 ds-input px-4 py-2.5 text-xs disabled:opacity-50 font-mono uppercase tracking-wider"
        />
        <button
          type="submit"
          disabled={!activeWorkspaceId || sending || !input.trim()}
          className="bg-indigo-600 hover:bg-white hover:text-black disabled:opacity-30 text-white p-2.5 transition-all flex items-center justify-center cursor-pointer shrink-0 border border-indigo-600 hover:border-white"
        >
          <Send size={16} />
        </button>
      </form>

      {/* Floating Citation Popover */}
      {activeCitation && (
        <div 
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the popover itself
          className="absolute z-50 w-72 xs:w-80 p-4 border border-white/10 bg-black shadow-2xl text-xs text-white"
          style={{
            top: `${activeCitation.top}px`,
            left: `${activeCitation.left}px`,
            transform: 'translate(-50%, -100%)',
            marginTop: '-8px'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              Citation Source [{activeCitation.index}]
            </span>
            <button 
              onClick={() => setActiveCitation(null)}
              className="text-slate-505 hover:text-slate-200 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>

          {/* Paper Title */}
          <h4 className="font-bold text-slate-100 leading-snug line-clamp-2 mb-1.5">
            {activeCitation.chunk.title || 'Source Paper'}
          </h4>

          {/* Metadata */}
          <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-500 font-semibold">
            <span>Score: {activeCitation.chunk.score ? activeCitation.chunk.score.toFixed(4) : 'N/A'}</span>
            <span>•</span>
            <a 
              href={`https://arxiv.org/abs/${activeCitation.chunk.arxiv_id}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-0.5"
            >
              <span>arXiv:{activeCitation.chunk.arxiv_id}</span>
            </a>
          </div>

          {/* Text Content */}
          <p className="text-[10px] text-slate-355 leading-relaxed font-mono whitespace-pre-wrap bg-black/30 p-2.5 rounded-lg border border-slate-900/60 max-h-32 overflow-y-auto select-text">
            {activeCitation.chunk.text}
          </p>
        </div>
      )}
    </div>
  </div>
  );
}
