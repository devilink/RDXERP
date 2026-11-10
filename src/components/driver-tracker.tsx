"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Runs on the driver's phone during a trip: watches GPS and posts the position
 * to the server at most every `every` ms. Keep the page open (screen on) while driving.
 */
export function DriverTracker({ active, every = 5000 }: { active: boolean; every?: number }) {
  const [status, setStatus] = useState(active ? "Waiting for GPS…" : "Trip not started");
  const [last, setLast] = useState<{ lat: number; lng: number; acc: number; at: string } | null>(null);
  const [sent, setSent] = useState(0);
  const lastSent = useRef(0);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!("geolocation" in navigator)) {
      const t = setTimeout(() => setStatus("This device has no GPS / location support."));
      return () => clearTimeout(t);
    }
    // Ask the browser to keep the screen awake so tracking isn't paused.
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (wakeLock.current = l)).catch(() => {});

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords;
        setLast({ lat, lng, acc: Math.round(accuracy), at: new Date().toLocaleTimeString() });
        if (Date.now() - lastSent.current < every) return;
        lastSent.current = Date.now();
        try {
          const r = await fetch("/api/transport/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng, speed }),
          });
          if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
          setSent((n) => n + 1);
          setStatus("● Sharing live location");
        } catch (e) {
          setStatus(`Upload failed: ${e instanceof Error ? e.message : "network error"} — retrying`);
        }
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "Location permission denied. Allow location access in browser settings." : `GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      wakeLock.current?.release().catch(() => {});
    };
  }, [active, every]);

  return (
    <div className="rounded-xl bg-slate-900 p-5 text-slate-50">
      <div className="text-lg font-semibold">{status}</div>
      {last && (
        <div className="mt-2 font-mono text-sm text-slate-300">
          {last.lat.toFixed(5)}, {last.lng.toFixed(5)} · ±{last.acc} m · {last.at}
        </div>
      )}
      <div className="mt-1 text-xs text-slate-300">Updates sent: {sent}</div>
    </div>
  );
}
