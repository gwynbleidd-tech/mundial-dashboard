/**
 * Motor de puntuación — Porra Mundial 2026
 * Implementa las 40 reglas de ADMIN!D8:D47 (ver data/scoring-rules.md).
 *
 * Entrada: predicciones de un jugador (data/predictions.json) + resultados reales (Supabase).
 * Salida: desglose de puntos por sección y total.
 *
 * Diseñado para correr en el cliente. Puro, sin efectos secundarios.
 */

// ---- Tipos ----
export type Signo = "1" | "X" | "2";
export interface Pred { signo: Signo; local: number; visitante: number }
export interface Match { partido: string; local: string; visitante: string; jornada?: string; pred: Pred }
export interface RealScore { local: number; visitante: number }
export type RealResults = Record<string, RealScore>;            // clave = partido
export type RealExtra = Record<string, string | string[]>;      // campeon, bota_oro, clasif_*, posiciones...

export interface Player {
  id: string; nombre: string;
  fase_grupos: Match[];
  posicion_grupos: { puesto: string; equipo: string }[];
  clasif_dieciseisavos: string[]; clasif_octavos: string[]; clasif_cuartos: string[];
  clasif_semis: string[]; clasif_3y4: string[]; clasif_final: string[];
  enfr_dieciseisavos: Match[]; enfr_octavos: Match[]; enfr_cuartos: Match[];
  enfr_semis: Match[]; enfr_3y4: Match[]; enfr_final: Match[];
  cuadro_honor: Record<string, string | null>;
}

// Puntos por ronda de eliminatoria: [signo, diferencia, exacto]
const KO_PTS: Record<string, [number, number, number]> = {
  dieciseisavos: [3, 2, 5],
  octavos:       [3, 2, 5],
  cuartos:       [4, 2, 6],
  semis:         [6, 4, 10],
  "3y4":         [10, 5, 15],
  final:         [12, 6, 18],
};
const CLASIF_PTS: Record<string, number> = {
  dieciseisavos: 3, octavos: 10, cuartos: 15, semis: 20, "3y4": 15, final: 25,
};
const POS_PTS = 5;       // posición exacta en grupo (1º/2º/3º/4º)
export const GRUPO_PTS: [number, number, number] = [2, 1, 3]; // signo, diferencia, exacto

const HONOR_PTS: Record<string, number> = {
  campeon: 50, subcampeon: 40, tercero: 30,
  bota_oro: 30, bota_plata: 20, bota_bronce: 10,
  balon_oro: 30, balon_plata: 20, balon_bronce: 10,
};

function signoDe(l: number, v: number): Signo {
  return l > v ? "1" : l < v ? "2" : "X";
}

/** Puntúa un partido (grupos o KO) dado el baremo [signo, dif, exacto]. */
export function scoreMatch(pred: Pred, real: RealScore | undefined, baremo: [number, number, number]) {
  if (!real) return { pts: 0, hit: null as null | "exacto" | "signo" | "fallo" };
  const [pSigno, pDif, pExacto] = baremo;
  const predSigno = signoDe(pred.local, pred.visitante);
  const realSigno = signoDe(real.local, real.visitante);
  let pts = 0;
  if (predSigno === realSigno) {
    pts += pSigno;
    if (pred.local - pred.visitante === real.local - real.visitante) pts += pDif;
    if (pred.local === real.local && pred.visitante === real.visitante) pts += pExacto;
  }
  const exact = pred.local === real.local && pred.visitante === real.visitante;
  return { pts, hit: exact ? "exacto" : predSigno === realSigno ? "signo" : "fallo" };
}

export interface Breakdown {
  grupos: number; posiciones: number; clasificados: number;
  eliminatorias: number; honor: number; total: number;
  // métricas para la UI
  exactos: number; signos: number; partidosJugados: number;
}

/**
 * Calcula el desglose completo de un jugador.
 * `real`    = resultados de partidos (grupos + KO), clave = label del partido.
 * `extra`   = cuadro de honor real, posiciones de grupo reales, listas de clasificados reales.
 */
export function scorePlayer(p: Player, real: RealResults, extra: RealExtra = {}): Breakdown {
  let grupos = 0, posiciones = 0, clasificados = 0, eliminatorias = 0, honor = 0;
  let exactos = 0, signos = 0, jugados = 0;

  // 1) Fase de grupos (partidos)
  for (const m of p.fase_grupos) {
    const r = real[m.partido];
    if (!r) continue;
    jugados++;
    const s = scoreMatch(m.pred, r, GRUPO_PTS);
    grupos += s.pts;
    if (s.hit === "exacto") exactos++; else if (s.hit === "signo") signos++;
  }

  // 2) Posiciones de grupo (extra['1_GRUPO_A'] = equipo real en ese puesto)
  for (const { puesto, equipo } of p.posicion_grupos) {
    const key = normPos(puesto);                 // "1º GRUPO A" -> "1_GRUPO_A"
    if (extra[key] && extra[key] === equipo) posiciones += POS_PTS;
  }

  // 3) Clasificados por ronda (extra['clasif_octavos'] = string[] equipos reales)
  for (const ronda of Object.keys(CLASIF_PTS)) {
    const reales = extra["clasif_" + ronda];
    if (!Array.isArray(reales)) continue;
    const setReal = new Set(reales);
    const pred = (p as any)["clasif_" + ronda] as string[];
    for (const eq of pred) if (setReal.has(eq)) clasificados += CLASIF_PTS[ronda];
  }

  // 4) Eliminatorias (cruces): mismo label de partido en `real`
  for (const ronda of Object.keys(KO_PTS)) {
    const cruces = (p as any)["enfr_" + ronda] as Match[];
    if (!cruces) continue;
    for (const m of cruces) {
      const s = scoreMatch(m.pred, real[m.partido], KO_PTS[ronda]);
      eliminatorias += s.pts;
      if (real[m.partido]) {
        jugados++;
        if (s.hit === "exacto") exactos++; else if (s.hit === "signo") signos++;
      }
    }
  }

  // 5) Cuadro de honor
  for (const [clave, pts] of Object.entries(HONOR_PTS)) {
    const pred = p.cuadro_honor[clave];
    if (pred && extra[clave] && extra[clave] === pred) honor += pts;
  }

  const total = grupos + posiciones + clasificados + eliminatorias + honor;
  return { grupos, posiciones, clasificados, eliminatorias, honor, total, exactos, signos, partidosJugados: jugados };
}

export function normPos(puesto: string): string {
  // "1º GRUPO A" -> "1_GRUPO_A"
  return puesto.replace("º", "").replace(/\s+/g, "_").toUpperCase();
}

/** Clasificación general: ordena jugadores por total, desempata por exactos. */
export function standings(players: Player[], real: RealResults, extra: RealExtra = {}) {
  return players
    .map((p) => ({ player: p, score: scorePlayer(p, real, extra) }))
    .sort((a, b) => b.score.total - a.score.total || b.score.exactos - a.score.exactos);
}
