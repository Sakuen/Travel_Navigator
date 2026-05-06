"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Compass, ArrowRight } from "lucide-react";
import Matchmaker from "../components/Matchmaker";
import Navigator from "../components/Navigator";

export default function Home() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: "assistant", content: "Hello! I'm your Lighthouse Navigator. Where are you dreaming of going, and who's coming with you?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  
  const [state, setState] = useState({
    user_dna: { hard_nos: [], soft_likes: [], past_footprints: [] },
    trip_context: { destination: null, dates: null, budget: null, group_size: null, status_flags: [] },
    is_brief_complete: false
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!state.is_brief_complete) {
      scrollToBottom();
    }
  }, [messages, state.is_brief_complete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          current_state: state,
          chat_history: messages
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", response.status, errorText);
        setMessages(prev => [...prev, { role: "assistant", content: "⚠️ The server is temporarily unavailable (it may be overloaded or the API quota has been exceeded). Please wait a moment and try again." }]);
        return;
      }

      const data = await response.json();
      
      if (data.state_updates) {
        setState(prev => ({
          ...prev,
          user_dna: data.state_updates.user_dna || prev.user_dna,
          trip_context: data.state_updates.trip_context || prev.trip_context,
          is_brief_complete: data.state_updates.is_brief_complete
        }));
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.response_message }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Could not reach the server. Please make sure the backend is running and try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDestinationSelect = (dest: any) => {
    console.log("Selected destination:", dest);
    setSelectedDestination(dest);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Global Status Bar */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10 px-6 py-4 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-400" />
            <span className="font-semibold text-lg tracking-tight">Lighthouse</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <AnimatePresence>
              {state.trip_context.status_flags?.map((flag: string) => (
                <motion.div
                  key={flag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-3 py-1 bg-neutral-800 rounded-full text-xs font-medium border border-neutral-700 shadow-sm flex items-center gap-1 text-emerald-300"
                >
                  {flag}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </header>

        {/* Main Content Area */}
      {selectedDestination ? (
        <Navigator state={state} destination={selectedDestination} />
      ) : state.is_brief_complete ? (
        <Matchmaker state={state} onSelectDestination={handleDestinationSelect} />
      ) : (
        <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 flex flex-col relative">
          <div className="flex-1 space-y-6 pb-28">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-3xl px-6 py-4 shadow-sm ${
                      msg.role === "user"
                        ? "bg-emerald-600/20 text-emerald-100 border border-emerald-500/30 rounded-br-none"
                        : "bg-neutral-800 border border-neutral-700 rounded-bl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-neutral-800 border border-neutral-700 rounded-3xl rounded-bl-none px-6 py-5 flex gap-1 items-center shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
              {messages.length > 2 && !state.is_brief_complete && (
                <div className="flex justify-end mb-4">
                  <button 
                    onClick={() => setState(prev => ({ ...prev, is_brief_complete: true }))}
                    className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-4 py-2 rounded-full transition-colors flex items-center gap-2 border border-neutral-700 shadow-lg"
                  >
                    Skip to Destinations
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSubmit} className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Where to? (e.g., 'A warm beach without tourists')"
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-emerald-500/50 rounded-2xl px-6 py-4 pr-14 outline-none transition-all shadow-xl text-neutral-100 placeholder:text-neutral-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
