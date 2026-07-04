"use client";

import { useState } from "react";
import type { Player, RealResults, RealExtra, Match, Pred } from "@/lib/scoring";
import { scoreMatch, GRUPO_PTS, CLASIF_PTS } from "@/lib/scoring";
import type { YoutubeUrls } from "@/lib/supabase";
import horariosData from "@/data/horarios_grupos.json";
import crusesData from "@/data/cruces_eliminatoria.json";
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

type CruceReal = { partido: string; local: string; visitante: string; kickoff?: string; jugadores: string[] };
const CRUCES = crusesData as Record<string, CruceReal[]>;

const KO_PTS: Record<string, [number, number, number]> = {
  dieciseisavos: [3, 2, 5],
  octavos:       [3, 2, 5],
  cuartos:       [4, 2, 6],
  semis:         [6, 4, 10],
  "3y4":         [10, 5, 15],
  final:         [12, 6, 18],
};

const KO_RONDAS = [
  { key: "dieciseisavos", label: "1/16"    },
  { key: "octavos",       label: "Octavos" },
  { key: "cuartos",       label: "Cuartos" },
  { key: "semis",         label: "Semis"   },
  { key: "3y4",           label: "3º/4º"  },
  { key: "final",         label: "Final"   },
] as const;

type KoRondaKey = typeof KO_RONDAS[number]["key"];
type Phase = "grupos" | "eliminatorias";

const NEXT_CLASIF_RONDA: Partial<Record<KoRondaKey, string>> = {
  dieciseisavos: "octavos",
  octavos:       "cuartos",
  cuartos:       "semis",
  semis:         "final",
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const DEFAULT_PHASE: Phase = TODAY_ISO >= "2026-06-28" ? "eliminatorias" : "grupos";

// Última ronda con kickoffs definidos = ronda activa
const DEFAULT_KO_RONDA: KoRondaKey = (() => {
  const keys: KoRondaKey[] = ["dieciseisavos", "octavos", "cuartos", "semis", "3y4", "final"];
  let active: KoRondaKey = "dieciseisavos";
  for (const key of keys) {
    if ((CRUCES["enfr_" + key] ?? []).some((c) => c.kickoff)) active = key;
  }
  return active;
})();

function formatKoHora(kickoff: string): string {
  return new Date(kickoff).toLocaleString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
}

function formatKoDia(kickoff: string): string {
  return new Date(kickoff).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });
}

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
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("es-ES", { weekday: "long" });
  const month = date.toLocaleDateString("es-ES", { month: "long" });
  return `${weekday} ${d} de ${month}`;
}

function formatHora(kickoff: string): string {
  return kickoff.slice(11, 16);
}

function nowMadrid(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "Europe/Madrid" })
    .replace(" ", "T")
    .slice(0, 16);
}

type MatchStatus = "proximo" | "pendiente" | "finalizado";

function getMatchStatus(kickoff: string, hasResult: boolean): MatchStatus {
  if (hasResult) return "finalizado";
  return nowMadrid() < kickoff.slice(0, 16) ? "proximo" : "pendiente";
}

// ---- estilos de hit ----

const HIT_COLOR: Record<"exacto" | "signo" | "fallo", string> = {
  exacto: "#2E8B57",
  signo:  "#B87333",
  fallo:  C.rojo,
};


// ---- subcomponentes ----

const STATUS_CFG: Record<"proximo" | "pendiente", { label: string; color: string; border: string }> = {
  proximo:   { label: "Próx.",  color: C.muted,   border: C.line },
  pendiente: { label: "Pend.",  color: "#B87333",  border: "#D4A06A" },
};

function StatusBadge({ status }: { status: "proximo" | "pendiente" }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
      textTransform: "uppercase", color: cfg.color,
      border: `1px solid ${cfg.border}`, borderRadius: 2,
      padding: "2px 5px", flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

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
  extra: RealExtra;
  youtube: YoutubeUrls;
}

