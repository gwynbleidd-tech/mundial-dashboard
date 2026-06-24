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
    
    const pendientesParaScenarios = standing.pendientes.length > 0
      ? standing.pendientes
      : partidosJ3.map(m => ({ partido: m.partido, local: m.local, visitante: m.visitante, kickoff: "" }));

    const baseScenarios = bestWorstScenario(
      grupo,
      standing.stats,
      pendientesParaScenarios,
      mejoresTerceros,
      player.posicion_grupos,
      player.clasif_dieciseisavos,
      matches
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
    if (!standing.stats || standing.stats.length === 0 || matches.length === 0 || standing.pendientes.length === 0) return null;

    const jugadosConResultados = matches.filter(m => real[m.partido]);
    if (jugadosConResultados.length === 0) return null;
    
    const ultimoMatch = jugadosConResultados[jugadosConResultados.length - 1];
    const resultadoReal = real[ultimoMatch.partido]!;
    const ptsActual = scorePos.total;

    const candidatos = [
      { local: 1, visitante: 0, desc: `gana ${ultimoMatch.local}` },
      { local: 0, visitante: 0, desc: `empate` },
      { local: 0, visitante: 1, desc: `gana ${ultimoMatch.visitante}` },
    ];

    let mejorAlternativo: any = null;

    for (const res of candidatos) {
      const esReal = Math.sign(res.local - res.visitante) === Math.sign(resultadoReal.local - resultadoReal.visitante);
      if (esReal) continue;

      const simReal: RealResults = { ...real, [ultimoMatch.partido]: { local: res.local, visitante: res.visitante } };
      const stSim = calcGrupoStanding(grupo, simReal);
      
      const guardadas: string[] = [];
      for (let r = 1; r <= 4; r++) {
        const v = extra[normPos(`${r}º GRUPO ${grupo}`)];
        if (typeof v === "string" && v) guardadas.push(v);
      }
      if (guardadas.length === 4) {
        stSim.stats.sort((a, b) => guardadas.indexOf(a.equipo) - guardadas.indexOf(b.equipo));
      }

      const scoreSimulado = scoreGrupoPositions(grupo, stSim.stats, mejoresTerceros, player.posicion_grupos, player.clasif_dieciseisavos);

      if (!mejorAlternativo || scoreSimulado.total > mejorAlternativo.pts) {
        mejorAlternativo = { pts: scoreSimulado.total, standing: stSim.stats, descripcion: res.desc };
      }
    }

    if (!mejorAlternativo || mejorAlternativo.pts <= ptsActual) return null;

    return { 
      mejorAlternativo, 
      ptsActual, 
      partido: { local: ultimoMatch.local, visitante: ultimoMatch.visitante }, 
      resultadoReal 
    };
  }, [grupo, real, extra, standing.stats, mejoresTerceros, player.posicion_grupos, player.clasif_dieciseisavos, matches, scorePos.total, standing.pendientes.length]);

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

    const miPuestoEnGrupo = rankingGrupoRivales.findIndex(r => r.id === player.id) + 1;
    const totalRivales = rankingGrupoRivales.length;
    const esUltimo = miPuestoEnGrupo === totalRivales;

    const mejorDeTodos = rankingGrupoRivales[0];
    const peorDeTodos = rankingGrupoRivales[totalRivales - 1];

    // ==========================================
    // BLOQUE 1: RENDIMIENTO HISTÓRICO (GLOBAL)
    // ==========================================
    let veredictoGlobal = "";
    
    if (miPuestoEnGrupo === 1) {
      if (posicionesClavadas >= 3) {
        veredictoGlobal = `Lideras el Grupo ${grupo} por pura mente analítica. Tu lectura de las posiciones finales fue perfecta (${posicionesClavadas} de 4). Los marcadores exactos te dieron un poco igual (metiste ${partidosClavados}), dominaste el destino del grupo.`;
      } else {
        veredictoGlobal = `Estás en la cima gracias a tu brutal pegada con los marcadores. Clavaste ${partidosClavados} resultados exactos y, aunque la tabla final te quedó algo caótica con ${posicionesClavadas} posiciones correctas, tu puntería te corona como líder absoluto.`;
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
    else { // Pozo y Colistas
      if (posicionesClavadas >= 3) {
        veredictoGlobal = `La paradoja del fracaso: clavaste una barbaridad de la tabla (${posicionesClavadas} posiciones de 4), pero el colapso absoluto de tus porras de partidos con solo ${partidosClavados} exactos ha sido tan dantesco que te has ido al subsuelo.`;
      } else if (partidosClavados === 0) {
        veredictoGlobal = `Dantesco. Registras 0 marcadores exactos y una tabla de posiciones lamentable con apenas ${posicionesClavadas} aciertos. Estás arrastrándote peligrosamente cerca de tu peor escenario estimado (${minimoPosible}). Una desgracia visual.`;
      } else {
        veredictoGlobal = `De nada te sirve haber cazado ${partidosClavados} marcador(es) exacto(s) en los partidos si tu lógica de posiciones finales fue un desastre con solo ${posicionesClavadas} aciertos. Puntería estéril que te condena al fondo.`;
      }
    }

    // ==========================================
    // BLOQUE 2 CORREGIDO: RESUMEN DE LA JORNADA J3 (CON SENTIDO COMÚN)
    // ==========================================
    let veredictoJ3 = "";

    if (posicionesClavadas === 0) {
      veredictoJ3 = `La jornada final simultánea te desintegró por completo. Clavaste la asombrosa cantidad de 0 posiciones reales en la tabla. El caos de los minutos finales borró tu estrategia del mapa, dejándote solo con ${partidosClavados} marcadores perfectos.`;
    } else if (posicionesClavadas >= 3) {
      veredictoJ3 = `La última jornada a la vez demostró que leías bien el futuro de la tabla con ${posicionesClavadas} posiciones perfectas, pero el vaivén de los goles y tus discretos ${partidosClavados} aciertos en porras congelaron tu ascenso.`;
    } else {
      // Casos intermedios (1 o 2 posiciones exactas)
      if (partidosClavados > 0) {
        // NUEVO: Caso donde compensas la tabla con marcadores exactos brutales
        veredictoJ3 = `Salvaste los muebles en el último segundo. Aunque la tabla final se te resistió con apenas ${posicionesClavadas} posiciones exactas, tu tremenda puntería con ${partidosClavados} marcador(es) exacto(s) en las porras amortiguó el golpe y evitó el desastre.`;
      } else if (esUltimo || miPuestoEnGrupo >= 7) {
        veredictoJ3 = `La jornada final simultánea fue una agonía televisada en directo hacia el fondo. Conseguiste amarrar apenas ${posicionesClavadas} posiciones exactas en la tabla, una renta ridícula que junto a tus ${partidosClavados} plenos de goles te sepultó.`;
      } else {
        veredictoJ3 = `La última jornada simultánea te dejó a medias. Acertaste apenas ${posicionesClavadas} posiciones exactas en la tabla de posiciones, lo justo para amortiguar el golpe pero insuficiente para salir de la zona gris.`;
      }
    }

    // ==========================================
    // BLOQUE 3: HUMILLACIÓN COMPARATIVA (RIVALES)
    // ==========================================
    let veredictoRivales = "";
    
    if (miPuestoEnGrupo === 1) {
      veredictoRivales = `Eres el Rey indiscutible del Grupo ${grupo}. Miras hacia abajo y solo ves un desierto de mediocridad. Que te limpien las boots antes de hablarte.`;
    } else if (miPuestoEnGrupo === 2 || miPuestoEnGrupo === 3) {
      veredictoRivales = `Puesto ${miPuestoEnGrupo} de ${totalRivales}. Estás arriba, oliéndole el cuello a ${mejorDeTodos.nombre} y marcando una distancia sana con los desgraciados del fondo.`;
    } else if (!esUltimo && miPuestoEnGrupo <= 6) {
      veredictoRivales = `Estás en el puesto ${miPuestoEnGrupo} de ${totalRivales}. Enterrado vivo en la intrascendencia de la mitad de la tabla. Ni amenazas al líder ${mejorDeTodos.nombre}, ni das tanta risa como la desgracia de ${peorDeTodos.nombre}.`;
    } else {
      veredictoRivales = `Puesto ${miPuestoEnGrupo} de ${totalRivales}. Estás en el subsuelo del Grupo ${grupo}. ${esUltimo ? `Eres oficialmente el bufón del grupo, vas ÚLTIMO.` : `Lo único que te salva de la humillación pública total es que ${peorDeTodos.nombre} está dando todavía más asco debajo de ti.`}`;
    }

    return { veredictoGlobal, veredictoJ3, veredictoRivales };
  }, [standing.pendientes.length, mejor, peor, player, grupo, equipoGrupo, real, players, standing.stats, mejoresTerceros]);

  const userPositions = useMemo(() => {
    return player.posicion_grupos
      .filter((p) => p.puesto.includes(`GRUPO ${grupo}`))
      .sort((a, b) => parseInt(a.puesto[0]) - parseInt(b.puesto[0]));
  }, [player.posicion_grupos, grupo]);

  return (
    <div>
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

                {clasificaReal && (
                  <span style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    color: textColor === "#2E7D55" ? "#0B5A53" : "#7A4A10",
                    backgroundColor: "#FAF8F2",
                    border: `1.5px solid ${textColor === "#2E7D55" ? "#0D695E" : "#B87333"}`,
                    borderRadius: "4px",
                    padding: "1px 5px",
                    letterSpacing: "0.03em",
                    lineHeight: "1",
                    flexShrink: 0,
                    boxShadow: "0px 1px 0px rgba(184, 115, 51, 0.15)"
                  }}>
                    CLASIF.
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
          <div style={{ fontSize: 12, color: C.ink, lineHeight: "1.4" }}>
            Si en{" "}
            <strong>{simUltima.partido.local} – {simUltima.partido.visitante}</strong>
            {" "}hubiera habido{" "}
            <strong style={{ color: "#B87333" }}>{simUltima.mejorAlternativo.descripcion}</strong>
            {" "}en vez de{" "}
            <strong style={{ color: C.muted, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
              {simUltima.resultadoReal.local}–{simUltima.resultadoReal.visitante}
            </strong>
            {", habrías sumado "}
            <strong style={{ fontFamily: "'DM Mono', monospace", color: "#2E7D55" }}>
              +{simUltima.mejorAlternativo.pts}
            </strong>
            {" pts en este grupo"}
            {simUltima.ptsActual > 0 && (
              <span style={{ color: C.muted }}>
                {" "}(ahora tienes +{simUltima.ptsActual})
              </span>
            )}
            .
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>
            Clasificación hipotética:{" "}
            {simUltima.mejorAlternativo.standing.map((s: any, i: number) => `${i + 1}º ${s.equipo}`).join(" · ")}
          </div>
        </div>
      )}

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