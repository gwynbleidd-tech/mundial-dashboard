"use client";

import { useState, useEffect } from "react";
import { fetchPortadas, type Portada } from "@/lib/supabase";
import { C } from "@/lib/theme";

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function ActualidadScreen() {
  const [portadas, setPortadas] = useState<Portada[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetchPortadas()
      .then(setPortadas)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: C.muted }}>
        Cargando…
      </div>
    );
  }

  if (portadas.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>📰</div>
        <p style={{ fontSize: 14, color: C.muted }}>No hay portadas aún</p>
      </div>
    );
  }

  return (
    <div>
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,.93)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Portada"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute", top: 16, right: 16,
              width: 36, height: 36, borderRadius: "50%",
              border: "none", background: "rgba(255,255,255,.18)",
              color: "#fff", fontSize: 20, lineHeight: 1,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Gallery */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {portadas.map((p) => (
          <div
            key={p.id}
            style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.line}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.titulo ?? "Portada"}
              loading="lazy"
              onClick={() => setLightbox(p.url)}
              style={{ width: "100%", display: "block", cursor: "pointer" }}
            />
            <div style={{ padding: "10px 14px" }}>
              {p.titulo && (
                <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 3 }}>
                  {p.titulo}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: C.muted, letterSpacing: ".01em" }}>
                {formatFecha(p.fecha)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
