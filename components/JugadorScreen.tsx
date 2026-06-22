"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player, RealResults, RealExtra, Match, Breakdown } from "@/lib/scoring";
import { scorePlayer, scoreMatch, GRUPO_PTS, normPos } from "@/lib/scoring";
import { calcGrupoStanding, calcMejoresTerceros, scoreGrupoPositions, bestWorstScenario } from "@/lib/grupoStandings";
import { C } from "@/lib/theme";

// ---- interfaces ----

interface RankedEntry {
  player: Player;
  score: Breakdown;
}

interface Props {
  players: Player[];
  picked: string;
  onPick: (id: string) => void;
  real: RealResults;
  extra: RealExtra;
  ranked?: RankedEntry[]; 
}

// ---- constants ----

const GRUPOS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;

const KO_RONDAS = [
  { key: "dieciseisavos", label: "1/16 de final",   short: "1/16" },
  { key: "octavos",       label: "Octavos de final", short: "Octavos" },
  { key: "cuartos",       label: "Cuartos de final", short: "Cuartos" },
  { key: "semis",         label: "Semifinales",       short: "Semis" },
  { key: "3y4",           label: "3er y 4º puesto",  short: "3º y 4º" },
  { key: "final",         label: "Final",             short: "Final" },
] as const;

const HIT_COLOR: Record<"exacto" | "signo" | "fallo", string> = {
  exacto: "#2E8B57",
  signo:  "#B87333",
  fallo:  C.rojo,
};

// ---- helpers ----

const hStyle: React.CSSProperties = {
  fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 22,
  color: C.ink, margin: 0, letterSpacing: ".01em", textTransform: "uppercase",
};

const secLabel: React.CSSProperties = {
  fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 15,
  color: C.ink, margin: 0, letterSpacing: ".04em", textTransform: "uppercase",
};

function buildEquipoGrupoMap(player: Player): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pos of player.posicion_grupos) {
    const m = pos.puesto.match(/GRUPO ([A-L])/);
    if (m) map[pos.equipo] = m[1];
  }
  return map;
}

// ---- subcomponents ----

function PredScore({ local, visitante }: { local: number; visitante: number }) {
  return (
    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
      {local}<span style={{ color: C.muted, margin: "0 2px" }}>–</span>{visitante}
    </span>
  );
}

type Hit = "exacto" | "signo" | "fallo";

function MatchRow({
  local, visitante, pred, hit, pts,
}: {
  local: string; visitante: string;
  pred: { local: number; visitante: number };
  hit?: Hit | null;
  pts?: number | null;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 0", borderBottom: `1px solid ${C.chalk}`,
    }}>
      <span style={{
        flex: 1, fontSize: 13, color: C.ink,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {local} <span style={{ color: C.muted }}>–</span> {visitante}
      </span>
      <PredScore local={pred.local} visitante={pred.visitante} />
      {pts !== undefined && (
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: pts != null && pts > 0 ? (hit ? HIT_COLOR[hit] : C.pitch) : C.line,
          fontWeight: pts != null && pts > 0 ? 700 : 400,
          flexShrink: 0, whiteSpace: "nowrap", minWidth: 44, textAlign: "right",
        }}>
          {pts != null ? `+${pts} pts` : "–"}
        </span>
      )}
    </div>
  );
}

