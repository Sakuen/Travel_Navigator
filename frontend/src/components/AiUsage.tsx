"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

type Usage = {
  model: string; period: string; requests: number; requests_last_minute: number;
  successful_requests: number; failed_requests: number; measured_requests: number;
  input_tokens: number; output_tokens: number; total_tokens: number | null; scope: string;
  latest_error: { message: string; occurred_at: string; success_since: boolean } | null;
};

export default function AiUsage({ model }: { model: string }) {
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/ai/usage?model_name=${encodeURIComponent(model)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Usage status is unavailable. Is the backend running?");
        const result: Usage = await response.json();
        if (active) { setUsage(result); setError(""); }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Could not load usage.");
      } finally { if (active) setLoading(false); }
    };
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("ai-usage-changed", refresh);
    return () => { active = false; controller.abort(); window.clearInterval(interval); window.removeEventListener("ai-usage-changed", refresh); };
  }, [open, model]);
  const current = usage?.model === model ? usage : null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="ai-usage-panel" className="flex gap-2 items-center rounded-xl bg-neutral-800 border border-neutral-700 p-2 text-xs text-neutral-200"><Activity className="w-4 h-4" /><span>AI usage</span></button>
      {open && <section id="ai-usage-panel" aria-label="Gemini usage" className="absolute right-0 top-full mt-3 w-[min(360px,90vw)] max-h-[75vh] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl z-[100] text-sm">
        <div className="flex justify-between gap-3"><h2 className="font-bold">Gemini usage</h2><button onClick={() => setOpen(false)} aria-label="Close usage panel">✕</button></div>
        <p className="text-emerald-300 text-xs mt-1">{model}</p>
        <p className="mt-4 font-medium">Free allowance remaining: unavailable here</p>
        <p className="text-xs text-neutral-400 mt-2">Google applies request and token limits per model/project. This app cannot see the project’s exact remaining quota or usage from other apps.</p>
        <a href="https://aistudio.google.com/usage?tab=rate-limit" target="_blank" rel="noreferrer" className="inline-block mt-3 text-emerald-300 underline">View limits & usage in Google AI Studio ↗</a>
        {error ? <p role="alert" className="text-amber-300 mt-4">{error}</p> : current && <>
          <p className="text-xs text-neutral-400 mt-5">Observed by Lighthouse · {current.period.toLowerCase()}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
            <dt>API calls</dt><dd>{current.requests} ({current.requests_last_minute} in last minute)</dd>
            <dt>Failed calls</dt><dd>{current.failed_requests}</dd>
            <dt>Reported tokens</dt><dd>{current.total_tokens === null ? "No measurements yet" : current.total_tokens.toLocaleString()}</dd>
            <dt>Input / output</dt><dd>{current.input_tokens.toLocaleString()} / {current.output_tokens.toLocaleString()}</dd>
          </dl>
          <p className="text-xs text-neutral-500 mt-2">Token metadata available for {current.measured_requests} calls. Failures may not report tokens. Counting starts when tracking is installed; this is not your billing balance.</p>
          {current.latest_error && <div className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200"><strong>Last recorded error · {new Date(current.latest_error.occurred_at).toLocaleString()}</strong><p className="mt-2">{current.latest_error.message}</p>{current.latest_error.success_since && <p className="mt-2">A subsequent call succeeded.</p>}</div>}
        </>}
        {loading && <p className="text-xs text-neutral-500 mt-3">Refreshing…</p>}
        <p className="text-xs text-neutral-500 mt-4">Finding matches can use three calls: candidates, live research, and assessment. Changing models does not guarantee additional quota.</p>
      </section>}
    </div>
  );
}
