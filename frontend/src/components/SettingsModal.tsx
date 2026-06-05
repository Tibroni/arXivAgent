'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Settings, Cpu, LineChart } from 'lucide-react';
import type { ServerKeyStatus } from '@/lib/keys';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  serverKeyStatus: ServerKeyStatus;
}

export default function SettingsModal({ isOpen, onClose, onSave, serverKeyStatus }: SettingsModalProps) {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [langsmithKey, setLangsmithKey] = useState('');
  const [langsmithProject, setLangsmithProject] = useState('arXivAgent');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOpenaiKey(localStorage.getItem('openai_key') || '');
      setGeminiKey(localStorage.getItem('gemini_key') || '');
      setLangsmithKey(localStorage.getItem('langsmith_key') || '');
      setLangsmithProject(localStorage.getItem('langsmith_project') || 'arXivAgent');
      setOpenaiModel(localStorage.getItem('openai_model') || 'gpt-4o-mini');
      setGeminiModel(localStorage.getItem('gemini_model') || 'gemini-1.5-flash');
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('openai_key', openaiKey);
    localStorage.setItem('gemini_key', geminiKey);
    localStorage.setItem('langsmith_key', langsmithKey);
    localStorage.setItem('langsmith_project', langsmithProject);
    localStorage.setItem('openai_model', openaiModel);
    localStorage.setItem('gemini_model', geminiModel);
    onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-[92%] sm:w-full max-w-lg rounded-2xl p-6 relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Settings className="text-indigo-400" size={24} />
          <h2 className="text-xl font-bold text-slate-100">Configuration Settings</h2>
        </div>

        <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-1">
          {serverKeyStatus.demoMode && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Demo mode is active. Server-managed API keys are already configured, so visitors can try the platform without entering their own keys. You can still add personal keys below to override the demo credentials.
            </div>
          )}

          {/* API Keys Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-1.5 border-b border-slate-800 pb-1">
              <Key size={16} /> API Credentials {serverKeyStatus.demoMode ? '(Optional)' : ''}
            </h3>
            
            <div className="space-y-2">
              <label className="text-xs text-slate-400">OpenAI API Key (Required for vector embedding generation)</label>
              <input 
                type="password" 
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..." 
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400">Gemini API Key (Preferred for agent execution)</label>
              <input 
                type="password" 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..." 
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Model Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-1.5 border-b border-slate-800 pb-1">
              <Cpu size={16} /> LLM Selection
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">OpenAI Model</label>
                <select 
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Faster, cheaper)</option>
                  <option value="gpt-4o">gpt-4o (Stronger reasoning)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Gemini Model</label>
                <select 
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Fast)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (High fidelity)</option>
                </select>
              </div>
            </div>
          </div>

          {/* LangSmith Observability Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-1.5 border-b border-slate-800 pb-1">
              <LineChart size={16} /> LangSmith Observability (Optional)
            </h3>
            
            <div className="space-y-2">
              <label className="text-xs text-slate-400">LangSmith API Key</label>
              <input 
                type="password" 
                value={langsmithKey}
                onChange={(e) => setLangsmithKey(e.target.value)}
                placeholder="lsv2_pt_..." 
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400">LangSmith Project Name</label>
              <input 
                type="text" 
                value={langsmithProject}
                onChange={(e) => setLangsmithProject(e.target.value)}
                placeholder="arXivAgent" 
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-slate-800 pt-4">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 text-sm font-medium transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-100 text-sm font-medium shadow-md shadow-indigo-600/25 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
