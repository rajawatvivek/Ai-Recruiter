"use client";
import { useState, useEffect, useCallback } from "react";

// Small fetch helper that surfaces the server's friendly error messages
export async function api(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export const post = (url, body, method = "POST") =>
  api(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const initials = (n = "") => (n.startsWith("Candidate #") ? "#" : n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?");
export const scoreLabel = (s) => (s >= 90 ? "Excellent" : s >= 80 ? "Very Good" : s >= 70 ? "Good" : s >= 50 ? "Fair" : "Low");
export const STATUSES = ["Shortlisted", "Review", "Rejected"];
export const COLORS = ["#4f2fd6", "#0ea5a5", "#f59e0b", "#ec4899"];
export const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

// Loads (and caches server-side) one AI analysis for a candidate: "gap" | "ats" | "questions"
export function useAi(id, kind) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const run = useCallback(
    (refresh) => {
      setState((s) => ({ ...s, loading: true, error: "" }));
      post("/api/ai", { candidateId: id, kind, refresh })
        .then((r) => setState({ data: r.data, loading: false, error: "" }))
        .catch((e) => setState({ data: null, loading: false, error: e.message }));
    },
    [id, kind]
  );
  useEffect(() => { run(false); }, [run]);
  return { ...state, refresh: () => run(true) };
}

// Shows loading / error states around an AI result
export function Wait({ s, children }) {
  if (s.loading) return <div className="card"><p className="muted">✨ Analyzing with AI… the first run takes a few seconds, then results are saved.</p></div>;
  if (s.error) return <div className="card"><p className="error">{s.error}</p><button className="btn" style={{ marginTop: 10 }} onClick={s.refresh}>Try again</button></div>;
  return children;
}

/* ---------- Small SVG charts (no chart library) ---------- */

// Circular score ring
export function Ring({ value, size = 150, stroke = 12, caption, gradient }) {
  const r = (size - stroke) / 2 - 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {gradient && <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2563eb" /><stop offset="1" stopColor="#ec4899" /></linearGradient></defs>}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ecebf8" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gradient ? "url(#rg)" : "#4f2fd6"} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - value / 100)} />
      </svg>
      <div><b style={{ fontSize: size / 4.5 }}>{value}{gradient ? "" : "%"}</b>{caption && <small>{caption}</small>}</div>
    </div>
  );
}

// Radar chart: axes = names, series = [{ name, values, color, dashed }]
export function Radar({ axes, series, size = 320 }) {
  const W = size + 140, cx = W / 2, cy = size / 2, r = size / 2 - 55, n = axes.length;
  const pt = (i, v) => {
    const a = ((-90 + (360 / n) * i) * Math.PI) / 180;
    return [cx + r * (v / 100) * Math.cos(a), cy + r * (v / 100) * Math.sin(a)];
  };
  const poly = (vals) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${size}`} style={{ width: "100%", maxWidth: W }}>
      {[25, 50, 75, 100].map((l) => <polygon key={l} points={poly(axes.map(() => l))} fill="none" stroke="#e5e7ef" />)}
      {axes.map((a, i) => { const [x, y] = pt(i, 100); return <line key={a} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7ef" />; })}
      {series.map((s) => (
        <g key={s.name}>
          <polygon points={poly(s.values)} fill={s.color} fillOpacity="0.15" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined} />
          {s.values.map((v, i) => { const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r="3.5" fill={s.color} />; })}
        </g>
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 120);
        return <text key={a} x={x} y={y} fontSize="11" textAnchor={x < cx - 5 ? "end" : x > cx + 5 ? "start" : "middle"} dominantBaseline="middle" fill="#1c1f33">{a}</text>;
      })}
    </svg>
  );
}

// Grouped vertical bars: cats = labels, series = [{ name, color, values }]
export function GroupBars({ cats, series, h = 200 }) {
  const W = 600, pad = 30, gw = (W - pad) / cats.length, bw = Math.min(28, (gw - 20) / series.length);
  return (
    <svg viewBox={`0 0 ${W} ${h + 40}`} style={{ width: "100%" }}>
      {[0, 25, 50, 75, 100].map((t) => {
        const y = h - (h * t) / 100 + 10;
        return <g key={t}><line x1={pad} x2={W} y1={y} y2={y} stroke="#eef0f6" /><text x={pad - 6} y={y + 3} fontSize="9" textAnchor="end" fill="#6b7088">{t}</text></g>;
      })}
      {cats.map((cat, ci) => (
        <g key={cat}>
          {series.map((s, si) => {
            const bh = (h * s.values[ci]) / 100;
            return <rect key={s.name} x={pad + ci * gw + (gw - bw * series.length) / 2 + si * bw} y={h - bh + 10} width={bw - 3} height={bh} rx="3" fill={s.color} />;
          })}
          <text x={pad + ci * gw + gw / 2} y={h + 28} fontSize="11" textAnchor="middle" fill="#1c1f33">{cat}</text>
        </g>
      ))}
    </svg>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((i) => <span key={i.name}><i style={{ background: i.color }} />{i.name}</span>)}
    </div>
  );
}

// Donut chart: parts = [{ name, value, color }]
export function Donut({ parts, size = 150, center }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = size / 2 - 12, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ecebf8" strokeWidth="18" />
        {parts.map((p) => {
          const len = (p.value / total) * circ;
          const el = <circle key={p.name} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </svg>
      <div>{center}</div>
    </div>
  );
}
