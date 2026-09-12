"use client";

import { useState } from "react";

export type TripBrief = {
  destination: string | null;
  dates: string | null;
  budget: string | null;
  group_size: string | null;
  status_flags: string[];
  start_date: string | null;
  end_date: string | null;
  weather_preferences: string;
  avoid_peak_periods: boolean;
  revisit_preference: "new_places" | "open_to_revisits" | "favorites";
};

export const initialBrief: TripBrief = {
  destination: null, dates: null, budget: null, group_size: null, status_flags: [],
  start_date: null, end_date: null,
  weather_preferences: "Comfortable temperatures; avoid extreme heat and heavy rain",
  avoid_peak_periods: true, revisit_preference: "new_places",
};

export default function TravelBrief({ context, historyCount, onConfirm, onBack }: {
  context: TripBrief; historyCount: number;
  onConfirm: (brief: TripBrief) => void; onBack: () => void;
}) {
  const [brief, setBrief] = useState<TripBrief>({ ...initialBrief, ...context });
  const [error, setError] = useState("");
  const field = "mt-2 w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-white";
  return (
    <form className="max-w-2xl mx-auto p-6 space-y-6 text-sm" onSubmit={event => {
      event.preventDefault();
      if (!!brief.start_date !== !!brief.end_date || (brief.start_date && brief.end_date && brief.end_date < brief.start_date)) {
        setError("Provide both dates, with the end on or after the start."); return;
      }
      setError("");
      onConfirm({ ...brief, dates: brief.start_date && brief.end_date ? `${brief.start_date} to ${brief.end_date}` : brief.dates });
    }}>
      <div><p className="text-emerald-400 mb-2">Your next journey</p><h2 className="text-3xl font-bold">Review your travel brief</h2>
        <p className="text-neutral-400 mt-3">We’ll connect your preferences with {historyCount} recorded trips, including what you loved and what you’d avoid.</p></div>
      <label className="block">Destination, if you have one<input className={field} value={brief.destination || ""} placeholder="Open to ideas" onChange={e => setBrief({ ...brief, destination: e.target.value || null })} /></label>
      <div className="grid grid-cols-2 gap-4">
        <label>Start date<input type="date" className={field} value={brief.start_date || ""} onChange={e => setBrief({ ...brief, start_date: e.target.value || null })} /></label>
        <label>End date<input type="date" className={field} min={brief.start_date || undefined} value={brief.end_date || ""} onChange={e => setBrief({ ...brief, end_date: e.target.value || null })} /></label>
      </div>
      <label className="block">Or flexible timing and duration<input className={field} disabled={!!brief.start_date} value={brief.dates || ""} placeholder="Two weeks in autumn 2027" onChange={e => setBrief({ ...brief, dates: e.target.value || null })} /></label>
      {!brief.start_date && <p className="text-amber-300">Exact dates and year let us check holiday overlaps. With flexible dates, suggestions remain provisional.</p>}
      <div className="grid grid-cols-2 gap-4">
        <label>Budget<input className={field} value={brief.budget || ""} placeholder="CHF 4,000 total" onChange={e => setBrief({ ...brief, budget: e.target.value || null })} /></label>
        <label>Who’s travelling?<input className={field} value={brief.group_size || ""} onChange={e => setBrief({ ...brief, group_size: e.target.value || null })} /></label>
      </div>
      <label className="block">Your ideal weather<textarea className={field} value={brief.weather_preferences} onChange={e => setBrief({ ...brief, weather_preferences: e.target.value })} /></label>
      <label className="block">Past destinations<select className={field} value={brief.revisit_preference} onChange={e => setBrief({ ...brief, revisit_preference: e.target.value as TripBrief["revisit_preference"] })}>
        <option value="new_places">Discover new places inspired by our favourites</option><option value="open_to_revisits">Open to new places and revisits</option><option value="favorites">Prioritize places we loved</option>
      </select></label>
      <label className="flex gap-3 items-start"><input type="checkbox" className="mt-1" checked={brief.avoid_peak_periods} onChange={e => setBrief({ ...brief, avoid_peak_periods: e.target.checked })} /><span>Avoid major holiday crowds and peak periods, including Golden Week in Japan.</span></label>
      <p className="text-neutral-500">For distant trips we assess seasonal climate; forecasts are only useful close to departure. Event and weather sources will appear with the matches.</p>
      {error && <p role="alert" className="text-red-400">{error}</p>}
      <div className="flex gap-3"><button type="button" onClick={onBack} className="px-5 py-3 bg-neutral-800 rounded-xl">Continue conversation</button><button className="px-5 py-3 bg-emerald-600 rounded-xl font-bold">Find my matches</button></div>
    </form>
  );
}
