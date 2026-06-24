/**
 * Calcula tablas de clasificación de grupos y mejores terceros.
 * Criterios FIFA: 1) Puntos 2) Diferencia de goles 3) Goles a favor
 *                 4) Resultado enfrentamiento directo 5) Orden alfabético
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
  stats: TeamStat[];
  pendientes: Fixture[];
  completo: boolean;
}

export interface MejoresTerceros {
  terceros: TeamStat[];
  clasifican: TeamStat[];
  completo: boolean;
}

// ---- Desempate por enfrentamiento directo ----

function getDirectResult(
  a: TeamStat,
  b: TeamStat,
  directos: Record<string, { local: number; visitante: number }>
): number {
  const r1 = directos[`${a.equipo}vs${b.equipo}`];
  if (r1) {
    if (r1.local > r1.visitante) return -1; // a ganó → a va antes
    if (r1.local < r1.visitante) return 1;  // b ganó → b va antes
    return 0;
  }
  const r2 = directos[`${b.equipo}vs${a.equipo}`];
  if (r2) {
    if (r2.local > r2.visitante) return 1;  // b ganó → b va antes
    if (r2.local < r2.visitante) return -1; // a ganó → a va antes
    return 0;
  }
  return 0;
}

function sortStanding(
  stats: TeamStat[],
  directos: Record<string, { local: number; visitante: number }> = {}
): TeamStat[] {
  return [...stats].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg  !== a.dg)  return b.dg  - a.dg;
    if (b.gf  !== a.gf)  return b.gf  - a.gf;
    // FIX 1: desempate por resultado directo antes del alfabético
    const direct = getDirectResult(a, b, directos);
    if (direct !== 0) return direct;
    return a.equipo.localeCompare(b.equipo);
  });
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
  const directos: Record<string, { local: number; visitante: number }> = {};

  for (const f of grupoFixtures) {
    const r = real[f.partido];
    if (!r) { pendientes.push(f); continue; }

    directos[`${f.local}vs${f.visitante}`] = { local: r.local, visitante: r.visitante };

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

  const stats = sortStanding(Object.values(statsMap), directos);
  return { stats, pendientes, completo: pendientes.length === 0 };
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
    complete: gruposCompletos === 12,
    completo: gruposCompletos === 12,
  } as MejoresTerceros & { complete: boolean };
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
  detalle: {
    equipo: string;
    pos: number;
    ptsPosicion: number;
    ptsClasif: number;
    clasificaReal: boolean;
    clasificaIncierto: boolean;
  }[];
} {
  let posiciones = 0;
  let clasificados = 0;
  const detalle: {
    equipo: string; pos: number; ptsPosicion: number;
    ptsClasif: number; clasificaReal: boolean; clasificaIncierto: boolean;
  }[] = [];

  const clasificanSet = new Set(mejoresTerceros.clasifican.map(t => t.equipo));

  standing.forEach((stat, idx) => {
    const pos = idx + 1;
    const puestoKey = `${pos}º GRUPO ${grupo}`;
    const predPos = playerPositions.find(p => p.puesto === puestoKey);
    const ptsPosicion = predPos?.equipo === stat.equipo ? 5 : 0;

    const clasificaReal = pos <= 2 || (pos === 3 && clasificanSet.has(stat.equipo));
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

/**
 * FIX 2: Recalcula mejoresTerceros sustituyendo el 3º de este grupo
 * por el 3º del standing simulado, manteniendo los de los demás grupos.
 */
