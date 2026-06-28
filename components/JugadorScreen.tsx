"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player, RealResults, RealExtra, Match, Breakdown } from "@/lib/scoring";
import { scorePlayer, scoreMatch, GRUPO_PTS, normPos } from "@/lib/scoring";
import { calcGrupoStanding, calcMejoresTerceros, scoreGrupoPositions, bestWorstScenario } from "@/lib/grupoStandings";
import { C } from "@/lib/theme";
import crusesData from "@/data/cruces_eliminatoria.json";

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

type CruceReal = { partido: string; local: string; visitante: string; kickoff?: string; jugadores: string[] };
const CRUCES_DATA = crusesData as Record<string, CruceReal[]>;

const KO_BAREMO: Record<string, [number, number, number]> = {
  dieciseisavos: [3, 2, 5], octavos: [3, 2, 5], cuartos: [4, 2, 6],
  semis: [6, 4, 10], "3y4": [10, 5, 15], final: [12, 6, 18],
};

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
  fallo: C.rojo,
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
  local, visitante, pred, hit, pts, localClasif, visitanteClasif, acertoCruce,
}: {
  local: string; visitante: string;
  pred: { local: number; visitante: number };
  hit?: Hit | null;
  pts?: number | null;
  localClasif?: boolean;
  visitanteClasif?: boolean;
  acertoCruce?: boolean;
}) {
  const localColor  = acertoCruce ? "#2E8B57" : localClasif     ? "#B87333" : C.ink;
  const visitColor  = acertoCruce ? "#2E8B57" : visitanteClasif ? "#B87333" : C.ink;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 4px", borderBottom: `1px solid ${C.chalk}`,
      background: acertoCruce ? "rgba(46,139,87,0.07)" : "transparent",
      borderRadius: acertoCruce ? 3 : 0,
      marginBottom: acertoCruce ? 1 : 0,
    }}>
      <span style={{
        flex: 1, fontSize: 13,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        <span style={{ color: localColor, fontWeight: (localClasif || acertoCruce) ? 600 : 400 }}>{local}</span>
        <span style={{ color: C.muted }}> – </span>
        <span style={{ color: visitColor, fontWeight: (visitanteClasif || acertoCruce) ? 600 : 400 }}>{visitante}</span>
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
  grupo, player, equipoGrupo, real, mejoresTerceros, extra, players
}: {
  grupo: string;
  player: Player;
  equipoGrupo: Record<string, string>;
  real: RealResults;
  mejoresTerceros: ReturnType<typeof calcMejoresTerceros>;
  extra: RealExtra;
  players: Player[];
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

  const scorePos = useMemo(() => {
    return scoreGrupoPositions(
      grupo,
      standing.stats,
      mejoresTerceros,
      player.posicion_grupos,
      player.clasif_dieciseisavos,
    );
  }, [grupo, standing.stats, mejoresTerceros, player.posicion_grupos, player.clasif_dieciseisavos]);
  
  const matches = useMemo(() => {
    return player.fase_grupos.filter(
      (m) => equipoGrupo[m.local] === grupo && equipoGrupo[m.visitante] === grupo
    );
  }, [player.fase_grupos, equipoGrupo, grupo]);

  // Puntos reales que hizo el usuario EN LOS PARTIDOS de este grupo
  const puntosPartidosUsuario = useMemo(() => {
    let acc = 0;
    matches.forEach(m => {
      const r = real[m.partido];
      if (r) {
        acc += scoreMatch(m.pred, r, GRUPO_PTS).pts;
      }
    });
    return acc;
  }, [matches, real]);

  // Puntos TOTALES reales conseguidos en el grupo (Tabla + Partidos)
  const totalPuntosGrupoUsuario = scorePos.total + puntosPartidosUsuario;

  // Calculamos los escenarios teóricos previos (usando los dos últimos partidos que corresponden a la J3)
  const { mejor, peor, escenarioIntermedio } = useMemo(() => {
    const partidosJ3 = matches.slice(-2);

    let pendientesParaScenarios: { partido: string; local: string; visitante: string; kickoff: string }[];
    let statsParaScenarios: typeof standing.stats;
    let realParaScenarios: RealResults;

    if (standing.pendientes.length > 0) {
      pendientesParaScenarios = standing.pendientes;
      statsParaScenarios = standing.stats;
      realParaScenarios = real;
    } else {
      // Grupo completo: reconstruimos el standing SIN J3 para evitar doble conteo
      pendientesParaScenarios = partidosJ3.map(m => ({
        partido: m.partido, local: m.local, visitante: m.visitante, kickoff: ""
      }));
      const realSinJ3: RealResults = { ...real };
      partidosJ3.forEach(m => { delete realSinJ3[m.partido]; });
      const stSinJ3 = calcGrupoStanding(grupo, realSinJ3);
      statsParaScenarios = stSinJ3.stats;
      realParaScenarios = realSinJ3;
    }

    const baseScenarios = bestWorstScenario(
      grupo,
      statsParaScenarios,
      pendientesParaScenarios,
      mejoresTerceros,
      player.posicion_grupos,
      player.clasif_dieciseisavos,
      matches,
      realParaScenarios
    );

    if (standing.pendientes.length === 0) {
      return { ...baseScenarios, escenarioIntermedio: null };
    }

    if (baseScenarios.mejor?.pts === baseScenarios.peor?.pts) {
      return { ...baseScenarios, escenarioIntermedio: null };
    }

    type TeamStatType = typeof standing.stats[0];

    const obtenerOpciones = (f: typeof standing.pendientes[0]) => [
      { local: 1, visitante: 0, desc: `gana ${f.local}` },
      { local: 0, visitante: 0, desc: `empate` },
      { local: 0, visitante: 1, desc: `gana ${f.visitante}` },
    ];

    let todasLasSims: { pts: number; standing: TeamStatType[]; descripcion: string; desglose: string; }[] = [];

    const calcularPtsPartidosSimulados = (resSimulados: { local: number; visitante: number }[]) => {
      let ptsPartidos = 0;
      standing.pendientes.forEach((f, idx) => {
        const pred = matches.find(m => m.partido === f.partido);
        if (pred) {
          const pLoc = pred.pred.local;
          const pVis = pred.pred.visitante;
          const rLoc = resSimulados[idx].local;
          const rVis = resSimulados[idx].visitante;

          const pSigno = Math.sign(pLoc - pVis);
          const rSigno = Math.sign(rLoc - rVis);

          if (pLoc === rLoc && pVis === rVis) {
            ptsPartidos += 3;
          } else if (pSigno === rSigno) {
            if (Math.abs((pLoc - pVis) - (rLoc - rVis)) === 1) {
              ptsPartidos += 3;
            } else {
              ptsPartidos += 2;
            }
          }
        }
      });
      return ptsPartidos;
    };

    if (standing.pendientes.length === 1) {
      const pnd = standing.pendientes[0];
      for (const r1 of obtenerOpciones(pnd)) {
        const simReal: RealResults = { ...real, [pnd.partido]: { local: r1.local, visitante: r1.visitante } };
        const stSim = calcGrupoStanding(grupo, simReal);
        
        const guardadas: string[] = [];
        for (let r = 1; r <= 4; r++) {
          const v = extra[normPos(`${r}º GRUPO ${grupo}`)];
          if (typeof v === "string" && v) guardadas.push(v);
        }
        if (guardadas.length === 4) {
          stSim.stats.sort((a, b) => guardadas.indexOf(a.equipo) - guardadas.indexOf(b.equipo));
        }

        const sPos = scoreGrupoPositions(grupo, stSim.stats, mejoresTerceros, player.posicion_grupos, player.clasif_dieciseisavos);
        const ptsP = calcularPtsPartidosSimulados([r1]);
        const totalSimCombo = sPos.total + ptsP;
        const desgloseStr = ptsP > 0 
          ? `${sPos.total} por tabla + ${ptsP} por partido` 
          : `${sPos.total} pts posiciones`;

        todasLasSims.push({ pts: totalSimCombo, standing: stSim.stats, descripcion: r1.desc, desglose: desgloseStr });
      }
    } else if (standing.pendientes.length === 2) {
      const pnd1 = standing.pendientes[0];
      const pnd2 = standing.pendientes[1];
      for (const r1 of obtenerOpciones(pnd1)) {
        for (const r2 of obtenerOpciones(pnd2)) {
          const simReal: RealResults = { 
            ...real, 
            [pnd1.partido]: { local: r1.local, visitante: r1.visitante },
            [pnd2.partido]: { local: r2.local, visitante: r2.visitante }
          };
          const stSim = calcGrupoStanding(grupo, simReal);
          
          const guardadas: string[] = [];
          for (let r = 1; r <= 4; r++) {
            const v = extra[normPos(`${r}º GRUPO ${grupo}`)];
            if (typeof v === "string" && v) guardadas.push(v);
          }
          if (guardadas.length === 4) {
            stSim.stats.sort((a, b) => guardadas.indexOf(a.equipo) - guardadas.indexOf(b.equipo));
          }

          const sPos = scoreGrupoPositions(grupo, stSim.stats, mejoresTerceros, player.posicion_grupos, player.clasif_dieciseisavos);
          const ptsP = calcularPtsPartidosSimulados([r1, r2]);
          const totalSimCombo = sPos.total + ptsP;
          const desgloseStr = ptsP > 0 
            ? `${sPos.total} por tabla + ${ptsP} por partidos` 
            : `${sPos.total} pts posiciones`;

          todasLasSims.push({ pts: totalSimCombo, standing: stSim.stats, descripcion: `${r1.desc} y ${r2.desc}`, desglose: desgloseStr });
        }
      }
    }

    const targetPts = ((baseScenarios.mejor?.pts ?? 0) + (baseScenarios.peor?.pts ?? 0)) / 2;
    let mejorIntermedio = todasLasSims[0];
    
    if (mejorIntermedio) {
      let menorDiff = Math.abs(mejorIntermedio.pts - targetPts);
      for (const sim of todasLasSims) {
        const diff = Math.abs(sim.pts - targetPts);
        if (diff < menorDiff && sim.pts > baseScenarios.peor!.pts && sim.pts < baseScenarios.mejor!.pts) {
          menorDiff = diff;
          mejorIntermedio = sim;
        }
      }

      if (mejorIntermedio.pts === baseScenarios.mejor?.pts || mejorIntermedio.pts === baseScenarios.peor?.pts) {
        const alternativa = todasLasSims.find(s => s.pts !== baseScenarios.mejor!.pts && s.pts !== baseScenarios.peor!.pts);
        if (alternativa) mejorIntermedio = alternativa;
      }
    }

    return {
      ...baseScenarios,
      escenarioIntermedio: mejorIntermedio && mejorIntermedio.pts !== baseScenarios.mejor?.pts && mejorIntermedio.pts !== baseScenarios.peor?.pts ? mejorIntermedio : null
    };
  }, [grupo, real, extra, standing.stats, standing.pendientes, mejoresTerceros, player.posicion_grupos, player.clasif_dieciseisavos, matches]);

  const simUltima = useMemo(() => {
    // Solo tiene sentido cuando el grupo ya cerró y el usuario NO acertó las posiciones exactas
    if (!standing.stats || standing.stats.length === 0 || matches.length === 0 || standing.pendientes.length !== 0) return null;

    // Si el usuario acertó todas las posiciones, no hay nada que "rescatar"
    const rankingReal = standing.stats;
    const pronosticoUsuario = player.posicion_grupos
      .filter(p => p.puesto.includes(`GRUPO ${grupo}`))
      .sort((a, b) => parseInt(a.puesto[0]) - parseInt(b.puesto[0]));
    const posicionesAcertadas = rankingReal.filter((eq, idx) => pronosticoUsuario[idx]?.equipo === eq.equipo).length;
    if (posicionesAcertadas === 4) return null; // ya las acertó todas, no hay qué mostrar

    // Objetivo: encontrar el standing que el usuario pronosticó
    const standingObjetivo = pronosticoUsuario.map(p => p.equipo);

    // Probar TODOS los partidos del grupo con todas las combinaciones de resultado
    const jugadosConResultados = matches.filter(m => real[m.partido]);
    if (jugadosConResultados.length === 0) return null;

    const candidatos = [
      { local: 1, visitante: 0 },
      { local: 0, visitante: 0 },
      { local: 0, visitante: 1 },
    ];

    let mejorCoincidencia: any = null;
    let maxCoincidencias = posicionesAcertadas; // solo mostramos si mejora lo actual

    for (const partido of jugadosConResultados) {
      const resultadoReal = real[partido.partido]!;
      const signReal = Math.sign(resultadoReal.local - resultadoReal.visitante);

      for (const res of candidatos) {
        if (Math.sign(res.local - res.visitante) === signReal) continue; // mismo resultado, saltar

        const simReal: RealResults = { ...real, [partido.partido]: { local: res.local, visitante: res.visitante } };
        const stSim = calcGrupoStanding(grupo, simReal);

        // Contar cuántas posiciones coinciden con el pronóstico del usuario
        const coincidencias = stSim.stats.filter((eq, idx) => standingObjetivo[idx] === eq.equipo).length;

        if (coincidencias > maxCoincidencias) {
          maxCoincidencias = coincidencias;
          const desc = Math.sign(res.local - res.visitante) > 0
            ? `gana ${partido.local}`
            : Math.sign(res.local - res.visitante) < 0
            ? `gana ${partido.visitante}`
            : `empate`;
          mejorCoincidencia = {
            partido: { local: partido.local, visitante: partido.visitante },
            resultadoReal,
            descripcion: desc,
            standingHipotetico: stSim.stats,
            coincidencias,
          };
        }
      }
    }

    if (!mejorCoincidencia) return null;
    return { ...mejorCoincidencia, posicionesActuales: posicionesAcertadas };
  }, [grupo, real, standing.stats, standing.pendientes.length, matches, player.posicion_grupos]);

// Análisis Cruel Post-Grupo (Cuando pendientes === 0) TOTALMENTE REDISEÑADO CON SENTIDO COMÚN
  const analisisCruelFinal = useMemo(() => {
    if (standing.pendientes.length !== 0) return null;

    const maximoPosible = mejor?.pts ?? 25;
    const minimoPosible = peor?.pts ?? 0;

      // 1. Contar aciertos exactos de marcador (Limitado estrictamente a los matches del grupo)
      let partidosClavados = 0;
      matches.forEach(m => {
        const idPartidoMapeado = m.partido.trim().toLowerCase();
        const claveReal = Object.keys(real).find(k => k.trim().toLowerCase() === idPartidoMapeado);
        const r = claveReal ? real[claveReal] : null;

        if (r && r.local !== undefined && r.visitante !== undefined) {
          const gL_pred = Number(m.pred.local);
          const gV_pred = Number(m.pred.visitante);
          const gL_real = Number(r.local);
          const gV_real = Number(r.visitante);

          if (!isNaN(gL_pred) && !isNaN(gL_real) && gL_pred === gL_real && gV_pred === gV_real) {
            partidosClavados++;
          }
        }
      });

    // 2. Calcular cuántas posiciones de la tabla clavó el usuario en este grupo
    let posicionesClavadas = 0;
    const rankingRealGrupo = standing.stats || [];
    const pronosticoUsuarioGrupo = player.posicion_grupos
      .filter((p) => p.puesto.includes(`GRUPO ${grupo}`))
      .sort((a, b) => parseInt(a.puesto[0]) - parseInt(b.puesto[0]));

    rankingRealGrupo.forEach((eqReal, idx) => {
      if (pronosticoUsuarioGrupo[idx]?.equipo === eqReal.equipo) {
        posicionesClavadas++;
      }
    });

    // 3. Calcular ranking de puntos del grupo entre todos los rivales
    const rankingGrupoRivales = players.map(p => {
      const pMatches = p.fase_grupos.filter(m => equipoGrupo[m.local] === grupo && equipoGrupo[m.visitante] === grupo);
      let ptsP = 0;
      pMatches.forEach(m => {
        const r = real[m.partido];
        if (r) ptsP += scoreMatch(m.pred, r, GRUPO_PTS).pts;
      });
      const sPos = scoreGrupoPositions(grupo, standing.stats, mejoresTerceros, p.posicion_grupos, p.clasif_dieciseisavos);
      return { nombre: p.nombre, total: sPos.total + ptsP, id: p.id };
    }).sort((a, b) => b.total - a.total);

    const miPuntos = rankingGrupoRivales.find(r => r.id === player.id)?.total ?? 0;
    const miPuestoEnGrupo = rankingGrupoRivales.findIndex(r => r.id === player.id) + 1;
    const totalRivales = rankingGrupoRivales.length;

    // Detectar empates en cabeza y en cola
    const puntosLider = rankingGrupoRivales[0]?.total ?? 0;
    const puntosColista = rankingGrupoRivales[totalRivales - 1]?.total ?? 0;
    const empataLider = miPuntos === puntosLider && miPuestoEnGrupo > 1;
    const empataColista = miPuntos === puntosColista && miPuestoEnGrupo < totalRivales;
    const esLiderSolitario = miPuestoEnGrupo === 1 && !empataLider;
    const esUltimoSolitario = miPuestoEnGrupo === totalRivales && !empataColista;
    const esUltimo = miPuestoEnGrupo === totalRivales; // incluye empate

    // Cuántos comparten la misma puntuación arriba/abajo
    const empatadosArriba = rankingGrupoRivales.filter(r => r.total === puntosLider);
    const empatadosAbajo = rankingGrupoRivales.filter(r => r.total === puntosColista);

    const mejorDeTodos = rankingGrupoRivales[0];
    const peorDeTodos = rankingGrupoRivales[totalRivales - 1];

    // ==========================================
    // BLOQUE 1: RENDIMIENTO HISTÓRICO (GLOBAL)
    // ==========================================
    let veredictoGlobal = "";

    if (esLiderSolitario) {
      if (posicionesClavadas >= 3) {
        veredictoGlobal = `Lideras el Grupo ${grupo} en solitario por pura mente analítica. Tu lectura de las posiciones finales fue perfecta (${posicionesClavadas} de 4). Los marcadores exactos te dieron un poco igual (metiste ${partidosClavados}), dominaste el destino del grupo.`;
      } else {
        veredictoGlobal = `Estás en la cima en solitario gracias a tu brutal pegada con los marcadores. Clavaste ${partidosClavados} resultados exactos y, aunque la tabla final te quedó algo caótica con ${posicionesClavadas} posiciones correctas, tu puntería te corona como líder absoluto.`;
      }
    } else if (empataLider) {
      const rivalesEmpate = empatadosArriba.filter(r => r.id !== player.id).map(r => r.nombre).join(" y ");
      if (posicionesClavadas >= 3) {
        veredictoGlobal = `Empatas en cabeza del Grupo ${grupo} con ${rivalesEmpate} a ${miPuntos} pts. Los dos lo habéis clavado bien: leíste la tabla con ${posicionesClavadas} de 4 posiciones, y ellos también tuvieron su momento. El mérito es compartido, que es lo que hay.`;
      } else {
        veredictoGlobal = `Empatas en lo más alto del Grupo ${grupo} con ${rivalesEmpate} a ${miPuntos} pts. Distinto camino, mismo destino: tú con ${partidosClavados} marcadores exactos, ellos con los suyos. Nadie se lleva la corona entera pero tampoco se la merece más el otro.`;
      }
    }
    else if (miPuestoEnGrupo === 2 || miPuestoEnGrupo === 3) {
      if (posicionesClavadas >= 3) {
        veredictoGlobal = `Excelente lectura estratégica. Clavaste casi toda la tabla de posiciones (${posicionesClavadas} de 4). Te ha faltado rascar más que tus ${partidosClavados} marcadores exactos para quitarle el liderato a ${mejorDeTodos.nombre}, pero tu base es impecable.`;
      } else {
        veredictoGlobal = `Estás en el podio gracias a tus fogonazos de genialidad: esos ${partidosClavados} marcadores exactos te sostienen arriba, compensando una tabla de posiciones donde solo rescataste ${posicionesClavadas} equipos exactos.`;
      }
    }
    else if (!esUltimo && miPuestoEnGrupo <= 6) { // Zona Media
      if (posicionesClavadas >= 3) {
        veredictoGlobal = `Tiene mérito lo tuyo: eres un visionario teórico pero un desastre clínico. Has clavado ${posicionesClavadas} posiciones en la tabla, pero tu triste acierto de ${partidosClavados} marcadores exactos te condena a esta gris mitad de tabla. Sabías quién pasaba, pero no cómo jugaban.`;
      } else if (partidosClavados === 0) {
        veredictoGlobal = `Flotas en una cómoda y cobarde mediocridad. No has sido capaz de clavar ni un solo marcador exacto en todo el grupo, y tu tabla de posiciones con apenas ${posicionesClavadas} aciertos da un poco de pereza.`;
      } else {
        veredictoGlobal = `Sumaste lo justo para sobrevivir en tierra de nadie. Metiste ${partidosClavados} resultados exactos, pero tu lectura general del grupo fue tan floja que con solo ${posicionesClavadas} posiciones atinadas estos chispazos no lucen.`;
      }
    }
    else if (empataColista) {
      const rivalesColaEmpate = empatadosAbajo.filter(r => r.id !== player.id).map(r => r.nombre).join(" y ");
      if (partidosClavados === 0) {
        veredictoGlobal = `Compartes el fondo del Grupo ${grupo} con ${rivalesColaEmpate}, todos a ${miPuntos} pts. Cero marcadores exactos y apenas ${posicionesClavadas} posiciones atinadas. El consuelo es que ${rivalesColaEmpate} tampoco lo hizo mejor: miseria repartida a partes iguales.`;
      } else {
        veredictoGlobal = `Empatas en el sótano del Grupo ${grupo} con ${rivalesColaEmpate} a ${miPuntos} pts. Con ${partidosClavados} marcador(es) exacto(s) y ${posicionesClavadas} posiciones, ninguno de los que compartís fondo puede tirar la primera piedra. Una derrota colectiva.`;
      }
    }
    else { // Pozo y Colista solitario
      if (posicionesClavadas >= 3) {
        veredictoGlobal = `La paradoja del fracaso: clavaste una barbaridad de la tabla (${posicionesClavadas} posiciones de 4), pero el colapso absoluto de tus porras de partidos con solo ${partidosClavados} exactos ha sido tan dantesco que te has ido al subsuelo.`;
      } else if (partidosClavados === 0) {
        veredictoGlobal = `Dantesco. Registras 0 marcadores exactos y una tabla de posiciones lamentable con apenas ${posicionesClavadas} aciertos. Estás arrastrándote peligrosamente cerca de tu peor escenario estimado (${minimoPosible}). Una desgracia visual.`;
      } else {
        veredictoGlobal = `De nada te sirve haber cazado ${partidosClavados} marcador(es) exacto(s) en los partidos si tu lógica de posiciones finales fue un desastre con solo ${posicionesClavadas} aciertos. Puntería estéril que te condena al fondo.`;
      }
    }

    // ==========================================
    // BLOQUE 2: CÓMO TE FUE EN LA JORNADA FINAL (J3)
    // ==========================================
    // BLOQUE 2: CÓMO TE FUE EN LA JORNADA FINAL (J3)
    // Eje principal: puntos de POSICIONES antes vs después de la J3.
    // La J3 reordena el grupo → eso cambia scorePos.
    // Calculamos el standing sin J3 (solo con J1+J2) y comparamos con el real.
    // ==========================================
    const partidosJ3 = matches.slice(-2);
    const partidosJ1J2 = matches.slice(0, -2);

    // Standing del grupo SIN los partidos de J3 (solo con J1+J2 jugados)
    const realSinJ3: typeof real = { ...real };
    partidosJ3.forEach(m => { delete realSinJ3[m.partido]; });
    const standingSinJ3 = calcGrupoStanding(grupo, realSinJ3);
    const scorePosAntes = scoreGrupoPositions(
      grupo, standingSinJ3.stats, mejoresTerceros,
      player.posicion_grupos, player.clasif_dieciseisavos
    );

    // Standing real (con J3 ya jugada) — scorePos ya existe
    const scorePosReal = scorePos.total;

    // Diferencia de pts de posiciones que aportó (o quitó) la J3
    const difPosJ3 = scorePosReal - scorePosAntes.total;

    // Puntos reales en los partidos de J3
    let ptsJ3 = 0;
    partidosJ3.forEach(m => {
      const r = real[m.partido];
      if (r) ptsJ3 += scoreMatch(m.pred, r, GRUPO_PTS).pts;
    });

    // Máximo posible en partidos J3: simulando acierto exacto del pronóstico
    let maxPtsJ3 = 0;
    partidosJ3.forEach(m => {
      maxPtsJ3 += scoreMatch(m.pred, { local: m.pred.local, visitante: m.pred.visitante }, GRUPO_PTS).pts;
    });
    if (maxPtsJ3 === 0) maxPtsJ3 = partidosJ3.length * 6;

    // Umbrales absolutos: >6 pts = increible, 5-6 = bien, 4 = decente, <4 = mal
    const J3_INCREIBLE = ptsJ3 >= 7;
    const J3_BIEN      = ptsJ3 >= 5 && ptsJ3 <= 6;
    const J3_DECENTE   = ptsJ3 === 4;
    const J3_MAL       = ptsJ3 < 4;
    const J3_POSITIVO  = ptsJ3 >= 5; // bien o increible
    const J3_ACEPTABLE = ptsJ3 >= 4; // decente o mejor

    // Clasificación de la J3 según diferencia de pts de posiciones:
    //  +4 o más  → increíble (la J3 ordenó el grupo como querías o mejor)
    //  +1 a +3   → buena
    //   0        → neutral (no movió posiciones)
    //  -1 a -3   → mala
    //  -4 o menos→ catastrófica

    const ptidosJ3Label = `${ptsJ3} de ${maxPtsJ3} pts en los partidos`;

    // Nivel de posiciones antes de J3: cuantifica si el escenario previo era bueno o malo
    // Usamos scorePosAntes.total como referencia de contexto en todos los mensajes
    const nivelPrevio = scorePosAntes.total;
    const nivelPrevioDesc = nivelPrevio >= 20
      ? `muy buena posición (${nivelPrevio} pts en tabla antes de la J3)`
      : nivelPrevio >= 12
      ? `posición decente (${nivelPrevio} pts en tabla antes de la J3)`
      : `posición floja (${nivelPrevio} pts en tabla antes de la J3)`;

    let veredictoJ3 = "";

    // Calidad descriptiva de los partidos J3 en texto
    const calidad_partidos = J3_INCREIBLE ? `increíble (${ptidosJ3Label})`
      : J3_BIEN    ? `buena (${ptidosJ3Label})`
      : J3_DECENTE ? `decente (${ptidosJ3Label})`
      : `floja (${ptidosJ3Label})`;

    if (difPosJ3 >= 4) {
      // INCREÍBLE en posiciones
      if (J3_POSITIVO) {
        veredictoJ3 = `Jornada final de escándalo: partías con ${nivelPrevioDesc} y la simultánea te sumó otros +${difPosJ3} pts de posiciones. Encima la actuación en los partidos fue ${calidad_partidos}. La J3 fue redonda.`;
      } else {
        veredictoJ3 = `La jornada final te regaló lo que importa en posiciones: partías con ${nivelPrevioDesc} y la simultánea te dio +${difPosJ3} pts más de tabla. En los partidos la actuación fue ${calidad_partidos}, pero la clasificación lo compensó de sobra.`;
      }
    } else if (difPosJ3 >= 1) {
      // BUENA en posiciones
      if (J3_POSITIVO) {
        veredictoJ3 = `Buena jornada final: llegabas con ${nivelPrevioDesc} y la simultánea añadió +${difPosJ3} pts de posiciones más. En los partidos la actuación fue ${calidad_partidos}. La J3 empujó por los dos lados.`;
      } else {
        veredictoJ3 = `Jornada final aceptable: llegabas con ${nivelPrevioDesc} y la clasificación del grupo te dio +${difPosJ3} pts más de posiciones. En los partidos la actuación fue ${calidad_partidos}. La tabla compensó donde los marcadores fallaron.`;
      }
    } else if (difPosJ3 === 0) {
      // NEUTRAL en posiciones — el contexto previo da el tono
      if (nivelPrevio >= 20) {
        if (J3_POSITIVO) {
          veredictoJ3 = `La simultánea no movió las posiciones — pero llegabas con ${nivelPrevio} pts de tabla, así que mantenerlos ya es positivo. Además la actuación en los partidos fue ${calidad_partidos}. Jornada final sólida.`;
        } else if (J3_ACEPTABLE) {
          veredictoJ3 = `La simultánea no cambió las posiciones del grupo, lo que con ${nivelPrevio} pts de tabla previos es un buen resultado. En los partidos la actuación fue ${calidad_partidos}. Lo importante se mantuvo.`;
        } else {
          veredictoJ3 = `La simultánea mantuvo las posiciones (${nivelPrevio} pts de tabla, sin cambios), pero en los partidos la actuación fue ${calidad_partidos}. Jornada final conservadora: la tabla aguantó, los partidos no.`;
        }
      } else if (nivelPrevio >= 12) {
        if (J3_POSITIVO) {
          veredictoJ3 = `La J3 no movió las posiciones (te quedas con los ${nivelPrevio} pts de tabla que ya tenías), pero en los partidos la actuación fue ${calidad_partidos}. Una jornada final plana en tabla, salvada algo por los partidos.`;
        } else if (J3_ACEPTABLE) {
          veredictoJ3 = `Jornada final anodina: la simultánea no cambió las posiciones del grupo (${nivelPrevio} pts de tabla, igual que antes) y en los partidos la actuación fue ${calidad_partidos}. La J3 pasó sin pena ni gloria.`;
        } else {
          veredictoJ3 = `Jornada final gris: sin cambios en posiciones (${nivelPrevio} pts de tabla) y en los partidos la actuación fue ${calidad_partidos}. La J3 no aportó nada en ningún frente.`;
        }
      } else {
        if (J3_ACEPTABLE) {
          veredictoJ3 = `La J3 no cambió las posiciones del grupo — y con solo ${nivelPrevio} pts de tabla previos, que no mejorara duele. En los partidos la actuación fue ${calidad_partidos}, que es lo poco que hay para rescatar.`;
        } else {
          veredictoJ3 = `La jornada final no aportó nada en posiciones — con ${nivelPrevio} pts de tabla era cuando más se necesitaba un cambio. En los partidos la actuación fue ${calidad_partidos}. Una J3 para olvidar.`;
        }
      }
    } else if (difPosJ3 >= -3) {
      // MALA en posiciones
      if (nivelPrevio >= 20) {
        if (J3_POSITIVO) {
          veredictoJ3 = `Jornada final agridulce: llegabas con ${nivelPrevio} pts de tabla y la simultánea te quitó ${Math.abs(difPosJ3)} pts de posiciones. En los partidos la actuación fue ${calidad_partidos}, que amortigua el golpe. Duele perder lo que tenías.`;
        } else if (J3_ACEPTABLE) {
          veredictoJ3 = `Jornada final regular: tenías ${nivelPrevio} pts de tabla y la simultánea te los recortó en ${Math.abs(difPosJ3)}. En los partidos la actuación fue ${calidad_partidos}. La J3 te hizo daño en la tabla sin mucha compensación.`;
        } else {
          veredictoJ3 = `Mala jornada final: tenías ${nivelPrevio} pts de tabla y la simultánea te los recortó en ${Math.abs(difPosJ3)}. En los partidos la actuación fue ${calidad_partidos}. La J3 te hizo daño cuando más tenías que perder.`;
        }
      } else {
        if (J3_POSITIVO) {
          veredictoJ3 = `Jornada final agridulce: la simultánea te costó ${Math.abs(difPosJ3)} pts de posiciones aunque en los partidos la actuación fue ${calidad_partidos}. Con los ${nivelPrevio} pts de tabla que llevabas, perder posiciones en J3 duele el doble.`;
        } else if (J3_ACEPTABLE) {
          veredictoJ3 = `Jornada final regular: ${Math.abs(difPosJ3)} pts de posiciones perdidos en la simultánea y en los partidos la actuación fue ${calidad_partidos}. Partías con ${nivelPrevio} pts de tabla y la J3 no hizo más que empeorar el panorama.`;
        } else {
          veredictoJ3 = `Mala jornada final: ${Math.abs(difPosJ3)} pts de posiciones perdidos en la simultánea y en los partidos la actuación fue ${calidad_partidos}. Partías con ${nivelPrevio} pts de tabla y la J3 apretó por los dos lados.`;
        }
      }
    } else {
      // CATASTRÓFICA en posiciones
      if (nivelPrevio >= 20) {
        if (J3_POSITIVO) {
          veredictoJ3 = `Catástrofe en la jornada final: llegabas con ${nivelPrevio} pts de tabla y la simultánea te arrancó ${Math.abs(difPosJ3)} pts de posiciones. En los partidos la actuación fue ${calidad_partidos}, pero de nada sirvió. La J3 tiró por la borda lo que habías construido.`;
        } else if (J3_ACEPTABLE) {
          veredictoJ3 = `Jornada final devastadora: tenías ${nivelPrevio} pts de tabla y la simultánea se los llevó por delante quitándote ${Math.abs(difPosJ3)} pts de posiciones. En los partidos la actuación fue ${calidad_partidos}. La J3 fue un mazazo.`;
        } else {
          veredictoJ3 = `Debacle total en la jornada final: tenías ${nivelPrevio} pts de tabla construidos y la simultánea se los llevó por delante con ${Math.abs(difPosJ3)} pts de posiciones perdidos. En los partidos la actuación fue ${calidad_partidos}. La J3 fue un desastre en toda regla.`;
        }
      } else {
        if (J3_POSITIVO) {
          veredictoJ3 = `Jornada final catastrófica en posiciones: la simultánea te costó ${Math.abs(difPosJ3)} pts de posiciones. Con los apenas ${nivelPrevio} pts de tabla que llevabas, ese golpe es demoledor. En los partidos la actuación fue ${calidad_partidos}, pero no alcanzó para nada.`;
        } else if (J3_ACEPTABLE) {
          veredictoJ3 = `Jornada final muy mala: ${Math.abs(difPosJ3)} pts de posiciones perdidos en la simultánea y en los partidos la actuación fue ${calidad_partidos}. Partías con ${nivelPrevio} pts de tabla y la J3 no dejó nada en pie.`;
        } else {
          veredictoJ3 = `Desastre total en la jornada final: ${Math.abs(difPosJ3)} pts de posiciones perdidos en la simultánea y en los partidos la actuación fue ${calidad_partidos}. Partías con ${nivelPrevio} pts de tabla — la J3 arrasó con todo.`;
        }
      }
    }

    // ==========================================
    // BLOQUE 3: HUMILLACIÓN COMPARATIVA (RIVALES)
    // ==========================================
    let veredictoRivales = "";

    if (esLiderSolitario) {
      veredictoRivales = `Eres el Rey indiscutible del Grupo ${grupo}. Miras hacia abajo y solo ves un desierto de mediocridad. Que te limpien las boots antes de hablarte.`;
    } else if (empataLider) {
      const rivalesTop = empatadosArriba.filter(r => r.id !== player.id).map(r => r.nombre).join(", ");
      veredictoRivales = `Compartes la cima del Grupo ${grupo} con ${rivalesTop}, todos a ${miPuntos} pts. Entre varios os repartís lo más alto — no hay liderato individual, pero tampoco hay nadie por encima de vosotros. Empate en la gloria.`;
    } else if (miPuestoEnGrupo === 2 || miPuestoEnGrupo === 3) {
      veredictoRivales = `Puesto ${miPuestoEnGrupo} de ${totalRivales}. Estás arriba, oliéndole el cuello a ${mejorDeTodos.nombre} y marcando una distancia sana con los desgraciados del fondo.`;
    } else if (!esUltimo && miPuestoEnGrupo <= 6) {
      veredictoRivales = `Estás en el puesto ${miPuestoEnGrupo} de ${totalRivales}. Enterrado vivo en la intrascendencia de la mitad de la tabla. Ni amenazas al líder ${mejorDeTodos.nombre}, ni das tanta risa como la desgracia de ${peorDeTodos.nombre}.`;
    } else if (empataColista) {
      const rivalesCol = empatadosAbajo.filter(r => r.id !== player.id).map(r => r.nombre).join(", ");
      veredictoRivales = `Compartes el último puesto del Grupo ${grupo} con ${rivalesCol}, todos a ${miPuntos} pts. Nadie se salva: la vergüenza del fondo es de todos por igual. Al menos no estás solo en el agujero.`;
    } else {
      veredictoRivales = `Puesto ${miPuestoEnGrupo} de ${totalRivales}. Estás en el subsuelo del Grupo ${grupo}. Eres oficialmente el último en solitario. El bufón tiene nombre propio.`;
    }

    return { veredictoGlobal, veredictoJ3, veredictoRivales };
  }, [standing.pendientes.length, mejor, peor, player, grupo, equipoGrupo, real, players, standing.stats, mejoresTerceros, scorePos.total, puntosPartidosUsuario, matches]);

  const userPositions = useMemo(() => {
    return player.posicion_grupos
      .filter((p) => p.puesto.includes(`GRUPO ${grupo}`))
      .sort((a, b) => parseInt(a.puesto[0]) - parseInt(b.puesto[0]));
  }, [player.posicion_grupos, grupo]);

  return (
    <div>
      {/* ── TOTAL PUNTOS GRUPO (posiciones + partidos) ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 12, padding: "10px 12px",
        background: C.chalk, borderRadius: 8,
        borderLeft: `4px solid ${C.ink}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: ".04em", textTransform: "uppercase" }}>
          Total grupo {grupo} (tabla + partidos)
        </span>
        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 20, color: totalPuntosGrupoUsuario > 0 ? C.pitch : C.muted }}>
          {totalPuntosGrupoUsuario > 0 ? `+${totalPuntosGrupoUsuario}` : "0"} pts
        </span>
      </div>

      {/* ── TOTAL POSICIONES GRUPO ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8, padding: "8px 0",
        borderBottom: `2px solid ${C.line}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: ".04em", textTransform: "uppercase" }}>
          Total posiciones grupo {grupo}
        </span>
        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 18, color: scorePos.total > 0 ? C.pitch : C.muted }}>
          {scorePos.total > 0 ? `+${scorePos.total}` : "0"} pts
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
          textTransform: "uppercase", color: C.muted, marginBottom: 6,
          display: "flex", justifyContent: "space-between"
        }}>
          <span style={{ flex: 1 }}>Tu Pronóstico</span>
          <span style={{ width: 100, textAlign: "right" }}>Porra</span>
        </div>

        {userPositions.map((userPos, idx) => {
          const posPronosticada = idx + 1;
          const realStat = standing.stats.find(s => s.equipo === userPos.equipo);
          const posRealNum = standing.stats.findIndex(s => s.equipo === userPos.equipo) + 1;

          const det = scorePos.detalle.find(d => d.equipo === userPos.equipo);
          const ptsPosicion = det?.ptsPosicion ?? 0;
          const ptsClasif = det?.ptsClasif ?? 0;
          const ptsTotales = ptsPosicion + ptsClasif;
          const clasificaReal = det?.clasificaReal ?? false;
          const clasificaIncierto = det?.clasificaIncierto ?? false;
          const predijoClaif = player.clasif_dieciseisavos.includes(userPos.equipo);
          const grupoCompleto = standing.pendientes.length === 0;
          // 4 casos: predijo+clasificó, predijo+no clasificó, no predijo+clasificó, no predijo+no clasificó
          const clasifLabel: { text: string; color: string; border: string; bg: string } | null = (() => {
            if (!grupoCompleto) return null;
            if (predijoClaif && clasificaReal)
              return { text: "✓ CLASIF.", color: "#0B5A53", border: "#0D695E", bg: "rgba(13,105,94,0.07)" };
            if (!predijoClaif && clasificaReal)
              return { text: "✗ CLASIF.", color: "#B91C1C", border: "#EF4444", bg: "rgba(239,68,68,0.07)" };
            if (predijoClaif && !clasificaReal)
              return { text: "✗ NO CLASIF.", color: "#B91C1C", border: "#EF4444", bg: "rgba(239,68,68,0.07)" };
            if (!predijoClaif && !clasificaReal && (det?.pos ?? 5) <= 3)
              return { text: "✓ NO CLASIF.", color: "#6B7280", border: "#9CA3AF", bg: "rgba(156,163,175,0.07)" };
            return null;
          })();

          let rowBg: string = "transparent";
          let textColor: string = C.ink;
          let indicatorColor: string = C.muted;

          if (realStat && realStat.pj > 0) {
            if (ptsTotales === 0) {
              rowBg = "rgba(211, 47, 47, 0.06)";
              textColor = C.rojo;
              indicatorColor = C.rojo;
            } else if (posRealNum === posPronosticada) {
              rowBg = "rgba(46, 125, 85, 0.08)";
              textColor = "#2E7D55";
              indicatorColor = "#2E7D55";
            } else {
              rowBg = "rgba(184, 115, 51, 0.08)";
              textColor = "#B87333";
              indicatorColor = "#B87333";
            }
          }

          return (
            <div key={userPos.equipo} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 4px",
              borderBottom: `1px solid ${C.chalk}`,
              background: rowBg,
              borderRadius: 4,
              marginBottom: 2
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

                {clasifLabel && (
                  <span style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    color: clasifLabel.color,
                    backgroundColor: clasifLabel.bg,
                    border: `1.5px solid ${clasifLabel.border}`,
                    borderRadius: "4px",
                    padding: "1px 5px",
                    letterSpacing: "0.03em",
                    lineHeight: "1",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    boxShadow: "0px 1px 0px rgba(0,0,0,0.08)"
                  }}>
                    {clasifLabel.text}
                  </span>
                )}
              </div>

              <div style={{ width: 100, textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                {ptsTotales > 0 ? (
                  <>
                    <span style={{ 
                      fontFamily: "'DM Mono', monospace", 
                      fontWeight: 700, 
                      fontSize: 11,
                      color: textColor 
                    }}>
                      +{ptsTotales} pts
                      {posRealNum > 0 && posRealNum !== posPronosticada && (
                        <span style={{ fontWeight: 400, fontSize: 10, color: C.muted, marginLeft: 2 }}>
                          ({posRealNum}º)
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 9, color: C.muted, fontFamily: "'DM Mono', monospace", marginTop: -2 }}>
                      {ptsClasif > 0 
                        ? `(${ptsPosicion} pos, ${ptsClasif} clsf)` 
                        : `(${ptsPosicion} pos)`}
                    </span>
                  </>
                ) : posRealNum > 0 && posRealNum !== posPronosticada ? (
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: indicatorColor }}>
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

      {/* ── TOTAL PUNTOS PARTIDOS + LISTA DE PARTIDOS ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8, padding: "8px 0",
        borderTop: `2px solid ${C.line}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: ".04em", textTransform: "uppercase" }}>
          Total puntos partidos grupo {grupo}
        </span>
        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 18, color: puntosPartidosUsuario > 0 ? C.pitch : C.muted }}>
          {puntosPartidosUsuario > 0 ? `+${puntosPartidosUsuario}` : "0"} pts
        </span>
      </div>

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

      {/* ── ESCENARIOS ANTES DE QUE SE CIERREN LOS PARTIDOS ── */}
      {standing.pendientes.length > 0 && (mejor || peor) && (
        <div style={{
          marginBottom: 16, padding: "14px",
          background: C.chalk, borderRadius: 8, border: `1px solid ${C.line}`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: `1px solid ${C.line}`, paddingBottom: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>💡</span>
            <span style={{ ...secLabel, fontSize: 12, color: C.ink }}>
              Última jornada · Proyecciones de rendimiento
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            
            {mejor && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2E8B57" }}>
                      ✅ Escenario Ideal Realista: <span style={{ fontWeight: 500, color: C.ink, textTransform: "lowercase" }}>{mejor.descripcion}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {mejor.desglose}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "#2E8B57", textAlign: "right" }}>
                    +{mejor.pts} pts
                  </div>
                </div>

                <div style={{ background: "rgba(46, 139, 87, 0.05)", borderRadius: 4, padding: "6px 8px", fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 6, color: C.ink }}>
                  {mejor.standing.map((team, idx) => (
                    <span key={team.equipo}>
                      <span style={{ color: C.muted }}>{idx + 1}º</span> {team.equipo}
                      {idx < mejor.standing.length - 1 && <span style={{ color: C.line, margin: "0 4px" }}>·</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ height: 1, background: C.line, opacity: 0.4 }} />

            {escenarioIntermedio && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#B87333" }}>
                      ⚠️ Escenario Intermedio: <span style={{ fontWeight: 500, color: C.ink, textTransform: "lowercase" }}>{escenarioIntermedio.descripcion}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {escenarioIntermedio.desglose}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "#B87333", textAlign: "right" }}>
                    +{escenarioIntermedio.pts} pts
                  </div>
                </div>

                <div style={{ background: "rgba(184, 115, 51, 0.05)", borderRadius: 4, padding: "6px 8px", fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 6, color: C.ink }}>
                  {escenarioIntermedio.standing.map((team, idx) => (
                    <span key={team.equipo}>
                      <span style={{ color: C.muted }}>{idx + 1}º</span> {team.equipo}
                      {idx < escenarioIntermedio.standing.length - 1 && <span style={{ color: C.line, margin: "0 4px" }}>·</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ height: 1, background: C.line, opacity: 0.4 }} />

            {peor && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#C32F2F" }}>
                      ❌ Peor Escenario: <span style={{ fontWeight: 500, color: C.ink, textTransform: "lowercase" }}>{peor.descripcion}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {peor.desglose}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: C.rojo, textAlign: "right" }}>
                    +{peor.pts} pts
                  </div>
                </div>

                <div style={{ background: "rgba(211, 47, 47, 0.05)", borderRadius: 4, padding: "6px 8px", fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 6, color: C.ink }}>
                  {peor.standing.map((team, idx) => (
                    <span key={team.equipo}>
                      <span style={{ color: C.muted }}>{idx + 1}º</span> {team.equipo}
                      {idx < peor.standing.length - 1 && <span style={{ color: C.line, margin: "0 4px" }}>·</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── ESCENARIO DESPUÉS: JUICIO FINAL DESPIADADO CUANDO QUEDAN 0 PARTIDOS PENDIENTES ── */}
      {standing.pendientes.length === 0 && analisisCruelFinal && (
        <div style={{
          marginBottom: 16, padding: "14px",
          background: "#FFF5F5", borderRadius: 8, border: `1px solid ${C.rojo}`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: `1px solid ${C.rojo}`, paddingBottom: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>💀</span>
            <span style={{ ...secLabel, fontSize: 12, color: C.rojo }}>
              Grupo Cerrado · Veredicto del Consejo de Sabios
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                📊 Rendimiento Histórico en el Grupo:
              </div>
              <div style={{ fontSize: 12.5, color: C.ink, marginTop: 3, lineHeight: "1.4", fontStyle: "italic" }}>
                "{analisisCruelFinal.veredictoGlobal}"
              </div>
            </div>

            <div style={{ height: 1, background: C.line, opacity: 0.3 }} />

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                ⏱️ Resumen de la Última Jornada:
              </div>
              <div style={{ fontSize: 12.5, color: C.ink, marginTop: 3, lineHeight: "1.4", fontStyle: "italic" }}>
                "{analisisCruelFinal.veredictoJ3}"
              </div>
            </div>

            <div style={{ height: 1, background: C.line, opacity: 0.3 }} />

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                🥊 Humillación Comparativa en la Porra:
              </div>
              <div style={{ fontSize: 12.5, color: C.ink, marginTop: 3, lineHeight: "1.4", fontStyle: "italic" }}>
                "{analisisCruelFinal.veredictoRivales}"
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SI HUBIERA PASADO OTRA COSA ── */}
      {simUltima && (
        <div style={{
          marginBottom: 16, padding: "10px 12px",
          background: "rgba(184, 115, 51, 0.07)",
          borderRadius: 6, border: `1px solid #B87333`,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 800, color: "#7A4A10",
            marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            🔮 Si hubiera pasado otra cosa…
          </div>
          <div style={{ fontSize: 12, color: C.ink, lineHeight: "1.6" }}>
            {simUltima.coincidencias === 4 ? (
              <>
                Tenías la tabla del Grupo {grupo} perfectamente adivinada.
                {" "}Si{" "}<strong>{simUltima.partido.local} – {simUltima.partido.visitante}</strong>{" "}
                hubiera acabado con{" "}<strong style={{ color: "#B87333" }}>{simUltima.descripcion}</strong>{" "}
                en lugar del{" "}
                <strong style={{ color: C.muted, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                  {simUltima.resultadoReal.local}–{simUltima.resultadoReal.visitante}
                </strong>
                {", habrías clavado las 4 posiciones. Un solo resultado te robó la tabla entera."}
              </>
            ) : (
              <>
                {"Con "}
                <strong style={{ color: "#B87333" }}>{simUltima.descripcion}</strong>
                {" en "}
                <strong>{simUltima.partido.local} – {simUltima.partido.visitante}</strong>
                {" en lugar del "}
                <strong style={{ color: C.muted, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                  {simUltima.resultadoReal.local}–{simUltima.resultadoReal.visitante}
                </strong>
                {", habrías acertado "}
                <strong style={{ color: "#2E7D55" }}>{simUltima.coincidencias} de 4</strong>
                {" posiciones — "}
                {(simUltima.coincidencias - simUltima.posicionesActuales) === 1
                  ? "una más de las que tienes ahora"
                  : `${simUltima.coincidencias - simUltima.posicionesActuales} más de las que tienes ahora`
                }.
              </>
            )}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>
            Clasificación hipotética:{" "}
            {simUltima.standingHipotetico.map((s: any, i: number) => `${i + 1}º ${s.equipo}`).join(" · ")}
          </div>
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

  const player = useMemo(() => {
    return players.find((p) => p.id === picked) ?? players[0];
  }, [players, picked]);

  const rankingBaseOficial = useMemo(() => {
    if (ranked && ranked.length > 0) return ranked;
    return players.map(p => ({
      player: p,
      score: scorePlayer(p, real, extra)
    })).sort((a, b) => b.score.total - a.score.total);
  }, [ranked, players, real, extra]);

  const score = useMemo(() => {
    if (!player) return { total: 0, signos: 0, exactos: 0 };
    return scorePlayer(player, real, extra);
  }, [player, real, extra]);

  const h = player?.cuadro_honor;
  
  const equipoGrupo = useMemo(() => {
    return player ? buildEquipoGrupoMap(player) : {};
  }, [player]);

  const mejoresTerceros = useMemo(() => calcMejoresTerceros(real), [real]);

  const totalPosicionesGlobal = useMemo(() => {
    if (!player) return 0;
    return GRUPOS.reduce((acc, g) => {
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
  }, [player, real, extra, mejoresTerceros]);

  const { puestoActual, puestoSimulado, ptsSimuladoArriba, ptsSimuladoAbajo } = useMemo(() => {
    if (!player || !rankingBaseOficial || rankingBaseOficial.length === 0) {
      return { puestoActual: 0, puestoSimulado: 0, ptsSimuladoActual: 0, ptsSimuladoArriba: null, ptsSimuladoAbajo: null };
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

    const entradaActual = tablaOrdenada[pSimulado - 1];
    const entradaArriba = pSimulado > 1 ? tablaOrdenada[pSimulado - 2] : null;
    const entradaAbajo = pSimulado < tablaOrdenada.length ? tablaOrdenada[pSimulado] : null;

    const ptsActual = entradaActual?.puntosSimulados ?? 0;
    const diffArriba = entradaArriba ? entradaArriba.puntosSimulados - ptsActual : null;
    const diffAbajo = entradaAbajo ? ptsActual - entradaAbajo.puntosSimulados : null;

    return {
      puestoActual: pActual,
      puestoSimulado: pSimulado,
      ptsSimuladoActual: ptsActual,
      ptsSimuladoArriba: diffArriba,
      ptsSimuladoAbajo: diffAbajo,
    };
  }, [rankingBaseOficial, player, real, mejoresTerceros, extra]);

  const subioPuesto = puestoSimulado < puestoActual;
  const bajoPuesto = puestoSimulado > puestoActual;

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (!player) return null;

  return (
    <div>
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

      <h2 style={hStyle}>{player.nombre}</h2>
      <p style={{ color: C.muted, fontSize: 12.5, margin: "5px 0 0", letterSpacing: ".02em" }}>
        {score.total} puntos · {score.signos + score.exactos} 1X2 · {score.exactos} exactos
      </p>

      {/* ── CUADRO DE HONOR ── */}
      <div style={{ marginTop: 22 }}>
        <SectionToggle label="Cuadro de honor" open={openSections.has("honor")} onToggle={() => toggleSection("honor")} />
        {openSections.has("honor") && h && (
          <div style={{ marginTop: 10 }}>
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
          </div>
        )}
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
                  <>
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
                  {(ptsSimuladoArriba !== null || ptsSimuladoAbajo !== null) && (
                    <div style={{ marginTop: 4, fontSize: 11, color: C.muted }}>
                      {ptsSimuladoArriba !== null && puestoSimulado > 1 && (
                        <span>
                          A{" "}
                          <strong style={{ fontFamily: "'DM Mono', monospace", color: C.ink }}>
                            {ptsSimuladoArriba}
                          </strong>{" "}
                          pts del {puestoSimulado - 1}°
                        </span>
                      )}
                      {ptsSimuladoArriba !== null && ptsSimuladoAbajo !== null && (
                        <span style={{ margin: "0 6px", color: C.line }}>·</span>
                      )}
                      {ptsSimuladoAbajo !== null && (
                        <span>
                          A{" "}
                          <strong style={{ fontFamily: "'DM Mono', monospace", color: C.ink }}>
                            {ptsSimuladoAbajo}
                          </strong>{" "}
                          pts del {puestoSimulado + 1}°
                        </span>
                      )}
                    </div>
                  )}
                  </>
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
              players={players}
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
          const koMatches = (player as unknown as Record<string, Match[]>)[`enfr_${rondaTab}`];
          const ronda = KO_RONDAS.find((r) => r.key === rondaTab);
          const realCruces = CRUCES_DATA["enfr_" + rondaTab] ?? [];
          const rondaTieneSorteoReal = realCruces.some(c => c.kickoff);
          const realCruceLabels = new Set(realCruces.map(c => c.partido));
          const realTeams = new Set(realCruces.flatMap(c => [c.local, c.visitante]));
          const baremo = KO_BAREMO[rondaTab];
          return (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
                {ronda?.label}
              </div>
              {koMatches?.length
                ? koMatches.map((m, i) => {
                    const r = real[m.partido];
                    const s = r ? scoreMatch(m.pred, r, baremo) : null;
                    const acertoCruce = rondaTieneSorteoReal && realCruceLabels.has(m.partido);
                    const localClasif = rondaTieneSorteoReal && !acertoCruce && realTeams.has(m.local);
                    const visitanteClasif = rondaTieneSorteoReal && !acertoCruce && realTeams.has(m.visitante);
                    return (
                      <MatchRow key={i}
                        local={m.local} visitante={m.visitante} pred={m.pred}
                        hit={s?.hit as Hit ?? null}
                        pts={s?.pts ?? null}
                        acertoCruce={acertoCruce}
                        localClasif={localClasif}
                        visitanteClasif={visitanteClasif}
                      />
                    );
                  })
                : <p style={{ color: C.muted, fontSize: 13 }}>Sin partidos</p>}
            </div>
          );
        })()}
        </div>}
      </div>
    </div>
  );
}