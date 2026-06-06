'use client';

import React from 'react';
import { ShieldAlert, ShieldCheck, CheckCircle, BarChart2 } from 'lucide-react';

export interface VerificationReport {
  claims: Array<{
    sentence: string;
    is_grounded: boolean;
    supporting_chunk_ids: string[];
    explanation: string;
  }>;
  confidence_score: number;
  summary: string;
}

export interface EvaluationMetrics {
  faithfulness: number;
  relevance: number;
  context_precision: number;
  context_recall: number;
  hallucination_risk: number;
  justification: string;
}

interface QualityAuditPanelProps {
  verificationReport?: VerificationReport;
  evaluationMetrics?: EvaluationMetrics;
}

function getMetricColor(val: number, isRisk = false) {
  if (isRisk) {
    if (val >= 0.6) return 'bg-rose-500';
    if (val >= 0.3) return 'bg-amber-500';
    return 'bg-emerald-500';
  }
  if (val >= 0.8) return 'bg-emerald-500';
  if (val >= 0.5) return 'bg-amber-500';
  return 'bg-rose-500';
}

function MetricBar({ label, value, isRisk = false }: { label: string; value: number; isRisk?: boolean }) {
  return (
    <div className="p-3 border border-white/10 bg-black space-y-1.5">
      <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-black text-white">{Math.round(value * 100)}%</span>
      <div className="w-full bg-white/5 h-1">
        <div
          className={`h-1 ${getMetricColor(value, isRisk)}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function QualityAuditPanel({ verificationReport, evaluationMetrics }: QualityAuditPanelProps) {
  const hasData = !!verificationReport || !!evaluationMetrics;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 console-scrollbar">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-28 text-gray-600 text-center">
            <ShieldCheck size={36} className="mb-3 opacity-20" />
            <h4 className="text-xs font-black uppercase tracking-tighter text-white">No Audit Data Yet</h4>
            <p className="text-[10px] text-gray-600 max-w-sm mt-1.5 font-mono">
              Ask a question, then click an assistant message to view grounding audit and RAG metrics.
            </p>
          </div>
        ) : (
          <>
            {evaluationMetrics && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="text-indigo-400" size={16} />
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-white">
                    RAG Alignment & Quality
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MetricBar label="Factuality" value={evaluationMetrics.faithfulness} />
                  <MetricBar label="Relevance" value={evaluationMetrics.relevance} />
                  <MetricBar label="Precision" value={evaluationMetrics.context_precision} />
                  <MetricBar label="Recall" value={evaluationMetrics.context_recall} />
                  <MetricBar label="Hallucination" value={evaluationMetrics.hallucination_risk} isRisk />
                </div>

                <p className="text-[10px] text-gray-500 font-mono leading-relaxed border border-white/10 bg-black p-3">
                  {evaluationMetrics.justification}
                </p>
              </section>
            )}

            {verificationReport && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  {verificationReport.confidence_score >= 80 ? (
                    <ShieldCheck className="text-emerald-400" size={16} />
                  ) : (
                    <ShieldAlert className="text-amber-400" size={16} />
                  )}
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-white">
                    Grounding Audit
                  </h3>
                  <span className="text-[9px] font-mono font-bold text-indigo-400 ml-auto">
                    {verificationReport.confidence_score}% confidence
                  </span>
                </div>

                <p className="text-[10px] text-gray-400 font-mono leading-relaxed border border-white/10 bg-black p-3">
                  {verificationReport.summary}
                </p>

                <div className="space-y-2">
                  {verificationReport.claims.map((claim, idx) => (
                    <div
                      key={`claim-${idx}`}
                      className="p-3 border border-white/10 bg-black flex items-start gap-2"
                    >
                      {claim.is_grounded ? (
                        <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={13} />
                      ) : (
                        <ShieldAlert className="text-rose-400 shrink-0 mt-0.5" size={13} />
                      )}
                      <div className="min-w-0">
                        <p className={`text-[11px] font-bold leading-normal ${claim.is_grounded ? 'text-white' : 'text-rose-300'}`}>
                          &ldquo;{claim.sentence}&rdquo;
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed font-mono">{claim.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
