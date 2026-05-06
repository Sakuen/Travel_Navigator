"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Map, Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Plus, Trash2, Star, Globe, Calendar, Building, MapPin, X, Loader2, Save, Filter, Edit2, Info, ChevronDown, ChevronUp, Users, Map as MapIcon } from "lucide-react";

const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316"
];

export default function PastTripsView({ username, pastTrips, onUpdate }: { username: string, pastTrips: any[], onUpdate: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [selectedParticipant, setSelectedParticipant] = useState<string>("Everyone");
  const [selectedContinent, setSelectedContinent] = useState<string>("All Continents");
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [popupInfo, setPopupInfo] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    title: "",
    country: "",
    continent: "",
    participants: [] as string[],
    participantInput: "",
    rating: 5,
    notes: "",
    stops: [{ city: "", hotel: "" }]
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
    pastTrips?.forEach(t => { if (t.continent) c.add(t.continent); });
    return ["All Continents", ...Array.from(c).sort()];
  }, [pastTrips]);

  const handleTripClick = (trip: any) => {
    const firstValidStop = trip.stops?.find((s: any) => s.lat && s.lng);
    if (firstValidStop) {
      setViewState({ longitude: firstValidStop.lng, latitude: firstValidStop.lat, zoom: 6 });
      setPopupInfo({ ...firstValidStop, trip });
    }
  };

  const startEdit = (trip: any) => {
    setEditingId(trip.id);
    setFormData({
      year: trip.year,
      title: trip.title || "",
      country: trip.country,
      continent: trip.continent || "",
      participants: trip.participants || [],
      participantInput: (trip.participants || []).join(", "),
      rating: trip.rating,
      notes: trip.notes || "",
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
      country: "",
      continent: "",
      participants: [],
      participantInput: "",
      rating: 5,
      notes: "",
      stops: [{ city: "", hotel: "" }]
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const parts = formData.participantInput.split(",").map(p => p.trim()).filter(p => p);
      const tripData = {
        ...formData,
        participants: parts,
        id: editingId || Math.random().toString(36).substr(2, 9),
      };

      const res = await fetch(`/api/users/${username}/past-trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, trip: tripData })
      });

      if (res.ok) {
        onUpdate();
        cancelEdit();
      }
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = useMemo(() => {
    return pastTrips?.filter(t => {
      const yearMatch = selectedYear === "All" || t.year.toString() === selectedYear;
      const partMatch = selectedParticipant === "Everyone" || t.participants?.includes(selectedParticipant);
      const contMatch = selectedContinent === "All Continents" || t.continent === selectedContinent;
      return yearMatch && partMatch && contMatch;
    }) || [];
  }, [pastTrips, selectedYear, selectedParticipant, selectedContinent]);

  const allPins = useMemo(() => {
    const pins: any[] = [];
    filteredTrips.forEach(trip => {
      const color = getTripColor(trip.id);
      trip.stops?.forEach((stop: any) => {
        if (stop.lat && stop.lng) pins.push({ ...stop, trip, color });
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

              <input type="text" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} placeholder="Country..." className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500" required/>
              
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold ml-1">Participants (comma separated)</label>
                <input type="text" value={formData.participantInput} onChange={e => setFormData({...formData, participantInput: e.target.value})} placeholder="e.g. Sascha, Jacky, Mom" className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"/>
              </div>

              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Notes & Memories..." className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500 min-h-[80px]"/>
              
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

        <div className="space-y-4 pb-20">
          {filteredTrips.sort((a,b) => b.year - a.year).map((trip) => {
            const color = getTripColor(trip.id);
            const isExpanded = expandedNotes === trip.id;
            return (
              <div key={trip.id} onClick={() => handleTripClick(trip)} className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all group relative cursor-pointer overflow-hidden shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-6">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{trip.year} • {trip.country} {trip.continent && `• ${trip.continent}`}</p>
                    <h3 className="font-bold text-neutral-100 text-sm">{trip.title || trip.country}</h3>
                    {trip.participants?.length > 0 && (
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
                  {trip.stops?.map((s: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-neutral-400">
                      <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium text-neutral-300">{s.city}</span>
                      {s.hotel && <span className="text-[9px] text-neutral-600 line-clamp-1">at {s.hotel}</span>}
                    </div>
                  ))}
                </div>
                {trip.notes && (
                  <div className="mt-3 pt-3 border-t border-neutral-800/50">
                    <p className={`text-[11px] italic text-neutral-500 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>"{trip.notes}"</p>
                    <button onClick={(e) => { e.stopPropagation(); setExpandedNotes(isExpanded ? null : trip.id); }} className="text-[9px] font-bold text-neutral-600 hover:text-emerald-400 mt-1 uppercase">{isExpanded ? "Show Less" : "Read More"}</button>
                  </div>
                )}
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
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{popupInfo.trip.year} {popupInfo.trip.continent && `• ${popupInfo.trip.continent}`}</span>
                  <div className="flex gap-0.5">{[1,2,3,4,5].map(r => <Star key={r} className={`w-2 h-2 ${popupInfo.trip.rating >= r ? "text-yellow-500 fill-current" : "text-neutral-800"}`} />)}</div>
                </div>
                <h3 className="font-bold text-white text-sm mb-0.5">{popupInfo.trip.title || popupInfo.trip.country}</h3>
                <p className="text-xs text-emerald-400 font-medium mb-2">{popupInfo.city}, {popupInfo.trip.country}</p>
                {popupInfo.trip.participants?.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{popupInfo.trip.participants.map((p:string) => <span key={p} className="text-[7px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded uppercase">{p}</span>)}</div>}
                {popupInfo.hotel && <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mb-2 bg-neutral-800/50 p-1.5 rounded-lg"><Building className="w-3 h-3 text-neutral-600" />{popupInfo.hotel}</div>}
                {popupInfo.trip.notes && <p className="text-[10px] italic text-neutral-500 border-t border-neutral-800 pt-2 line-clamp-2">"{popupInfo.trip.notes}"</p>}
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
