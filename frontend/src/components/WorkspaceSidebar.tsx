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
    setSelectedPaperIds([]);
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
        setSelectedPaperIds(selectedPaperIds.filter(id => id !== paperId));
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
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <span className="ds-label block mb-3">[ Active Workspace ]</span>
        
        <form onSubmit={handleCreateWorkspace} className="flex gap-2 mb-3">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="New workspace..."
            className="flex-1 ds-input px-2.5 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="bg-indigo-600 hover:bg-white hover:text-black text-white p-1.5 transition-colors border border-indigo-600 hover:border-white"
          >
            <Plus size={16} />
          </button>
        </form>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setActiveWorkspaceId(ws.id)}
              className={`w-full text-left px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 border ${
                activeWorkspaceId === ws.id
                  ? 'bg-white text-black border-white'
                  : 'bg-black border-white/10 text-gray-500 hover:text-white hover:border-white/20'
              }`}
            >
              <Folder size={13} />
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
          {workspaces.length === 0 && (
            <p className="text-[10px] text-gray-600 text-center py-2 font-mono uppercase tracking-widest">No workspaces</p>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col min-h-0">
        <span className="ds-label block mb-3">[ Ingested Papers ]</span>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white animate-spin"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {papers.map((paper) => {
              const isSelected = selectedPaperIds.includes(paper.id);
              return (
                <div
                  key={paper.id}
                  onClick={() => togglePaperSelection(paper.id)}
                  className={`p-3 border transition-all duration-300 cursor-pointer select-none flex items-start gap-2.5 relative group ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-black border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <button className="mt-0.5 transition-colors shrink-0">
                    {isSelected ? <CheckSquare size={15} /> : <Square size={15} className="opacity-40" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold leading-snug line-clamp-2 break-words pr-5 uppercase tracking-tight text-white">
                      {paper.title}
                    </h4>
                    <p className={`text-[10px] truncate mt-1 ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                      {paper.authors.slice(0, 2).join(', ')} {paper.authors.length > 2 && 'et al.'}
                    </p>
                    <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1.5 text-[9px] font-mono leading-none ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                      <FileText size={10} className="shrink-0" />
                      <span className="font-bold shrink-0">arXiv:{paper.arxiv_id}</span>
                      <a 
                        href={`https://arxiv.org/abs/${paper.arxiv_id}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`hover:underline font-bold shrink-0 ${isSelected ? 'text-white' : 'text-indigo-400'}`}
                        title="Open arXiv abstract page in new tab"
                      >
                        abs
                      </a>
                      <span className="shrink-0 opacity-30">|</span>
                      <a 
                        href={paper.pdf_url || `https://arxiv.org/pdf/${paper.arxiv_id}.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`hover:underline font-bold shrink-0 ${isSelected ? 'text-white' : 'text-indigo-400'}`}
                        title="Open original arXiv PDF in new tab"
                      >
                        pdf
                      </a>
                      <span className="shrink-0 opacity-30">•</span>
                      <span className="shrink-0">{paper.publication_date}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeletePaper(paper.id, paper.title, e)}
                    className={`absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-all p-1 shrink-0 cursor-pointer ${isSelected ? 'text-indigo-100 hover:text-red-200' : 'text-gray-600 hover:text-red-400'}`}
                    title="Delete paper from workspace"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}

            {papers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-600 text-center px-4">
                <BookOpen size={24} className="mb-2 opacity-30" />
                <p className="text-[10px] font-mono uppercase tracking-widest">No papers ingested</p>
                <p className="text-[9px] text-gray-700 mt-1 font-mono">Search arXiv to get started</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
