"use client";

import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import type { Player } from "@/lib/scoring";
import type { EvoRow } from "@/lib/evolution";
import { C } from "@/lib/theme";

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

interface Props {
  data: EvoRow[];
  players: Player[];
  mode: "dia" | "partido";
}

export default function EvolucionChart({ data, players, mode }: Props) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>
        Sin datos aún
      </div>
    );
  }

  // Flatten EvoRow for recharts (scores spread into flat keys)
  const chartData = data.map(row => ({ ...row, ...row.scores }));
  const hitoLabels = data.filter(r => r.isHito).map(r => r.label);

  const toggle = (id: string) => setHighlighted(h => h === id ? null : id);

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
          <Tooltip content={<CustomTooltip players={players} />} />

          {/* Línea vertical en cada hito */}
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
            const isActive = highlighted === null || highlighted === p.id;
            return (
              <Line
                key={p.id}
                dataKey={p.id}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={isActive ? 2 : 1}
                strokeOpacity={isActive ? 1 : 0.18}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Leyenda tocable */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, justifyContent: "center" }}>
        {players.map((p, i) => {
          const isActive = highlighted === null || highlighted === p.id;
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                border: `1.5px solid ${PALETTE[i % PALETTE.length]}`,
                background: isActive ? PALETTE[i % PALETTE.length] : "transparent",
                color: isActive ? "#fff" : PALETTE[i % PALETTE.length],
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

function CustomTooltip({ active, payload, label, players }: {
  active?: boolean;
  payload?: { dataKey: string; value: number; stroke: string }[];
  label?: string;
  players: Player[];
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
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
        return (
          <div key={entry.dataKey} style={{
            display: "flex", justifyContent: "space-between", gap: 10, color: entry.stroke,
          }}>
            <span>{player?.nombre ?? entry.dataKey}</span>
            <span style={{ fontWeight: 700 }}>{entry.value}</span>
          </div>
        );
      })}
    </div>
  );
}
