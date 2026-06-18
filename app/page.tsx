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
import ActualidadScreen from "@/components/ActualidadScreen";
import ClipetoToast from "@/components/ClipetoToast";
import { C } from "@/lib/theme";
import { FECHA_CIERRE_PREDICCIONES } from "@/lib/config";

const [cierreY, cierreM, cierreD] = FECHA_CIERRE_PREDICCIONES.split("-").map(Number);
const fechaCierreLabel = new Date(cierreY, cierreM - 1, cierreD)
  .toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

const TABS = [
  ["clas", "Clasif."],
  ["dia", "Calendario"],
  ["jug", "Jugador"],
  ["act", "Actualidad"],
  ["admin", "Admin"],
] as const;

type TabId = "clas" | "dia" | "jug" | "act" | "admin";

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
    <div style={{ background: C.paper, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Tapa fija que siempre cubre la zona de la barra de estado con el verde del header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "env(safe-area-inset-top)",
        background: C.pitch,
      }} />
      <div style={{
        maxWidth: 460, margin: "0 auto",
        minHeight: "100dvh",
        display: "flex", flexDirection: "column",
        paddingBottom: "calc(52px + env(safe-area-inset-bottom))",
      }}>

        {/* Header */}
        <header style={{
          padding: "18px 20px 14px",
          paddingTop: "calc(18px + env(safe-area-inset-top))",
          borderBottom: `2px solid ${C.ink}`,
          background: `linear-gradient(180deg,${C.pitch} 0%,${C.pitchLit} 100%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{
              fontFamily: "'Anton', sans-serif", fontSize: 36, color: C.chalk,
              letterSpacing: ".01em",
            }}>
              MUNDIAL 2026
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
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 8,
          }}>
            <div style={{ fontSize: 10, color: C.chalk, opacity: 0.6, letterSpacing: ".06em" }}>
              🔒 Predicciones cerradas · {fechaCierreLabel}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/clipeto/clipeto.svg" alt="Clipeto" style={{ height: 22, width: "auto" }} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: C.gold,
                letterSpacing: ".04em", fontFamily: "'Anton', sans-serif",
              }}>
                CLIPETOS
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ padding: "20px", flex: 1 }}>
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
          {tab === "act" && <ActualidadScreen />}
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
              youtube={youtube}
              onResultSaved={(partido, local, visitante) =>
                setReal((prev) => ({ ...prev, [partido]: { local, visitante } }))
              }
              onResultCleared={(partido) =>
                setReal((prev) => { const n = { ...prev }; delete n[partido]; return n; })
              }
              onExtraSaved={(clave, valor) =>
                setExtra((prev) => ({ ...prev, [clave]: valor }))
              }
              onYoutubeSaved={(partido, url) =>
                setYoutube((prev) => {
                  const n = { ...prev };
                  if (url) n[partido] = url; else delete n[partido];
                  return n;
                })
              }
            />
          )}
        </main>

        <ClipetoToast />

        {/* Bottom nav — altura fija para que no varíe al cambiar de tab */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 460,
          margin: "0 auto", display: "flex", alignItems: "flex-start",
          height: "calc(52px + env(safe-area-inset-bottom))",
          borderTop: `1px solid ${C.line}`, background: C.paper,
        }}>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1, height: 52,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 4px",
                border: "none", background: "none", cursor: "pointer",
                borderTop: `3px solid ${tab === id ? C.pitch : "transparent"}`,
                color: tab === id ? C.ink : C.muted,
                fontWeight: tab === id ? 700 : 500,
                fontSize: 11, letterSpacing: ".01em",
                whiteSpace: "nowrap",
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
