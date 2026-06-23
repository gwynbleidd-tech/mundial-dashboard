/**
 * Calcula tablas de clasificación de grupos y mejores terceros.
 * Criterios FIFA: 1) Puntos 2) Diferencia de goles 3) Goles a favor
 * Empate exacto → orden alfabético (admin desempata con drag & drop).
 */

import type { RealResults } from "@/lib/scoring";
import { scoreMatch, GRUPO_PTS } from "@/lib/scoring";
import horarios from "@/data/horarios_grupos.json";
import teamsData from "@/data/teams.json";

type Fixture = { partido: string; local: string; visitante: string; kickoff: string };

const ALL_FIXTURES: Fixture[] = Object.values(
  horarios as Record<string, Fixture[]>
).flat();

const GRUPOS_DATA = (teamsData as { grupos: Record<string, string[]> }).grupos;
const GRUPOS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;

export interface TeamStat {
  equipo: string;
  grupo: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}

export interface GrupoStanding {
  stats: TeamStat[];       // ordenados 1º→4º
  pendientes: Fixture[];   // partidos sin resultado
  completo: boolean;
}

export interface MejoresTerceros {
  terceros: TeamStat[];    // todos los 3º disponibles, ordenados
  clasifican: TeamStat[];  // los 8 primeros
  completo: boolean;       // los 12 grupos tienen resultado
}

// ---- Clasificación de un grupo ----

export function calcGrupoStanding(grupo: string, real: RealResults): GrupoStanding {
  const equipos = GRUPOS_DATA[grupo] ?? [];
  const statsMap: Record<string, TeamStat> = {};
  for (const eq of equipos) {
    statsMap[eq] = { equipo: eq, grupo, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
  }

  const grupoFixtures = ALL_FIXTURES.filter(
    f => equipos.includes(f.local) && equipos.includes(f.visitante)
  );
  const pendientes: Fixture[] = [];

  for (const f of grupoFixtures) {
    const r = real[f.partido];
    if (!r) { pendientes.push(f); continue; }

    const loc = statsMap[f.local];
    const vis = statsMap[f.visitante];
    if (!loc || !vis) continue;

    loc.pj++; vis.pj++;
    loc.gf += r.local;  loc.gc += r.visitante;
    vis.gf += r.visitante; vis.gc += r.local;
    loc.dg = loc.gf - loc.gc;
    vis.dg = vis.gf - vis.gc;

    if (r.local > r.visitante) {
      loc.pg++; loc.pts += 3; vis.pp++;
    } else if (r.local < r.visitante) {
      vis.pg++; vis.pts += 3; loc.pp++;
    } else {
      loc.pe++; loc.pts++; vis.pe++; vis.pts++;
    }
  }

  const stats = sortStanding(Object.values(statsMap));
  return { stats, pendientes, completo: pendientes.length === 0 };
}

function sortStanding(stats: TeamStat[]): TeamStat[] {
  return [...stats].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg  !== a.dg)  return b.dg  - a.dg;
    if (b.gf  !== a.gf)  return b.gf  - a.gf;
    return a.equipo.localeCompare(b.equipo);
  });
}

// ---- Mejores terceros de todos los grupos ----

export function calcMejoresTerceros(real: RealResults): MejoresTerceros {
  const terceros: TeamStat[] = [];
  let gruposCompletos = 0;

  for (const g of GRUPOS) {
    const standing = calcGrupoStanding(g, real);
    if (standing.stats.length >= 3 && standing.stats[2].pj > 0) {
      terceros.push({ ...standing.stats[2], grupo: g });
    }
    if (standing.completo) gruposCompletos++;
  }

  const sorted = sortStanding(terceros);
  return {
    terceros: sorted,
    clasifican: sorted.slice(0, 8),
    complete: gruposCompletos === 12, // Mantenemos la propiedad esperada por tus componentes
    completo: gruposCompletos === 12,
  };
}

// ---- Puntos de posición y clasificación para un jugador ----

export function scoreGrupoPositions(
  grupo: string,
  standing: TeamStat[],
  mejoresTerceros: MejoresTerceros,
  playerPositions: { puesto: string; equipo: string }[],
  playerClasifDieciseisavos: string[],
): {
  posiciones: number;
  clasificados: number;
  total: number;
  detalle: { equipo: string; pos: number; ptsPosicion: number; ptsClasif: number; clasificaReal: boolean; clasificaIncierto: boolean }[];
} {
  let posiciones = 0;
  let clasificados = 0;
  const detalle: { equipo: string; pos: number; ptsPosicion: number; ptsClasif: number; clasificaReal: boolean; clasificaIncierto: boolean }[] = [];

  const clasificanSet = new Set(mejoresTerceros.clasifican.map(t => t.equipo));

  standing.forEach((stat, idx) => {
    const pos = idx + 1;
    const puestoKey = `${pos}º GRUPO ${grupo}`;
    const predPos = playerPositions.find(p => p.puesto === puestoKey);
    const ptsPosicion = predPos?.equipo === stat.equipo ? 5 : 0;

    // 1º y 2º clasifican siempre; 3º solo si está entre los 8 mejores terceros
    const clasificaReal = pos <= 2 || (pos === 3 && clasificanSet.has(stat.equipo));
    // 3º aún incierto si no todos los grupos han acabado
    const clasificaIncierto = pos === 3 && !mejoresTerceros.completo;

    const predClasif = playerClasifDieciseisavos.includes(stat.equipo);
    const ptsClasif = clasificaReal && predClasif ? 3 : 0;

    posiciones += ptsPosicion;
    clasificados += ptsClasif;
    detalle.push({ equipo: stat.equipo, pos, ptsPosicion, ptsClasif, clasificaReal, clasificaIncierto });
  });

  return { posiciones, clasificados, total: posiciones + clasificados, detalle };
}

