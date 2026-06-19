"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Player, Breakdown, RealResults, RealExtra } from "@/lib/scoring";
import { buildEvolutionByDay, buildEvolutionByMatch } from "@/lib/evolution";
import { C } from "@/lib/theme";
import type { HighlightMode } from "@/lib/highlight";
import { computeBadges, BADGES } from "@/lib/badges";
import type { PlayerBadge } from "@/lib/badges";

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

function barColor(position: number): string {
  if (position === 0) return "#C8A23A"; // oro
  if (position === 1) return "#A8A9AD"; // plata
  if (position === 2) return "#CD7F32"; // bronce
  // posiciones 3-7 (4º a 8º): verde con opacidad decreciente
  const opacity = 1 - ((position - 3) / 4) * 0.65; // 1.0 en 4º, 0.35 en 8º
  return `rgba(27, 94, 58, ${opacity.toFixed(2)})`; // C.pitch con opacidad
}

function BadgesPanel({ badges, onClose }: { badges: PlayerBadge[]; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(14,26,43,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 460,
          background: C.paper,
          borderRadius: "16px 16px 0 0",
          padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 20, letterSpacing: ".02em", color: C.ink }}>
            INSIGNIAS
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.muted, padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        {BADGES.map(badge => {
          const awarded = badges.find(b => b.badge.id === badge.id);
          return (
            <div key={badge.id} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "12px 0",
              borderBottom: `1px solid ${C.line}`,
              opacity: awarded ? 1 : 0.4,
            }}>
              <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0, width: 36, textAlign: "center" }}>
                {badge.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{badge.name}</span>
                  {awarded && (
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: badge.positive ? C.pitch : C.rojo,
                      background: badge.positive ? "#e8f5ee" : "#fdecea",
                      borderRadius: 10, padding: "1px 8px",
                    }}>
                      {awarded.playerName}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{badge.description}</div>
                {awarded && (
                  <div style={{
                    fontSize: 11, color: badge.positive ? C.pitch : C.rojo,
                    marginTop: 4, fontFamily: "'DM Mono', monospace", letterSpacing: ".01em",
                  }}>
                    {awarded.detail}
                  </div>
                )}
                {!awarded && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: "italic" }}>
                    Sin asignar aún
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const HIGHLIGHT_TOGGLES: { id: HighlightMode; label: string; emoji: string; color: string }[] = [
  { id: "gloria", label: "Camino a la gloria", emoji: "🏆", color: C.gold },
  { id: "pozo",   label: "Huyendo del pozo",   emoji: "🪣", color: C.rojo },
];

export default function ClasificacionScreen({ ranked, players, real, extra, loading, onPick }: Props) {
  const [view, setView] = useState<View>("general");
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("none");
  const [showBadges, setShowBadges] = useState(false);

  const rankedIds = ranked.map(r => r.player.id);

  const badges = useMemo(
    () => computeBadges(players, real, extra, rankedIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, real, extra, rankedIds.join(",")],
  );

  const badgesByPlayer = useMemo(() => {
    const map: Record<string, PlayerBadge[]> = {};
    for (const b of badges) {
      if (!map[b.playerId]) map[b.playerId] = [];
      map[b.playerId].push(b);
    }
    return map;
  }, [badges]);

  function toggleHighlight(id: HighlightMode) {
    setHighlightMode(prev => prev === id ? "none" : id);
  }

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
            const isPodio = anyPlayed && i < 3;
            const isPozo = showLantern && i === lastIdx;

            // Paletas por posición
            const ROW_STYLES = isPodio ? [
              { bg: "#FDF8E7", border: "#E8D48A", ptsColor: "#B8860B", mutedColor: "#9A7B2A", badgeBg: "rgba(200,162,58,0.15)" },
              { bg: "#F5F5F6", border: "#C8C9CD", ptsColor: "#6B7280", mutedColor: "#9CA3AF", badgeBg: "rgba(168,169,173,0.15)" },
              { bg: "#FDF0E7", border: "#DFA882", ptsColor: "#A0522D", mutedColor: "#B87333", badgeBg: "rgba(205,127,50,0.15)" },
            ][i] : null;

            const rowBg       = isPodio ? ROW_STYLES!.bg : isPozo ? "#1E1B2E" : "none";
            const rowBorder   = isPodio ? ROW_STYLES!.border : isPozo ? "#3D2030" : C.line;
            const nombreColor = isPodio ? ROW_STYLES!.ptsColor : isPozo ? "#C47A7A" : C.ink;
            const ptsColor    = isPodio ? ROW_STYLES!.ptsColor : isPozo ? "#C47A7A" : C.ink;
            const statsColor  = isPodio ? ROW_STYLES!.mutedColor : isPozo ? "#7A5555" : C.muted;
            const barBg       = isPodio ? "rgba(255,255,255,0.5)" : isPozo ? "rgba(255,255,255,0.05)" : C.chalk;
            const posColor    = isPodio ? ROW_STYLES!.ptsColor : isPozo ? "#C47A7A" : C.muted;

            return (
              <button
                key={r.player.id}
                onClick={() => onPick(r.player.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: isPodio ? "14px 10px" : "12px 4px",
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  borderBottom: `1px solid ${rowBorder}`,
                  background: rowBg,
                  cursor: "pointer", textAlign: "left",
                  borderRadius: isPodio ? 8 : isPozo ? 8 : 0,
                  marginBottom: isPodio || isPozo ? 4 : 0,
                  boxShadow: isPozo ? "inset 0 0 20px rgba(150,20,20,0.08), 0 0 8px rgba(150,20,20,0.06)" : "none",
                }}
              >
                {/* Posición / podio / pozo */}
                <div style={{ width: 34, flexShrink: 0, textAlign: "center" }}>
                  {isPodio ? (
                    <div style={{ fontSize: 20, lineHeight: 1 }}>{PODIO[i]}</div>
                  ) : isPozo ? (
                    <div style={{
                      fontSize: 20, lineHeight: 1,
                      filter: "drop-shadow(0 0 3px rgba(180,50,50,0.5))",
                    }}>🏮</div>
                  ) : (
                    <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 20, color: posColor, lineHeight: 1 }}>
                      {i + 1}
                    </div>
                  )}
                </div>

                {/* Nombre + barra + insignias */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: nombreColor }}>
                      {r.player.nombre}
                    </span>
                    {isPozo && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/clipeto/clipeto.svg" alt="" style={{ height: 14, width: "auto" }} />
                        <span style={{ fontSize: 10, color: "#C47A7A", letterSpacing: ".02em" }}>
                          This guy uses Clipeto
                        </span>
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <div style={{ flex: 1, height: 6, background: barBg, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: maxPts > 0 ? `${(r.score.total / maxPts) * 100}%` : "0%",
                        background: isPozo ? "rgba(180,50,50,0.4)" : barColor(i),
                        borderRadius: 3,
                        transition: "width .4s ease",
                        boxShadow: isPozo ? "0 0 4px rgba(180,50,50,0.25)" : "none",
                      }} />
                    </div>
                    {(badgesByPlayer[r.player.id] ?? []).length > 0 && (
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        {(badgesByPlayer[r.player.id] ?? []).map(pb => (
                          <span key={pb.badge.id} style={{ fontSize: 12, lineHeight: 1 }} title={pb.badge.name}>
                            {pb.badge.emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Puntos y stats */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, color: ptsColor, lineHeight: 1 }}>
                    {r.score.total}
                  </div>
                  {n > 0 && (
                    <>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: statsColor, letterSpacing: ".01em", marginTop: 2 }}>
                        {signos1x2}/{n} 1X2
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: statsColor, letterSpacing: ".01em" }}>
                        {r.score.exactos}/{n} exactos
                      </div>
                    </>
                  )}
                </div>
              </button>
            );
          })}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 20 }}>
            <ShareButton ranked={ranked} />
            <button
              onClick={() => setShowBadges(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px",
                border: `1px solid ${C.line}`,
                borderRadius: 20,
                background: "none",
                cursor: "pointer",
                fontSize: 13,
                color: C.muted,
              }}
            >
              <span style={{ fontSize: 15 }}>🏅</span> Insignias
            </button>
          </div>
        </>
      )}

      {/* Vistas de evolución */}
      {(view === "dia" || view === "partido") && (
        <div>
          {/* Toggles de highlight */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {HIGHLIGHT_TOGGLES.map(({ id, label, emoji, color }) => {
              const active = highlightMode === id;
              return (
                <button
                  key={id}
                  onClick={() => toggleHighlight(id)}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "7px 8px",
                    border: `1.5px solid ${active ? color : C.line}`,
                    borderRadius: 10,
                    background: active ? color : "transparent",
                    color: active ? "#fff" : C.muted,
                    fontSize: 11.5,
                    fontWeight: active ? 700 : 400,
                    cursor: "pointer",
                    transition: "background .15s, color .15s, border-color .15s",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{emoji}</span>
                  {label}
                </button>
              );
            })}
          </div>

          <EvolucionChart
            data={view === "dia" ? evoByDay : evoByMatch}
            players={players}
            mode={view}
            highlightMode={highlightMode}
          />
        </div>
      )}

      {/* Panel de insignias */}
      {showBadges && (
        <BadgesPanel badges={badges} onClose={() => setShowBadges(false)} />
      )}
    </div>
  );
}
