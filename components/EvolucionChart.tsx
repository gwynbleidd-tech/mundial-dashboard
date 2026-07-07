"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import type { Player } from "@/lib/scoring";
import type { EvoRow } from "@/lib/evolution";
import { C } from "@/lib/theme";
import type { HighlightMode } from "@/lib/highlight";

const PALETTE = [
  "#E63946", // rojo
  "#1D7EA1", // azul
  "#E09F3E", // dorado-naranja
  "#2A9D8F", // teal
  "#7B2D8B", // púrpura
  "#F72585", // magenta
  "#3A7D44", // verde bosque
  "#FF6B35", // coral
];

const MARGEN = 20;

interface Props {
  data: EvoRow[];
  players: Player[];
  mode: "dia" | "partido";
  highlightMode?: HighlightMode;
}

// Por cada punto del eje X, calcula el máximo y mínimo de puntos entre todos los jugadores
function useExtremes(data: EvoRow[], players: Player[]) {
  return useMemo(() => {
    return data.map(row => {
      const vals = players.map(p => row.scores[p.id] ?? 0);
      return { max: Math.max(...vals), min: Math.min(...vals) };
    });
  }, [data, players]);
}

// Devuelve si un jugador está "cerca" del líder o del colista en TODOS los puntos
// Para el renderizado, necesitamos saber tramo a tramo
function getRelevance(
  playerId: string,
  data: EvoRow[],
  extremes: { max: number; min: number }[],
  highlightMode: HighlightMode,
): boolean[] {
  return data.map((row, i) => {
    const val = row.scores[playerId] ?? 0;
    const { max, min } = extremes[i];
    if (highlightMode === "gloria") return (max - val) <= MARGEN;
    if (highlightMode === "pozo")   return (val - min) <= MARGEN;
    return true;
  });
}

