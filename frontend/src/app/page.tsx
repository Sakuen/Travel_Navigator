"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Compass, ArrowRight, User as UserIcon, LogOut, History, Trash2, Globe, ArrowLeft, Star, MapPin, X } from "lucide-react";
import Matchmaker from "../components/Matchmaker";
import Navigator from "../components/Navigator";
import Auth from "../components/Auth";
import ModelSelector from "../components/ModelSelector";
import PastTripsView from "../components/PastTripsView";

export default function Home() {
  const [user, setUser] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [currentView, setCurrentView] = useState<"chat" | "past-trips" | "itinerary">("chat");
  
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
    past_trips: [] as any[],
    is_brief_complete: false
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (currentView === "chat" && !state.is_brief_complete && user) {
      scrollToBottom();
    }
  }, [messages, state.is_brief_complete, user, currentView]);

  const refreshUserData = async (username: string) => {
    try {
      const res = await fetch(`/api/users/${username}`);
      const data = await res.json();
      setUserData(data);
      setState(prev => ({
        ...prev,
        username,
        user_dna: data.user_dna || prev.user_dna,
        past_trips: data.past_trips || []
      }));
    } catch (e) {
      console.error("User fetch error:", e);
    }
  };

  const handleLogin = async (username: string) => {
    setUser(username);
    await refreshUserData(username);
  };

  const handleLogout = () => {
    setUser(null);
    setUserData(null);
    setSelectedDestination(null);
    setSavedTripView(null);
    setShowHistory(false);
    setCurrentView("chat");
    setMessages([{ role: "assistant", content: "Hello! I'm your Lighthouse Navigator. Where are you dreaming of going, and who's coming with you?" }]);
    setState({
      username: null,
      user_dna: { hard_nos: [], soft_likes: [], past_footprints: [] },
      trip_context: { destination: null, dates: null, budget: null, group_size: null, status_flags: [] },
      past_trips: [],
      is_brief_complete: false
    });
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
        setMessages(prev => [...prev, { role: "assistant", content: "⚠️ The server is temporarily unavailable. Please retry." }]);
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
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection error." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-8 shrink-0">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setCurrentView("chat"); setSelectedDestination(null); setSavedTripView(null); }}>
              <Compass className="w-6 h-6 text-emerald-400 group-hover:rotate-45 transition-transform" />
              <span className="font-bold text-lg tracking-tight hidden xs:block">Lighthouse</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-1 bg-neutral-800/50 p-1 rounded-xl border border-neutral-700/50">
              <button 
                onClick={() => { setCurrentView("chat"); setSelectedDestination(null); setSavedTripView(null); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === "chat" ? "bg-emerald-500 text-white shadow-lg" : "text-neutral-400 hover:text-white"}`}
              >
                Chat
              </button>
              <button 
                onClick={() => setCurrentView("past-trips")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === "past-trips" ? "bg-emerald-500 text-white shadow-lg" : "text-neutral-400 hover:text-white"}`}
              >
                My Travels
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <ModelSelector selectedModel={selectedModel} onSelect={setSelectedModel} />
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 border-l border-neutral-800 pl-4 ml-2">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-xl transition-all ${showHistory ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-neutral-800 text-neutral-400"}`}
                title="Future Plans"
              >
                <History className="w-5 h-5" />
              </button>
              
              <button 
                onClick={handleLogout}
                className="p-2 rounded-xl hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-all"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* History Overlay (Future Plans) */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 top-[73px] z-40 bg-neutral-950/80 backdrop-blur-sm p-6"
            onClick={() => setShowHistory(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="max-w-4xl mx-auto bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  Your Future Plans
                </h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 grid gap-4 grid-cols-1 md:grid-cols-2">
                {userData?.saved_trips?.length > 0 ? (
                  userData.saved_trips.map((trip: any) => (
                    <div key={trip.id} className="p-4 rounded-2xl bg-neutral-800/50 border border-neutral-700/50 hover:border-emerald-500/30 flex flex-col gap-3 group transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-neutral-100">{trip.trip_title}</h3>
                          <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">{trip.total_days} Days</p>
                        </div>
                        <button onClick={() => {
                          fetch(`/api/users/${user}/trips/${trip.id}`, { method: "DELETE" }).then(() => refreshUserData(user!));
                        }} className="opacity-0 group-hover:opacity-100 p-2 text-neutral-500 hover:text-red-400 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          setSavedTripView(trip);
                          setShowHistory(false);
                          setSelectedDestination({ name: trip.trip_title });
                          setCurrentView("itinerary");
                        }}
                        className="w-full py-2 bg-emerald-500 text-white rounded-xl shadow-lg hover:bg-emerald-400 transition-all text-xs font-bold"
                      >
                        Open Itinerary
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center text-neutral-500 text-sm">
                    No itineraries saved yet. Start a chat to build one!
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {currentView === "past-trips" ? (
            <motion.div key="past" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="absolute inset-0">
              <PastTripsView username={user!} pastTrips={userData?.past_trips || []} onUpdate={() => refreshUserData(user!)} />
            </motion.div>
          ) : (selectedDestination || savedTripView) ? (
            <motion.div key="itinerary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0">
              <Navigator 
                state={state} 
                destination={selectedDestination} 
                savedTripData={savedTripView} 
                selectedModel={selectedModel}
                onSaveTrip={() => refreshUserData(user!)}
              />
              <button 
                onClick={() => { setSelectedDestination(null); setSavedTripView(null); setCurrentView("chat"); }}
                className="fixed bottom-8 left-8 p-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-neutral-400 hover:text-white shadow-2xl z-50 flex items-center gap-2 text-sm font-bold"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Search
              </button>
            </motion.div>
          ) : state.is_brief_complete ? (
            <motion.div key="match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 overflow-y-auto">
              <Matchmaker state={state} selectedModel={selectedModel} onSelectDestination={(dest) => { setSelectedDestination(dest); setCurrentView("itinerary"); }} />
            </motion.div>
          ) : (
            <motion.main key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 flex flex-col h-full relative">
              {/* Progress Tags */}
              <div className="flex flex-wrap gap-2 mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
                {state.user_dna.soft_likes.map((like, i) => (
                  <span key={`like-${i}`} className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-current" /> {like}
                  </span>
                ))}
                {state.trip_context.destination && (
                  <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" /> {state.trip_context.destination}
                  </span>
                )}
                {state.trip_context.budget && (
                  <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    $ {state.trip_context.budget}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pb-28 scroll-smooth hide-scrollbar">
                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-3xl px-6 py-4 shadow-sm ${
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
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent p-4 md:p-8">
                <div className="max-w-3xl mx-auto">
                  <form onSubmit={handleSubmit} className="relative group">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Start planning your next adventure..."
                      className="w-full bg-neutral-900 border border-neutral-700 focus:border-emerald-500/50 rounded-2xl px-6 py-4 pr-14 outline-none transition-all shadow-xl text-neutral-100 placeholder:text-neutral-500 text-sm"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </motion.main>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

