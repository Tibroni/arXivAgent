'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, Sparkles, BookOpen, Download, AlertCircle, CheckCircle, Terminal } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { hasOpenAIKey, type ServerKeyStatus } from '@/lib/keys';

interface ScoredPaper {
  arxiv_id: string;
  title: string;
  abstract: string;
  authors: string[];
  publication_date: string;
  categories: string[];
  pdf_url: string;
  relevance_score: number;
  relevance_justification: string;
}

interface ArxivSearchProps {
  activeWorkspaceId: string | null;
  apiHeaders: Record<string, string>;
  serverKeyStatus: ServerKeyStatus;
  onIngestionSuccess: () => void;
}

type IngestionState = 'idle' | 'downloading' | 'chunking' | 'summarizing' | 'saving' | 'done' | 'error';

interface AgentLog {
  id: string;
  type: 'info' | 'agent_thought' | 'tool_call' | 'agent_result' | 'warning' | 'done' | 'error';
  step: string;
  message: string;
  timestamp: string;
}

export default function ArxivSearch({ activeWorkspaceId, apiHeaders, serverKeyStatus, onIngestionSuccess }: ArxivSearchProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [results, setResults] = useState<ScoredPaper[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [showConsole, setShowConsole] = useState(true);
  const [searchStatus, setSearchStatus] = useState('Initiating discovery pipeline...');
  
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [ingestionStates, setIngestionStates] = useState<Record<string, IngestionState>>({});
  const [ingestionErrors, setIngestionErrors] = useState<Record<string, string>>({});
  const [searchMode, setSearchMode] = useState<'keyword' | 'url'>('keyword');
  const [urlInput, setUrlInput] = useState('');
  const [lastQueryIds, setLastQueryIds] = useState<string[] | null>(null);

  const executeSearch = async (searchQuery: string, startOffset: number, isLoadMore: boolean, targetIds?: string[]) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setSearching(true);
      setResults([]);
      setLogs([]);
      setSearchStatus('Initiating discovery pipeline...');
      setShowConsole(true);
    }

    setStartIndex(startOffset);

    const getTimestamp = () => {
      const d = new Date();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    const appendLog = (type: AgentLog['type'], step: string, message: string) => {
      setLogs(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          type,
          step,
          message,
          timestamp: getTimestamp()
        }
      ]);
    };

    if (!isLoadMore) {
      const logDesc = targetIds ? `IDs: ${targetIds.join(', ')}` : `"${searchQuery}"`;
      appendLog('info', 'arXiv Query', `Initiating discovery pipeline for ${logDesc}`);
    } else {
      const logDesc = targetIds ? `IDs: ${targetIds.join(', ')}` : `"${searchQuery}"`;
      appendLog('info', 'arXiv Query', `Fetching page offset ${startOffset} for ${logDesc}`);
    }

    try {
      const res = await fetch(apiUrl('/api/arxiv/search'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiHeaders
        },
        body: JSON.stringify({
          query: targetIds ? undefined : searchQuery,
          id_list: targetIds || null,
          start: startOffset,
          max_results: 15
        })
      });

      if (!res.ok) {
        let errMsg = 'Search failed';
        try {
          const errData = await res.json();
          errMsg = errData.detail || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      if (!res.body) {
        throw new Error("No response stream available");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6);
            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'info') {
                appendLog('info', data.step || 'arXiv Query', data.message);
                setSearchStatus(data.message);
              } else if (data.type === 'agent_thought') {
                appendLog('agent_thought', data.step || 'Discovery Agent', data.message);
                setSearchStatus(data.message);
              } else if (data.type === 'tool_call') {
                appendLog('tool_call', data.step || 'Discovery Agent', data.message);
                setSearchStatus(data.message);
              } else if (data.type === 'agent_result') {
                appendLog('agent_result', data.step || 'Discovery Agent', data.message);
              } else if (data.type === 'warning') {
                appendLog('warning', data.step || 'Discovery Agent', data.message);
                setSearchStatus(data.message);
              } else if (data.type === 'done') {
                const newPapers = data.papers || [];
                appendLog('done', 'Pipeline', `Search pipeline completed. Found ${newPapers.length} papers.`);
                
                if (isLoadMore) {
                  setResults(prev => [...prev, ...newPapers]);
                } else {
                  setResults(newPapers);
                }
                
                setHasMore(newPapers.length === 15);
              } else if (data.type === 'error') {
                appendLog('error', 'Pipeline', data.message);
                alert(`Search failed: ${data.message}`);
              }
            } catch (err) {
              console.error("JSON parsing error inside stream packet", err);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Fetch search stream error", err);
      appendLog('error', 'Connection', err.message || 'Failed to connect to backend server');
      alert(err.message || "Failed to connect to backend. Make sure FastAPI server is running.");
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  };

  const extractArxivIds = (text: string): string[] => {
    const newStyleRegex = /(?:\b|\/)(?:\d{4}\.\d{4,5}(?:v\d+)?)(?:\b|\.pdf)/g;
    const legacyRegex = /(?:\b|\/)(?:[a-zA-Z\-]+(?:\.[a-zA-Z]{2})?\/\d{7}(?:v\d+)?)(?:\b|\.pdf)/g;
    
    const matches: string[] = [];
    const cleanId = (id: string) => {
      return id.replace(/^\//, '').replace(/\.pdf$/, '').trim();
    };

    const newStyleMatches = text.match(newStyleRegex);
    if (newStyleMatches) {
      newStyleMatches.forEach(m => matches.push(cleanId(m)));
    }

    const legacyMatches = text.match(legacyRegex);
    if (legacyMatches) {
      legacyMatches.forEach(m => matches.push(cleanId(m)));
    }

    return Array.from(new Set(matches));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLastQueryIds(null);
    executeSearch(query, 0, false);
  };

  const handleUrlSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedIds = extractArxivIds(urlInput);
    if (parsedIds.length === 0) {
      alert("No valid arXiv paper URLs or IDs found in your input. Please check the format.");
      return;
    }
    setLastQueryIds(parsedIds);
    executeSearch('', 0, false, parsedIds);
  };

  const handleLoadMore = () => {
    if (searching || loadingMore) return;
    if (searchMode === 'url' && lastQueryIds && lastQueryIds.length > 0) {
      executeSearch('', results.length, true, lastQueryIds);
    } else if (searchMode === 'keyword' && query.trim()) {
      executeSearch(query, results.length, true);
    }
  };

  const handleIngest = async (paper: ScoredPaper) => {
    if (!activeWorkspaceId) {
      alert("Please select or create a workspace first.");
      return;
    }

    const { arxiv_id } = paper;
    
    if (!hasOpenAIKey(apiHeaders, serverKeyStatus)) {
      alert("OpenAI API key is required in Settings to generate chunk embeddings.");
      return;
    }

    setIngestionStates(prev => ({ ...prev, [arxiv_id]: 'downloading' }));
    setIngestionErrors(prev => {
      const copy = { ...prev };
      delete copy[arxiv_id];
      return copy;
    });

    try {
      const stateTimer = setInterval(() => {
        setIngestionStates(prev => {
          const current = prev[arxiv_id];
          if (current === 'downloading') return { ...prev, [arxiv_id]: 'chunking' };
          if (current === 'chunking') return { ...prev, [arxiv_id]: 'summarizing' };
          if (current === 'summarizing') return { ...prev, [arxiv_id]: 'saving' };
          return prev;
        });
      }, 3000);

      const res = await fetch(apiUrl('/api/arxiv/ingest'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiHeaders
        },
        body: JSON.stringify({
          workspace_id: activeWorkspaceId,
          arxiv_id: paper.arxiv_id,
          title: paper.title,
          abstract: paper.abstract,
          authors: paper.authors,
          publication_date: paper.publication_date,
          categories: paper.categories,
          pdf_url: paper.pdf_url
        })
      });

      clearInterval(stateTimer);

      if (res.ok) {
        setIngestionStates(prev => ({ ...prev, [arxiv_id]: 'done' }));
        onIngestionSuccess();
      } else {
        const data = await res.json();
        throw new Error(data.detail || 'Ingestion failed on backend');
      }
    } catch (err: any) {
      console.error("Ingestion error", err);
      setIngestionStates(prev => ({ ...prev, [arxiv_id]: 'error' }));
      setIngestionErrors(prev => ({ ...prev, [arxiv_id]: err.message || 'Unknown ingestion error' }));
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-950/30 border-emerald-500/25';
    if (score >= 50) return 'text-amber-400 bg-amber-950/30 border-amber-500/25';
    return 'text-slate-400 bg-slate-900/35 border-slate-700/20';
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border-slate-800/80 flex flex-col h-full overflow-hidden">
      {/* Search Header - Simplified Layout */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/50 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="text-indigo-400" size={22} />
          <h2 className="text-lg font-bold text-slate-100">arXiv Discovery Portal</h2>
        </div>
        
        {/* Console Toggle Button */}
        <button
          onClick={() => setShowConsole(!showConsole)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800/80 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm shrink-0"
          title="Toggle Discovery Logs"
        >
          <Terminal size={14} className={showConsole ? "text-emerald-400 animate-pulse" : "text-slate-550"} />
          <span>Logs</span>
        </button>
      </div>

      {/* Main Content Split Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-5 overflow-hidden min-h-0">
        
        {/* Left Pane: Search & Results */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* Tabs and Input Fields */}
          <div className="glass-panel p-4 rounded-xl border-slate-850 bg-slate-950/20 space-y-4 shrink-0">
            {/* Mode Switch Tabs */}
            <div className="flex border-b border-slate-850 pb-1 gap-2">
              <button
                onClick={() => setSearchMode('keyword')}
                className={`pb-2 px-3 text-xs font-semibold transition-all relative cursor-pointer ${
                  searchMode === 'keyword'
                    ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold'
                    : 'text-slate-455 hover:text-slate-205'
                }`}
              >
                Search by Keywords
              </button>
              <button
                onClick={() => setSearchMode('url')}
                className={`pb-2 px-3 text-xs font-semibold transition-all relative cursor-pointer ${
                  searchMode === 'url'
                    ? 'text-indigo-400 border-b-2 border-indigo-500 font-bold'
                    : 'text-slate-455 hover:text-slate-205'
                }`}
              >
                Import by arXiv URLs / IDs
              </button>
            </div>

            {/* Keyword Search Form */}
            {searchMode === 'keyword' ? (
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search papers e.g. 'Multi-Agent workflows' or 'RAG valuation'..."
                    className="w-full bg-slate-900/60 border border-slate-850 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || loadingMore}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 text-slate-100 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
                >
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  <span>Search</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleUrlSearch} className="flex flex-col gap-2.5">
                <textarea
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste arXiv URLs or IDs (separated by commas or newlines), e.g.:&#10;- https://arxiv.org/abs/1706.03762&#10;- https://arxiv.org/pdf/2303.17580.pdf&#10;- 2103.00020"
                  rows={3}
                  className="w-full bg-slate-900/60 border border-slate-850 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
                <button
                  type="submit"
                  disabled={searching || loadingMore}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 text-slate-100 py-2 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span>Load and Analyze Papers</span>
                </button>
              </form>
            )}
          </div>
          {results.map((paper, idx) => {
            const state = ingestionStates[paper.arxiv_id] || 'idle';
            const error = ingestionErrors[paper.arxiv_id];
            return (
              <div 
                key={`${paper.arxiv_id}-${idx}`} 
                className="glass-panel glass-panel-interactive p-5 rounded-xl border-slate-800/60 bg-slate-900/5 flex flex-col justify-between gap-3"
              >
                {/* Paper Header */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 px-2.5 py-0.5 rounded-md bg-slate-950/50 border border-slate-850">
                      {paper.publication_date}
                    </span>
                    {paper.categories.slice(0, 2).map((cat) => (
                      <span key={cat} className="text-[10px] font-semibold text-indigo-400 px-2.5 py-0.5 rounded-md bg-indigo-950/20 border border-indigo-900/30">
                        {cat}
                      </span>
                    ))}
                    <span className="text-[10px] font-semibold text-slate-500 ml-auto">
                      ID: {paper.arxiv_id}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-200 leading-snug hover:text-indigo-400 transition-colors">
                    {paper.title}
                  </h3>
                  
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {paper.authors.join(', ')}
                  </p>
                </div>

                {/* Paper Abstract */}
                <p className="text-xs text-slate-550 line-clamp-3 leading-relaxed font-medium">
                  {paper.abstract}
                </p>

                {/* Relevance score block */}
                {searchMode === 'keyword' && paper.relevance_score !== undefined && (
                  <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${getRelevanceColor(paper.relevance_score)}`}>
                    <Sparkles size={14} className="shrink-0 mt-0.5 text-indigo-400" />
                    <div>
                      <span className="font-bold text-slate-200">Relevance Score: {paper.relevance_score}%</span>
                      <p className="text-[11px] text-slate-455 mt-0.5 leading-snug font-medium">{paper.relevance_justification}</p>
                    </div>
                  </div>
                )}

                {/* Action Footer */}
                <div className="border-t border-slate-850/60 pt-3 mt-1 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <a 
                      href={`https://arxiv.org/abs/${paper.arxiv_id}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[10px] font-bold text-slate-405 hover:text-slate-205 hover:underline transition-all"
                      title="Open arXiv abstract page in new tab"
                    >
                      Abstract
                    </a>
                    <span className="text-[10px] text-slate-700">|</span>
                    <a 
                      href={paper.pdf_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition-all"
                      title="Open original arXiv PDF in new tab"
                    >
                      PDF
                    </a>
                  </div>
                  
                  <div className="w-full sm:w-44 sm:shrink-0">
                    {state === 'idle' && (
                      <button
                        onClick={() => handleIngest(paper)}
                        className="w-full bg-slate-900/60 hover:bg-indigo-650 text-indigo-300 hover:text-slate-100 border border-slate-800 hover:border-indigo-500/30 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-inner"
                      >
                        <Download size={13} />
                        <span>Ingest Paper</span>
                      </button>
                    )}

                    {state === 'downloading' && (
                      <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                        <Loader2 size={13} className="animate-spin text-indigo-400" />
                        <span>Downloading PDF...</span>
                      </div>
                    )}

                    {state === 'chunking' && (
                      <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                        <Loader2 size={13} className="animate-spin text-indigo-400" />
                        <span>Chunking & Embedding...</span>
                      </div>
                    )}

                    {state === 'summarizing' && (
                      <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                        <Loader2 size={13} className="animate-spin text-indigo-400" />
                        <span>Summarizing Content...</span>
                      </div>
                    )}

                    {state === 'saving' && (
                      <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                        <Loader2 size={13} className="animate-spin text-indigo-400" />
                        <span>Indexing Vector DB...</span>
                      </div>
                    )}

                    {state === 'done' && (
                      <div className="text-right text-xs text-emerald-450 flex items-center justify-end gap-1.5">
                        <CheckCircle size={14} className="text-emerald-400" />
                        <span className="font-semibold text-emerald-400">Ingested</span>
                      </div>
                    )}

                    {state === 'error' && (
                      <div className="flex flex-col items-end">
                        <div className="text-rose-400 text-xs flex items-center gap-1">
                          <AlertCircle size={14} />
                          <span className="font-semibold">Failed</span>
                        </div>
                        <button
                          onClick={() => handleIngest(paper)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline mt-0.5"
                        >
                          Retry Ingestion
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Curated Recommendations for Beginners Empty State */}
          {results.length === 0 && !searching && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center space-y-4">
              <div className="p-4 rounded-full bg-slate-900/60 border border-slate-850 text-indigo-400">
                <Search size={32} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Discover Scientific Literature</h4>
                <p className="text-xs text-slate-455 max-w-sm mt-1 mx-auto leading-relaxed">
                  Enter any research query above, or click on a recommended topic below to see the Discovery Agent parse, filter, and score papers.
                </p>
              </div>
              
              <div className="flex flex-wrap justify-center gap-2.5 max-w-md pt-2">
                {['Dark Matter & Webb Telescope', 'Quantum Computing', 'CRISPR Gene Editing', 'Game Theory & Nash Equilibrium', 'Retrieval-Augmented Generation (RAG)'].map((topic) => (
                  <button
                    key={topic}
                  onClick={() => {
                    setSearchMode('keyword');
                    setQuery(topic);
                    executeSearch(topic, 0, false);
                  }}
                    className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-905/80 hover:bg-indigo-650 hover:text-slate-100 border border-slate-850 hover:border-indigo-500/35 transition-all text-slate-400 cursor-pointer shadow-sm"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searching && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 text-center">
              <Loader2 size={36} className="text-indigo-400 animate-spin mb-3" />
              <h4 className="text-sm font-semibold">Searching arXiv...</h4>
              <p className="text-xs text-slate-455 mt-2.5 max-w-md mx-auto leading-relaxed animate-pulse">
                {searchStatus}
              </p>
            </div>
          )}

          {/* Load More Pagination Trigger */}
          {results.length > 0 && !searching && !loadingMore && hasMore && (
            <div className="flex justify-center pt-2 pb-4">
              <button
                onClick={handleLoadMore}
                className="bg-slate-900/60 hover:bg-indigo-650 text-slate-355 hover:text-slate-100 border border-slate-800 hover:border-indigo-500/35 px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-inner cursor-pointer"
              >
                <span>Load More Papers</span>
              </button>
            </div>
          )}
          {loadingMore && (
            <div className="flex justify-center pt-2 pb-4 text-xs text-slate-400 gap-1.5 items-center">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              <span>Fetching next batch...</span>
            </div>
          )}
        </div>

        {/* Right Pane: Discovery Agent scrolling terminal console (Collapsible) */}
        {showConsole && (
          <div className="w-full lg:w-96 shrink-0 flex flex-col h-56 lg:h-full min-h-0 border-t lg:border-t-0 lg:border-l border-slate-850 pt-4 lg:pt-0 lg:pl-5">
            <AgentConsole logs={logs} isStreaming={searching || loadingMore} />
          </div>
        )}
      </div>
    </div>
  );
}

interface AgentConsoleProps {
  logs: AgentLog[];
  isStreaming: boolean;
}

function AgentConsole({ logs, isStreaming }: AgentConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: string) => {
    switch (type) {
      case 'info':
        return 'text-slate-355';
      case 'agent_thought':
        return 'text-sky-455 font-medium';
      case 'tool_call':
        return 'text-indigo-400 italic';
      case 'agent_result':
        return 'text-emerald-400 font-semibold';
      case 'warning':
        return 'text-amber-400';
      case 'error':
        return 'text-rose-450 font-bold';
      case 'done':
        return 'text-emerald-500 font-bold';
      default:
        return 'text-slate-355';
    }
  };

  const getLogBadge = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-slate-900 border-slate-800/80 text-slate-400';
      case 'agent_thought':
        return 'bg-sky-950/40 border-sky-900/30 text-sky-400';
      case 'tool_call':
        return 'bg-indigo-950/40 border-indigo-900/30 text-indigo-400';
      case 'agent_result':
        return 'bg-emerald-950/40 border-emerald-900/30 text-emerald-400';
      case 'warning':
        return 'bg-amber-950/40 border-amber-900/30 text-amber-400';
      case 'error':
        return 'bg-rose-950/40 border-rose-900/30 text-rose-400';
      case 'done':
        return 'bg-emerald-950 border-emerald-800 text-emerald-300';
      default:
        return 'bg-slate-950 border-slate-900 text-slate-455';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-850 rounded-xl overflow-hidden font-mono text-[11px] leading-relaxed shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="bg-slate-900/95 border-b border-slate-850/80 px-3.5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          <span className="text-slate-400 font-bold ml-1.5 text-[10px]">Discovery Agent Console</span>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-[9px] text-indigo-400 uppercase font-semibold tracking-wider">Live</span>
          </div>
        )}
      </div>

      {/* Terminal logs list */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-scroll p-3.5 space-y-2.5 min-h-0 console-scrollbar select-text"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic flex flex-col items-center justify-center h-full text-center p-4">
            <Terminal size={18} className="text-slate-800 mb-1.5" />
            <span>Terminal Idle</span>
            <span className="text-[10px] mt-1 text-slate-700">Enter a query to stream discovery logs.</span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex flex-col space-y-0.5 border-l-2 border-slate-850 pl-2">
              <div className="flex items-center flex-wrap gap-1.5 text-[9px]">
                <span className="text-slate-655">{log.timestamp}</span>
                <span className={`px-1.5 py-0.2 rounded border text-[8px] font-bold tracking-tight uppercase ${getLogBadge(log.type)}`}>
                  {log.step}
                </span>
              </div>
              <p className={getLogColor(log.type)}>
                {log.message}
              </p>
            </div>
          ))
        )}
        
        {isStreaming && (
          <div className="flex items-center gap-1 text-slate-600 text-[10px] pl-2 mt-2">
            <span>agent-stdout_</span>
            <span className="w-1.5 h-3.5 bg-slate-550 animate-pulse inline-block align-middle" />
          </div>
        )}
      </div>
    </div>
  );
}
