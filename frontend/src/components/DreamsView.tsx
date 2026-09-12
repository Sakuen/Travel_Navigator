"use client";

import { useEffect, useState } from "react";
import { Map, Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Dream } from "../types/travel";
import { readApiError, refreshAiUsage } from "../lib/api-error";

const blank = (): Dream => ({ revision: 0, title: "", countries: [], continents: [], participants: [], timing: "", priority: "someday", notes: "", links: [], stops: [] });
const split = (text: string) => text.split(",").map(s => s.trim()).filter(Boolean);
const lines = (text: string) => text.split("\n").map(s => s.trim()).filter(Boolean);
const control = "w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm";
const button = "min-h-11 rounded-xl border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-40";
const safeLink = (url: string) => { try { return ["http:", "https:"].includes(new URL(url).protocol); } catch { return false; } };

export default function DreamsView({ username, selectedModel, onUpdate, onTravels }: { username: string; selectedModel: string; onUpdate: () => void; onTravels: () => void }) {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [participant, setParticipant] = useState("all");
  const [continent, setContinent] = useState("all");
  const [archived, setArchived] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [pin, setPin] = useState<{ title: string; city: string; lat: number; lng: number } | null>(null);
  const [draft, setDraft] = useState<Dream | null>(null);
  const [countries, setCountries] = useState("");
  const [continents, setContinents] = useState("");
  const [participants, setParticipants] = useState("");
  const [links, setLinks] = useState("");
  const [completing, setCompleting] = useState<Dream | null>(null);
  const [actual, setActual] = useState({ title: "", year: new Date().getFullYear(), countries: "", continents: "", participants: "", cities: "", rating: 5, notes: "", liked: "", disliked: "", revisit: "unsure" });
  const base = `/api/users/${encodeURIComponent(username)}/dreams`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(base, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw await readApiError(response);
      setDreams((await response.json()).dreams);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base]);

  async function reload() {
    const response = await fetch(base);
    if (!response.ok) throw await readApiError(response);
    setDreams((await response.json()).dreams);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Could not update your dreams."); }
    finally { setBusy(false); refreshAiUsage(); }
  }
  async function request(path: string, method: string, body?: unknown) {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }
  function edit(dream: Dream) {
    setDraft({ ...dream, stops: dream.stops.map(s => ({ ...s })) });
    setCountries(dream.countries.join(", ")); setContinents(dream.continents.join(", "));
    setParticipants(dream.participants.join(", ")); setLinks(dream.links.join("\n")); setError("");
  }
  const active = dreams.filter(d => d.status !== "completed");
  const visible = dreams.filter(d => (d.status === "completed") === archived
    && (priority === "all" || d.priority === priority)
    && (participant === "all" || d.participants.includes(participant))
    && (continent === "all" || d.continents.includes(continent))
    && JSON.stringify([d.title, d.countries, d.stops, d.notes, d.links, d.timing]).toLowerCase().includes(query.toLowerCase()));
  const pins = visible.flatMap(d => d.stops.filter(s => s.lat != null && s.lng != null).map(s => ({ title: d.title, city: s.city, lat: s.lat!, lng: s.lng! })));

  return <div className="h-full overflow-y-auto bg-neutral-950 p-4 sm:p-8">
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between gap-4"><div><p className="text-violet-300 text-sm">Your next chapters</p><h1 className="text-3xl font-bold">My Dreams</h1><p className="text-neutral-400 mt-2">Places, ideas and little things you don’t want to forget.</p></div>
        <button className={button + " bg-violet-600"} disabled={busy} onClick={() => edit(blank())}>+ Add a dream</button></div>
      <div className="grid grid-cols-3 gap-3 text-center">{[[active.length, "Dreams"], [new Set(active.flatMap(d => d.countries)).size, "Countries to explore"], [dreams.length - active.length, "Dreams fulfilled"]].map(([count, label]) => <div key={label} className="rounded-2xl bg-neutral-900 p-4"><p className="text-2xl font-bold text-violet-300">{count}</p><p className="text-xs text-neutral-400">{label}</p></div>)}</div>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Search dreams" placeholder="Search places, notes or links…" className={control + " sm:max-w-xs"} value={query} onChange={e => setQuery(e.target.value)} />
        <select aria-label="Filter priority" className={control + " sm:w-auto"} value={priority} onChange={e => setPriority(e.target.value)}><option value="all">All priorities</option><option value="next">Next adventure</option><option value="keen">Really keen</option><option value="someday">Someday</option></select>
        <select aria-label="Filter traveller" className={control + " sm:w-auto"} value={participant} onChange={e => setParticipant(e.target.value)}><option value="all">All travellers</option>{[...new Set(dreams.flatMap(d => d.participants))].sort().map(p => <option key={p}>{p}</option>)}</select>
        <select aria-label="Filter continent" className={control + " sm:w-auto"} value={continent} onChange={e => setContinent(e.target.value)}><option value="all">All continents</option>{[...new Set(dreams.flatMap(d => d.continents))].sort().map(c => <option key={c}>{c}</option>)}</select>
        <button className={button} onClick={() => { setArchived(!archived); setPin(null); }}>{archived ? "Show dreams" : "Fulfilled archive"}</button>
        <button className={button} onClick={() => setShowMap(!showMap)}>{showMap ? "Hide map" : "Show map"}</button>
      </div>
      {error && <div role="alert" className="text-amber-200 border border-amber-700 rounded-xl p-4">{error} <button className="underline ml-2" disabled={busy} onClick={() => run(reload)}>Reload saved dreams</button></div>}
      {showMap && <div className="rounded-2xl overflow-hidden border border-neutral-800">
        {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? <div className="h-80"><Map initialViewState={{ longitude: 0, latitude: 20, zoom: 1.3 }} mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} mapStyle="mapbox://styles/mapbox/dark-v11">{pins.map((p, i) => <Marker key={i} longitude={p.lng} latitude={p.lat}><button aria-label={`${p.title}: ${p.city}`} onClick={() => setPin(p)} className="text-violet-300 text-2xl">●</button></Marker>)}{pin && <Popup longitude={pin.lng} latitude={pin.lat} onClose={() => setPin(null)}><div className="text-neutral-950">{pin.title}<br />{pin.city}</div></Popup>}</Map></div> : <p className="p-4">Set a Mapbox token to display the map.</p>}
        <p className="text-xs text-neutral-400 p-3">{pins.length} mapped stops. Add optional coordinates when editing a dream. Wishlist places are not counted as visited.</p>
      </div>}
      {loading ? <p>Loading dreams…</p> : !visible.length && <p className="rounded-2xl border border-dashed border-neutral-700 p-10 text-center text-neutral-400">{dreams.length ? "No dreams match these filters." : "Start with a destination, a wish, or a handful of notes and links."}</p>}
      <div className="grid gap-5 md:grid-cols-2">{visible.map(dream => <article key={dream.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <div><p className="text-xs uppercase tracking-wider text-violet-300">{dream.status === "completed" ? "Fulfilled · research archive" : { next: "Next adventure", keen: "Really keen", someday: "Someday" }[dream.priority]}</p><h2 className="text-xl font-semibold mt-2">{dream.title}</h2><p className="text-neutral-400 text-sm">{dream.countries.join(" · ")}</p></div>
        <p className="text-sm text-neutral-400">{[dream.timing, dream.participants.join(", ")].filter(Boolean).join(" · ")}</p>
        {dream.stops.length > 0 && <p className="text-sm">Places: {dream.stops.map(s => s.city + (s.hotel ? ` (${s.hotel})` : "")).join(" · ")}</p>}
        {dream.notes && <details><summary className="cursor-pointer text-sm">Notes & collected ideas</summary><p className="whitespace-pre-wrap break-words text-sm text-neutral-300 mt-3">{dream.notes}</p></details>}
        {dream.links.length > 0 && <ul className="space-y-2">{dream.links.map((link, i) => <li key={i} className="truncate text-sm">{safeLink(link) ? <a className="text-violet-300 underline" href={link} target="_blank" rel="noreferrer">{link}</a> : link}</li>)}</ul>}
        {dream.generated_summary && <section className="bg-violet-500/10 rounded-xl p-4 space-y-3"><p className="text-xs text-violet-300">AI summary · saved notes, no linked-page retrieval</p><h3 className="font-semibold">{dream.generated_summary.title}</h3><p className="text-sm whitespace-pre-wrap">{dream.generated_summary.overview}</p>{([["Highlights", dream.generated_summary.highlights], ["Practical notes", dream.generated_summary.practical_notes], ["Still to work out", dream.generated_summary.open_questions]] as [string, string[]][]).map(([title, items]) => items.length > 0 && <div key={title}><h4 className="text-sm font-semibold">{title}</h4><ul className="list-disc pl-5 text-sm text-neutral-300">{items.map((item, i) => <li key={i}>{item}</li>)}</ul></div>)}</section>}
        <div className="flex flex-wrap gap-2">{dream.status !== "completed" ? <>
          <button className={button} disabled={busy} onClick={() => edit(dream)}>Edit</button>
          <button className={button} disabled={busy} onClick={() => run(async () => { const result = await request(`/${dream.id}/summary`, "POST", { model_name: selectedModel }); setDreams(prev => prev.map(d => d.id === dream.id ? result.dream : d)); })}>{busy ? "Working…" : "Summarize with AI"}</button>
          <button className={button + " text-emerald-300"} disabled={busy} onClick={() => { setCompleting(dream); setActual({ title: dream.title, year: new Date().getFullYear(), countries: "", continents: "", participants: dream.participants.join(", "), cities: "", rating: 5, notes: "", liked: "", disliked: "", revisit: "unsure" }); }}>We did it!</button>
        </> : <button className={button} onClick={onTravels}>View My Travels</button>}
          <button className={button + " text-red-300"} disabled={busy} onClick={() => { if (window.confirm(`Delete “${dream.title}” and its research? Completed trips will remain.`)) void run(async () => { await request(`/${dream.id}?revision=${dream.revision}`, "DELETE"); setDreams(prev => prev.filter(d => d.id !== dream.id)); }); }}>Delete</button>
        </div>
      </article>)}</div>
    </div>

    {draft && <div className="fixed inset-0 z-[110] bg-black/80 overflow-y-auto p-4"><form aria-label="Edit dream" className="max-w-2xl mx-auto rounded-2xl bg-neutral-900 p-5 space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { const result = await request("", "POST", { ...draft, countries: split(countries), continents: split(continents), participants: split(participants), links: lines(links), stops: draft.stops.filter(s => s.city.trim()) }); setDreams(prev => [...prev.filter(d => d.id !== result.dream.id), result.dream]); setDraft(null); }); }}>
      <h2 className="text-xl font-bold">{draft.id ? "Edit dream" : "A new dream"}</h2>
      <label className="block text-sm">Title<input required maxLength={200} className={control} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      {([["Countries (comma-separated)", countries, setCountries], ["Continents (comma-separated)", continents, setContinents], ["Travellers (comma-separated)", participants, setParticipants]] as [string, string, (s: string) => void][]).map(([label, value, setter]) => <label key={label} className="block text-sm">{label}<input className={control} value={value} onChange={e => setter(e.target.value)} /></label>)}
      <label className="block text-sm">When would you like to go?<input className={control} placeholder="Someday, autumn, a special anniversary…" value={draft.timing} onChange={e => setDraft({ ...draft, timing: e.target.value })} /></label>
      <label className="block text-sm">Priority<select className={control} value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Dream["priority"] })}><option value="someday">Someday</option><option value="keen">Really keen</option><option value="next">Next adventure</option></select></label>
      <label className="block text-sm">Notes, ideas & article excerpts<textarea rows={8} maxLength={60000} className={control} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Paste your research here: things to do, food, hotels, tips, costs, questions…" /></label>
      <label className="block text-sm">Links (one http/https URL per line)<textarea rows={4} className={control} value={links} onChange={e => setLinks(e.target.value)} /></label>
      <p className="text-xs text-neutral-400">AI summarizes saved notes and references. Paste useful article excerpts above; linked pages are not fetched. Saving edits clears the previous summary.</p>
      <fieldset className="space-y-3"><legend className="text-sm font-semibold">Places & possible stays</legend>{draft.stops.map((stop, i) => <div key={i} className="grid grid-cols-2 gap-2 border border-neutral-700 p-3 rounded-xl">{(["city", "hotel", "lat", "lng"] as const).map(field => <label key={field} className="text-xs">{{ city: "City / place", hotel: "Possible hotel", lat: "Latitude (optional)", lng: "Longitude (optional)" }[field]}<input className={control} type={field === "lat" || field === "lng" ? "number" : "text"} step="any" min={field === "lat" ? -90 : field === "lng" ? -180 : undefined} max={field === "lat" ? 90 : field === "lng" ? 180 : undefined} value={stop[field] ?? ""} onChange={e => setDraft({ ...draft, stops: draft.stops.map((s, index) => index === i ? { ...s, [field]: field === "lat" || field === "lng" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value } : s) })} /></label>)}<button type="button" className={button} onClick={() => setDraft({ ...draft, stops: draft.stops.filter((_, index) => index !== i) })}>Remove place</button></div>)}<button type="button" className={button} onClick={() => setDraft({ ...draft, stops: [...draft.stops, { city: "" }] })}>+ Add place</button></fieldset>
      {error && <p role="alert" className="text-amber-300">{error}</p>}
      <div className="flex gap-3"><button disabled={busy} className={button + " bg-violet-600"}>{busy ? "Saving…" : "Save dream"}</button><button type="button" disabled={busy} className={button} onClick={() => setDraft(null)}>Cancel</button></div>
    </form></div>}

    {completing && <div className="fixed inset-0 z-[110] bg-black/80 overflow-y-auto p-4"><form aria-label="Complete dream" className="max-w-2xl mx-auto rounded-2xl bg-neutral-900 p-5 space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { await request(`/${completing.id}/complete`, "POST", { username, revision: completing.revision, trip: { id: completing.id, title: actual.title, year: actual.year, countries: split(actual.countries), continents: split(actual.continents), participants: split(actual.participants), rating: actual.rating, notes: actual.notes, liked: lines(actual.liked), disliked: lines(actual.disliked), would_revisit: actual.revisit === "unsure" ? null : actual.revisit === "yes", stops: split(actual.cities).map(city => { const planned = completing.stops.find(s => s.city.toLowerCase() === city.toLowerCase()); return { city, ...(planned?.lat != null && planned?.lng != null ? { lat: planned.lat, lng: planned.lng } : {}) }; }) } }); setCompleting(null); await reload(); onUpdate(); onTravels(); }); }}>
      <h2 className="text-xl font-bold">Turn this dream into a memory</h2><p className="text-sm text-neutral-400">Record what actually happened. Your original dream, notes, links and summary remain in the fulfilled archive.</p>
      {([["Trip title", "title"], ["Countries actually visited (comma-separated)", "countries"], ["Continents visited (comma-separated)", "continents"], ["Who went? (comma-separated)", "participants"], ["Places actually visited (comma-separated)", "cities"]] as const).map(([label, field]) => <label key={field} className="block text-sm">{label}<input required={field === "countries" || field === "title"} className={control} value={actual[field]} onChange={e => setActual({ ...actual, [field]: e.target.value })} /></label>)}
      <label className="block text-sm">Year visited<input type="number" min={1900} max={new Date().getFullYear()} required className={control} value={actual.year} onChange={e => setActual({ ...actual, year: Number(e.target.value) })} /></label>
      <label className="block text-sm">Your rating<select className={control} value={actual.rating} onChange={e => setActual({ ...actual, rating: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>
      {([["Memories & stories", "notes"], ["What you loved (one per line)", "liked"], ["What you disliked (one per line)", "disliked"]] as const).map(([label, field]) => <label key={field} className="block text-sm">{label}<textarea className={control} rows={3} value={actual[field]} onChange={e => setActual({ ...actual, [field]: e.target.value })} /></label>)}
      <label className="block text-sm">Would you revisit?<select className={control} value={actual.revisit} onChange={e => setActual({ ...actual, revisit: e.target.value })}><option value="unsure">Unsure</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      {error && <p role="alert" className="text-amber-300">{error}</p>}
      <div className="flex gap-3"><button className={button + " bg-emerald-700"} disabled={busy}>{busy ? "Saving…" : "Save to My Travels"}</button><button type="button" className={button} disabled={busy} onClick={() => setCompleting(null)}>Cancel</button></div>
    </form></div>}
  </div>;
}
