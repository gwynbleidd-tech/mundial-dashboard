"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Player, Breakdown, RealResults, RealExtra } from "@/lib/scoring";
import { buildEvolutionByDay, buildEvolutionByMatch } from "@/lib/evolution";
import { C } from "@/lib/theme";

const EvolucionChart = dynamic(() => import("@/components/EvolucionChart"), { ssr: false });

interface RankedEntry {
  player: Player;
  score: Breakdown;
}

type View = "general" | "dia" | "partido";
const VIEWS: [View, string][] = [
  ["general", "General"],
  ["dia", "Por día"],
  ["partido", "Por partido"],
];

interface Props {
  ranked: RankedEntry[];
  players: Player[];
  real: RealResults;
  extra: RealExtra;
  loading: boolean;
  onPick: (id: string) => void;
}

const PODIO = ["🥇", "🥈", "🥉"];

function buildShareText(ranked: RankedEntry[]): string {
  const fecha = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const anyPlayed = ranked.some(r => r.score.partidosJugados > 0);
  const maxPartidos = Math.max(...ranked.map(r => r.score.partidosJugados), 0);

  const line = "─".repeat(22);
  const rows = ranked.map((r, i) => {
    const pos = i < 3 ? PODIO[i] : `${String(i + 1).padStart(2)}. `;
    const nombre = r.player.nombre.padEnd(14);
    return `${pos} ${nombre} ${r.score.total} pts`;
  });

  const parts = [`🏆 Porra Mundial 2026 · ${fecha}`, line, ...rows, line];
  if (anyPlayed) parts.push(`${maxPartidos} partido${maxPartidos !== 1 ? "s" : ""} jugado${maxPartidos !== 1 ? "s" : ""}`);

  return parts.join("\n");
}

function ShareButton({ ranked }: { ranked: RankedEntry[] }) {
  const [status, setStatus] = useState<"idle" | "copied">("idle");

  async function handleShare() {
    const text = buildShareText(ranked);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Porra Mundial 2026", text });
        return;
      } catch {
        // user cancelled or share failed → fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      // clipboard blocked — nothing to do
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 14px",
        border: `1px solid ${C.line}`,
        borderRadius: 20,
        background: "none",
        cursor: "pointer",
        fontSize: 13,
        color: status === "copied" ? C.pitch : C.muted,
        fontWeight: status === "copied" ? 700 : 400,
        transition: "color .2s, border-color .2s",
      }}
    >
      {status === "copied" ? "✓ Copiado" : <><span style={{ fontSize: 15 }}>📤</span> Compartir</>}
    </button>
  );
}

export default function ClasificacionScreen({ ranked, players, real, extra, loading, onPick }: Props) {
  const [view, setView] = useState<View>("general");

  const evoByDay = useMemo(
    () => view === "dia" ? buildEvolutionByDay(players, real, extra) : [],
    [view, players, real, extra],
  );
  const evoByMatch = useMemo(
    () => view === "partido" ? buildEvolutionByMatch(players, real, extra) : [],
    [view, players, real, extra],
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: C.muted }}>
        Cargando…
      </div>
    );
  }

  const maxPts = ranked.length > 0 ? ranked[0].score.total : 0;
  const anyPlayed = ranked.some(r => r.score.partidosJugados > 0);
  const lastIdx = ranked.length - 1;
  const showLantern = anyPlayed && ranked.length > 1 && ranked[lastIdx].score.total < ranked[0].score.total;

  return (
    <div>
      {/* Selector de vista */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {VIEWS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{
              flex: 1,
              padding: "6px 4px",
              border: `1px solid ${view === id ? C.pitch : C.line}`,
              borderRadius: 20,
              background: view === id ? C.pitch : "transparent",
              color: view === id ? C.chalk : C.muted,
              fontSize: 12,
              fontWeight: view === id ? 700 : 400,
              cursor: "pointer",
              transition: "background .15s, color .15s, border-color .15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Vista General */}
      {view === "general" && (
        <>
          {maxPts === 0 && (
            <p style={{
              fontSize: 12, color: C.muted, textAlign: "center",
              marginBottom: 16, letterSpacing: ".03em",
            }}>
              Torneo aún no empezado · todos a 0 pts
            </p>
          )}
          {ranked.map((r, i) => {
            const n = r.score.partidosJugados;
            const signos1x2 = r.score.signos + r.score.exactos;
            const badge = anyPlayed && i < 3 ? PODIO[i] : (showLantern && i === lastIdx ? "🏮" : null);

            return (
              <button
                key={r.player.id}
                onClick={() => onPick(r.player.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 4px",
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  borderBottom: `1px solid ${C.line}`,
                  background: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ width: 34, flexShrink: 0, textAlign: "center" }}>
                  {badge ? (
                    <div style={{ fontSize: 26, lineHeight: 1 }}>{badge}</div>
                  ) : (
                    <div style={{
                      fontFamily: "'Anton', sans-serif", fontSize: 26,
                      color: C.muted, lineHeight: 1,
                    }}>
                      {i + 1}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>
                    {r.player.nombre}
                  </div>
                  <div style={{ height: 6, background: C.chalk, borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: maxPts > 0 ? `${(r.score.total / maxPts) * 100}%` : "0%",
                      background: i === 0 ? C.gold : C.pitch,
                      borderRadius: 3,
                      transition: "width .4s ease",
                    }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, color: C.ink, lineHeight: 1 }}>
                    {r.score.total}
                  </div>
                  {n > 0 && (
                    <>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: ".01em", marginTop: 2 }}>
                        {signos1x2}/{n} 1X2
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: ".01em" }}>
                        {r.score.exactos}/{n} exactos
                      </div>
                    </>
                  )}
                </div>
              </button>
            );
          })}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <ShareButton ranked={ranked} />
          </div>
        </>
      )}

      {/* Vistas de evolución */}
      {(view === "dia" || view === "partido") && (
        <EvolucionChart
          data={view === "dia" ? evoByDay : evoByMatch}
          players={players}
          mode={view}
        />
      )}
    </div>
  );
}
