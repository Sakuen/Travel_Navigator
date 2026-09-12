"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Map, Marker, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Clock, Navigation2, RefreshCw, Loader2, ArrowLeft, Calendar, AlertCircle } from "lucide-react";

import type { AppState, Destination, SavedTrip, DailySummary, DailyItinerary, Activity } from "../types/travel";
import { readApiError, refreshAiUsage } from "../lib/api-error";

export default function Navigator({ state, destination, savedTripData, selectedModel, onSaveTrip }: { state: AppState, destination: Destination, savedTripData?: SavedTrip | null, selectedModel: string, onSaveTrip?: (trip: SavedTrip) => void }) {
  const [overview, setOverview] = useState<SavedTrip | null>(savedTripData || null);
  const [selectedDay, setSelectedDay] = useState<DailySummary | null>(null);
  const [dayDetail, setDayDetail] = useState<DailyItinerary | null>(null);
  const [loading, setLoading] = useState(!savedTripData);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(!!savedTripData);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dailyDetails, setDailyDetails] = useState<Record<string, DailyItinerary>>(savedTripData?.daily_details || {});
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(savedTripData?.status || "draft");
  const [completing, setCompleting] = useState(false);
  const [completion, setCompletion] = useState({ year: new Date().getFullYear(), countries: "", rating: "", notes: "", liked: "", disliked: "" });
  const detailRequest = useRef(0);
  const tripState = { ...state, trip_context: savedTripData?.trip_context || state.trip_context };
  const tripDestination = savedTripData?.destination || destination;
  
  const [viewState, setViewState] = useState({
    longitude: savedTripData?.daily_summaries?.[0]?.lng || 0,
    latitude: savedTripData?.daily_summaries?.[0]?.lat || 0,
    zoom: 11
  });
  
  const hasFetched = useRef(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_state: state, destination, model_name: selectedModel })
      });
      if (!response.ok) throw await readApiError(response);
      const data = await response.json();
      
      if (!data.daily_summaries || data.daily_summaries.length === 0) {
        throw new Error("No daily plans were generated. Please retry.");
      }

      setOverview({ ...data, id: crypto.randomUUID(), revision: 0 });
      if (data.daily_summaries?.[0]) {
        setViewState({
          longitude: data.daily_summaries[0].lng,
          latitude: data.daily_summaries[0].lat,
          zoom: 10
        });
      }
    } catch (error) {
      console.error("Error fetching overview:", error);
      setError(error instanceof Error ? error.message : "Could not create plan.");
    } finally {
      setLoading(false);
      refreshAiUsage();
    }
  }, [state, destination, selectedModel, setViewState]);

  useEffect(() => {
    if (savedTripData) return;
    
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchOverview();
  }, [savedTripData, fetchOverview]);

  const handleDaySelect = async (day: DailySummary) => {
    if (isSaving) return;
    const requestId = ++detailRequest.current;
    setSelectedDay(day);
    setDetailError(null);
    setViewState({
      longitude: day.lng,
      latitude: day.lat,
      zoom: 13
    });
    
    if (dailyDetails[String(day.day_number)]) {
      setDayDetail(dailyDetails[String(day.day_number)]);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setDayDetail(null);
    try {
      const response = await fetch("/api/itinerary/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_state: tripState, destination: tripDestination, day_number: day.day_number,
          model_name: selectedModel, overview, existing_days: dailyDetails })
      });
      if (!response.ok) throw await readApiError(response);
      const data = await response.json();
      if (requestId !== detailRequest.current) return;
      if (!data.items?.length) throw new Error("No activities were generated. Please retry this day.");
      setDailyDetails(prev => ({ ...prev, [String(day.day_number)]: data }));
      setDayDetail(data);
      setIsSaved(false);
    } catch (error) {
      console.error("Error fetching day detail:", error);
      if (requestId === detailRequest.current) setDetailError(error instanceof Error ? error.message : "Could not load this day.");
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
      refreshAiUsage();
    }
  };

  const updateDay = (items: Activity[]) => {
    if (!dayDetail || !selectedDay) return;
    const updated = { ...dayDetail, items };
    setDayDetail(updated);
    setDailyDetails(prev => ({ ...prev, [String(selectedDay.day_number)]: updated }));
    setIsSaved(false);
  };

  const saveTrip = async () => {
    if (!overview) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/users/${state.username}/trips`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: state.username, trip: { ...overview,
          destination: tripDestination, trip_context: tripState.trip_context,
          daily_details: dailyDetails, status } })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Could not save this trip. Your edits are still here.");
      setOverview(data.trip);
      setIsSaved(true);
      onSaveTrip?.(data.trip);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save trip.");
    } finally { setIsSaving(false); }
  };

  const completeTrip = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!overview) return;
    setIsSaving(true); setSaveError(null);
    try {
      const response = await fetch(`/api/users/${state.username}/trips/${overview.id}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: state.username, revision: overview.revision,
          trip: { id: overview.id, title: overview.trip_title, year: completion.year,
            countries: completion.countries.split(",").map(s => s.trim()).filter(Boolean),
            rating: Number(completion.rating), notes: completion.notes,
            liked: completion.liked.split("\n").map(s => s.trim()).filter(Boolean),
            disliked: completion.disliked.split("\n").map(s => s.trim()).filter(Boolean), stops: [] } })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Could not complete this trip.");
      setOverview(data.trip); setStatus("completed"); setIsSaved(true); setCompleting(false);
      onSaveTrip?.(data.trip);
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Could not complete trip."); }
    finally { setIsSaving(false); }
  };

  const routeData = useMemo(() => {
    if (selectedDay && dayDetail?.items) {
      return {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: dayDetail.items.map((i: Activity) => [i.lng, i.lat])
        }
      };
    } else if (overview?.daily_summaries) {
      return {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: overview.daily_summaries.map((d: DailySummary) => [d.lng, d.lat])
        }
      };
    }
    return null;
  }, [selectedDay, dayDetail, overview]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] bg-neutral-950">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-neutral-100">Drafting the Big Picture...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] bg-neutral-950 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-neutral-100">Generation Failed</h2>
        <p className="text-neutral-400 mt-2">{error}</p>
        <button onClick={fetchOverview} className="mt-6 px-6 py-2 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-all flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!overview) return null;

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const destName = destination?.name || overview.trip_title;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-neutral-950">
      {/* Sidebar - Fixed width on desktop */}
      <div className="w-full md:w-[450px] lg:w-[500px] h-full overflow-y-auto border-r border-neutral-800 p-6 relative bg-neutral-950 z-20 shadow-2xl shrink-0">
        <div className="sticky top-0 z-30 bg-neutral-950 pb-4 mb-4 border-b border-neutral-800">
          <div className="flex flex-wrap gap-2">
            <button onClick={saveTrip} disabled={isSaving || detailLoading} className="px-4 py-2 bg-emerald-600 rounded-xl text-sm font-bold disabled:opacity-50">{isSaving ? "Saving…" : isSaved ? "Saved" : "Save trip"}</button>
            <button disabled={isSaving} onClick={() => setEditing(!editing)} className="px-4 py-2 bg-neutral-800 rounded-xl text-sm">{editing ? "Done editing" : "Edit plan"}</button>
            <select aria-label="Trip status" disabled={isSaving || status === "completed"} value={status} onChange={e => { setStatus(e.target.value); setIsSaved(false); }} className="bg-neutral-800 rounded-xl p-2 text-xs"><option value="draft">Draft</option><option value="planned">Planned</option><option value="in_progress">Travelling</option>{status === "completed" && <option value="completed">Completed</option>}</select>
            {status !== "completed" && <button disabled={isSaving || (!isSaved && !savedTripData) || detailLoading} onClick={() => setCompleting(!completing)} className="text-xs text-emerald-300 underline disabled:opacity-40">Record completed trip</button>}
          </div>
          <p className="text-xs text-neutral-500 mt-2">{Object.keys(dailyDetails).length} of {overview.total_days} days detailed. Save after making changes.</p>
          {saveError && <p role="alert" className="text-red-400 text-sm mt-2">{saveError}</p>}
          {status === "completed" && <p className="text-xs text-emerald-300 mt-2">Your feedback is in My Travels and will inform future matches.</p>}
        </div>
        {completing && <form onSubmit={completeTrip} className="mb-6 p-4 bg-neutral-900 rounded-2xl space-y-3 text-sm">
          <h3 className="text-lg font-bold">How was your trip?</h3><p className="text-neutral-400 text-xs">Record what actually happened. Add stops and more memories in My Travels. Save plan edits before completing.</p>
          <label className="block">Year<input required type="number" value={completion.year} onChange={e => setCompletion({ ...completion, year: Number(e.target.value) })} className="w-full p-2 bg-neutral-800 rounded-lg" /></label>
          <label className="block">Countries visited<input required value={completion.countries} onChange={e => setCompletion({ ...completion, countries: e.target.value })} placeholder="Italy, France" className="w-full p-2 bg-neutral-800 rounded-lg" /></label>
          <label className="block">Rating<select required value={completion.rating} onChange={e => setCompletion({ ...completion, rating: e.target.value })} className="w-full p-2 bg-neutral-800 rounded-lg"><option value="">Choose a rating</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>
          {(["notes", "liked", "disliked"] as const).map(field => <label className="block" key={field}>{field === "notes" ? "Stories & memories" : field === "liked" ? "What we loved (one per line)" : "What we’d avoid (one per line)"}<textarea value={completion[field]} onChange={e => setCompletion({ ...completion, [field]: e.target.value })} className="w-full p-2 bg-neutral-800 rounded-lg" /></label>)}
          <button disabled={isSaving || !isSaved} className="bg-emerald-600 px-4 py-2 rounded-lg disabled:opacity-40">Add to My Travels</button><button type="button" className="ml-3 text-neutral-400" onClick={() => setCompleting(false)}>Cancel</button>
          {!isSaved && <p className="text-amber-300 text-xs">Save your plan above before completing the trip.</p>}
        </form>}
        <AnimatePresence mode="wait">
          {!selectedDay ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 pb-12"
            >
              <div className="flex justify-between items-start">
                <div className="max-w-[70%]">
                  {editing ? <input aria-label="Trip title" disabled={isSaving} className="w-full bg-neutral-800 rounded-xl p-2 text-xl" value={overview.trip_title} onChange={e => { setOverview({ ...overview, trip_title: e.target.value }); setIsSaved(false); }} /> : <h2 className="text-3xl font-bold tracking-tight text-neutral-100 leading-tight">{overview.trip_title}</h2>}
                  <p className="text-emerald-400 mt-2 text-lg font-medium flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {overview.total_days} Day Journey
                  </p>
                </div>
              </div>
              
              <p className="text-neutral-400 leading-relaxed text-sm bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800/50">{overview.general_summary}</p>

              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  The Journey Breakdown
                </h3>
                {overview.daily_summaries?.map((day: DailySummary) => (
                  <button
                    key={day.day_number}
                    onClick={() => handleDaySelect(day)}
                    className="w-full text-left rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 transition-all group overflow-hidden flex flex-col shadow-sm"
                  >
                    <div className="h-32 w-full relative overflow-hidden bg-neutral-800">
                      <img 
                        src={`https://loremflickr.com/800/600/${encodeURIComponent(destName.split(',')[0])},${encodeURIComponent(day.image_url || 'travel')}/all`} 
                        alt={day.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-60"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent" />
                      <div className="absolute bottom-4 left-5 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                          {day.day_number}
                        </div>
                        <h4 className="font-bold text-white text-lg drop-shadow-md">{day.title}</h4>
                      </div>
                    </div>
                    <div className="p-4 pt-2">
                      <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">{day.summary}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <button 
                onClick={() => {
                  detailRequest.current++;
                  setDetailLoading(false);
                  setSelectedDay(null);
                  setViewState({
                    longitude: overview.daily_summaries[0].lng,
                    latitude: overview.daily_summaries[0].lat,
                    zoom: 10
                  });
                }}
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Overview
              </button>

              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xl">
                  {selectedDay.day_number}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-neutral-100">{selectedDay.title}</h2>
                  <p className="text-emerald-400 text-sm font-medium">Daily Schedule</p>
                </div>
              </div>

              {detailError ? <div role="alert" className="text-red-300">{detailError}<button className="block mt-2 underline" onClick={() => handleDaySelect(selectedDay)}>Retry day</button></div> : detailLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
                  <p className="text-neutral-400">Generating daily plan...</p>
                </div>
              ) : dayDetail ? (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-neutral-800">
                  {dayDetail.items.map((item: Activity, idx: number) => (
                    <div key={idx} className="relative pl-12">
                      <div className="absolute left-3 top-1 w-4 h-4 rounded-full bg-neutral-900 border-2 border-emerald-500 z-10 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-sm hover:border-neutral-700 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-emerald-400">{item.time}</span>
                          <span className="text-[10px] uppercase tracking-tighter px-2 py-0.5 bg-neutral-800 rounded text-neutral-400 border border-neutral-700">{item.action_type}</span>
                        </div>
                        <h4 className="font-bold text-neutral-100 text-sm">{item.title}</h4>
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{item.description}</p>
                        {editing && <fieldset disabled={isSaving} className="mt-3 space-y-2">
                          {(["time", "title", "description"] as const).map(field => <label key={field} className="block text-xs text-neutral-400 capitalize">{field}<input className="block w-full mt-1 p-2 bg-neutral-800 rounded-lg text-white" value={item[field]} onChange={e => updateDay(dayDetail.items.map((entry: Activity, i: number) => i === idx ? { ...entry, [field]: e.target.value } : entry))} /></label>)}
                          <div className="flex gap-3 text-xs"><button disabled={idx === 0} onClick={() => { const items = [...dayDetail.items]; [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]]; updateDay(items); }} className="underline disabled:opacity-30">Move up</button><button onClick={() => updateDay(dayDetail.items.filter((_: Activity, i: number) => i !== idx))} className="text-red-300 underline">Remove</button></div>
                        </fieldset>}
                        <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-3 bg-black/20 p-2 rounded-lg">
                          <Navigation2 className="w-3 h-3 text-emerald-500" />
                          {item.location_name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 text-center py-10 italic">Select a day to see details</p>
              )}
              {editing && dayDetail && !detailLoading && <button disabled={isSaving} className="w-full border border-dashed border-neutral-600 rounded-xl p-3 text-sm" onClick={() => updateDay([...dayDetail.items, { time: "", title: "Free time", description: "", location_name: selectedDay.title, lat: selectedDay.lat, lng: selectedDay.lng, action_type: "Explore" }])}>Add activity near this day’s base</button>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map - Fills remaining space */}
      <div className="flex-1 h-full bg-neutral-950 relative z-10">
        {!mapboxToken ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 p-8 text-center flex-col text-white">
            Mapbox Token Required
          </div>
        ) : (
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            onLoad={e => e.target.resize()}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={mapboxToken}
          >
            {routeData && (
              <Source id="route" type="geojson" data={routeData}>
                <Layer
                  id="route-line"
                  type="line"
                  paint={{
                    "line-color": "#10b981",
                    "line-width": 3,
                    "line-dasharray": [2, 1],
                    "line-opacity": 0.6
                  }}
                />
              </Source>
            )}

            {!selectedDay ? (
              overview.daily_summaries?.map((day: DailySummary) => (
                <Marker key={day.day_number} longitude={day.lng} latitude={day.lat} anchor="bottom">
                  <div 
                    onClick={() => handleDaySelect(day)}
                    className="bg-emerald-500 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] border-2 border-white cursor-pointer hover:scale-125 transition-transform"
                  >
                    {day.day_number}
                  </div>
                </Marker>
              ))
            ) : dayDetail?.items.map((item: Activity, idx: number) => (
              <Marker key={idx} longitude={item.lng} latitude={item.lat} anchor="bottom">
                <div className="bg-white w-7 h-7 rounded-full flex items-center justify-center text-emerald-600 font-bold shadow-xl border-2 border-emerald-500 hover:scale-110 transition-transform">
                  {idx + 1}
                </div>
              </Marker>
            ))}
          </Map>
        )}
      </div>
    </div>
  );
}
