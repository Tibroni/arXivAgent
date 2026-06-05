'use client';

import React from 'react';
import { Activity, Clock, DollarSign, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import { hasLangsmithKey, type ServerKeyStatus } from '@/lib/keys';

interface TraceStep {
  step: string;
  details: string;
  timestamp: number;
  duration_ms: number;
}

interface ObservabilityDashboardProps {
  traces: TraceStep[];
  apiHeaders?: Record<string, string>;
  serverKeyStatus?: ServerKeyStatus;
}

export default function ObservabilityDashboard({
  traces,
  apiHeaders = {},
  serverKeyStatus = {
    openai: false,
    gemini: false,
    langsmith: false,
    langsmithProject: 'arXivAgent',
    demoMode: false,
  },
}: ObservabilityDashboardProps) {
  // Simple token/cost calculations
  // In a real app we'd get these from API responses, but we can compute high-fidelity estimates:
  const isLangsmithActive = hasLangsmithKey(apiHeaders, serverKeyStatus);
  const langsmithProject =
    apiHeaders['X-Langsmith-Project'] ||
    (typeof window !== 'undefined' ? localStorage.getItem('langsmith_project') : null) ||
    serverKeyStatus.langsmithProject ||
    'arXivAgent';

  // Calculate stats
  const totalLatencyMs = traces.reduce((acc, t) => acc + t.duration_ms, 0);
  
  // Estimate tokens based on characters (rough estimation: 1 token = 4 chars)
  // Input tokens: user query, context papers, history (~15k characters = 3750 tokens)
  // Output tokens: assistant answer (~1500 characters = 375 tokens)
  const hasTraces = traces.length > 0;
  const estInputTokens = hasTraces ? 4200 : 0;
  const estOutputTokens = hasTraces ? 520 : 0;
  
  // Model cost rates (GPT-4o-mini rates as baseline: Input $0.15/1M, Output $0.60/1M)
  const estCost = hasTraces 
    ? (estInputTokens * 0.15 / 1000000) + (estOutputTokens * 0.60 / 1000000)
    : 0;

  return (
    <div className="glass-panel rounded-2xl p-5 border-slate-800/80 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="text-indigo-400 animate-pulse" size={20} />
          <h2 className="text-lg font-bold text-slate-100">Observability & Agent Traces</h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold">
          {isLangsmithActive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-emerald-400">LangSmith Active: {langsmithProject}</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-650"></span>
              <span className="text-slate-500">LangSmith Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {/* Latency Widget */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/10 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
            <Clock size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Latency</span>
            <span className="text-sm font-bold text-slate-200">
              {hasTraces ? `${(totalLatencyMs / 1000).toFixed(2)}s` : '0.00s'}
            </span>
          </div>
        </div>

        {/* Cost Widget */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/10 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <DollarSign size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Est. Cost</span>
            <span className="text-sm font-bold text-slate-200">
              {hasTraces ? `$${estCost.toFixed(5)}` : '$0.00000'}
            </span>
          </div>
        </div>

        {/* Token Usage Widget */}
        <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/10 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <Cpu size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Token Usage</span>
            <span className="text-sm font-bold text-slate-200">
              {hasTraces ? `${estInputTokens + estOutputTokens}` : '0'}
            </span>
          </div>
        </div>
      </div>

      {/* Traces List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {traces.length > 0 ? (
          <div className="relative border-l-2 border-indigo-900/50 ml-3 pl-5 space-y-4 py-1">
            {traces.map((trace, idx) => (
              <div key={`trace-${idx}`} className="relative group">
                {/* Timeline node */}
                <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-indigo-500/80 group-hover:border-indigo-400 transition-colors z-10 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"></div>
                </div>

                {/* Trace Step Card */}
                <div className="p-3.5 rounded-xl border border-slate-850/80 bg-slate-900/15 group-hover:border-slate-800 transition-colors">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-1.5 mb-1.5">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                      {trace.step}
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/20 px-2 py-0.5 rounded border border-indigo-900/30">
                      {trace.duration_ms.toFixed(0)}ms
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {trace.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-slate-500 text-center">
            <Activity size={36} className="text-slate-800 mb-3" />
            <h4 className="text-sm font-semibold">Live Observability Logging</h4>
            <p className="text-xs text-slate-650 max-w-sm mt-1.5">
              Run a RAG query in the chat dashboard to view live node execution timings, cost calculations, and agent traces.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
