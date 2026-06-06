'use client';

import React, { useState } from 'react';
import { GitCompare, Loader2, Plus, Sparkles, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { hasLLMKey, type ServerKeyStatus } from '@/lib/keys';

interface ComparisonData {
  similarities: string[];
  differences: string[];
  strengths: Record<string, string[]>;
  weaknesses: Record<string, string[]>;
  research_gaps: string[];
}

interface ComparisonViewProps {
  selectedPaperIds: string[];
  apiHeaders: Record<string, string>;
  serverKeyStatus: ServerKeyStatus;
}

export default function ComparisonView({ selectedPaperIds, apiHeaders, serverKeyStatus }: ComparisonViewProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (selectedPaperIds.length < 2) {
      alert("Please select at least 2 papers in the sidebar to generate a comparison matrix.");
      return;
    }

    if (!hasLLMKey(apiHeaders, serverKeyStatus)) {
      alert("Please configure API keys in settings to generate comparison reports.");
      return;
    }

    setLoading(true);
    setData(null);

    try {
      const res = await fetch(apiUrl('/api/compare'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiHeaders
        },
        body: JSON.stringify({
          paper_ids: selectedPaperIds
        })
      });

      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        const err = await res.json();
        alert(`Comparison failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to submit comparison request to backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black tracking-tighter uppercase text-white flex items-center gap-2">
            <GitCompare className="text-indigo-400" size={18} />
            Literature Synthesis
          </h2>
        </div>
        
        <button
          onClick={handleCompare}
          disabled={selectedPaperIds.length < 2 || loading}
          className="ds-btn-primary px-4 py-2.5 flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <GitCompare size={14} />}
          <span>Generate ({selectedPaperIds.length})</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {loading && (
          <div className="flex flex-col items-center justify-center py-28 text-gray-500 text-center">
            <Loader2 size={36} className="text-indigo-400 animate-spin mb-3" />
            <h4 className="text-xs font-black uppercase tracking-tighter text-white">Running Agent</h4>
            <p className="text-[10px] font-mono mt-1 max-w-sm">
              Analyzing methodologies and contributions across selected papers.
            </p>
          </div>
        )}

        {!loading && !data && (
          <div className="flex flex-col items-center justify-center py-28 text-gray-600 text-center">
            <GitCompare size={36} className="mb-3 opacity-20" />
            <h4 className="text-xs font-black uppercase tracking-tighter text-white">Comparison Matrix</h4>
            <p className="text-[10px] font-mono max-w-sm mt-1.5">
              Select 2+ papers in the sidebar, then generate.
            </p>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-6">
            {/* Similarities & Differences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-white/10 bg-black">
                <h3 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Similarities
                </h3>
                <ul className="space-y-2 text-xs text-gray-300">
                  {data.similarities.map((item, i) => (
                    <li key={`similarity-${i}`} className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                  {data.similarities.length === 0 && <li className="text-gray-600 font-mono text-[10px]">None identified.</li>}
                </ul>
              </div>

              <div className="p-4 border border-white/10 bg-black">
                <h3 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <GitCompare size={14} /> Differences
                </h3>
                <ul className="space-y-2 text-xs text-gray-300">
                  {data.differences.map((item, i) => (
                    <li key={`difference-${i}`} className="flex items-start gap-1.5 leading-relaxed">
                      <span className="text-indigo-400 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                  {data.differences.length === 0 && <li className="text-gray-600 font-mono text-[10px]">None identified.</li>}
                </ul>
              </div>
            </div>

            {/* Strengths & Weaknesses Matrix */}
            {/* Strengths & Weaknesses Matrix */}
            <div className="p-4 border border-white/10 bg-black">
              <h3 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Sparkles size={14} /> Evaluation
              </h3>
              
              <div className="space-y-4">
                {Object.keys(data.strengths).map((paperTitle, idx) => (
                  <div key={`paper-eval-${idx}`} className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                    <h4 className="text-xs font-black text-white mb-2 leading-snug truncate uppercase tracking-tight">{paperTitle}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Strengths</span>
                        <ul className="space-y-1.5 text-xs text-gray-400 mt-1.5 pl-1.5">
                          {data.strengths[paperTitle]?.map((str, i) => (
                            <li key={`strength-${idx}-${i}`} className="flex items-start gap-1.5 leading-relaxed">
                              <span className="text-emerald-500">•</span>
                              <span>{str}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Limitations</span>
                        <ul className="space-y-1.5 text-xs text-gray-400 mt-1.5 pl-1.5">
                          {data.weaknesses[paperTitle]?.map((weak, i) => (
                            <li key={`weakness-${idx}-${i}`} className="flex items-start gap-1.5 leading-relaxed">
                              <span className="text-rose-500">•</span>
                              <span>{weak}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Research Gaps */}
            <div className="p-4 border border-white/10 bg-black">
              <h3 className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Lightbulb size={14} /> Research Gaps
              </h3>
              <ul className="space-y-2 text-xs text-gray-300">
                {data.research_gaps.map((gap, i) => (
                  <li key={`gap-${i}`} className="flex items-start gap-1.5 leading-relaxed">
                    <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>{gap}</span>
                  </li>
                ))}
                {data.research_gaps.length === 0 && <li className="text-gray-600 font-mono text-[10px]">None identified.</li>}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
