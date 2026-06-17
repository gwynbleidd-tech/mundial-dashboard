"use client";

import { useState } from "react";
import type { Player, RealResults } from "@/lib/scoring";
import { scoreMatch, GRUPO_PTS } from "@/lib/scoring";
import type { YoutubeUrls } from "@/lib/supabase";
import horariosData from "@/data/horarios_grupos.json";
import { C } from "@/lib/theme";

// ---- tipos ----

interface Fixture {
  partido: string;
  local: string;
  visitante: string;
  kickoff: string;
}
const horarios = horariosData as Record<string, Fixture[]>;
const DAYS = Object.keys(horarios).sort();

// ---- helpers de fecha/hora ----

function todayString(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDefaultDay(): string {
  const today = todayString();
  if (DAYS.includes(today)) return today;
  const upcoming = DAYS.filter((d) => d > today);
  return upcoming.length ? upcoming[0] : DAYS[DAYS.length - 1];
}

function formatDia(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // new Date(y, m-1, d) usa hora local → día de semana fiable sin desfase de zona
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("es-ES", { weekday: "long" });
  const month = date.toLocaleDateString("es-ES", { month: "long" });
  return `${weekday} ${d} de ${month}`;
}

// Extrae HH:mm del ISO sin parsear → sin conversión de zona
function formatHora(kickoff: string): string {
  return kickoff.slice(11, 16);
}

// ---- estilos de hit ----

const HIT_COLOR: Record<"exacto" | "signo" | "fallo", string> = {
  exacto: "#2E8B57",
  signo:  "#B87333",
  fallo:  C.rojo,
};


// ---- subcomponentes ----

function Score({ a, b }: { a: number; b: number }) {
  return (
    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
      {a}<span style={{ color: C.muted, margin: "0 3px" }}>–</span>{b}
    </span>
  );
}

const hStyle: React.CSSProperties = {
  fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 22,
  color: C.ink, margin: 0, letterSpacing: ".01em", textTransform: "uppercase",
};

const btnBase: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 3, flexShrink: 0,
  background: "none", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 18, fontWeight: 700,
};

// ---- componente principal ----

interface Props {
  players: Player[];
  real: RealResults;
  youtube: YoutubeUrls;
}

export default function JornadaScreen({ players, real, youtube }: Props) {
  const [day, setDay] = useState<string>(getDefaultDay);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const idx = DAYS.indexOf(day);
  const fixtures = (horarios[day] ?? [])
    .slice()
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  function toggleFixture(partido: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(partido) ? next.delete(partido) : next.add(partido);
      return next;
    });
  }

  return (
    <div>
      <h2 style={hStyle}>Por día</h2>

      {/* Selector de día */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
        <button
          onClick={() => setDay(DAYS[idx - 1])}
          disabled={idx === 0}
          style={{
            ...btnBase,
            border: `1px solid ${idx === 0 ? C.line : C.ink}`,
            cursor: idx === 0 ? "default" : "pointer",
            color: idx === 0 ? C.line : C.ink,
          }}
          aria-label="Día anterior"
        >
          ‹
        </button>

        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          style={{
            flex: 1, height: 36, border: `1px solid ${C.ink}`,
            borderRadius: 3, background: C.paper, color: C.ink,
            fontWeight: 700, fontSize: 13, letterSpacing: ".01em",
            padding: "0 8px", cursor: "pointer", appearance: "none",
            textAlign: "center",
          }}
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>{formatDia(d)}</option>
          ))}
        </select>

        <button
          onClick={() => setDay(DAYS[idx + 1])}
          disabled={idx === DAYS.length - 1}
          style={{
            ...btnBase,
            border: `1px solid ${idx === DAYS.length - 1 ? C.line : C.ink}`,
            cursor: idx === DAYS.length - 1 ? "default" : "pointer",
            color: idx === DAYS.length - 1 ? C.line : C.ink,
          }}
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>

      {/* Lista de partidos */}
      <div style={{ marginTop: 16 }}>
        {fixtures.length === 0 && (
          <p style={{ color: C.muted, textAlign: "center", paddingTop: 24 }}>
            Sin partidos este día
          </p>
        )}
        {fixtures.map((fixture) => {
          const r = real[fixture.partido];
          const isOpen = open.has(fixture.partido);
          const yt = youtube[fixture.partido];

          return (
            <div key={fixture.partido} style={{ borderBottom: `1px solid ${C.line}` }}>

              {/* Cabecera colapsable */}
              <button
                onClick={() => toggleFixture(fixture.partido)}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  gap: 8, padding: "11px 2px",
                  border: "none", background: "none", cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {/* Hora */}
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                  color: C.muted, flexShrink: 0, width: 36,
                }}>
                  {formatHora(fixture.kickoff)}
                </span>

                {/* Equipos */}
                <span style={{
                  flex: 1, fontWeight: 700, fontSize: 14, color: C.ink,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textAlign: "left",
                }}>
                  {fixture.local} – {fixture.visitante}
                </span>

                {/* Resultado o estado */}
                <span style={{ fontSize: 13, flexShrink: 0 }}>
                  {r
                    ? <Score a={r.local} b={r.visitante} />
                    : <span style={{ color: C.muted, fontSize: 11 }}>pendiente</span>}
                </span>

                {/* YouTube */}
                {yt && (
                  <a
                    href={yt}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Ver resumen"
                    style={{
                      flexShrink: 0, fontSize: 15, color: C.rojo,
                      textDecoration: "none", lineHeight: 1,
                      padding: "2px 4px",
                    }}
                  >
                    ▶
                  </a>
                )}

                {/* Chevron */}
                <span style={{
                  flexShrink: 0, fontSize: 12, color: C.muted,
                  transform: isOpen ? "rotate(90deg)" : "none",
                  transition: "transform .15s ease",
                  display: "inline-block", width: 14, textAlign: "center",
                }}>
                  ›
                </span>
              </button>

              {/* Predicciones expandidas */}
              {isOpen && (
                <div style={{ paddingBottom: 8, paddingLeft: 44 }}>
                  {players.map((p) => {
                    const pm = p.fase_grupos.find((m) => m.partido === fixture.partido);
                    if (!pm) return null;
                    const s = r ? scoreMatch(pm.pred, r, GRUPO_PTS) : null;
                    const hit = (s?.hit ?? null) as "exacto" | "signo" | "fallo" | null;

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "3px 2px",
                          borderBottom: `1px solid ${C.chalk}`,
                        }}
                      >
                        <span style={{
                          fontSize: 12, color: C.muted, fontWeight: 400,
                          width: 72, flexShrink: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {p.nombre.split(" ")[0]}
                        </span>

                        <span style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 13,
                          color: hit ? HIT_COLOR[hit] : C.muted,
                          fontWeight: hit ? 600 : 400,
                          flexShrink: 0,
                        }}>
                          {pm.pred.local}–{pm.pred.visitante}
                        </span>

                        <span style={{
                          fontFamily: "'DM Mono', monospace", fontSize: 11,
                          color: s && s.pts > 0 ? C.pitch : C.line,
                          fontWeight: s && s.pts > 0 ? 700 : 400,
                          flexShrink: 0, whiteSpace: "nowrap",
                        }}>
                          {s ? `+${s.pts} pts` : "–"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
