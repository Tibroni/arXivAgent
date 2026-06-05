'use client';

import React, { useState, useEffect } from 'react';
import { Settings, BookOpen, MessageSquare, GitCompare, Activity, FileSearch, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import SettingsModal from '@/components/SettingsModal';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';
import ArxivSearch from '@/components/ArxivSearch';
import PaperChat from '@/components/PaperChat';
import ComparisonView from '@/components/ComparisonView';
import CitationsPanel from '@/components/CitationsPanel';
import LandingPage from '@/components/LandingPage';
import { apiUrl } from '@/lib/api';
import { EMPTY_SERVER_KEY_STATUS, type ServerKeyStatus } from '@/lib/keys';

export default function Home() {
  const [isAppLaunched, setIsAppLaunched] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatMobileSubTab, setChatMobileSubTab] = useState<'chat' | 'inspect'>('chat');
  
  // Last interaction trace data
  const [traces, setTraces] = useState<any[]>([]);
  const [retrievedChunks, setRetrievedChunks] = useState<any[]>([]);
  
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'chat' | 'compare'>('search');
  const [activeSideTab, setActiveSideTab] = useState<'citations' | 'inspector'>('citations');
  
  const [apiHeaders, setApiHeaders] = useState<Record<string, string>>({});
  const [serverKeyStatus, setServerKeyStatus] = useState<ServerKeyStatus>(EMPTY_SERVER_KEY_STATUS);

  // Load API keys on mount and when settings change
  const loadApiKeys = () => {
    if (typeof window !== 'undefined') {
      const openaiKey = localStorage.getItem('openai_key') || '';
      const geminiKey = localStorage.getItem('gemini_key') || '';
      const langsmithKey = localStorage.getItem('langsmith_key') || '';
      const langsmithProject = localStorage.getItem('langsmith_project') || 'arXivAgent';

      const headers: Record<string, string> = {};
      if (openaiKey) headers['X-OpenAI-Key'] = openaiKey;
      if (geminiKey) headers['X-Gemini-Key'] = geminiKey;
      if (langsmithKey) {
        headers['X-Langsmith-Key'] = langsmithKey;
        headers['X-Langsmith-Project'] = langsmithProject;
      }
      setApiHeaders(headers);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  useEffect(() => {
    const loadServerKeyStatus = async () => {
      try {
        const res = await fetch(apiUrl('/api/config'));
        if (!res.ok) return;

        const data = await res.json();
        setServerKeyStatus({
          openai: !!data.server_keys?.openai,
          gemini: !!data.server_keys?.gemini,
          langsmith: !!data.server_keys?.langsmith,
          langsmithProject: data.langsmith_project || 'arXivAgent',
          demoMode: !!data.demo_mode,
        });
      } catch {
        // Backend may be offline during local frontend-only development.
      }
    };

    loadServerKeyStatus();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleIngestionSuccess = () => {
    setRefreshSignal(prev => prev + 1);
  };

  const handleNewTrace = (newTraces: any[]) => {
    setTraces(newTraces);
    // Extract retrieved chunks if they are returned inside traces or directly
    // The PaperChat component triggers this with the traces array, and we also update chunks
    // Let's retrieve from chat response if handled. We'll hook into chat completion.
  };

  const triggerChatResponseHooks = (chatResponseData: any) => {
    if (chatResponseData.traces) setTraces(chatResponseData.traces);
    if (chatResponseData.retrieved_chunks) setRetrievedChunks(chatResponseData.retrieved_chunks);
  };

  const activeWorkspace = workspaces.find((w: any) => w.id === activeWorkspaceId);
  const activeWorkspaceName = activeWorkspace ? activeWorkspace.name : 'No Workspace';

  if (!isAppLaunched) {
    return <LandingPage onLaunch={() => setIsAppLaunched(true)} />;
  }

  return (
    <main className="w-screen h-screen flex overflow-hidden bg-[#060814] text-slate-100 font-sans antialiased relative">
      {/* Backdrop overlay for mobile/tablet when sidebar is open */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden cursor-pointer"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* Left Sidebar (Collapsible Drawer Overlay on mobile) */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 lg:relative lg:z-0 transition-all duration-300 ease-in-out shrink-0 h-full ${
          isSidebarCollapsed 
            ? '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-none' 
            : 'translate-x-0 w-80 border-r border-slate-850/80 bg-[#080a1d] lg:bg-transparent shadow-2xl lg:shadow-none'
        }`}
      >
        <WorkspaceSidebar
          activeWorkspaceId={activeWorkspaceId}
          setActiveWorkspaceId={setActiveWorkspaceId}
          selectedPaperIds={selectedPaperIds}
          setSelectedPaperIds={setSelectedPaperIds}
          apiHeaders={apiHeaders}
          refreshSignal={refreshSignal}
          papers={papers}
          setPapers={setPapers}
          workspaces={workspaces}
          setWorkspaces={setWorkspaces}
        />
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-gradient-to-br from-[#060814] via-[#080a1d] to-[#0c0e2a] overflow-hidden">
        {/* Top Header / Navigation Bar */}
        <header className="h-16 shrink-0 border-b border-slate-850/60 bg-[#060814]/75 backdrop-blur-md flex items-center justify-between px-3.5 sm:px-6 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/30 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer hover:bg-slate-900/60"
              title={isSidebarCollapsed ? "Show Workspace Sidebar" : "Hide Workspace Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
            
            <div className="flex items-center gap-2.5 ml-2">
              <div className="p-1.5 rounded-lg bg-indigo-650/20 border border-indigo-550/35 text-indigo-400">
                <Sparkles size={16} />
              </div>
              <div className="leading-none">
                <h1 className="text-sm font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
                  <span className="hidden sm:inline">arXivAgent</span> <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-950/40 border border-indigo-900/30 px-1.5 py-0.5 rounded-full">v1.0</span>
                </h1>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2 ml-4">
              <span className="text-slate-800">|</span>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 border border-slate-850/60 text-[10px] font-bold text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Workspace: {activeWorkspaceName}</span>
              </div>
            </div>
          </div>

          {/* Center: Tabs Switcher */}
          <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-850/80">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-indigo-650/85 text-slate-100 border border-indigo-500/20 shadow-md shadow-indigo-600/15 font-bold'
                  : 'text-slate-455 border border-transparent hover:text-slate-200'
              }`}
            >
              <FileSearch size={14} />
              <span className="hidden sm:inline">Search arXiv</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-indigo-650/85 text-slate-100 border border-indigo-500/20 shadow-md shadow-indigo-600/15 font-bold'
                  : 'text-slate-455 border border-transparent hover:text-slate-200'
              }`}
            >
              <MessageSquare size={14} />
              <span className="hidden sm:inline">Paper Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'compare'
                  ? 'bg-indigo-650/85 text-slate-100 border border-indigo-500/20 shadow-md shadow-indigo-600/15 font-bold'
                  : 'text-slate-455 border border-transparent hover:text-slate-200'
              }`}
            >
              <GitCompare size={14} />
              <span className="hidden sm:inline">Compare Matrix</span>
            </button>
          </div>

          {/* Right: Settings Cog */}
          <div className="flex items-center gap-3">
            {serverKeyStatus.demoMode && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Demo Mode</span>
              </div>
            )}
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              <span>LangGraph Connected</span>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800 text-slate-350 p-2 rounded-xl transition-all hover:text-slate-100 cursor-pointer shadow-sm"
              title="Configure API Keys"
            >
              <Settings size={15} />
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 min-h-0 p-3 sm:p-6 overflow-hidden relative">
          {activeTab === 'search' && (
            <ArxivSearch
              activeWorkspaceId={activeWorkspaceId}
              apiHeaders={apiHeaders}
              serverKeyStatus={serverKeyStatus}
              onIngestionSuccess={handleIngestionSuccess}
            />
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-full min-h-0 gap-3">
              {/* Mobile Sub-Tab Switcher (only below lg) */}
              <div className="flex lg:hidden bg-slate-950/60 p-1 rounded-xl border border-slate-850/80 shrink-0">
                <button
                  onClick={() => setChatMobileSubTab('chat')}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    chatMobileSubTab === 'chat'
                      ? 'bg-indigo-650/35 border border-indigo-550/25 text-indigo-300 font-bold'
                      : 'text-slate-455 hover:text-slate-205'
                  }`}
                >
                  Workspace Chat
                </button>
                <button
                  onClick={() => setChatMobileSubTab('inspect')}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    chatMobileSubTab === 'inspect'
                      ? 'bg-indigo-650/35 border border-indigo-550/25 text-indigo-300 font-bold'
                      : 'text-slate-455 hover:text-slate-205'
                  }`}
                >
                  Citations
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0">
                {/* Main Chat Panel */}
                <div className={`lg:col-span-3 h-full min-h-0 ${chatMobileSubTab === 'chat' ? 'block' : 'hidden lg:block'}`}>
                  <PaperChat
                    activeWorkspaceId={activeWorkspaceId}
                    selectedPaperIds={selectedPaperIds}
                    apiHeaders={apiHeaders}
                    serverKeyStatus={serverKeyStatus}
                    onNewTrace={(newTraces) => handleNewTrace(newTraces)}
                    onNewChunks={setRetrievedChunks}
                    papers={papers}
                  />
                </div>

                {/* Side Observability details */}
                <div className={`lg:col-span-2 h-full flex flex-col min-h-0 gap-4 ${chatMobileSubTab === 'inspect' ? 'flex' : 'hidden lg:flex'}`}>
                  <div className="flex-1 min-h-0">
                    <CitationsPanel retrievedChunks={retrievedChunks} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'compare' && (
            <ComparisonView
              selectedPaperIds={selectedPaperIds}
              apiHeaders={apiHeaders}
              serverKeyStatus={serverKeyStatus}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={loadApiKeys}
        serverKeyStatus={serverKeyStatus}
      />

      {/* Custom chat Completion intercept helper */}
      <ChatInterceptHelper 
        setChunks={setRetrievedChunks} 
        setTraces={setTraces} 
      />
    </main>
  );
}

// Simple interceptor to fetch metadata for current queries in background
function ChatInterceptHelper({ 
  setChunks, 
  setTraces 
}: { 
  setChunks: (c: any[]) => void;
  setTraces: (t: any[]) => void; 
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Intercept standard fetch calls to /api/chat so we can load retrieval inspect data in context
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
      const response = await originalFetch(input, init);
      
      const isChatApi = typeof input === 'string' && input.includes('/api/chat');
      if (isChatApi && response.status === 200) {
        // Clone response to avoid consuming body stream
        const clone = response.clone();
        try {
          const data = await clone.json();
          if (data.retrieved_chunks) setChunks(data.retrieved_chunks);
          if (data.traces) setTraces(data.traces);
        } catch (e) {
          console.error("Failed to parse intercepted chat chunks", e);
        }
      }
      
      return response;
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [setChunks, setTraces]);

  return null;
}