function recalcMejoresTercerosParaSim(
  grupo: string,
  simStanding: TeamStat[],
  mejoresTercerosActuales: MejoresTerceros,
): MejoresTerceros {
  // Quitamos el 3º actual de este grupo (si existe) y añadimos el simulado
  const tercerosOtros = mejoresTercerosActuales.terceros.filter(t => t.grupo !== grupo);

  // El 3º simulado es el equipo en posición índice 2 del standing simulado
  const terceroSim = simStanding[2];
  if (!terceroSim || terceroSim.pj === 0) {
    // Sin datos suficientes, devolvemos los actuales sin cambios
    return mejoresTercerosActuales;
  }

  const nuevosTerceros = sortStanding([...tercerosOtros, { ...terceroSim, grupo }]);
  const nuevosClasifican = nuevosTerceros.slice(0, 8);

  return {
    terceros: nuevosTerceros,
    clasifican: nuevosClasifican,
    completo: mejoresTercerosActuales.completo,
    complete: mejoresTercerosActuales.completo,
  } as MejoresTerceros & { complete: boolean };
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
        combos.push({ res1: r1, res2: r2, descripcion: `${r1.desc} + ${r2.desc}` });
      }
    }
  }

  // Reconstruimos los resultados directos YA CONOCIDOS para este grupo
  // a partir de los fixtures no pendientes
  const pendientesIds = new Set(pendientes.map(p => p.partido));
  const equipos = currentStats.map(s => s.equipo);
  const grupoFixtures = ALL_FIXTURES.filter(
    f => equipos.includes(f.local) && equipos.includes(f.visitante)
  );

  // Los directos conocidos los inferimos reconstruyendo el grupo desde currentStats.
  // Como currentStats ya tiene los resultados acumulados, los directos los calculamos
  // comparando los fixtures jugados. Para los que no están en pendientes,
  // los marcamos como "jugados pero resultado desconocido" — usamos un enfoque
  // más seguro: calculamos directos solo de los partidos simulados que añadimos.
  const directosBase: Record<string, { local: number; visitante: number }> = {};
  // Nota: no podemos reconstruir los directos históricos sin el RealResults completo.
  // Los directos de los partidos SIMULADOS sí los añadiremos en cada combo.
  // Para el desempate en empate de puntos entre equipos cuyos directos
  // ya están jugados, el orden en currentStats ya los refleja correctamente,
  // así que clonar currentStats y solo añadir los simulados es suficiente.

  let mejor: { pts: number; standing: TeamStat[]; descripcion: string; desglose: string } | null = null;
  let peor:  { pts: number; standing: TeamStat[]; descripcion: string; desglose: string } | null = null;

  for (const combo of combos) {
    const simStats: Record<string, TeamStat> = {};
    for (const s of currentStats) simStats[s.equipo] = { ...s };

    // Directos simulados: solo los partidos pendientes de esta simulación
    const simDirectos: Record<string, { local: number; visitante: number }> = { ...directosBase };

    // Aplica pendiente 1
    const loc1 = simStats[pendientes[0].local];
    const vis1 = simStats[pendientes[0].visitante];
    if (loc1 && vis1) {
      loc1.pj++; vis1.pj++;
      loc1.gf += combo.res1.local;  loc1.gc += combo.res1.visitante;
      vis1.gf += combo.res1.visitante; vis1.gc += combo.res1.local;
      loc1.dg = loc1.gf - loc1.gc;
      vis1.dg = vis1.gf - vis1.gc;
      if (combo.res1.local > combo.res1.visitante) {
        loc1.pg++; loc1.pts += 3; vis1.pp++;
      } else if (combo.res1.local < combo.res1.visitante) {
        vis1.pg++; vis1.pts += 3; loc1.pp++;
      } else {
        loc1.pe++; loc1.pts++; vis1.pe++; vis1.pts++;
      }
      simDirectos[`${pendientes[0].local}vs${pendientes[0].visitante}`] = {
        local: combo.res1.local, visitante: combo.res1.visitante
      };
    }

    // Aplica pendiente 2 si existe
    if (combo.res2 && pendientes[1]) {
      const loc2 = simStats[pendientes[1].local];
      const vis2 = simStats[pendientes[1].visitante];
      if (loc2 && vis2) {
        loc2.pj++; vis2.pj++;
        loc2.gf += combo.res2.local;  loc2.gc += combo.res2.visitante;
        vis2.gf += combo.res2.visitante; vis2.gc += combo.res2.local;
        loc2.dg = loc2.gf - loc2.gc;
        vis2.dg = vis2.gf - vis2.gc;
        if (combo.res2.local > combo.res2.visitante) {
          loc2.pg++; loc2.pts += 3; vis2.pp++;
        } else if (combo.res2.local < combo.res2.visitante) {
          vis2.pg++; vis2.pts += 3; loc2.pp++;
        } else {
          loc2.pe++; loc2.pts++; vis2.pe++; vis2.pts++;
        }
        simDirectos[`${pendientes[1].local}vs${pendientes[1].visitante}`] = {
          local: combo.res2.local, visitante: combo.res2.visitante
        };
      }
    }

    // FIX 1: sortStanding con los directos simulados
    const simStanding = sortStanding(Object.values(simStats), simDirectos);

    // FIX 2: recalcular mejoresTerceros con el 3º del standing simulado
    const simMejoresTerceros = recalcMejoresTercerosParaSim(grupo, simStanding, mejoresTerceros);

    const scorePosiciones = scoreGrupoPositions(
      grupo,
      simStanding,
      simMejoresTerceros,
      playerPositions,
      playerClasifDieciseisavos
    );

    let ptsPartidos = 0;
    const resPartidos = [
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
          if (Math.abs((pLoc - pVis) - (rLoc - rVis)) === 1) {
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