export default function JornadaScreen({ players, real, extra, youtube }: Props) {
  const [phase, setPhase] = useState<Phase>(DEFAULT_PHASE);
  const [day, setDay] = useState<string>(getDefaultDay);
  const [koRonda, setKoRonda] = useState<KoRondaKey>(DEFAULT_KO_RONDA);
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

  function switchPhase(p: Phase) {
    setPhase(p);
    setOpen(new Set());
  }

  return (
    <div>
      <h2 style={hStyle}>Calendario</h2>

      {/* Toggle Grupos / Eliminatorias */}
      <div style={{ display: "flex", gap: 6, marginTop: 14, marginBottom: 18 }}>
        {(["grupos", "eliminatorias"] as const).map((p) => (
          <button
            key={p}
            onClick={() => switchPhase(p)}
            style={{
              flex: 1, padding: "7px 0", borderRadius: 3, fontSize: 12, fontWeight: 700,
              border: `1px solid ${phase === p ? C.ink : C.line}`,
              background: phase === p ? C.ink : "transparent",
              color: phase === p ? C.chalk : C.muted,
              cursor: "pointer",
            }}
          >
            {p === "grupos" ? "Fase de grupos" : "Eliminatorias"}
          </button>
        ))}
      </div>

      {/* ── FASE DE GRUPOS ── */}
      {phase === "grupos" && (<>

      {/* Selector de día */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

          // 1. Buscamos a Larios y su predicción para este partido
          const larios = players.find(p => p.nombre.toLowerCase().includes("larios"));
          const lariosPred = larios?.fase_grupos.find(m => m.partido === fixture.partido)?.pred;

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
                  {(() => {
                    const status = getMatchStatus(fixture.kickoff, !!r);
                    if (status === "finalizado") return <Score a={r!.local} b={r!.visitante} />;
                    return <StatusBadge status={status} />;
                  })()}
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

                    // 2. Comprobar si comparte el mismo resultado exacto que Larios (y que no sea el propio Larios)
                    const esLarios = p.id === larios?.id;
                    const coincideConLarios = !esLarios && lariosPred && 
                      lariosPred.local === pm.pred.local && 
                      lariosPred.visitante === pm.pred.visitante;

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

                        {/* 3. Renderizado de las etiquetas de gafe condicionales */}
                        {coincideConLarios && (
                          <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 4 }}>
                            {(() => {
                              if (!r) {
                                // Sin resultado real aún
                                return <span style={{ color: C.rojo }}>Gafado 👓</span>;
                              }
                              // Con resultado real ya relleno
                              if (s!.pts === 0) {
                                return <span style={{ color: C.rojo }}>Efecto Larios!👓</span>;
                              } else if (s!.pts === 2 || s!.pts === 3) {
                                return <span style={{ color: "#D4A06A" }}>Te libraste!</span>;
                              } else if (s!.pts >= 6) {
                                return <span style={{ color: "#2E8B57" }}>Milagro!</span>;
                              }
                              return null;
                            })()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      </>)}

      {/* ── ELIMINATORIAS ── */}
      {phase === "eliminatorias" && (
        <div>
          {/* Selector de ronda */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
            {KO_RONDAS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setKoRonda(key); setOpen(new Set()); }}
                style={{
                  padding: "5px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${koRonda === key ? C.ink : C.line}`,
                  background: koRonda === key ? C.ink : "transparent",
                  color: koRonda === key ? C.chalk : C.muted,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lista de partidos KO */}
          {(() => {
            const cruces = CRUCES["enfr_" + koRonda] ?? [];
            const esRondaFutura = !cruces.some((c) => c.kickoff) && !cruces.some((c) => real[c.partido]);
            if (esRondaFutura) return (
              <div style={{
                textAlign: "center", padding: "48px 20px",
                color: C.muted,
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
                <div style={{
                  fontFamily: "'Anton', sans-serif", fontSize: 16,
                  letterSpacing: ".06em", textTransform: "uppercase",
                  color: C.muted, marginBottom: 6,
                }}>
                  Próximamente
                </div>
                <div style={{ fontSize: 12 }}>
                  Los partidos de esta ronda aún no han comenzado
                </div>
              </div>
            );
            return (<div>
            {cruces.map((cruce) => {
              const r = real[cruce.partido];
              const isOpen = open.has(cruce.partido);
              const yt = youtube[cruce.partido];
              const baremo = KO_PTS[koRonda];
              const acertaron = cruce.jugadores.length;
              const matchStatus = cruce.kickoff ? getMatchStatus(cruce.kickoff, !!r) : (r ? "finalizado" : "proximo");

              return (
                <div key={cruce.partido} style={{ borderBottom: `1px solid ${C.line}` }}>

                  {/* Cabecera */}
                  <button
                    onClick={() => toggleFixture(cruce.partido)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center",
                      gap: 8, padding: "11px 2px",
                      border: "none", background: "none", cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {/* Hora + Día (columna izquierda, igual que fase de grupos) */}
                    {cruce.kickoff && (
                      <div style={{ flexShrink: 0, width: 40, fontFamily: "'DM Mono', monospace", color: C.muted, textAlign: "left" }}>
                        <div style={{ fontSize: 12 }}>{formatKoHora(cruce.kickoff)}</div>
                        <div style={{ fontSize: 10 }}>{formatKoDia(cruce.kickoff)}</div>
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700, fontSize: 14, color: C.ink,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {cruce.local} – {cruce.visitante}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                        {acertaron === 0 ? "Nadie acertó este cruce" : `${acertaron}/8 acertaron este cruce`}
                      </div>
                    </div>

                    <span style={{ fontSize: 13, flexShrink: 0 }}>
                      {matchStatus === "finalizado"
                        ? <Score a={r!.local} b={r!.visitante} />
                        : <StatusBadge status={matchStatus as "proximo" | "pendiente"} />}
                    </span>

                    {yt && (
                      <a
                        href={yt} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Ver resumen"
                        style={{ flexShrink: 0, fontSize: 15, color: C.rojo, textDecoration: "none", lineHeight: 1, padding: "2px 4px" }}
                      >▶</a>
                    )}

                    <span style={{
                      flexShrink: 0, fontSize: 12, color: C.muted,
                      transform: isOpen ? "rotate(90deg)" : "none",
                      transition: "transform .15s ease",
                      display: "inline-block", width: 14, textAlign: "center",
                    }}>›</span>
                  </button>

                  {/* Predicciones expandidas */}
                  {isOpen && (
                    <div style={{ paddingBottom: 8, paddingLeft: 8 }}>
                      {players.map((p) => {
                        const canScore = cruce.jugadores.includes(p.id);
                        const predMatches = (p as unknown as Record<string, Match[]>)["enfr_" + koRonda] ?? [];
                        const pred: Pred | null = canScore
                          ? (predMatches.find((m) => m.partido === cruce.partido)?.pred ?? null)
                          : null;
                        const s = pred && r ? scoreMatch(pred, r, baremo) : null;
                        const hit = s?.hit as "exacto" | "signo" | "fallo" | null ?? null;

                        // Indicador de clasificación a siguiente fase
                        const nextRonda = NEXT_CLASIF_RONDA[koRonda];
                        const playerClasifNext: string[] = nextRonda
                          ? ((p as unknown as Record<string, string[]>)["clasif_" + nextRonda] ?? [])
                          : [];
                        const teamsFromMatch = [cruce.local, cruce.visitante].filter(t => playerClasifNext.includes(t));
                        const actualNextClasif = nextRonda ? extra["clasif_" + nextRonda] : undefined;
                        const clasifResolved = !!r && Array.isArray(actualNextClasif) && (actualNextClasif as string[]).length > 0;
                        const nextPts = nextRonda ? (CLASIF_PTS[nextRonda] ?? 0) : 0;

                        return (
                          <div
                            key={p.id}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "3px 2px", borderBottom: `1px solid ${C.chalk}`,
                            }}
                          >
                            <span style={{
                              fontSize: 12, fontWeight: canScore ? 600 : 400,
                              color: canScore ? C.ink : C.muted,
                              width: 72, flexShrink: 0,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {p.nombre.split(" ")[0]}
                            </span>

                            {pred ? (
                              <>
                                <span style={{
                                  fontFamily: "'DM Mono', monospace", fontSize: 13,
                                  color: hit ? HIT_COLOR[hit] : C.muted,
                                  fontWeight: hit ? 600 : 400, flexShrink: 0,
                                }}>
                                  {pred.local}–{pred.visitante}
                                </span>
                                <span style={{
                                  fontFamily: "'DM Mono', monospace", fontSize: 11,
                                  color: s && s.pts > 0 ? C.pitch : C.line,
                                  fontWeight: s && s.pts > 0 ? 700 : 400,
                                  flexShrink: 0,
                                }}>
                                  {s ? `+${s.pts}` : "–"}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                                No acertó
                              </span>
                            )}

                            {/* Indicador de siguiente fase */}
                            {teamsFromMatch.length > 0 && (
                              <span style={{
                                marginLeft: "auto", flexShrink: 0,
                                display: "flex", gap: 5, whiteSpace: "nowrap", alignItems: "center",
                              }}>
                                {teamsFromMatch.map((team) => {
                                  const isCorrect = clasifResolved && (actualNextClasif as string[]).includes(team);
                                  const isMiss = clasifResolved && !(actualNextClasif as string[]).includes(team);
                                  const color = isCorrect ? "#2E8B57" : isMiss ? C.rojo : C.muted;
                                  return (
                                    <span key={team} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                      <span style={{ fontSize: 12, color }}>{isCorrect ? "✓" : isMiss ? "✗" : "→"}</span>
                                      <span style={{ fontSize: 12, fontStyle: "italic", color }}>{team}</span>
                                      {isCorrect && (
                                        <span style={{
                                          fontFamily: "'DM Mono', monospace", fontSize: 11,
                                          fontWeight: 700, color: C.pitch,
                                        }}>
                                          +{nextPts}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>);
          })()}
        </div>
      )}
    </div>
  );
}