// ---- Mejor/peor escenario con partidos pendientes ----

type ResultadoSim = { local: number; visitante: number; desc: string };

function aplicarResultado(stats: Record<string, TeamStat>, fixture: Fixture, res: ResultadoSim) {
  const loc = stats[fixture.local];
  const vis = stats[fixture.visitante];
  if (!loc || !vis) return;

  loc.pj++; vis.pj++;
  loc.gf += res.local;  loc.gc += res.visitante;
  vis.gf += res.visitante; vis.gc += res.local;
  loc.dg = loc.gf - loc.gc;
  vis.dg = vis.gf - vis.gc;

  if (res.local > res.visitante) {
    loc.pg++; loc.pts += 3; vis.pp++;
  } else if (res.local < res.visitante) {
    vis.pg++; vis.pts += 3; loc.pp++;
  } else {
    loc.pe++; loc.pts++; vis.pe++; vis.pts++;
  }
}

export function bestWorstScenario(
  grupo: string,
  currentStats: TeamStat[],
  pendientes: Fixture[],
  mejoresTerceros: MejoresTerceros,
  playerPositions: { puesto: string; equipo: string }[],
  playerClasifDieciseisavos: string[],
  playerMatches: { partido: string; pred: { local: number; visitante: number; signo: string } }[] = [],
): {
  mejor: { pts: number; standing: TeamStat[]; descripcion: string; desglose: string } | null;
  peor:  { pts: number; standing: TeamStat[]; descripcion: string; desglose: string } | null;
} {
  if (pendientes.length === 0 || pendientes.length > 2) return { mejor: null, peor: null };

  const opciones = (f: Fixture): ResultadoSim[] => [
    { local: 1, visitante: 0, desc: `gana ${f.local}` },
    { local: 0, visitante: 0, desc: `empate` },
    { local: 0, visitante: 1, desc: `gana ${f.visitante}` },
  ];

  type Combo = { res1: ResultadoSim; res2?: ResultadoSim; descripcion: string };
  const combos: Combo[] = [];

  if (pendientes.length === 1) {
    for (const r1 of opciones(pendientes[0])) {
      combos.push({ res1: r1, descripcion: r1.desc });
    }
  } else {
    for (const r1 of opciones(pendientes[0])) {
      for (const r2 of opciones(pendientes[1])) {
        combos.push({
          res1: r1, res2: r2,
          descripcion: `${r1.desc} + ${r2.desc}`,
        });
      }
    }
  }

  let mejor: { pts: number; standing: TeamStat[]; descripcion: string; desglose: string } | null = null;
  let peor:  { pts: number; standing: TeamStat[]; descripcion: string; desglose: string } | null = null;

  for (const combo of combos) {
    const simStats: Record<string, TeamStat> = {};
    for (const s of currentStats) simStats[s.equipo] = { ...s };

     aplicarResultado(simStats, pendientes[0], combo.res1);
    if (combo.res2) aplicarResultado(simStats, pendientes[1], combo.res2);

    const simStanding = sortStanding(Object.values(simStats));
    const scorePosiciones = scoreGrupoPositions(grupo, simStanding, mejoresTerceros, playerPositions, playerClasifDieciseisavos);

    let ptsPartidos = 0;
    const resPartidos: { local: number; visitante: number }[] = [
      { local: combo.res1.local, visitante: combo.res1.visitante },
      ...(combo.res2 ? [{ local: combo.res2.local, visitante: combo.res2.visitante }] : []),
    ];

    pendientes.forEach((f, idx) => {
      const pred = playerMatches.find(m => m.partido === f.partido);
      if (pred) {
        const pLoc = pred.pred.local;
        const pVis = pred.pred.visitante;
        const rLoc = resPartidos[idx].local;
        const rVis = resPartidos[idx].visitante;

        const pSigno = Math.sign(pLoc - pVis);
        const rSigno = Math.sign(rLoc - rVis);

        if (pLoc === rLoc && pVis === rVis) {
          ptsPartidos += 3; 
        } else if (pSigno === rSigno) {
          const pDiff = pLoc - pVis;
          const rDiff = rLoc - rVis;
          
          if (Math.abs(pDiff - rDiff) === 1) {
            ptsPartidos += 3; 
          } else {
            ptsPartidos += 2; 
          }
        }
      }
    });

    const totalCombo = scorePosiciones.total + ptsPartidos;
    const desglose = ptsPartidos > 0
      ? `${scorePosiciones.total} por tabla + ${ptsPartidos} por partido${ptsPartidos !== 1 ? "s" : ""}`
      : `${scorePosiciones.total} pts posiciones`;

    if (!mejor || totalCombo > mejor.pts) mejor = { pts: totalCombo, standing: simStanding, descripcion: combo.descripcion, desglose };
    if (!peor  || totalCombo < peor.pts)  peor  = { pts: totalCombo, standing: simStanding, descripcion: combo.descripcion, desglose };
  }

  return { mejor, peor };
}