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

  const inputClass = "w-full ds-input px-3 py-2 text-sm";
  const labelClass = "text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest";
  const sectionClass = "text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/10 pb-2";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="glass-panel w-[92%] sm:w-full max-w-lg p-6 relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Settings className="text-indigo-400" size={20} />
          <h2 className="text-lg font-black tracking-tighter uppercase text-white">Configuration</h2>
        </div>

        <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-1">
          {serverKeyStatus.demoMode && (
            <div className="border border-indigo-500/30 bg-indigo-600/10 px-4 py-3 text-xs text-indigo-300 font-mono leading-relaxed">
              Demo mode active — server keys are configured. Add personal keys below to override.
            </div>
          )}

          <div className="space-y-4">
            <h3 className={sectionClass}>
              <Key size={14} /> API Credentials {serverKeyStatus.demoMode ? '(Optional)' : ''}
            </h3>
            
            <div className="space-y-2">
              <label className={labelClass}>OpenAI API Key</label>
              <input 
                type="password" 
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..." 
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Gemini API Key</label>
              <input 
                type="password" 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..." 
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className={sectionClass}>
              <Cpu size={14} /> LLM Selection
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>OpenAI Model</label>
                <select 
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className={inputClass}
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Gemini Model</label>
                <select 
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className={inputClass}
                >
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className={sectionClass}>
              <LineChart size={14} /> LangSmith
            </h3>
            
            <div className="space-y-2">
              <label className={labelClass}>LangSmith API Key</label>
              <input 
                type="password" 
                value={langsmithKey}
                onChange={(e) => setLangsmithKey(e.target.value)}
                placeholder="lsv2_pt_..." 
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Project Name</label>
              <input 
                type="text" 
                value={langsmithProject}
                onChange={(e) => setLangsmithProject(e.target.value)}
                placeholder="arXivAgent" 
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 border-t border-white/10 pt-4">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-500 hover:text-white hover:bg-white/5 text-[10px] font-mono font-bold uppercase tracking-widest transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 ds-btn-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
