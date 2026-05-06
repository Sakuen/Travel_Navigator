"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Map, Marker, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Clock, Navigation2, RefreshCw, Loader2, Compass, ArrowLeft, Bookmark, Check, Calendar, AlertCircle } from "lucide-react";

export default function Navigator({ state, destination, savedTripData, selectedModel, onSaveTrip }: { state: any, destination: any, savedTripData?: any, selectedModel: string, onSaveTrip?: (trip: any) => void }) {
  const [overview, setOverview] = useState<any>(savedTripData || null);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [dayDetail, setDayDetail] = useState<any>(null);
  const [loading, setLoading] = useState(!savedTripData);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 11
  });
  
  const hasFetched = useRef(false);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_state: state, destination, model_name: selectedModel })
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      
      if (!data.daily_summaries || data.daily_summaries.length === 0) {
        throw new Error("No daily plans were generated. Please retry.");
      }

      setOverview(data);
      if (data.daily_summaries?.[0]) {
        setViewState({
          longitude: data.daily_summaries[0].lng,
          latitude: data.daily_summaries[0].lat,
          zoom: 10
        });
      }
    } catch (error: any) {
      console.error("Error fetching overview:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (savedTripData) {
      setOverview(savedTripData);
      setLoading(false);
      if (savedTripData.daily_summaries?.[0]) {
        setViewState({
          longitude: savedTripData.daily_summaries[0].lng,
          latitude: savedTripData.daily_summaries[0].lat,
          zoom: 10
        });
      }
      return;
    }
    
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchOverview();
  }, [savedTripData]);

  const handleDaySelect = async (day: any) => {
    setSelectedDay(day);
    setViewState({
      longitude: day.lng,
      latitude: day.lat,
      zoom: 13
    });
    
    setDetailLoading(true);
    setDayDetail(null);
    try {
      const response = await fetch("/api/itinerary/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_state: state, destination, day_number: day.day_number, model_name: selectedModel })
      });
      if (!response.ok) throw new Error("Daily detail fetch failed");
      const data = await response.json();
      setDayDetail(data);
    } catch (error) {
      console.error("Error fetching day detail:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const routeData = useMemo(() => {
    if (selectedDay && dayDetail?.items) {
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: dayDetail.items.map((i: any) => [i.lng, i.lat])
        }
      };
    } else if (overview?.daily_summaries) {
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: overview.daily_summaries.map((d: any) => [d.lng, d.lat])
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
                  <h2 className="text-3xl font-bold tracking-tight text-neutral-100 leading-tight">{overview.trip_title}</h2>
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
                {overview.daily_summaries?.map((day: any) => (
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

              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
                  <p className="text-neutral-400">Generating daily plan...</p>
                </div>
              ) : dayDetail ? (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-neutral-800">
                  {dayDetail.items.map((item: any, idx: number) => (
                    <div key={idx} className="relative pl-12">
                      <div className="absolute left-3 top-1 w-4 h-4 rounded-full bg-neutral-900 border-2 border-emerald-500 z-10 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-sm hover:border-neutral-700 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-emerald-400">{item.time}</span>
                          <span className="text-[10px] uppercase tracking-tighter px-2 py-0.5 bg-neutral-800 rounded text-neutral-400 border border-neutral-700">{item.action_type}</span>
                        </div>
                        <h4 className="font-bold text-neutral-100 text-sm">{item.title}</h4>
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{item.description}</p>
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
              overview.daily_summaries?.map((day: any) => (
                <Marker key={day.day_number} longitude={day.lng} latitude={day.lat} anchor="bottom">
                  <div 
                    onClick={() => handleDaySelect(day)}
                    className="bg-emerald-500 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] border-2 border-white cursor-pointer hover:scale-125 transition-transform"
                  >
                    {day.day_number}
                  </div>
                </Marker>
              ))
            ) : dayDetail?.items.map((item: any, idx: number) => (
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
