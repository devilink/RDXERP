"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

type Vehicle = {
  id: string; regNo: string; route: string | null; driver: string | null; driverPhone: string | null;
  tripActive: boolean; lat: number | null; lng: number | null; speed: number | null; lastSeenAt: string | null; trail: [number, number][];
};
type Stop = { id: string; name: string; lat: number; lng: number; route: string; pickupTime: string | null; mine: boolean };

function ago(iso: string | null, now = Date.now()) {
  if (!iso) return "never";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(iso).toLocaleString();
}

function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Live bus map. Polls /api/transport/positions every `interval` ms. Uses OpenStreetMap tiles (no API key). */
export function LiveMap({ child, interval = 5000 }: { child?: string; interval?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const fitted = useRef(false);
  const [data, setData] = useState<{ vehicles: Vehicle[]; stops: Stop[]; now: number } | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      L.current = mod;
      map.current = mod.map(el.current).setView([22.5726, 88.3639], 12);
      mod.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
      layer.current = mod.layerGroup().addTo(map.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Poll positions.
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/transport/positions${child ? `?child=${encodeURIComponent(child)}` : ""}`, { cache: "no-store" });
        if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
        if (!stop) { setData({ ...(await r.json()), now: Date.now() }); setError(""); }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Failed to load");
      }
    };
    load();
    const t = setInterval(load, interval);
    return () => { stop = true; clearInterval(t); };
  }, [child, interval]);

  // Draw.
  useEffect(() => {
    const Lf = L.current, m = map.current, g = layer.current;
    if (!Lf || !m || !g || !data) return;
    g.clearLayers();
    const bounds: [number, number][] = [];
    const byRoute = new Map<string, Stop[]>();
    for (const s of data.stops) {
      byRoute.set(s.route, [...(byRoute.get(s.route) ?? []), s]);
      bounds.push([s.lat, s.lng]);
      Lf.marker([s.lat, s.lng], {
        icon: Lf.divIcon({ className: "", html: `<div style="font-size:${s.mine ? 26 : 18}px;line-height:1">${s.mine ? "🏠" : "🚏"}</div>`, iconSize: [24, 24], iconAnchor: [12, 22] }),
      }).bindPopup(`<b>${escapeHtml(s.name)}</b><br>${escapeHtml(s.route)}${s.pickupTime ? `<br>Pickup ${escapeHtml(s.pickupTime)}` : ""}${s.mine ? "<br><b>Your stop</b>" : ""}`).addTo(g);
    }
    for (const stops of byRoute.values()) Lf.polyline(stops.map((s) => [s.lat, s.lng]), { color: "#94a3b8", dashArray: "6 6", weight: 3 }).addTo(g);
    for (const v of data.vehicles) {
      if (v.trail.length > 1) Lf.polyline(v.trail, { color: "#4f46e5", weight: 4, opacity: 0.6 }).addTo(g);
      if (v.lat == null || v.lng == null) continue;
      bounds.push([v.lat, v.lng]);
      Lf.marker([v.lat, v.lng], {
        icon: Lf.divIcon({ className: "", html: `<div style="font-size:30px;line-height:1;filter:${v.tripActive ? "none" : "grayscale(1)"}">🚌</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
        zIndexOffset: 1000,
      }).bindPopup(`<b>${escapeHtml(v.regNo)}</b><br>${escapeHtml(v.route ?? "")}<br>Driver: ${escapeHtml(v.driver ?? "—")}<br>${v.tripActive ? `On trip · ${v.speed ?? 0} km/h` : "Not on trip"}<br>Updated ${ago(v.lastSeenAt)}`).addTo(g);
    }
    if (!fitted.current && bounds.length) {
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [data, ready]);

  const mine = data?.stops.find((s) => s.mine);
  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
      <div ref={el} className="h-[480px] w-full overflow-hidden rounded-xl border border-slate-200" />
      <div className="grid gap-3 md:grid-cols-2">
        {data?.vehicles.length === 0 && <p className="text-sm text-slate-500">No bus is assigned to this route yet.</p>}
        {data?.vehicles.map((v) => {
          const eta = mine && v.lat != null && v.lng != null && v.tripActive ? distanceKm([v.lat, v.lng], [mine.lat, mine.lng]) : null;
          const stale = !v.lastSeenAt || data.now - new Date(v.lastSeenAt).getTime() > 120_000;
          return (
            <div key={v.id} className="card flex items-center gap-4 py-3">
              <div className="text-3xl">🚌</div>
              <div className="flex-1 text-sm">
                <div className="font-semibold">{v.regNo} <span className="font-normal text-slate-500">· {v.route ?? "No route"}</span></div>
                <div className="text-slate-600">Driver {v.driver ?? "—"}{v.driverPhone ? ` · ${v.driverPhone}` : ""}</div>
                <div className="text-xs text-slate-500">
                  {v.tripActive ? (stale ? "⚠ On trip, GPS signal lost" : `● Live · ${v.speed ?? 0} km/h`) : "Not on trip"} · updated {ago(v.lastSeenAt, data.now)}
                  {eta !== null && <> · <b>{eta.toFixed(1)} km</b> from your stop (~{Math.max(1, Math.round((eta / 20) * 60))} min)</>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
