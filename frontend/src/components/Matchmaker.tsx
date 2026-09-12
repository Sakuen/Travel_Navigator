import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { MapPin, Loader2, Navigation, RefreshCw } from "lucide-react";

import type { AppState, DestinationCard } from "../types/travel";
import { ApiError, readApiError, refreshAiUsage } from "../lib/api-error";

export default function Matchmaker({ state, selectedModel, onSelectDestination, onEditBrief }: { state: AppState, selectedModel: string, onSelectDestination: (dest: DestinationCard) => void, onEditBrief: () => void }) {
  const [destinations, setDestinations] = useState<DestinationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [notice, setNotice] = useState("");
  const [excluded, setExcluded] = useState<{name: string; reason: string; source?: string}[]>([]);
  const [datesConfirmed, setDatesConfirmed] = useState(false);
  const hasFetched = useRef(false);
  useEffect(() => {
    if (!retryAt) return;
    const interval = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(interval);
  }, [retryAt]);

  const fetchDestinations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRetryAt(0); setSecondsLeft(0);
    try {
      const response = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_state: state, model_name: selectedModel })
      });
      if (!response.ok) {
        throw await readApiError(response);
      }
      const data = await response.json();
      setDestinations(data.destinations);
      setNotice(data.notice || "");
      setExcluded(data.excluded || []);
      setDatesConfirmed(data.dates_confirmed);
    } catch (error) {
      console.error("Error fetching destinations:", error);
      setError(error instanceof Error ? error.message : "Could not find destinations.");
      if (error instanceof ApiError && error.failure.retry_after_seconds) {
        setRetryAt(Date.now() + error.failure.retry_after_seconds * 1000);
        setSecondsLeft(error.failure.retry_after_seconds);
      }
    } finally {
      setLoading(false);
      refreshAiUsage();
    }
  }, [state, selectedModel]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchDestinations();
  }, [fetchDestinations]);


  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
        <h2 className="text-2xl font-bold tracking-tight text-neutral-100">Consulting the Compass...</h2>
        <p className="text-neutral-400 mt-2">Matching your history and checking seasonal weather and local events…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-neutral-950">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6">
          <Navigation className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-100">Something went wrong</h2>
        <p className="text-neutral-400 mt-2 max-w-md">
          {error}
        </p>
        <button 
          onClick={fetchDestinations}
          disabled={secondsLeft > 0}
          className="mt-8 px-8 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-xl transition-all border border-neutral-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {secondsLeft > 0 ? `Retry in ${secondsLeft}s` : "Try Again"}
        </button>
        <button onClick={onEditBrief} className="mt-4 text-emerald-300 underline">Review my brief</button>
        <a href="https://aistudio.google.com/usage?tab=rate-limit" target="_blank" rel="noreferrer" className="mt-3 text-sm text-neutral-400 underline">Check Gemini limits in AI Studio</a>
      </div>
    );
  }


  return (
    <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-100">Your Tailored Matches</h2>
        <p className="text-neutral-400 mt-2 text-lg">Inspired by your experiences, assessed for your travel period.</p>
        <button onClick={onEditBrief} className="text-emerald-400 mt-3 underline">Edit dates and preferences</button>
        <p className="text-sm text-neutral-400 mt-4">{notice}</p>
        {!datesConfirmed && <p className="text-amber-300 text-sm mt-2">Confirm exact dates and year to check holiday overlaps. These matches are provisional.</p>}
        {excluded.length > 0 && <details className="mt-4 text-sm text-orange-300"><summary>Why some destinations were excluded</summary>{excluded.map((item, i) => <p className="mt-2" key={i}><strong>{item.name}:</strong> {item.reason} {item.source && <a href={item.source} target="_blank" rel="noreferrer" className="underline">Source</a>}</p>)}</details>}
        {destinations.length === 0 && <p className="py-8">No suitable matches for this brief. Try different dates or preferences.</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8">
        {destinations.map((dest, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.15 }}
            key={dest.id}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl group flex flex-col relative"
          >
            <div className="h-48 md:h-56 bg-neutral-800 relative overflow-hidden">
              <img 
                src={`https://loremflickr.com/800/600/${encodeURIComponent(dest.image_url)}?lock=${idx + 1}`} 
                alt={dest.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { e.currentTarget.src = `https://picsum.photos/800/600?random=${idx + 1}` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent opacity-80" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  {dest.name}
                </h3>
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div className="flex flex-wrap gap-2 mb-4">
                {dest.tags.map((tag: string) => (
                  <span key={tag} className="px-2 py-1 bg-neutral-800 rounded-md text-xs font-medium text-neutral-300 border border-neutral-700">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">The Why</h4>
                  <p className="text-neutral-300 text-sm leading-relaxed">{dest.the_why}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">The But</h4>
                  <p className="text-neutral-400 text-sm leading-relaxed italic">{dest.the_but}</p>
                </div>
                {dest.history_reason && <div><h4 className="text-xs font-bold text-emerald-400 mb-1">From your travels</h4><p className="text-sm text-neutral-300">{dest.history_reason}</p></div>}
                <div className="border-t border-neutral-800 pt-4"><h4 className="text-xs font-bold text-blue-300 mb-1">Weather for your visit</h4><p className="text-sm text-neutral-400">{dest.weather_note || "Weather suitability still needs checking."}</p></div>
                <div><h4 className="text-xs font-bold text-orange-300 mb-1">Holidays, events & timing</h4><p className="text-sm text-neutral-400">{dest.timing_note || "Local dates and events still need checking."}</p></div>
                <p className="text-xs text-amber-300">{dest.research_status === "sources_found" ? "Sources found · AI assessment" : "Unverified · provisional suggestion"}{dest.checked_at ? ` · ${new Date(dest.checked_at).toLocaleDateString()}` : ""}</p>
                {dest.sources?.map((source: {id: number; url: string; title: string}) => <a className="block text-xs text-blue-300 underline" key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}
              </div>

              <button
                onClick={() => onSelectDestination(dest)}
                className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
              >
                Select Destination
                <Navigation className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
