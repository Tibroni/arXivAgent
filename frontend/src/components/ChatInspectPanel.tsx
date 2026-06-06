'use client';

import React from 'react';
import CitationsPanel from '@/components/CitationsPanel';
import QualityAuditPanel, { type EvaluationMetrics, type VerificationReport } from '@/components/QualityAuditPanel';

interface Chunk {
  paper_id: string;
  arxiv_id: string;
  title: string;
  chunk_id: string;
  text: string;
  score: number;
}

interface ChatInspectPanelProps {
  activeSideTab: 'citations' | 'audit';
  onSideTabChange: (tab: 'citations' | 'audit') => void;
  retrievedChunks: Chunk[];
  verificationReport?: VerificationReport;
  evaluationMetrics?: EvaluationMetrics;
}

export default function ChatInspectPanel({
  activeSideTab,
  onSideTabChange,
  retrievedChunks,
  verificationReport,
  evaluationMetrics,
}: ChatInspectPanelProps) {
  return (
    <div className="glass-panel p-5 flex flex-col h-full overflow-hidden">
      <div className="flex border border-white/10 shrink-0 mb-4">
        <button
          onClick={() => onSideTabChange('citations')}
          className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer ${
            activeSideTab === 'citations' ? 'ds-tab-active' : 'ds-tab-inactive'
          }`}
        >
          Active Citations
        </button>
        <button
          onClick={() => onSideTabChange('audit')}
          className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer border-l border-white/10 ${
            activeSideTab === 'audit' ? 'ds-tab-active' : 'ds-tab-inactive'
          }`}
        >
          Grounding Audit
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {activeSideTab === 'citations' ? (
          <CitationsPanel retrievedChunks={retrievedChunks} embedded />
        ) : (
          <QualityAuditPanel
            verificationReport={verificationReport}
            evaluationMetrics={evaluationMetrics}
          />
        )}
      </div>
    </div>
  );
}