export default function EvolucionChart({ data, players, mode, highlightMode = "none" }: Props) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const extremes = useExtremes(data, players);

  if (data.length === 0) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>
        Sin datos aún
      </div>
    );
  }

  const chartData = data.map(row => ({ ...row, ...row.scores }));
  const hitoLabels = data.filter(r => r.isHito).map(r => r.label);

  const toggle = (id: string) => setHighlighted(h => h === id ? null : id);

  // En modo highlight, ignoramos el "highlighted" individual de la leyenda
  const usingHighlight = highlightMode !== "none";

  // Calcula relevancia por jugador (array de booleanos, uno por punto del eje)
  const relevanceMap = useMemo(() => {
    const map: Record<string, boolean[]> = {};
    for (const p of players) {
      map[p.id] = getRelevance(p.id, data, extremes, highlightMode);
    }
    return map;
  }, [players, data, extremes, highlightMode]);

  // ¿Es el jugador relevante en el último punto? (para colorear leyenda)
  const isRelevantNow = (id: string) => {
    const rel = relevanceMap[id];
    return rel ? rel[rel.length - 1] : true;
  };

  // Líderes y colistas en el último punto
  const lastExtremes = extremes[extremes.length - 1];
  const lastData = data[data.length - 1];

  const leaderIds = lastData
    ? players.filter(p => (lastData.scores[p.id] ?? 0) === lastExtremes?.max).map(p => p.id)
    : [];
  const trailerIds = lastData
    ? players.filter(p => (lastData.scores[p.id] ?? 0) === lastExtremes?.min).map(p => p.id)
    : [];

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
          <XAxis
            dataKey="label"
            tick={mode === "dia" ? { fontSize: 10, fill: C.muted } : false}
            interval={mode === "dia" ? "preserveStartEnd" : undefined}
            axisLine={{ stroke: C.line }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: C.muted }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip content={<CustomTooltip players={players} highlightMode={highlightMode} extremes={extremes} />} />

          {hitoLabels.map(label => (
            <ReferenceLine
              key={label}
              x={label}
              stroke={C.muted}
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          ))}

          {players.map((p, i) => {
            const color = PALETTE[i % PALETTE.length];

            if (!usingHighlight) {
              // Comportamiento original
              const isActive = highlighted === null || highlighted === p.id;
              return (
                <Line
                  key={p.id}
                  dataKey={p.id}
                  stroke={color}
                  strokeWidth={isActive ? 2 : 1}
                  strokeOpacity={isActive ? 1 : 0.18}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              );
            }

            // Modo highlight: relevante = color, irrelevante = gris muy tenue
            const relevant = isRelevantNow(p.id);

            // ¿Es el líder/colista principal?
            const isLeader  = leaderIds.includes(p.id);
            const isTrailer = trailerIds.includes(p.id);
            const isMain = highlightMode === "gloria" ? isLeader : isTrailer;

            return (
              <Line
                key={p.id}
                dataKey={p.id}
                stroke={relevant ? color : "#CFCFCF"}
                strokeWidth={isMain ? 3.5 : relevant ? 2 : 0.8}
                strokeOpacity={relevant ? 1 : 0.2}
                strokeDasharray={isMain && highlightMode === "pozo" ? "6 3" : undefined}
                dot={relevant ? { r: 2.5, fill: color, strokeWidth: 0 } : false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Leyenda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, justifyContent: "center" }}>
        {players.map((p, i) => {
          const color = PALETTE[i % PALETTE.length];

          if (usingHighlight) {
            const relevant = isRelevantNow(p.id);
            const isLeader  = leaderIds.includes(p.id);
            const isTrailer = trailerIds.includes(p.id);
            const isMain = highlightMode === "gloria" ? isLeader : isTrailer;
            return (
              <div
                key={p.id}
                style={{
                  padding: "3px 10px",
                  borderRadius: 20,
                  border: `1.5px solid ${relevant ? color : C.line}`,
                  background: isMain ? color : "transparent",
                  color: isMain ? "#fff" : relevant ? color : C.muted,
                  fontSize: 11,
                  fontWeight: isMain ? 700 : relevant ? 600 : 400,
                  opacity: relevant ? 1 : 0.4,
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {isMain && (highlightMode === "gloria" ? "🏆" : "🪣")} {p.nombre}
              </div>
            );
          }

          const isActive = highlighted === null || highlighted === p.id;
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                border: `1.5px solid ${color}`,
                background: isActive ? color : "transparent",
                color: isActive ? "#fff" : color,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                opacity: highlighted !== null && !isActive ? 0.4 : 1,
                transition: "opacity .15s, background .15s",
              }}
            >
              {p.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label, players, highlightMode, extremes }: {
  active?: boolean;
  payload?: { dataKey: string; value: number; stroke: string }[];
  label?: string;
  players: Player[];
  highlightMode: HighlightMode;
  extremes: { max: number; min: number }[];
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);

  // Índice del punto actual para sacar extremes
  const maxVal = Math.max(...payload.map(e => e.value));
  const minVal = Math.min(...payload.map(e => e.value));

  return (
    <div style={{
      background: C.paper,
      border: `1px solid ${C.line}`,
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: 12,
      boxShadow: "0 2px 8px rgba(0,0,0,.1)",
      maxWidth: 200,
    }}>
      <div style={{ fontWeight: 700, color: C.muted, marginBottom: 5, fontSize: 11 }}>
        {label}
      </div>
      {sorted.map(entry => {
        const player = players.find(p => p.id === entry.dataKey);
        const val = entry.value;
        let badge = "";
        if (highlightMode === "gloria" && val === maxVal) badge = "🏆 ";
        if (highlightMode === "pozo"   && val === minVal) badge = "🪣 ";
        return (
          <div key={entry.dataKey} style={{
            display: "flex", justifyContent: "space-between", gap: 10, color: entry.stroke,
          }}>
            <span>{badge}{player?.nombre ?? entry.dataKey}</span>
            <span style={{ fontWeight: 700 }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
}
