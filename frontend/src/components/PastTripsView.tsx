"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Map, Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Plus, Trash2, Star, Globe, Calendar, Building, MapPin, X, Loader2, Edit2, Users, Map as MapIcon, Compass } from "lucide-react";

import type { PastTrip, PastTripStop } from "../types/travel";
import { readApiError, refreshAiUsage } from "../lib/api-error";
type MapPinData = PastTripStop & { lat: number; lng: number; trip: PastTrip; color?: string };

const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316"
];

export default function PastTripsView({ username, pastTrips, onUpdate }: { username: string, pastTrips: PastTrip[], onUpdate: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState("");

  const generateSummary = async (tripId: string) => {
    setSummaryLoading(tripId); setSummaryError("");
    try {
      const response = await fetch(`/api/users/${username}/past-trips/${tripId}/summary`, { method: "POST" });
      if (!response.ok) throw await readApiError(response);
      onUpdate();
    } catch (error) { setSummaryError(error instanceof Error ? error.message : "Summary unavailable."); }
    finally { setSummaryLoading(null); refreshAiUsage(); }
  };
  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [selectedParticipant, setSelectedParticipant] = useState<string>("Everyone");
  const [selectedContinent, setSelectedContinent] = useState<string>("All Continents");
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [popupInfo, setPopupInfo] = useState<MapPinData | null>(null);
  
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    title: "",
    countries: [] as string[],
    countryInput: "",
    continents: [] as string[],
    participants: [] as string[],
    participantInput: "",
    rating: 5,
    notes: "",
    liked: "",
    disliked: "",
    would_revisit: "unsure",
    stops: [{ city: "", hotel: "" }] as PastTripStop[]
  });

  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 1.5
  });

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const getTripColor = (tripId: string) => {
    const index = tripId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLORS[index % COLORS.length];
  };

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(pastTrips?.map(t => t.year.toString()) || []));
    return ["All", ...years.sort((a,b) => parseInt(b) - parseInt(a))];
  }, [pastTrips]);

  const allParticipants = useMemo(() => {
    const p = new Set<string>();
    pastTrips?.forEach(t => t.participants?.forEach((name: string) => p.add(name)));
    return ["Everyone", ...Array.from(p).sort()];
  }, [pastTrips]);

  const allContinents = useMemo(() => {
    const c = new Set<string>();
    pastTrips?.forEach(t => { t.continents?.forEach((cont: string) => c.add(cont)); });
    return ["All Continents", ...Array.from(c).sort()];
  }, [pastTrips]);

  const handleTripClick = (trip: PastTrip) => {
    const firstValidStop = trip.stops?.find((s: PastTripStop) => s.lat != null && s.lng != null);
    if (firstValidStop && firstValidStop.lat != null && firstValidStop.lng != null) {
      setViewState({ longitude: firstValidStop.lng, latitude: firstValidStop.lat, zoom: 6 });
      setPopupInfo({ ...firstValidStop, lat: firstValidStop.lat!, lng: firstValidStop.lng!, trip });
    }
  };

  const startEdit = (trip: PastTrip) => {
    setEditingId(trip.id);
    setFormData({
      year: trip.year,
      title: trip.title || "",
      countries: trip.countries || [],
      countryInput: (trip.countries || []).join(", "),
      continents: trip.continents || [],
      participants: trip.participants || [],
      participantInput: (trip.participants || []).join(", "),
      rating: trip.rating,
      notes: trip.notes || "",
      liked: (trip.liked || []).join("\n"),
      disliked: (trip.disliked || []).join("\n"),
      would_revisit: trip.would_revisit === true ? "yes" : trip.would_revisit === false ? "no" : "unsure",
      stops: trip.stops || [{ city: "", hotel: "" }]
    });
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({
      year: new Date().getFullYear(),
      title: "",
      countries: [],
      countryInput: "",
      continents: [],
      participants: [],
      participantInput: "",
      rating: 5,
      notes: "",
      liked: "",
      disliked: "",
      would_revisit: "unsure",
      stops: [{ city: "", hotel: "" }] as PastTripStop[]
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveError("");
    try {
      const parts = formData.participantInput.split(",").map(p => p.trim()).filter(p => p);
      const countries = formData.countryInput.split(",").map(c => c.trim()).filter(c => c);
      const tripData = {
        ...formData,
        participants: parts,
        countries: countries,
        id: editingId || crypto.randomUUID(),
        liked: formData.liked.split("\n").map(s => s.trim()).filter(Boolean),
        disliked: formData.disliked.split("\n").map(s => s.trim()).filter(Boolean),
        would_revisit: formData.would_revisit === "unsure" ? null : formData.would_revisit === "yes",
      };

      const res = await fetch(`/api/users/${username}/past-trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, trip: tripData })
      });

      if (res.ok) {
        onUpdate();
        cancelEdit();
      } else { setSaveError("Could not save your trip. Please retry."); }
    } catch (e) {
      console.error("Save error:", e);
      setSaveError("Could not connect. Your edits are still here; please retry.");
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = useMemo(() => {
    return pastTrips?.filter(t => {
      const yearMatch = selectedYear === "All" || t.year.toString() === selectedYear;
      const partMatch = selectedParticipant === "Everyone" || t.participants?.includes(selectedParticipant);
      const contMatch = selectedContinent === "All Continents" || t.continents?.includes(selectedContinent);
      return yearMatch && partMatch && contMatch;
    }) || [];
  }, [pastTrips, selectedYear, selectedParticipant, selectedContinent]);

  const stats = useMemo(() => {
    if (!pastTrips || pastTrips.length === 0) return null;
    
    const countries = new Set(filteredTrips.flatMap(t => t.countries || []).map(c => c.trim()).filter(Boolean));
    const cities = new Set(filteredTrips.flatMap(t => t.stops?.map((s: PastTripStop) => s.city?.trim()).filter(Boolean) || []));
    const participants = new Set(filteredTrips.flatMap(t => t.participants || []));
    
    return [
      { label: "Trips", value: filteredTrips.length, icon: Compass, color: "text-emerald-400", bg: "bg-emerald-500/5" },
      { label: "Countries", value: countries.size, icon: Globe, color: "text-blue-400", bg: "bg-blue-500/5" },
      { label: "Cities", value: cities.size, icon: MapPin, color: "text-purple-400", bg: "bg-purple-500/5" },
      { label: "Squad", value: participants.size, icon: Users, color: "text-orange-400", bg: "bg-orange-500/5" },
    ];
  }, [pastTrips, filteredTrips]);

  const allPins = useMemo(() => {
    const pins: MapPinData[] = [];
    filteredTrips.forEach(trip => {
      const color = getTripColor(trip.id);
      trip.stops?.forEach((stop: PastTripStop) => {
        if (stop.lat != null && stop.lng != null) pins.push({ ...stop, lat: stop.lat, lng: stop.lng, trip, color });
      });
    });
    return pins;
  }, [filteredTrips]);

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-neutral-950">
      <div className="w-full md:w-[450px] h-full overflow-y-auto border-r border-neutral-800 p-6 bg-neutral-950 z-20 shadow-2xl shrink-0 scroll-smooth custom-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-neutral-100 flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-400" /> My Travels
          </h2>
          <button onClick={() => isAdding ? cancelEdit() : setIsAdding(true)} className={`p-2 rounded-xl transition-all ${isAdding ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}>
            {isAdding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>

        {stats && !isAdding && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            {stats.map((stat, i) => (
              <div key={i} className={`flex flex-col items-center justify-center p-3 rounded-2xl border border-neutral-800 shadow-sm group hover:border-neutral-700 transition-all ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 mb-1.5 ${stat.color} opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all`} />
                <span className="text-lg font-black text-neutral-100 leading-none">{stat.value}</span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-500 mt-1">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        {!isAdding && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <Calendar className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
              {availableYears.map(year => (
                <button key={year} onClick={() => setSelectedYear(year)} className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all shrink-0 ${selectedYear === year ? "bg-emerald-500 text-white" : "bg-neutral-800 text-neutral-500 border border-neutral-700"}`}>{year}</button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <Users className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
              {allParticipants.map(name => (
                <button key={name} onClick={() => setSelectedParticipant(name)} className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all shrink-0 ${selectedParticipant === name ? "bg-blue-500 text-white" : "bg-neutral-800 text-neutral-500 border border-neutral-700"}`}>{name}</button>
              ))}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <MapIcon className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
              {allContinents.map(c => (
                <button key={c} onClick={() => setSelectedContinent(c)} className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all shrink-0 ${selectedContinent === c ? "bg-purple-500 text-white" : "bg-neutral-800 text-neutral-500 border border-neutral-700"}`}>{c}</button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {isAdding && (
            <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onSubmit={handleSubmit} className="mb-8 p-6 rounded-3xl bg-neutral-900 border border-emerald-500/30 space-y-5 overflow-hidden shadow-2xl">
              <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Trip Name (e.g. Family Summer)..." className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500 transition-all font-bold"/>
              
              <div className="grid grid-cols-2 gap-4">
                <input type="number" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})} className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"/>
                <div className="flex gap-1 py-2 justify-end">
                  {[1,2,3,4,5].map(r => <Star key={r} onClick={() => setFormData({...formData, rating: r})} className={`w-4 h-4 cursor-pointer ${formData.rating >= r ? "text-yellow-400 fill-current" : "text-neutral-700"}`} />)}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold ml-1">Countries (comma separated)</label>
                <input type="text" value={formData.countryInput} onChange={e => setFormData({...formData, countryInput: e.target.value})} placeholder="e.g. France, Italy..." className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500" required/>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold ml-1">Participants (comma separated)</label>
                <input type="text" value={formData.participantInput} onChange={e => setFormData({...formData, participantInput: e.target.value})} placeholder="e.g. Sascha, Jacky, Mom" className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"/>
              </div>

              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Notes & Memories..." className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500 min-h-[80px]"/>
              <p className="text-xs text-emerald-300">These experiences will inform your next recommendations.</p>
              <label className="block text-xs text-neutral-400">What we loved (one idea per line)<textarea value={formData.liked} onChange={e => setFormData({...formData, liked: e.target.value})} placeholder="Quiet coastal walks\nSmall family-run hotels" className="mt-2 w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm" /></label>
              <label className="block text-xs text-neutral-400">What we’d avoid next time<textarea value={formData.disliked} onChange={e => setFormData({...formData, disliked: e.target.value})} placeholder="Crowded attractions\nToo many hotel changes" className="mt-2 w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm" /></label>
              <label className="block text-xs text-neutral-400">Would we go back?<select value={formData.would_revisit} onChange={e => setFormData({...formData, would_revisit: e.target.value})} className="mt-2 w-full bg-neutral-800 rounded-xl p-2"><option value="unsure">Not sure yet</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              {saveError && <p role="alert" className="text-red-400 text-sm">{saveError}</p>}
              
              <div className="space-y-3">
                {formData.stops.map((stop, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50 relative group">
                    <input value={stop.city} onChange={e => { const s = [...formData.stops]; s[idx].city = e.target.value; setFormData({...formData, stops: s}); }} placeholder="City" className="w-full bg-transparent border-none text-xs outline-none mb-1" required/>
                    <input value={stop.hotel} onChange={e => { const s = [...formData.stops]; s[idx].hotel = e.target.value; setFormData({...formData, stops: s}); }} placeholder="Hotel" className="w-full bg-transparent border-none text-[10px] outline-none text-neutral-500"/>
                    {formData.stops.length > 1 && <X onClick={() => setFormData({...formData, stops: formData.stops.filter((_, i) => i !== idx)})} className="absolute top-2 right-2 w-3 h-3 text-red-500 cursor-pointer opacity-0 group-hover:opacity-100"/>}
                  </div>
                ))}
                <button type="button" onClick={() => setFormData({...formData, stops: [...formData.stops, {city: "", hotel: ""}]})} className="w-full py-2 border border-dashed border-neutral-700 rounded-xl text-[10px] font-bold uppercase text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-all">+ Add Stop</button>
              </div>
              
              <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (editingId ? "Update Trip" : "Save Trip")}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {summaryError && <p role="alert" className="text-red-300 text-sm mb-3">{summaryError}</p>}
        <div className="space-y-4 pb-20">
          {filteredTrips.sort((a,b) => b.year - a.year).map((trip) => {
            const color = getTripColor(trip.id);
            const isExpanded = expandedNotes === trip.id;
            return (
              <div key={trip.id} onClick={() => handleTripClick(trip)} className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all group relative cursor-pointer overflow-hidden shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-6">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
                      {trip.year} • {trip.countries?.join(", ")} {(trip.continents && trip.continents.length > 0) && `• ${trip.continents.join(", ")}`}
                    </p>
                    <h3 className="font-bold text-neutral-100 text-sm">{trip.title || trip.countries?.join(" & ")}</h3>
                    {(trip.participants && trip.participants.length > 0) && (
                       <div className="flex flex-wrap gap-1 mt-2">
                          {trip.participants.map((p: string) => (
                             <span key={p} className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{p}</span>
                          ))}
                       </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(trip); }} className="p-1 hover:text-emerald-400"><Edit2 className="w-3 h-3"/></button>
                    <button onClick={(e) => { e.stopPropagation(); fetch(`/api/users/${username}/past-trips/${trip.id}`, {method: "DELETE"}).then(onUpdate); }} className="p-1 hover:text-red-400"><Trash2 className="w-3 h-3"/></button>
                  </div>
                </div>
                <div className="space-y-2 mb-3">
                  {trip.stops?.map((s: PastTripStop, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-neutral-400">
                      <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium text-neutral-300">{s.city}</span>
                      {s.hotel && <span className="text-[9px] text-neutral-600 line-clamp-1">at {s.hotel}</span>}
                    </div>
                  ))}
                </div>
                {trip.notes && (
                  <div className="mt-3 pt-3 border-t border-neutral-800/50">
                    <p className={`text-[11px] italic text-neutral-500 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>&ldquo;{trip.notes}&rdquo;</p>
                    <button onClick={(e) => { e.stopPropagation(); setExpandedNotes(isExpanded ? null : trip.id); }} className="text-[9px] font-bold text-neutral-600 hover:text-emerald-400 mt-1 uppercase">{isExpanded ? "Show Less" : "Read More"}</button>
                  </div>
                )}
                {(trip.liked && trip.liked.length > 0) && <p className="text-xs text-emerald-300 mt-3">Loved: {trip.liked.join(" · ")}</p>}
                {(trip.disliked && trip.disliked.length > 0) && <p className="text-xs text-orange-300 mt-2">Avoid next time: {trip.disliked.join(" · ")}</p>}
                <button disabled={!!summaryLoading} onClick={e => { e.stopPropagation(); generateSummary(trip.id); }} className="mt-4 text-xs text-emerald-300 underline disabled:opacity-40">{summaryLoading === trip.id ? "Writing your story…" : trip.generated_story ? "Rewrite travel story" : "Create travel story"}</button>
                {trip.generated_story && <article className="mt-5 rounded-2xl bg-stone-100 text-stone-800 p-5 cursor-text" onClick={e => e.stopPropagation()}>
                  <p className="text-[10px] uppercase tracking-widest text-stone-500">Our travel journal · {trip.year}</p>
                  <h4 className="font-serif text-2xl mt-2">{trip.generated_story.title}</h4>
                  <p className="text-sm italic mt-3">{trip.generated_story.introduction}</p>
                  <ul className="list-disc pl-4 my-4 text-xs space-y-2">{trip.generated_story.highlights?.map((highlight: string, i: number) => <li key={i}>{highlight}</li>)}</ul>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{trip.generated_story.story}</p>
                  <p className="text-[10px] text-stone-500 mt-4">AI draft from your recorded memories. Edit the trip to correct or add details, then rewrite.</p>
                </article>}
                <div className="flex gap-0.5 mt-3">
                  {[1,2,3,4,5].map(r => <Star key={r} className={`w-2.5 h-2.5 ${trip.rating >= r ? "text-yellow-500 fill-current" : "text-neutral-800"}`} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 h-full relative">
        <Map {...viewState} onMove={evt => setViewState(evt.viewState)} style={{ width: "100%", height: "100%" }} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={mapboxToken}>
          {allPins.map((pin, idx) => (
            <Marker key={`${pin.trip.id}-${idx}`} longitude={pin.lng} latitude={pin.lat} anchor="bottom">
              <div onClick={(e) => { e.stopPropagation(); setPopupInfo(pin); }} className="p-1.5 rounded-full border border-white/20 backdrop-blur-sm hover:scale-125 transition-all cursor-pointer shadow-lg" style={{ backgroundColor: `${pin.color}44`, borderColor: pin.color }}>

                <MapPin className="w-5 h-5" style={{ color: pin.color, fill: `${pin.color}44` }} />
              </div>
            </Marker>
          ))}
          {popupInfo && (
            <Popup longitude={popupInfo.lng} latitude={popupInfo.lat} anchor="bottom" onClose={() => setPopupInfo(null)} offset={30} closeButton={false}>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl min-w-[200px]">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{popupInfo.trip.year} {(popupInfo.trip.continents && popupInfo.trip.continents.length > 0) && `• ${popupInfo.trip.continents.join(", ")}`}</span>
                  <div className="flex gap-0.5">{[1,2,3,4,5].map(r => <Star key={r} className={`w-2 h-2 ${popupInfo.trip.rating >= r ? "text-yellow-500 fill-current" : "text-neutral-800"}`} />)}</div>
                </div>
                <h3 className="font-bold text-white text-sm mb-0.5">{popupInfo.trip.title || popupInfo.trip.countries?.join(" & ")}</h3>
                <p className="text-xs text-emerald-400 font-medium mb-2">{popupInfo.city}, {popupInfo.trip.countries?.join(", ")}</p>
                {(popupInfo.trip.participants && popupInfo.trip.participants.length > 0) && <div className="flex flex-wrap gap-1 mb-2">{popupInfo.trip.participants.map((p:string) => <span key={p} className="text-[7px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded uppercase">{p}</span>)}</div>}
                {popupInfo.hotel && <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-2 bg-neutral-800/50 p-1.5 rounded-lg"><Building className="w-3 h-3 text-neutral-600" />{popupInfo.hotel}</div>}
                {popupInfo.trip.notes && <p className="text-[10px] italic text-neutral-500 border-t border-neutral-800 pt-2 line-clamp-2">&ldquo;{popupInfo.trip.notes}&rdquo;</p>}
              </div>
            </Popup>
          )}
        </Map>
      </div>

      <style jsx global>{`
        .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .mapboxgl-popup-tip { border-top-color: #262626 !important; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

    </div>
  );
}
