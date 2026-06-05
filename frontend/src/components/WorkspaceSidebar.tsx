'use client';

import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Layers, CheckSquare, Square, FileText, Folder, Trash2 } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

interface Paper {
  id: string;
  arxiv_id: string;
  title: string;
  authors: string[];
  publication_date: string;
  pdf_url?: string;
}

interface WorkspaceSidebarProps {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  selectedPaperIds: string[];
  setSelectedPaperIds: (ids: string[]) => void;
  apiHeaders: Record<string, string>;
  refreshSignal: number;
  papers: Paper[];
  setPapers: (papers: Paper[]) => void;
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
}

export default function WorkspaceSidebar({
  activeWorkspaceId,
  setActiveWorkspaceId,
  selectedPaperIds,
  setSelectedPaperIds,
  apiHeaders,
  refreshSignal,
  papers,
  setPapers,
  workspaces,
  setWorkspaces
}: WorkspaceSidebarProps) {
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch workspaces
  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(apiUrl('/api/workspaces'));
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
        if (data.length > 0 && !activeWorkspaceId) {
          setActiveWorkspaceId(data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch workspaces", e);
    }
  };

  // Fetch papers in active workspace
  const fetchPapers = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/workspaces/${activeWorkspaceId}/papers`));
      if (res.ok) {
        const data = await res.json();
        setPapers(data);
      }
    } catch (e) {
      console.error("Failed to fetch papers", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    fetchPapers();
    setSelectedPaperIds([]); // reset selected papers when switching workspace
  }, [activeWorkspaceId, refreshSignal]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch(apiUrl('/api/workspaces'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName })
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces([...workspaces, data]);
        setActiveWorkspaceId(data.id);
        setNewWorkspaceName('');
      }
    } catch (err) {
      console.error("Failed to create workspace", err);
    } finally {
      setIsCreating(false);
    }
  };

  const togglePaperSelection = (paperId: string) => {
    if (selectedPaperIds.includes(paperId)) {
      setSelectedPaperIds(selectedPaperIds.filter(id => id !== paperId));
    } else {
      setSelectedPaperIds([...selectedPaperIds, paperId]);
    }
  };

  const handleDeletePaper = async (paperId: string, paperTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${paperTitle}" from this workspace?`)) {
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/papers/${paperId}`), {
        method: 'DELETE'
      });
      if (res.ok) {
        // Remove from selected list if it was selected
        setSelectedPaperIds(selectedPaperIds.filter(id => id !== paperId));
        // Refresh paper list
        fetchPapers();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete paper");
      }
    } catch (err: any) {
      alert("Error deleting paper: " + err.message);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#060814]/30 backdrop-blur-md overflow-hidden">
      {/* Workspace Header Section */}
      <div className="p-4 border-b border-slate-800/60 bg-slate-950/20">
        <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Layers size={14} /> Workspaces
        </h3>
        
        <form onSubmit={handleCreateWorkspace} className="flex gap-2 mb-3">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="New Workspace Name..."
            className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-600 transition-colors"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="bg-indigo-600/85 hover:bg-indigo-600 text-slate-100 p-1.5 rounded-lg transition-colors border border-indigo-500/20"
          >
            <Plus size={16} />
          </button>
        </form>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setActiveWorkspaceId(ws.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 border ${
                activeWorkspaceId === ws.id
                  ? 'bg-indigo-650/15 border-indigo-550/25 text-indigo-300 shadow-inner'
                  : 'bg-slate-900/10 border-slate-850/40 text-slate-400 hover:bg-slate-800/35 hover:text-slate-300 hover:border-slate-800'
              }`}
            >
              <Folder size={13} className={activeWorkspaceId === ws.id ? "text-indigo-400" : "text-slate-500"} />
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
          {workspaces.length === 0 && (
            <p className="text-[11px] text-slate-500 text-center py-2">No workspaces. Create one above.</p>
          )}
        </div>
      </div>

      {/* Papers Section */}
      <div className="flex-1 p-4 flex flex-col min-h-0 bg-slate-950/5">
        <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <BookOpen size={14} /> Ingested Papers
        </h3>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
            {papers.map((paper) => {
              const isSelected = selectedPaperIds.includes(paper.id);
              return (
                <div
                  key={paper.id}
                  onClick={() => togglePaperSelection(paper.id)}
                  className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer select-none flex items-start gap-2.5 relative group ${
                    isSelected
                      ? 'bg-indigo-950/25 border-indigo-500/35 shadow-md shadow-indigo-950/15 text-indigo-200'
                      : 'bg-slate-900/15 border-slate-850/50 hover:bg-slate-800/25 hover:border-slate-800 text-slate-350 hover:text-slate-200'
                  }`}
                >
                  <button className="mt-0.5 text-indigo-400 hover:text-indigo-300 transition-colors shrink-0">
                    {isSelected ? <CheckSquare size={15} /> : <Square size={15} className="text-slate-600" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-xs font-semibold leading-snug line-clamp-2 break-words pr-5 ${isSelected ? 'text-indigo-300' : 'text-slate-300'}`}>
                      {paper.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate mt-1">
                      {paper.authors.slice(0, 2).join(', ')} {paper.authors.length > 2 && 'et al.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1.5 text-[9px] text-slate-550 leading-none">
                      <FileText size={10} className="text-slate-655 shrink-0" />
                      <span className="font-semibold text-slate-500 shrink-0">arXiv:{paper.arxiv_id}</span>
                      <a 
                        href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-indigo-400 hover:text-indigo-300 hover:underline font-bold shrink-0"
                        title="Open arXiv abstract page in new tab"
                      >
                        abs
                      </a>
                      <span className="text-slate-800 shrink-0">|</span>
                      <a 
                        href={paper.pdf_url || `https://arxiv.org/pdf/${paper.arxiv_id}.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-indigo-400 hover:text-indigo-300 hover:underline font-bold shrink-0"
                        title="Open original arXiv PDF in new tab"
                      >
                        pdf
                      </a>
                      <span className="text-slate-800 shrink-0">•</span>
                      <span className="shrink-0">{paper.publication_date}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeletePaper(paper.id, paper.title, e)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-rose-450 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-slate-850/60 rounded-md shrink-0 cursor-pointer"
                    title="Delete paper from workspace"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}

            {papers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center px-4">
                <BookOpen size={24} className="text-slate-700 mb-2" />
                <p className="text-xs">No papers ingested in this workspace.</p>
                <p className="text-[10px] text-slate-600 mt-1">Search and ingest papers from arXiv to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
