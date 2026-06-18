"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPortadas, type Portada } from "@/lib/supabase";
import { C } from "@/lib/theme";

function formatFechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "short",
  });
}

type ItemWithIndex = { portada: Portada; flatIdx: number };

function splitColumns(
  items: ItemWithIndex[],
  getRatio: (p: Portada) => number,
): [ItemWithIndex[], ItemWithIndex[]] {
  const left: ItemWithIndex[] = [];
  const right: ItemWithIndex[] = [];
  let leftH = 0;
  let rightH = 0;
  for (const item of items) {
    const h = 1 / getRatio(item.portada);
    if (leftH <= rightH) {
      left.push(item);
      leftH += h;
    } else {
      right.push(item);
      rightH += h;
    }
  }
  return [left, right];
}

export default function ActualidadScreen() {
  const [portadas, setPortadas] = useState<Portada[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [measuredRatios, setMeasuredRatios] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    fetchPortadas()
      .then(setPortadas)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getRatio = useCallback(
    (p: Portada) => p.aspect_ratio ?? measuredRatios.get(p.id) ?? 1,
    [measuredRatios],
  );

  const goNext = useCallback(
    () => setLightboxIdx((i) => (i !== null && i < portadas.length - 1 ? i + 1 : i)),
    [portadas.length],
  );
  const goPrev = useCallback(
    () => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i)),
    [],
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, goNext, goPrev]);

  function handleMeasure(e: React.SyntheticEvent<HTMLImageElement>, id: number) {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    setMeasuredRatios((prev) => {
      if (prev.get(id) === ratio) return prev;
      const next = new Map(prev);
      next.set(id, ratio);
      return next;
    });
  }

  // Group by date, preserving flat index
  const dateGroups: { date: string; items: ItemWithIndex[] }[] = [];
  {
    const dateMap = new Map<string, ItemWithIndex[]>();
    portadas.forEach((p, flatIdx) => {
      if (!dateMap.has(p.fecha)) {
        const arr: ItemWithIndex[] = [];
        dateMap.set(p.fecha, arr);
        dateGroups.push({ date: p.fecha, items: arr });
      }
      dateMap.get(p.fecha)!.push({ portada: p, flatIdx });
    });
  }

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

  const lightboxPortada = lightboxIdx !== null ? portadas[lightboxIdx] : null;

  return (
    <div>
      {/* ── Lightbox ── */}
      {lightboxPortada !== null && lightboxIdx !== null && (
        <div
          onClick={() => setLightboxIdx(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,.93)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxPortada.url}
            alt={lightboxPortada.titulo ?? "Portada"}
            style={{ maxWidth: "92vw", maxHeight: "85vh", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Close */}
          <button
            onClick={() => setLightboxIdx(null)}
            style={navBtnStyle({ top: 16, right: 16 })}
            aria-label="Cerrar"
          >
            ×
          </button>

          {/* Prev */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              style={navBtnStyle({ left: 10, top: "50%", transform: "translateY(-50%)" })}
              aria-label="Anterior"
            >
              ‹
            </button>
          )}

          {/* Next */}
          {lightboxIdx < portadas.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              style={navBtnStyle({ right: 10, top: "50%", transform: "translateY(-50%)" })}
              aria-label="Siguiente"
            >
              ›
            </button>
          )}

          {/* Caption */}
          {(lightboxPortada.titulo || lightboxPortada.fecha) && (
            <div style={{
              position: "absolute", bottom: 20, left: 0, right: 0,
              textAlign: "center", pointerEvents: "none",
              padding: "0 60px",
            }}>
              {lightboxPortada.titulo && (
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
                  {lightboxPortada.titulo}
                </div>
              )}
              <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11, marginTop: 3 }}>
                {formatFechaLarga(lightboxPortada.fecha)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Masonry gallery by date ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {dateGroups.map(({ date, items }) => {
          const [left, right] = splitColumns(items, getRatio);
          return (
            <div key={date}>
              {/* Date separator */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: C.line }} />
                <span style={{
                  fontSize: 10.5, fontWeight: 600, color: C.muted,
                  textTransform: "uppercase", letterSpacing: ".07em",
                  whiteSpace: "nowrap",
                }}>
                  {formatFechaLarga(date)}
                </span>
                <div style={{ flex: 1, height: 1, background: C.line }} />
              </div>

              {/* Two-column masonry */}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {left.map(({ portada: p, flatIdx }) => (
                    <MasonryCard
                      key={p.id}
                      portada={p}
                      onClick={() => setLightboxIdx(flatIdx)}
                      onMeasure={p.aspect_ratio === null
                        ? (e) => handleMeasure(e, p.id)
                        : undefined}
                    />
                  ))}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {right.map(({ portada: p, flatIdx }) => (
                    <MasonryCard
                      key={p.id}
                      portada={p}
                      onClick={() => setLightboxIdx(flatIdx)}
                      onMeasure={p.aspect_ratio === null
                        ? (e) => handleMeasure(e, p.id)
                        : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared styles ──

function navBtnStyle(pos: React.CSSProperties): React.CSSProperties {
  return {
    position: "absolute", ...pos,
    width: 40, height: 40, borderRadius: "50%",
    border: "none", background: "rgba(255,255,255,.18)",
    color: "#fff", fontSize: 22, lineHeight: 1,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  };
}

// ── MasonryCard ──

interface MasonryCardProps {
  portada: Portada;
  onClick: () => void;
  onMeasure?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

function MasonryCard({ portada: p, onClick, onMeasure }: MasonryCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 8, overflow: "hidden",
        border: `1px solid ${C.line}`,
        cursor: "pointer", background: C.chalk,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.url}
        alt={p.titulo ?? "Portada"}
        loading="lazy"
        onLoad={onMeasure}
        style={{ width: "100%", display: "block" }}
      />
      <div style={{ padding: "6px 10px 8px" }}>
        {p.titulo && (
          <div style={{
            fontWeight: 700, fontSize: 11.5, color: C.ink,
            marginBottom: 2, lineHeight: 1.3,
          }}>
            {p.titulo}
          </div>
        )}
        <div style={{ fontSize: 10.5, color: C.muted, letterSpacing: ".01em" }}>
          {formatFechaCorta(p.fecha)}
        </div>
      </div>
    </div>
  );
}
