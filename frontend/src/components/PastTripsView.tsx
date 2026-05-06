"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Map, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Plus, Trash2, Star, Globe, Calendar, Building, MapPin, X, Loader2, Save } from "lucide-react";

export default function PastTripsView({ username, pastTrips, onUpdate }: { username: string, pastTrips: any[], onUpdate: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [newTrip, setNewTrip] = useState({
    year: new Date().getFullYear(),
    country: "",
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

  const addStop = () => {
    setNewTrip({
      ...newTrip,
      stops: [...newTrip.stops, { city: "", hotel: "" }]
    });
  };

  const removeStop = (idx: number) => {
    if (newTrip.stops.length === 1) return;
    setNewTrip({
      ...newTrip,
      stops: newTrip.stops.filter((_, i) => i !== idx)
    });
  };

  const updateStop = (idx: number, field: string, value: string) => {
    const stops = [...newTrip.stops];
    stops[idx] = { ...stops[idx], [field]: value };
    setNewTrip({ ...newTrip, stops });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tripData = {
        ...newTrip,
        id: Math.random().toString(36).substr(2, 9),
      };

      const res = await fetch(`/api/users/${username}/past-trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, trip: tripData })
      });

      if (res.ok) {
        onUpdate();
        setIsAdding(false);
        setNewTrip({ year: new Date().getFullYear(), country: "", rating: 5, notes: "", stops: [{ city: "", hotel: "" }] });
      }
    } catch (e) {
      console.error("Add past trip error:", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (id: string) => {
    if (!confirm("Remove this trip from your history?")) return;
    try {
      await fetch(`/api/users/${username}/past-trips/${id}`, { method: "DELETE" });
      onUpdate();
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  // Flatten all stops from all trips for the map
  const allPins = useMemo(() => {
    const pins: any[] = [];
    pastTrips?.forEach(trip => {
      trip.stops?.forEach((stop: any) => {
        if (stop.lat && stop.lng) {
          pins.push({ ...stop, tripId: trip.id });
        }
      });
    });
    return pins;
  }, [pastTrips]);

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-neutral-950">
      <div className="w-full md:w-[450px] h-full overflow-y-auto border-r border-neutral-800 p-6 bg-neutral-950 z-20 shadow-2xl shrink-0 scroll-smooth">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-neutral-100 flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-400" />
            My Travel History
          </h2>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
          >
            {isAdding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="mb-8 p-6 rounded-3xl bg-neutral-900 border border-emerald-500/30 space-y-6 overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Year</label>
                  <input 
                    type="number" 
                    value={newTrip.year} 
                    onChange={e => setNewTrip({...newTrip, year: parseInt(e.target.value)})}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Rating</label>
                  <div className="flex gap-1 py-2">
                    {[1,2,3,4,5].map(r => (
                      <button 
                        key={r} 
                        type="button"
                        onClick={() => setNewTrip({...newTrip, rating: r})}
                        className={`transition-colors ${newTrip.rating >= r ? "text-yellow-400" : "text-neutral-700"}`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Country</label>
                <input 
                  type="text" 
                  value={newTrip.country} 
                  onChange={e => setNewTrip({...newTrip, country: e.target.value})}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"
                  placeholder="e.g. Italy"
                  required
                />
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Stops & Locations</label>
                 {newTrip.stops.map((stop, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-neutral-800/50 border border-neutral-700/50 space-y-3 relative group/stop">
                       <input 
                          type="text" 
                          value={stop.city} 
                          onChange={e => updateStop(idx, "city", e.target.value)}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-xs outline-none focus:border-emerald-500"
                          placeholder="City (e.g. Rome)"
                          required
                       />
                       <input 
                          type="text" 
                          value={stop.hotel} 
                          onChange={e => updateStop(idx, "hotel", e.target.value)}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-[10px] outline-none focus:border-emerald-500"
                          placeholder="Hotel (Optional)"
                       />
                       {newTrip.stops.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => removeStop(idx)}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover/stop:opacity-100 transition-opacity"
                          >
                             <X className="w-3 h-3" />
                          </button>
                       )}
                    </div>
                 ))}
                 <button 
                    type="button" 
                    onClick={addStop}
                    className="w-full py-2 rounded-xl border border-dashed border-neutral-700 text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-all text-xs font-bold flex items-center justify-center gap-2"
                 >
                    <Plus className="w-3 h-3" /> Add Stop
                 </button>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Trip History
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="space-y-4 pb-20">
          {pastTrips?.length > 0 ? (
            pastTrips.sort((a,b) => b.year - a.year).map((trip) => (
              <div 
                key={trip.id}
                className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">
                      <Calendar className="w-3 h-3" />
                      {trip.year}
                    </div>
                    <h3 className="text-lg font-bold text-neutral-100">{trip.country}</h3>
                  </div>
                  <button 
                    onClick={() => deleteTrip(trip.id)}
                    className="p-2 text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                   {trip.stops?.map((stop: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 pl-2 border-l border-neutral-800">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                         <div>
                            <p className="text-sm font-bold text-neutral-200">{stop.city}</p>
                            {stop.hotel && <p className="text-[10px] text-neutral-500 flex items-center gap-1"><Building className="w-2.5 h-2.5" /> {stop.hotel}</p>}
                         </div>
                      </div>
                   ))}
                </div>

                <div className="mt-4 flex items-center gap-1">
                   {[1,2,3,4,5].map(r => (
                      <Star key={r} className={`w-3 h-3 ${trip.rating >= r ? "text-yellow-500 fill-current" : "text-neutral-800"}`} />
                   ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 text-neutral-600 text-sm">
              No trips recorded yet.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 h-full bg-neutral-950 relative">
        {!mapboxToken ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 p-8 text-center flex-col text-white">
            Mapbox Token Required
          </div>
        ) : (
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={mapboxToken}
          >
            {allPins.map((pin, idx) => (
              <Marker key={`${pin.tripId}-${idx}`} longitude={pin.lng} latitude={pin.lat} anchor="bottom">
                <div className="group relative">
                   <div className="bg-emerald-500/20 p-1.5 rounded-full border border-emerald-500/50 backdrop-blur-sm hover:scale-125 hover:bg-emerald-500 transition-all cursor-pointer">
                      <MapPin className="w-5 h-5 text-emerald-400 group-hover:text-white" />
                   </div>
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-50 text-white">
                      {pin.city}
                   </div>
                </div>
              </Marker>
            ))}
          </Map>
        )}
      </div>
    </div>
  );
}
