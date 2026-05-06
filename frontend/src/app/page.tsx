"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Compass, ArrowRight, User as UserIcon, LogOut, History, Trash2 } from "lucide-react";
import Matchmaker from "../components/Matchmaker";
import Navigator from "../components/Navigator";
import Auth from "../components/Auth";
import ModelSelector from "../components/ModelSelector";

export default function Home() {
  const [user, setUser] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: "assistant", content: "Hello! I'm your Lighthouse Navigator. Where are you dreaming of going, and who's coming with you?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [savedTripView, setSavedTripView] = useState<any>(null);
  
  const [state, setState] = useState({
    username: null as string | null,
    user_dna: { hard_nos: [], soft_likes: [], past_footprints: [] },
    trip_context: { destination: null, dates: null, budget: null, group_size: null, status_flags: [] },
    is_brief_complete: false
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!state.is_brief_complete && user) {
      scrollToBottom();
    }
  }, [messages, state.is_brief_complete, user]);

  const handleLogin = async (username: string) => {
    setUser(username);
    try {
      const res = await fetch(`/api/users/${username}`);
      const data = await res.json();
      setUserData(data);
      setState(prev => ({
        ...prev,
        username,
        user_dna: data.user_dna || prev.user_dna
      }));
    } catch (e) {
      console.error("Login fetch error:", e);
      setUser(username);
      setState(prev => ({ ...prev, username }));
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUserData(null);
    setSelectedDestination(null);
    setSavedTripView(null);
    setShowHistory(false);
    setMessages([{ role: "assistant", content: "Hello! I'm your Lighthouse Navigator. Where are you dreaming of going, and who's coming with you?" }]);
    setState({
      username: null,
      user_dna: { hard_nos: [], soft_likes: [], past_footprints: [] },
      trip_context: { destination: null, dates: null, budget: null, group_size: null, status_flags: [] },
      is_brief_complete: false
    });
  };

  const resetPreferences = async () => {
    if (!user || user === "Guest") return;
    if (!confirm("Are you sure you want to delete all your preferences?")) return;
    
    try {
      await fetch(`/api/users/${user}/dna`, { method: "DELETE" });
      setState(prev => ({ ...prev, user_dna: { hard_nos: [], soft_likes: [], past_footprints: [] } }));
      alert("Preferences reset!");
    } catch (e) {
      console.error("Reset DNA error:", e);
    }
  };

  const deleteTrip = async (tripId: string) => {
    if (!user) return;
    try {
      await fetch(`/api/users/${user}/trips/${tripId}`, { method: "DELETE" });
      setUserData((prev: any) => ({
        ...prev,
        saved_trips: prev.saved_trips.filter((t: any) => t.id !== tripId)
      }));
    } catch (e) {
      console.error("Delete trip error:", e);
    }
  };

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
          chat_history: messages,
          model_name: selectedModel
        })
      });

      if (!response.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: "⚠️ The server is temporarily unavailable. Please try again or switch models." }]);
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
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection error. Please retry." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Global Status Bar */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleLogout()}>
              <Compass className="w-6 h-6 text-emerald-400" />
              <span className="font-semibold text-lg tracking-tight hidden xs:block">Lighthouse</span>
            </div>
            
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-neutral-800 rounded-full border border-neutral-700 text-xs shrink-0">
              <UserIcon className="w-3 h-3 text-emerald-400" />
              <span className="text-neutral-300">{user}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <ModelSelector selectedModel={selectedModel} onSelect={setSelectedModel} />
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-lg transition-colors ${showHistory ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-neutral-800 text-neutral-400"}`}
                title="Saved Trips"
              >
                <History className="w-5 h-5" />
              </button>
              
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 top-[73px] z-40 bg-neutral-950/80 backdrop-blur-sm p-6"
          >
            <div className="max-w-4xl mx-auto bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
                <h2 className="text-xl font-bold">Your Saved Journeys</h2>
                <button onClick={() => setShowHistory(false)} className="text-neutral-500 hover:text-white">Close</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 grid gap-4 grid-cols-1 md:grid-cols-2">
                {userData?.saved_trips?.length > 0 ? (
                  userData.saved_trips.map((trip: any) => (
                    <div key={trip.id} className="p-4 rounded-2xl bg-neutral-800 border border-neutral-700 flex flex-col gap-3 group">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-neutral-100">{trip.trip_title}</h3>
                          <p className="text-xs text-neutral-500 uppercase tracking-widest">{trip.total_days} Days</p>
                        </div>
                        <button onClick={() => deleteTrip(trip.id)} className="opacity-0 group-hover:opacity-100 p-2 text-neutral-500 hover:text-red-400 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          setSavedTripView(trip);
                          setShowHistory(false);
                          setSelectedDestination({ name: trip.trip_title });
                        }}
                        className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg transition-all text-sm font-medium"
                      >
                        Open Journey
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center text-neutral-500">
                    No saved trips yet.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      {selectedDestination || savedTripView ? (
        <Navigator 
          state={state} 
          destination={selectedDestination} 
          savedTripData={savedTripView} 
          selectedModel={selectedModel}
          onSaveTrip={(trip) => {
            setUserData((prev: any) => ({
              ...prev,
              saved_trips: [...(prev?.saved_trips || []), trip]
            }));
          }}
        />
      ) : state.is_brief_complete ? (
        <Matchmaker state={state} selectedModel={selectedModel} onSelectDestination={(dest) => setSelectedDestination(dest)} />
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
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
          <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent p-4 md:p-8 z-30">
            <div className="max-w-3xl mx-auto">
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
