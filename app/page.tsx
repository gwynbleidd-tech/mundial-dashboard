"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player, RealResults, RealExtra } from "@/lib/scoring";
import { standings } from "@/lib/scoring";
import { fetchResultados, fetchExtra, type YoutubeUrls } from "@/lib/supabase";
import predictionsData from "@/data/predictions.json";
import ClasificacionScreen from "@/components/ClasificacionScreen";
import JugadorScreen from "@/components/JugadorScreen";
import JornadaScreen from "@/components/JornadaScreen";
import AdminScreen from "@/components/AdminScreen";
import { C } from "@/lib/theme";
import { FECHA_CIERRE_PREDICCIONES } from "@/lib/config";

const [cierreY, cierreM, cierreD] = FECHA_CIERRE_PREDICCIONES.split("-").map(Number);
const fechaCierreLabel = new Date(cierreY, cierreM - 1, cierreD)
  .toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

const TABS = [
  ["clas", "Clasificación"],
  ["dia", "Por día"],
  ["jug", "Jugador"],
  ["admin", "Admin"],
] as const;

type TabId = "clas" | "dia" | "jug" | "admin";

const players = Object.values(
  (predictionsData as { players: Record<string, Player> }).players
);

export default function Home() {
  const [tab, setTab] = useState<TabId>("clas");
  const [picked, setPicked] = useState<string>(players[0]?.id ?? "");
  const [real, setReal] = useState<RealResults>({});
  const [extra, setExtra] = useState<RealExtra>({});
  const [youtube, setYoutube] = useState<YoutubeUrls>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchResultados(), fetchExtra()])
      .then(([{ results, youtube: yt }, e]) => {
        setReal(results);
        setYoutube(yt);
        setExtra(e);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => standings(players, real, extra), [real, extra]);

  return (
    <div style={{ minHeight: "100%", background: C.paper, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Tapa fija que siempre cubre la zona de la barra de estado con el verde del header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "env(safe-area-inset-top)",
        background: C.pitch,
      }} />
      <div style={{ maxWidth: 460, margin: "0 auto", paddingBottom: "calc(90px + env(safe-area-inset-bottom))" }}>

        {/* Header */}
        <header style={{
          padding: "18px 20px 14px",
          paddingTop: "calc(18px + env(safe-area-inset-top))",
          borderBottom: `2px solid ${C.ink}`,
          background: `linear-gradient(180deg,${C.pitch} 0%,${C.pitchLit} 100%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{
              fontFamily: "'Anton', sans-serif", fontSize: 40, color: C.chalk,
              lineHeight: 0.95, letterSpacing: ".01em",
            }}>
              MUNDIAL<br />2026
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/flags/us.png" alt="USA" style={{ height: 28, width: "auto" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/flags/ca.png" alt="Canadá" style={{ height: 28, width: "auto" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/flags/mx.png" alt="México" style={{ height: 28, width: "auto" }} />
            </div>
          </div>
          <div style={{
            fontSize: 10, color: C.chalk, opacity: 0.6,
            marginTop: 8, letterSpacing: ".06em",
          }}>
            🔒 Predicciones cerradas · {fechaCierreLabel}
          </div>
        </header>

        {/* Content */}
        <main style={{ padding: "20px" }}>
          {tab === "clas" && (
            <ClasificacionScreen
              ranked={ranked}
              players={players}
              real={real}
              extra={extra}
              loading={loading}
              onPick={(id) => { setPicked(id); setTab("jug"); }}
            />
          )}
          {tab === "dia" && (
            <JornadaScreen players={players} real={real} youtube={youtube} />
          )}
          {tab === "jug" && (
            <JugadorScreen
              players={players}
              picked={picked}
              onPick={setPicked}
              real={real}
              extra={extra}
            />
          )}
          {tab === "admin" && (
            <AdminScreen
              players={players}
              real={real}
              extra={extra}
              onResultSaved={(partido, local, visitante) =>
                setReal((prev) => ({ ...prev, [partido]: { local, visitante } }))
              }
              onResultCleared={(partido) =>
                setReal((prev) => { const n = { ...prev }; delete n[partido]; return n; })
              }
              onExtraSaved={(clave, valor) =>
                setExtra((prev) => ({ ...prev, [clave]: valor }))
              }
            />
          )}
        </main>

        {/* Bottom nav */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460,
          margin: "0 auto", display: "flex",
          borderTop: `1px solid ${C.line}`, background: C.paper,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1, padding: "12px 4px 14px",
                border: "none", background: "none", cursor: "pointer",
                borderTop: `3px solid ${tab === id ? C.pitch : "transparent"}`,
                color: tab === id ? C.ink : C.muted,
                fontWeight: tab === id ? 700 : 500,
                fontSize: 11.5, letterSpacing: ".02em",
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