function HonorRow({ items }: { items: { label: string; val: string | null | undefined }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
      {items.map(({ label, val }) => (
        <div key={label} style={{
          flex: 1, border: `1px solid ${C.line}`, borderRadius: 4, padding: "7px 8px",
          minWidth: 0,
        }}>
          <div style={{
            fontSize: 8, letterSpacing: ".08em", textTransform: "uppercase",
            color: C.muted, fontWeight: 700, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700, marginTop: 3, color: C.ink,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {val || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%", display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "14px 0 10px",
        border: "none", background: "none", cursor: "pointer",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <span style={{ ...secLabel }}>{label}</span>
      <span style={{
        fontSize: 16, color: C.muted,
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform .15s ease",
        display: "inline-block",
      }}>›</span>
    </button>
  );
}

function GroupView({
  grupo, player, equipoGrupo, real, mejoresTerceros, extra,
}: {
  grupo: string;
  player: Player;
  equipoGrupo: Record<string, string>;
  real: RealResults;
  mejoresTerceros: ReturnType<typeof calcMejoresTerceros>;
  extra: RealExtra;
}) {
  const standing = useMemo(() => {
    const st = calcGrupoStanding(grupo, real);
    const guardadas: string[] = [];
    for (let r = 1; r <= 4; r++) {
      const v = extra[normPos(`${r}º GRUPO ${grupo}`)];
      if (typeof v === "string" && v) guardadas.push(v);
    }
    if (guardadas.length === 4) {
      st.stats.sort((a, b) => guardadas.indexOf(a.equipo) - guardadas.indexOf(b.equipo));
    }
    return st;
  }, [grupo, real, extra]);

  const scorePos = scoreGrupoPositions(
    grupo,
    standing.stats,
    mejoresTerceros,
    player.posicion_grupos,
    player.clasif_dieciseisavos,
  );
  
  const { mejor, peor } = bestWorstScenario(
    grupo,
    standing.stats,
    standing.pendientes,
    mejoresTerceros,
    player.posicion_grupos,
    player.clasif_dieciseisavos,
  );

  const matches = player.fase_grupos.filter(
    (m) => equipoGrupo[m.local] === grupo && equipoGrupo[m.visitante] === grupo
  );

  const userPositions = player.posicion_grupos
    .filter((p) => p.puesto.includes(`GRUPO ${grupo}`))
    .sort((a, b) => parseInt(a.puesto[0]) - parseInt(b.puesto[0]));

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
          textTransform: "uppercase", color: C.muted, marginBottom: 6,
          display: "flex", justifyContent: "space-between"
        }}>
          <span style={{ flex: 1 }}>Tu Pronóstico</span>
          <span style={{ width: 60, textAlign: "right" }}>Porra</span>
        </div>

        {userPositions.map((userPos, idx) => {
          const posPronosticada = idx + 1;
          const realStat = standing.stats.find(s => s.equipo === userPos.equipo);
          const posRealNum = standing.stats.findIndex(s => s.equipo === userPos.equipo) + 1;

          const det = scorePos.detalle.find(d => d.equipo === userPos.equipo);
          const ptsTotales = (det?.ptsPosicion ?? 0) + (det?.ptsClasif ?? 0);
          const clasificaReal = det?.clasificaReal ?? false;

          let rowBg = "transparent";
          let textColor = C.ink;
          let indicatorColor = C.muted;

          if (realStat && realStat.pj > 0) {
            if (clasificaReal) {
              if (ptsTotales === 8) {
                rowBg = "rgba(46, 125, 85, 0.08)";
                textColor = "#2E7D55";
                indicatorColor = "#2E7D55";
              } else {
                rowBg = "rgba(184, 115, 51, 0.08)";
                textColor = "#B87333";
                indicatorColor = "#B87333";
              }
            } else {
              if (ptsTotales === 5) {
                rowBg = "rgba(46, 125, 85, 0.08)";
                textColor = "#2E7D55";
                indicatorColor = "#2E7D55";
              } else if (ptsTotales > 0) {
                rowBg = "rgba(184, 115, 51, 0.08)";
                textColor = "#B87333";
                indicatorColor = "#B87333";
              } else {
                rowBg = "rgba(211, 47, 47, 0.06)";
                textColor = C.rojo;
                indicatorColor = C.rojo;
              }
            }
          }

          return (
            <div key={userPos.equipo} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 0",
              borderBottom: `1px solid ${C.chalk}`,
              background: rowBg,
            }}>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 12,
                color: indicatorColor,
                width: 14, flexShrink: 0, textAlign: "right", fontWeight: 700,
              }}>
                {posPronosticada}
              </span>
              
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: textColor,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {userPos.equipo}
                </span>

                {clasificaReal && (
                  <span style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    color: "#0B5A53",
                    backgroundColor: "#FAF8F2",
                    border: "1.5px solid #0D695E",
                    borderRadius: "4px",
                    padding: "1px 5px",
                    letterSpacing: "0.03em",
                    lineHeight: "1",
                    flexShrink: 0,
                    boxShadow: "0px 1px 0px rgba(184, 115, 51, 0.3)"
                  }}>
                    CLASIF.
                  </span>
                )}
              </div>

              <div style={{ width: 60, textAlign: "right", flexShrink: 0, fontSize: 11 }}>
                {ptsTotales > 0 ? (
                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: (ptsTotales === 8 || (!clasificaReal && ptsTotales === 5)) ? "#2E8B57" : "#B87333" }}>
                    +{ptsTotales}
                    {posRealNum > 0 && posRealNum !== posPronosticada && (
                      <span style={{ fontWeight: 400, fontSize: 10, color: C.muted, marginLeft: 2 }}>
                        ({posRealNum}º)
                      </span>
                    )}
                  </span>
                ) : posRealNum > 0 && posRealNum !== posPronosticada ? (
                  <span style={{ fontFamily: "'DM Mono', monospace", color: indicatorColor }}>
                    ({posRealNum}º)
                  </span>
                ) : (
                  <span style={{ color: C.line }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 12, padding: "8px 0",
        borderBottom: `2px solid ${C.line}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: ".04em", textTransform: "uppercase" }}>
          Total posiciones grupo {grupo}
        </span>
        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 18, color: scorePos.total > 0 ? C.pitch : C.muted }}>
          {scorePos.total > 0 ? `+${scorePos.total}` : "0"} pts
        </span>
      </div>

      {/* ── SIMULACIÓN DEL MEJOR ESCENARIO INTEGRADA DIRECTAMENTE DEBAJO DEL TOTAL ── */}
      {standing.pendientes.length > 0 && mejor && (
        <div style={{ 
          marginBottom: 16, padding: "10px 12px", 
          background: "#E6F0E9", borderRadius: 6, border: "1px solid #2E8B57" 
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#1B5E3A", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            💡 Simulación · Apoya este resultado para sumar más:
          </div>
          <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, lineHeight: "1.3" }}>
            {mejor.descripcion} 
            <span style={{ color: "#1B5E3A", marginLeft: 4, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
              (+{mejor.pts} pts posibles)
            </span>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        {matches.map((m, i) => {
          const r = real[m.partido];
          const s = r ? scoreMatch(m.pred, r, GRUPO_PTS) : null;
          return (
            <MatchRow key={i} local={m.local} visitante={m.visitante} pred={m.pred}
              hit={s ? s.hit as Hit : null}
              pts={s ? s.pts : null}
            />
          );
        })}
      </div>

      {mejor && standing.pendientes.length === 1 && (
        <div style={{ marginTop: 10, background: C.chalk, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
            textTransform: "uppercase", color: C.muted, marginBottom: 8,
          }}>
            🎯 Jornada pendiente · {standing.pendientes[0].local} vs {standing.pendientes[0].visitante}
          </div>
          <div style={{ marginBottom: peor && peor.pts < mejor.pts ? 8 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#2E8B57" }}>
                ✅ Te conviene: {mejor.descripcion}
              </span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#2E8B57" }}>
                +{mejor.pts} pts
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
              {mejor.standing.map((s, i) => `${i + 1}º ${s.equipo}`).join(" · ")}
            </div>
          </div>
          {peor && peor.pts < mejor.pts && (
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.rojo }}>
                  ❌ Evita: {peor.descripcion}
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: C.rojo }}>
                  +{peor.pts} pts
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                {peor.standing.map((s, i) => `${i + 1}º ${s.equipo}`).join(" · ")}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JugadorScreen({ players, picked, onPick, real, extra, ranked = [] }: Props) {
  const [grupoTab, setGrupoTab] = useState<string>("todos");
  const [rondaTab, setRondaTab] = useState<string>("dieciseisavos");
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["honor"]));
  
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const player = players.find((p) => p.id === picked) ?? players[0];
  if (!player) return null;

  const rankingBaseOficial = useMemo(() => {
    if (ranked && ranked.length > 0) return ranked;
    return players.map(p => ({
      player: p,
      score: scorePlayer(p, real, extra)
    })).sort((a, b) => b.score.total - a.score.total);
  }, [ranked, players, real, extra]);

  const score = scorePlayer(player, real, extra);
  const h = player.cuadro_honor;
  const equipoGrupo = buildEquipoGrupoMap(player);
  const mejoresTerceros = calcMejoresTerceros(real);

  const totalPosicionesGlobal = GRUPOS.reduce((acc, g) => {
    const standing = calcGrupoStanding(g, real);
    
    const guardadas: string[] = [];
    for (let r = 1; r <= 4; r++) {
      const v = extra[normPos(`${r}º GRUPO ${g}`)];
      if (typeof v === "string" && v) guardadas.push(v);
    }
    if (guardadas.length === 4) {
      standing.stats.sort((a, b) => guardadas.indexOf(a.equipo) - guardadas.indexOf(b.equipo));
    }

    const scorePos = scoreGrupoPositions(
      g,
      standing.stats,
      mejoresTerceros,
      player.posicion_grupos,
      player.clasif_dieciseisavos
    );
    return acc + scorePos.total;
  }, 0);

  const { puestoActual, puestoSimulado } = useMemo(() => {
    if (!rankingBaseOficial || rankingBaseOficial.length === 0) {
      return { puestoActual: 0, puestoSimulado: 0 };
    }

    const pActual = rankingBaseOficial.findIndex(r => r.player?.id === player.id) + 1;

    const tablaSimulada = rankingBaseOficial.map(r => {
      const ptsPosicionesSimuladas = GRUPOS.reduce((acc, g) => {
        const standing = calcGrupoStanding(g, real);
        
        const guardadas: string[] = [];
        for (let r = 1; r <= 4; r++) {
          const v = extra[normPos(`${r}º GRUPO ${g}`)];
          if (typeof v === "string" && v) guardadas.push(v);
        }
        if (guardadas.length === 4) {
          standing.stats.sort((a, b) => guardadas.indexOf(a.equipo) - guardadas.indexOf(b.equipo));
        }

        return acc + scoreGrupoPositions(g, standing.stats, mejoresTerceros, r.player.posicion_grupos, r.player.clasif_dieciseisavos).total;
      }, 0);

      return {
        id: r.player?.id,
        puntosSimulados: r.score.total + ptsPosicionesSimuladas,
      };
    });

    const tablaOrdenada = [...tablaSimulada].sort((a, b) => b.puntosSimulados - a.puntosSimulados);
    const pSimulado = tablaOrdenada.findIndex(p => p.id === player.id) + 1;

    return { puestoActual: pActual, puestoSimulado: pSimulado };
  }, [rankingBaseOficial, player.id, real, mejoresTerceros, extra]);

  const subioPuesto = puestoSimulado < puestoActual;
  const bajoPuesto = puestoSimulado > puestoActual;

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div>
      {/* Selector de jugador */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            style={{
              fontSize: 12, padding: "6px 10px", borderRadius: 20,
              cursor: "pointer", fontWeight: 700,
              border: `1px solid ${p.id === picked ? C.ink : C.line}`,
              background: p.id === picked ? C.ink : "transparent",
              color: p.id === picked ? C.chalk : C.ink,
            }}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {/* Cabecera */}
      <h2 style={hStyle}>{player.nombre}</h2>
      <p style={{ color: C.muted, fontSize: 12.5, margin: "5px 0 0", letterSpacing: ".02em" }}>
        {score.total} puntos · {score.signos + score.exactos} 1X2 · {score.exactos} exactos
      </p>

      {/* ── CUADRO DE HONOR ── */}
      <div style={{ marginTop: 22 }}>
        <SectionToggle label="Cuadro de honor" open={openSections.has("honor")} onToggle={() => toggleSection("honor")} />
        {openSections.has("honor") && <div style={{ marginTop: 10 }}>

        <div style={{ background: C.ink, borderRadius: 4, padding: "12px 14px", marginBottom: 6 }}>
          <div style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: C.gold, fontWeight: 700 }}>
            Campeón
          </div>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 22, color: C.chalk, letterSpacing: ".01em", marginTop: 2 }}>
            {h.campeon || "—"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {[
            { label: "Subcampeón", val: h.subcampeon },
            { label: "3er puesto", val: h.tercero },
          ].map(({ label, val }) => (
            <div key={label} style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 4, padding: "8px 10px", minWidth: 0 }}>
              <div style={{ fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>
                {label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: C.ink }}>
                {val || "—"}
              </div>
            </div>
          ))}
        </div>

        <HonorRow items={[
          { label: "Bota de oro",    val: h.bota_oro },
          { label: "Bota de plata",  val: h.bota_plata },
          { label: "Bota de bronce", val: h.bota_bronce },
        ]} />

        <HonorRow items={[
          { label: "Balón de oro",    val: h.balon_oro },
          { label: "Balón de plata",  val: h.balon_plata },
          { label: "Balón de bronce", val: h.balon_bronce },
        ]} />
        </div>}
      </div>

      {/* ── FASE DE GRUPOS ── */}
      <div style={{ marginTop: 6 }}>
        <SectionToggle label="Fase de grupos" open={openSections.has("grupos")} onToggle={() => toggleSection("grupos")} />
        {openSections.has("grupos") && <div style={{ marginTop: 12 }}>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(["todos", ...GRUPOS] as const).map((g) => {
            const active = grupoTab === g;
            return (
              <button
                key={g}
                onClick={() => setGrupoTab(g)}
                style={{
                  padding: "5px 11px", borderRadius: 20,
                  border: `1px solid ${active ? C.ink : C.line}`,
                  background: active ? C.ink : "transparent",
                  color: active ? C.chalk : C.muted,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {g === "todos" ? "Todos" : g}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12 }}>
          {grupoTab === "todos" ? (
            <>
              {/* Bloque con Sumatorio y Clasificación Simulada */}
              <div style={{
                marginBottom: 16, padding: "12px 14px",
                background: C.chalk, borderRadius: 8,
                borderLeft: `4px solid ${C.ink}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, letterSpacing: ".02em", textTransform: "uppercase" }}>
                    Total posiciones grupos (A-L)
                  </span>
                  <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 18, color: totalPosicionesGlobal > 0 ? C.pitch : C.muted }}>
                    {totalPosicionesGlobal > 0 ? `+${totalPosicionesGlobal}` : "0"} pts
                  </span>
                </div>
                
                {isHydrated && rankingBaseOficial.length > 0 && puestoActual > 0 ? (
                  <div style={{ 
                    marginTop: 8, paddingTop: 8, 
                    borderTop: `1px solid ${C.line}`,
                    fontSize: 12, color: C.ink, fontWeight: 500
                  }}>
                    Con estos resultados pasarías de la posición{" "}
                    <strong style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: C.muted }}>{puestoActual}º</strong> a la{" "}
                    <strong style={{ 
                      fontFamily: "'DM Mono', monospace", 
                      fontSize: 14, 
                      color: subioPuesto ? "#2E7D55" : bajoPuesto ? C.rojo : C.ink 
                    }}>
                      {puestoSimulado}º
                    </strong>
                    {subioPuesto && " 🔥"}
                    {bajoPuesto && " 📉"}
                    {!subioPuesto && !bajoPuesto && " 🤝 (te mantienes igual)"}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.muted }}>
                    Cargando simulación...
                  </div>
                )}
              </div>

              {player.fase_grupos.map((m, i) => {
                const r = real[m.partido];
                const s = r ? scoreMatch(m.pred, r, GRUPO_PTS) : null;
                return (
                  <MatchRow key={i} local={m.local} visitante={m.visitante} pred={m.pred}
                    hit={s ? s.hit as Hit : null}
                    pts={s ? s.pts : null}
                  />
                );
              })}
            </>
          ) : (
            <GroupView
              grupo={grupoTab}
              player={player}
              equipoGrupo={equipoGrupo}
              real={real}
              mejoresTerceros={mejoresTerceros}
              extra={extra}
            />
          )}
        </div>
        </div>}
      </div>

      {/* ── FASE FINAL ── */}
      <div style={{ marginTop: 6, marginBottom: 16 }}>
        <SectionToggle label="Fase Final" open={openSections.has("final")} onToggle={() => toggleSection("final")} />
        {openSections.has("final") && <div style={{ marginTop: 12 }}>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
          {KO_RONDAS.map(({ key, short }) => {
            const active = rondaTab === key;
            return (
              <button
                key={key}
                onClick={() => setRondaTab(key)}
                style={{
                  padding: "5px 11px", borderRadius: 20,
                  border: `1px solid ${active ? C.ink : C.line}`,
                  background: active ? C.ink : "transparent",
                  color: active ? C.chalk : C.muted,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {short}
              </button>
            );
          })}
        </div>

        {(() => {
          const matches = (player as unknown as Record<string, Match[]>)[`enfr_${rondaTab}`];
          const ronda = KO_RONDAS.find((r) => r.key === rondaTab);
          return (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
                {ronda?.label}
              </div>
              {matches?.length
                ? matches.map((m, i) => (
                    <MatchRow key={i} local={m.local} visitante={m.visitante} pred={m.pred} />
                  ))
                : <p style={{ color: C.muted, fontSize: 13 }}>Sin partidos</p>}
            </div>
          );
        })()}
        </div>}
      </div>
    </div>
  );
}