import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, Loader2, Navigation } from "lucide-react";

export default function Matchmaker({ state, onSelectDestination }: { state: any, onSelectDestination: (dest: any) => void }) {
  const [destinations, setDestinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const fetchDestinations = async () => {
      try {
        const response = await fetch("/api/destinations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current_state: state })
        });
        if (!response.ok) {
          console.error("Destinations fetch failed:", response.status);
          return;
        }
        const data = await response.json();
        setDestinations(data.destinations);
      } catch (error) {
        console.error("Error fetching destinations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDestinations();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
        <h2 className="text-2xl font-bold tracking-tight text-neutral-100">Consulting the Compass...</h2>
        <p className="text-neutral-400 mt-2">Deep searching live data for your perfect match.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-100">Your Tailored Matches</h2>
        <p className="text-neutral-400 mt-2 text-lg">Swipe to explore. Select to plan.</p>
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
