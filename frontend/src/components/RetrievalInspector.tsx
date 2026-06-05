'use client';

import React from 'react';
import { Eye, Info, Link as LinkIcon, FileText } from 'lucide-react';

interface Chunk {
  paper_id: string;
  arxiv_id: string;
  title: string;
  chunk_id: string;
  text: string;
  score: number;
}

interface RetrievalInspectorProps {
  retrievedChunks: Chunk[];
}

export default function RetrievalInspector({ retrievedChunks }: RetrievalInspectorProps) {
  return (
    <div className="glass-panel rounded-2xl p-5 border-slate-800/80 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-800/50 pb-4 mb-4">
        <Eye className="text-indigo-400" size={20} />
        <h2 className="text-lg font-bold text-slate-100">Retrieval Inspector</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {retrievedChunks.length > 0 ? (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl border border-indigo-550/10 bg-indigo-950/5 text-xs text-indigo-300 flex items-start gap-2 leading-relaxed">
              <Info size={15} className="shrink-0 mt-0.5" />
              <p>
                These text chunks were retrieved from Qdrant based on their vector similarity (cosine score) to the user's question, and served as the direct prompt grounding context.
              </p>
            </div>

            {retrievedChunks.map((chunk, idx) => (
              <div 
                key={`chunk-${idx}`} 
                className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/15 space-y-3 transition-colors hover:border-slate-700/60"
              >
                {/* Chunk Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-indigo-650/20 text-indigo-300 border border-indigo-550/25 px-2.5 py-0.5 rounded-full">
                      Rank #{idx + 1}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      {chunk.chunk_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-500/15">
                      Similarity: {chunk.score.toFixed(4)}
                    </span>
                    <a 
                      href={`https://arxiv.org/abs/${chunk.arxiv_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 underline underline-offset-2 font-semibold"
                    >
                      <LinkIcon size={10} />
                      <span>arXiv:{chunk.arxiv_id}</span>
                    </a>
                  </div>
                </div>

                {/* Snippet */}
                <div className="text-xs text-slate-350 leading-relaxed font-mono whitespace-pre-wrap bg-black/20 p-3 rounded-lg border border-slate-900 overflow-x-auto max-h-48">
                  {chunk.text}
                </div>

                {/* Source Paper Title */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold">
                  <FileText size={12} className="text-slate-650" />
                  <span className="truncate">Source: {chunk.title}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-slate-500 text-center">
            <Eye size={36} className="text-slate-800 mb-3" />
            <h4 className="text-sm font-semibold">Inspect Vector Retrieval</h4>
            <p className="text-xs text-slate-650 max-w-sm mt-1.5">
              Ask a question in the chat panel to inspect the retrieved text passages, ranking orders, and cosine similarity scores.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
