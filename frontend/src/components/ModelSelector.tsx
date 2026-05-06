"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Cpu, ChevronDown, Zap, Shield, Sparkles, Activity } from "lucide-react";
import { useState } from "react";

const MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", icon: Shield, desc: "Default Powerhouse", color: "text-purple-400" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", icon: Activity, desc: "High Efficiency", color: "text-orange-400" }
];




export default function ModelSelector({ selectedModel, onSelect }: { selectedModel: string, onSelect: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const current = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl hover:border-neutral-500 transition-all group"
      >
        <current.icon className={`w-4 h-4 ${current.color}`} />
        <div className="text-left hidden sm:block">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold leading-none mb-1">Model</p>
          <p className="text-xs font-bold text-neutral-100 leading-none">{current.name}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden z-[100]"
          >
            <div className="p-2 grid gap-1">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelect(m.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all ${selectedModel === m.id ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-neutral-800 border border-transparent"}`}
                >
                  <m.icon className={`w-5 h-5 shrink-0 mt-0.5 ${m.color}`} />
                  <div className="text-left">
                    <p className={`text-sm font-bold ${selectedModel === m.id ? "text-emerald-400" : "text-neutral-100"}`}>{m.name}</p>
                    <p className="text-xs text-neutral-500">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 bg-neutral-950 border-t border-neutral-800">
              <p className="text-[10px] text-neutral-600 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                Select model to bypass local quota limits.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
