'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Zap, Library, FileSearch, MessageSquare, Terminal } from 'lucide-react';

interface LandingPageProps {
  onLaunch: () => void;
}

export default function LandingPage({ onLaunch }: LandingPageProps) {
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHoveringInteractive, setIsHoveringInteractive] = useState(false);
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('a') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea')
      ) {
        setIsHoveringInteractive(true);
      } else {
        setIsHoveringInteractive(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  return (
    <div className="min-h-screen w-screen bg-black text-white flex flex-col justify-between overflow-x-hidden relative font-sans selection:bg-indigo-650 selection:text-white md:cursor-none">
      
      {/* Fixed SVG noise grain overlay */}
      <svg className="fixed inset-0 pointer-events-none z-[90] opacity-[0.03] mix-blend-overlay w-full h-full">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      {/* Custom mix-blend-difference cursor */}
      <div 
        className="fixed w-6 h-6 rounded-full bg-indigo-600 pointer-events-none z-[100] mix-blend-difference transition-transform duration-200 ease-out -translate-x-1/2 -translate-y-1/2 hidden md:block"
        style={{
          left: `${mousePos.x}px`,
          top: `${mousePos.y}px`,
          transform: `translate(-50%, -50%) scale(${isHoveringInteractive ? 2.5 : 1})`,
        }}
      />

      {/* Main Hero & Content Grid */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col justify-center pt-24 pb-24 gap-24 z-10">
        
        {/* Simple Project Description */}
        <div className="space-y-6 max-w-5xl mx-auto text-center flex flex-col items-center">
          <span className="font-mono text-xs font-bold tracking-widest text-indigo-400 uppercase block">
            [ Project Description // arXivAgent ]
          </span>

          <h1 className="text-[10vw] sm:text-[8vw] md:text-[7vw] lg:text-[6.5rem] font-black tracking-tighter uppercase leading-[0.85] text-white">
            ARXIV <br />
            RESEARCH PLATFORM
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed font-medium pt-2 mx-auto">
            arXivAgent is a platform for finding, chatting with, and comparing scientific papers. It allows you to search and ingest papers directly from arXiv, ask questions grounded by text-similarity citations, and synthesize comparison tables across multiple documents.
          </p>

          <div className="pt-6">
            <button
              onClick={onLaunch}
              className="bg-indigo-600 text-white rounded-none font-bold px-10 py-5 uppercase tracking-widest text-xs transition-colors duration-300 hover:bg-white hover:text-black cursor-pointer shadow-lg inline-flex items-center gap-3 transform hover:-translate-y-0.5"
            >
              <span>Launch Application</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Feature Cards Grid (Clear explanations) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white/10 pt-20">
          {/* Card 1 */}
          <div className="group rounded-none border border-white/10 bg-black p-10 hover:bg-white hover:text-black transition-all duration-500 flex flex-col justify-between h-72">
            <div className="space-y-6">
              <div className="space-y-3 transition-all duration-300 group-hover:pl-4">
                <h3 className="text-xl font-black tracking-tighter uppercase">
                  Search & Ingest
                </h3>
                <p className="text-xs text-gray-500 group-hover:text-gray-700 leading-relaxed font-semibold">
                  Query the live arXiv repository by keyword or paper ID. Select and import papers directly into your active workspace.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-widest uppercase text-indigo-500 group-hover:text-indigo-650 transition-all group-hover:pl-4">
              <span>Open Search</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* Card 2 */}
          <div className="group rounded-none border border-white/10 bg-black p-10 hover:bg-white hover:text-black transition-all duration-500 flex flex-col justify-between h-72">
            <div className="space-y-6">
              <div className="space-y-3 transition-all duration-300 group-hover:pl-4">
                <h3 className="text-xl font-black tracking-tighter uppercase">
                  Grounded Dialogue
                </h3>
                <p className="text-xs text-gray-500 group-hover:text-gray-700 leading-relaxed font-semibold">
                  Ask questions about your selected papers. The system queries vector passages to ground answers, and lets you view references in a side panel.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-widest uppercase text-indigo-500 group-hover:text-indigo-650 transition-all group-hover:pl-4">
              <span>Open Chat</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* Card 3 */}
          <div className="group rounded-none border border-white/10 bg-black p-10 hover:bg-white hover:text-black transition-all duration-500 flex flex-col justify-between h-72">
            <div className="space-y-6">
              <div className="space-y-3 transition-all duration-300 group-hover:pl-4">
                <h3 className="text-xl font-black tracking-tighter uppercase">
                  Literature Synthesis
                </h3>
                <p className="text-xs text-gray-500 group-hover:text-gray-700 leading-relaxed font-semibold">
                  Synthesize methodologies, results, and research limitations across multiple papers side-by-side using structured comparison matrices.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-widest uppercase text-indigo-500 group-hover:text-indigo-650 transition-all group-hover:pl-4">
              <span>Open Compare</span>
              <ArrowRight size={12} />
            </div>
          </div>
        </div>

        {/* Start interface preview mockup */}
        <div className="w-full rounded-none border border-white/10 bg-black p-6 md:p-8 overflow-hidden relative shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            </div>
            <span className="font-mono text-[9px] text-gray-650 font-bold uppercase tracking-widest">
              WORKSPACE_PREVIEW // SCHEMA_01
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[280px] text-xs">
            {/* Sidebar list mock */}
            <div className="lg:col-span-3 border border-white/10 bg-black p-4 space-y-4 overflow-hidden hidden lg:block">
              <span className="font-mono text-[9px] font-bold text-gray-500 uppercase tracking-widest">Active Workspace</span>
              <div className="space-y-2.5">
                <div className="p-3 bg-white text-black flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold uppercase truncate">causal_heritability.pdf</span>
                  <Library size={10} />
                </div>
                {[1, 2].map((i) => (
                  <div key={i} className="p-3 border border-white/10 flex items-center justify-between opacity-30">
                    <span className="font-mono text-[9px] font-bold uppercase truncate">quantum_lattices.pdf</span>
                    <Library size={10} />
                  </div>
                ))}
              </div>
            </div>

            {/* Chat mock */}
            <div className="lg:col-span-6 border border-white/10 bg-black p-4 flex flex-col justify-between overflow-hidden">
              <div className="space-y-4 flex-1">
                {/* User msg */}
                <div className="flex justify-end">
                  <div className="border border-white/15 bg-black rounded-none px-4 py-2 w-[70%] text-xs font-semibold">
                    Explain the main findings and methodology of the causal heritability paper.
                  </div>
                </div>

                {/* Assistant response */}
                <div className="flex justify-start">
                  <div className="bg-white text-black rounded-none px-4 py-3.5 w-[85%] space-y-2 text-xs">
                    <p className="font-bold leading-relaxed">
                      The paper provides a counterfactual framework to define heritability as a potential outcomes model, addressing the identification problem using Twin Study bounds
                      <span className="inline-block px-1 py-0.2 ml-1 text-[8px] font-mono font-bold bg-black text-white border border-black rounded">
                        [1]
                      </span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Input mock */}
              <div className="flex gap-2 border-t border-white/10 pt-4 mt-2">
                <div className="flex-1 bg-black border border-white/15 h-10 px-3 flex items-center">
                  <span className="font-mono text-[9px] text-gray-650 font-bold uppercase tracking-wider">Ask a research question...</span>
                </div>
                <div className="w-10 h-10 bg-indigo-600 flex items-center justify-center text-white animate-pulse">
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>

            {/* Citations panel mock */}
            <div className="lg:col-span-3 border border-white/10 bg-black p-4 space-y-4 overflow-hidden hidden lg:block">
              <span className="font-mono text-[9px] font-bold text-gray-500 uppercase tracking-widest">Active Citations</span>
              <div className="p-3 border border-white/15 bg-white/5 space-y-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-1">
                  <span className="text-[8px] font-mono font-bold bg-indigo-650 text-white px-1.5 py-0.5 rounded">Citation [1]</span>
                  <span className="text-[8px] font-mono font-bold text-gray-400">Score: 0.9412</span>
                </div>
                <div className="font-mono text-[8px] text-gray-500 leading-normal line-clamp-4">
                  "Because we cannot observe both potential outcomes for a single individual, counterfactual heritability remains only partially identifiable and must be bounded..."
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 py-8 text-center z-10 shrink-0 font-mono text-[10px] text-gray-600 font-bold uppercase tracking-widest">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>arXivAgent Platform // Ingest and chat with scientific literature.</span>
          <div className="flex items-center gap-3">
            <span>[ Qdrant Vector Storage ]</span>
            <span>•</span>
            <span>[ LangGraph Routing ]</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
