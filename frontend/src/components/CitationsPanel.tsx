'use client';

import React from 'react';
import { BookOpen, Link as LinkIcon, FileText, Bookmark } from 'lucide-react';

interface Chunk {
  paper_id: string;
  arxiv_id: string;
  title: string;
  chunk_id: string;
  text: string;
  score: number;
}

interface CitationsPanelProps {
  retrievedChunks: Chunk[];
}

export default function CitationsPanel({ retrievedChunks }: CitationsPanelProps) {
  return (
    <div className="glass-panel p-5 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-4">
        <BookOpen className="text-indigo-400" size={18} />
        <h2 className="text-sm font-black tracking-tighter uppercase text-white">Active Citations</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 console-scrollbar">
        {retrievedChunks.length > 0 ? (
          <div className="space-y-3.5">
            <div className="p-3 border border-white/10 bg-black text-[10px] text-gray-400 flex items-start gap-2 leading-relaxed font-mono">
              <Bookmark size={14} className="shrink-0 mt-0.5 text-indigo-400" />
              <p>
                Source passages corresponding to inline citations used to ground the assistant response.
              </p>
            </div>

            {retrievedChunks.map((chunk, idx) => (
              <div 
                key={`citation-item-${idx}`} 
                className="p-4 border border-white/10 bg-black space-y-3 transition-colors hover:border-white/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-[8px] font-mono font-bold bg-indigo-600 text-white px-1.5 py-0.5">
                    Citation [{idx + 1}]
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-mono font-bold text-gray-500">
                      Score: {chunk.score.toFixed(4)}
                    </span>
                    <a 
                      href={`https://arxiv.org/abs/${chunk.arxiv_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] text-indigo-400 hover:text-white flex items-center gap-0.5 underline font-mono font-bold"
                    >
                      <LinkIcon size={10} />
                      <span>arXiv:{chunk.arxiv_id}</span>
                    </a>
                  </div>
                </div>

                <div className="text-[10px] text-gray-400 leading-normal font-mono whitespace-pre-wrap bg-white/5 p-3 border border-white/10 overflow-x-auto max-h-48 select-text">
                  {chunk.text}
                </div>

                <div className="flex items-center gap-1.5 text-[9px] text-gray-600 font-mono font-bold uppercase tracking-wider">
                  <FileText size={12} />
                  <span className="truncate">{chunk.title}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-gray-600 text-center">
            <BookOpen size={36} className="mb-3 opacity-20" />
            <h4 className="text-xs font-black uppercase tracking-tighter text-white">No Citations Yet</h4>
            <p className="text-[10px] text-gray-600 max-w-sm mt-1.5 font-mono">
              Start chatting to view grounding source passages here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
