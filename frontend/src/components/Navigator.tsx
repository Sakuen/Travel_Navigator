"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Clock, Navigation2, RefreshCw, Loader2, Compass } from "lucide-react";

export default function Navigator({ state, destination }: { state: any, destination: any }) {
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchItinerary = async () => {
      try {
        const response = await fetch("/api/itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current_state: state, destination })
        });
        if (!response.ok) {
          console.error("Itinerary fetch failed:", response.status);
          return;
        }
        const data = await response.json();
        setItinerary(data);
      } catch (error) {
        console.error("Error fetching itinerary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchItinerary();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
        <h2 className="text-2xl font-bold tracking-tight text-neutral-100">Drafting the Itinerary...</h2>
        <p className="text-neutral-400 mt-2">Stitching together times and locations.</p>
      </div>
    );
  }

  if (!itinerary) return null;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-80px)] overflow-hidden bg-neutral-950">
      {/* Timeline View (Left 40%) */}
      <div className="w-full md:w-[40%] h-full overflow-y-auto border-r border-neutral-800 p-6 relative">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-100">{itinerary.day}</h2>
          <p className="text-emerald-400 mt-2 text-lg">{destination.name}</p>
        </div>

        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-800 before:to-transparent">
          {itinerary.items.map((item: any, idx: number) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={idx}
              className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
            >
              {/* Timeline marker */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-neutral-700 bg-neutral-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-emerald-400">
                <Clock className="w-4 h-4" />
              </div>
              
              {/* Card */}
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-emerald-400">{item.time}</span>
                  <span className="px-2 py-1 bg-neutral-800 rounded-md text-[10px] uppercase tracking-wider font-bold text-neutral-300">
                    {item.action_type}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-neutral-100 mb-1">{item.title}</h3>
                <p className="text-sm text-neutral-400 mb-4">{item.description}</p>
                <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                  <Navigation2 className="w-3 h-3" />
                  {item.location_name}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Remix Button */}
        <div className="sticky bottom-6 flex justify-center mt-8">
          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-full shadow-lg shadow-emerald-900/20 font-semibold transition-transform hover:scale-105 active:scale-95">
            <RefreshCw className="w-4 h-4" />
            Remix this day
          </button>
        </div>
      </div>

      {/* Mapbox View (Right 60%) */}
      <div className="hidden md:block w-[60%] h-full bg-neutral-900 relative">
        <Map
          initialViewState={{
            longitude: itinerary.items[0]?.lng || 0,
            latitude: itinerary.items[0]?.lat || 0,
            zoom: 12
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoiZHVtbXkiLCJhIjoiY2x4bHRwbWhzMDJhbjJqb20zZjZtdTNheCJ9.dummy"}
        >
          {itinerary.items.map((item: any, idx: number) => (
            <Marker key={idx} longitude={item.lng} latitude={item.lat} anchor="bottom">
              <div className="bg-emerald-500 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg transform -translate-y-4 cursor-pointer hover:scale-110 transition-transform">
                {idx + 1}
              </div>
            </Marker>
          ))}
        </Map>
        {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 p-8 text-center flex-col">
             <Compass className="w-16 h-16 text-neutral-500 mb-4 animate-pulse" />
             <h3 className="text-xl font-bold text-white">Mapbox Token Required</h3>
             <p className="text-neutral-400 max-w-md mt-2">
               To view the interactive route, add your NEXT_PUBLIC_MAPBOX_TOKEN to the .env file.
               The coordinates ({itinerary.items[0]?.lat}, {itinerary.items[0]?.lng}) are ready to map!
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
