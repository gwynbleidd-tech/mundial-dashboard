/**
 * Calcula tablas de clasificación de grupos y mejores terceros.
 * Criterios FIFA: 1) Puntos 2) Diferencia de goles 3) Goles a favor
 * Empate exacto → orden alfabético (admin desempata con drag & drop).
 */

import type { RealResults } from "@/lib/scoring";
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

// ---- Mejor/peor escenario con 1 partido pendiente ----

export function bestWorstScenario(
  grupo: string,
  currentStats: TeamStat[],
  pendientes: Fixture[],
  mejoresTerceros: MejoresTerceros,
  playerPositions: { puesto: string; equipo: string }[],
  playerClasifDieciseisavos: string[],
): {
  mejor: { pts: number; standing: TeamStat[]; descripcion: string } | null;
  peor:  { pts: number; standing: TeamStat[]; descripcion: string } | null;
} {
  if (pendientes.length !== 1) return { mejor: null, peor: null };

  const partido = pendientes[0];
  const resultados = [
    { local: 1, visitante: 0, desc: `gana ${partido.local}` },
    { local: 0, visitante: 0, desc: `empate` },
    { local: 0, visitante: 1, desc: `gana ${partido.visitante}` },
  ];

  let mejor: { pts: number; standing: TeamStat[]; descripcion: string } | null = null;
  let peor:  { pts: number; standing: TeamStat[]; descripcion: string } | null = null;

  for (const res of resultados) {
    const simStats: Record<string, TeamStat> = {};
    for (const s of currentStats) simStats[s.equipo] = { ...s };

    const loc = simStats[partido.local];
    const vis = simStats[partido.visitante];
    if (!loc || !vis) continue;

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

    const simStanding = sortStanding(Object.values(simStats));
    const score = scoreGrupoPositions(grupo, simStanding, mejoresTerceros, playerPositions, playerClasifDieciseisavos);

    if (!mejor || score.total > mejor.pts) mejor = { pts: score.total, standing: simStanding, descripcion: res.desc };
    if (!peor  || score.total < peor.pts)  peor  = { pts: score.total, standing: simStanding, descripcion: res.desc };
  }

  return { mejor, peor };
}
