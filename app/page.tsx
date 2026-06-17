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
      <div style={{ maxWidth: 460, margin: "0 auto", paddingBottom: 90 }}>

        {/* Header */}
        <header style={{
          padding: "22px 20px 16px",
          borderBottom: `2px solid ${C.ink}`,
          background: `linear-gradient(180deg,${C.pitch} 0%,${C.pitchLit} 100%)`,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: ".22em", color: C.chalk,
            opacity: 0.85, textTransform: "uppercase", fontWeight: 700,
          }}>
            La Porra · Norteamérica
          </div>
          <div style={{
            fontFamily: "'Anton', sans-serif", fontSize: 40, color: C.chalk,
            lineHeight: 0.95, marginTop: 4, letterSpacing: ".01em",
          }}>
            MUNDIAL<br />2026
          </div>
        </header>

        {/* Content */}
        <main style={{ padding: "20px" }}>
          {tab === "clas" && (
            <ClasificacionScreen
              ranked={ranked}
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
              onResultSaved={(partido, local, visitante) =>
                setReal((prev) => ({ ...prev, [partido]: { local, visitante } }))
              }
            />
          )}
        </main>

        {/* Bottom nav */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460,
          margin: "0 auto", display: "flex",
          borderTop: `1px solid ${C.line}`, background: C.paper,
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
