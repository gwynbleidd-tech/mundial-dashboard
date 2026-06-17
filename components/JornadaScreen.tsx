"use client";

import { useState } from "react";
import type { Player, RealResults, Pred, RealScore } from "@/lib/scoring";
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

// ---- scoring de grupo (igual que JugadorScreen) ----

function scoreGrupo(pred: Pred, real: RealScore): { pts: number; hit: "exacto" | "signo" | "fallo" } {
  const sign = (l: number, v: number) => l > v ? "1" : l < v ? "2" : "X";
  if (sign(pred.local, pred.visitante) !== sign(real.local, real.visitante)) {
    return { pts: 0, hit: "fallo" };
  }
  let pts = 2;
  if (pred.local - pred.visitante === real.local - real.visitante) pts++;
  if (pred.local === real.local && pred.visitante === real.visitante) pts += 3;
  const hit = pred.local === real.local && pred.visitante === real.visitante
    ? "exacto" : "signo";
  return { pts, hit };
}

function Score({ a, b }: { a: number; b: number }) {
  return (
    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
      {a}<span style={{ color: C.muted, margin: "0 3px" }}>–</span>{b}
    </span>
  );
}

const BG: Record<"exacto" | "signo" | "fallo", string> = {
  exacto: "#E6F0E9",
  signo: "#F6EFD6",
  fallo: C.paper,
};

const hStyle: React.CSSProperties = {
  fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 22,
  color: C.ink, margin: 0, letterSpacing: ".01em", textTransform: "uppercase",
};

// ---- componente principal ----

interface Props {
  players: Player[];
  real: RealResults;
}

export default function JornadaScreen({ players, real }: Props) {
  const [day, setDay] = useState<string>(getDefaultDay);

  const idx = DAYS.indexOf(day);
  const fixtures = (horarios[day] ?? [])
    .slice()
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  return (
    <div>
      <h2 style={hStyle}>Por día</h2>

      {/* Selector de día */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
        <button
          onClick={() => setDay(DAYS[idx - 1])}
          disabled={idx === 0}
          style={{
            width: 36, height: 36, borderRadius: 3, flexShrink: 0,
            border: `1px solid ${idx === 0 ? C.line : C.ink}`,
            background: "none", cursor: idx === 0 ? "default" : "pointer",
            color: idx === 0 ? C.line : C.ink,
            fontSize: 18, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label="Día anterior"
        >
          ‹
        </button>

        <div style={{
          flex: 1, textAlign: "center", fontWeight: 700, fontSize: 14,
          color: C.ink, letterSpacing: ".01em",
        }}>
          {formatDia(day)}
        </div>

        <button
          onClick={() => setDay(DAYS[idx + 1])}
          disabled={idx === DAYS.length - 1}
          style={{
            width: 36, height: 36, borderRadius: 3, flexShrink: 0,
            border: `1px solid ${idx === DAYS.length - 1 ? C.line : C.ink}`,
            background: "none", cursor: idx === DAYS.length - 1 ? "default" : "pointer",
            color: idx === DAYS.length - 1 ? C.line : C.ink,
            fontSize: 18, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
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
        {fixtures.map((fixture, i) => {
          const r = real[fixture.partido];
          return (
            <div key={i} style={{ borderBottom: `1px solid ${C.line}`, padding: "12px 2px" }}>

              {/* Cabecera del partido */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 12,
                    color: C.muted, flexShrink: 0,
                  }}>
                    {formatHora(fixture.kickoff)}
                  </span>
                  <span style={{
                    fontWeight: 700, fontSize: 14, color: C.ink,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {fixture.local} – {fixture.visitante}
                  </span>
                </div>
                <span style={{ fontSize: 13, flexShrink: 0 }}>
                  {r
                    ? <Score a={r.local} b={r.visitante} />
                    : <span style={{ color: C.muted, fontSize: 11 }}>sin jugar</span>}
                </span>
              </div>

              {/* Predicciones de los 8 jugadores */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {players.map((p) => {
                  const pm = p.fase_grupos.find((m) => m.partido === fixture.partido);
                  if (!pm) return null;
                  const s = r ? scoreGrupo(pm.pred, r) : null;
                  return (
                    <span
                      key={p.id}
                      style={{
                        fontSize: 11, border: `1px solid ${C.line}`,
                        borderRadius: 2, padding: "3px 6px",
                        background: s ? BG[s.hit] : C.paper,
                      }}
                    >
                      <b style={{ color: C.ink }}>{p.nombre.split(" ")[0]}</b>
                      <span style={{ color: C.muted, marginLeft: 5 }}>
                        {pm.pred.local}-{pm.pred.visitante}
                      </span>
                    </span>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
