/**
 * Motor de insignias — Porra Mundial 2026
 */

import type { Player, RealResults, RealExtra, Match } from "@/lib/scoring";
import { scoreMatch, GRUPO_PTS, KO_PTS, CLASIF_PTS, standings } from "@/lib/scoring";
import horarios from "@/data/horarios_grupos.json";
import crucesData from "@/data/cruces_eliminatoria.json";

type CruceFijado = { partido: string; kickoff?: string };
const CRUCES = crucesData as Record<string, CruceFijado[]>;

// ---- Tipos ----

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  positive: boolean;
  priority: number;
}

export interface PlayerBadge {
  badge: Badge;
  playerId: string;
  playerName: string;
  detail: string;
}

// ---- Catálogo ----
// Positivas priority 0..7: menor priority = más valiosa = en empate va al más alto clasificado
// Negativas priority 8..13: mayor priority = más grave = en empate va al más bajo clasificado
// Gafe (13) siempre al último

export const BADGES: Badge[] = [
  { id: "quinielas",     emoji: "🎯", name: "Quinielas",     positive: true,  priority: 0,  description: "El rey del signo. Adivina quién gana aunque no sepa el marcador ni de qué país es el equipo." },
  { id: "visionario",    emoji: "🔮", name: "Visionario",    positive: true,  priority: 1,  description: "No predice partidos, los recibe en sueños. Más exactos que el resto juntos." },
  { id: "arquitecto",    emoji: "🏗️", name: "Arquitecto",    positive: true,  priority: 2,  description: "Construye el bracket perfecto, pieza a pieza. El que mejor combina equipos clasificados y enfrentamientos acertados en octavos." },
  { id: "estratega",     emoji: "🧠", name: "Estratega",     positive: true,  priority: 3,  description: "Le importan lo mismo los signos que los del horóscopo y los marcadores los pone al azar, pero te arma un PowerPoint de sus aciertos con el grupo de la muerte." },
  { id: "pelotazo",      emoji: "🎰", name: "Pelotazo",      positive: true,  priority: 4,  description: "Acertó ese marcador rarísimo que nadie más vio venir. Suerte o genialidad, tú decides." },
  { id: "cohete",        emoji: "🚀", name: "Cohete",        positive: true,  priority: 5,  description: "De cero a héroe en una jornada. La mayor subida de posiciones de un tirón." },
  { id: "ned",           emoji: "🧑‍🏫", name: "Ned Flanders", positive: true,  priority: 6,  description: "Sus predicciones son tan correctas que aburren. El vecino responsable que todos odian un poco." },
  { id: "consistente",   emoji: "🪨", name: "Consistente",   positive: true,  priority: 7,  description: "Nunca ha tocado fondo. Como una roca, pero con quinielas." },
  { id: "fumanchu",      emoji: "💨", name: "Fumanchú",      positive: false, priority: 8,  description: "Predijo un marcador tan disparatado que huele a humo. El problema no fue el partido, fuiste tú." },
  { id: "triplista",     emoji: "🏀", name: "Triplista",     positive: false, priority: 9,  description: "No falla uno, los falla todos. Consistencia en el desastre, hay que reconocérselo." },
  { id: "ciego",         emoji: "🙈", name: "Ciego",         positive: false, priority: 10, description: "El peor ratio exactos/partidos. Tiene los ojos abiertos pero no ve nada." },
  { id: "chavo8",        emoji: "🎱", name: "Chavo del 8",   positive: false, priority: 11, description: "La bola que si la metes, pierdes la partida. El que peor combina equipos clasificados y enfrentamientos acertados en octavos." },
  { id: "asencio",       emoji: "👧", name: "Asencio",       positive: false, priority: 12, description: "Más de dieciseisaños que dieciseisavos, como nuestro protagonista... para encerrarlo." },
  { id: "gafe",          emoji: "🪦", name: "Gafe",          positive: false, priority: 13, description: "Más tiempo en el pozo que un cubo. Lidera el ranking de últimos puestos con autoridad." },
];

// ---- Helpers ----

type FixtureEntry = { partido: string; kickoff?: string };

const RONDAS_KO = ["dieciseisavos", "octavos", "cuartos", "semis", "3y4", "final"] as const;
type RondaKO = typeof RONDAS_KO[number];

// Orden cronológico de cada ronda. Se usa como fallback para ordenar partidos que aún no
// tienen "kickoff" en cruces_eliminatoria.json (a día de hoy, cuartos/semis/3y4/final no lo
// tienen todavía — solo dieciseisavos y octavos), para que no se cuelen al principio de la
// cronología por tener una fecha "vacía".
const ORDEN_RONDA: Record<string, number> = {
  dieciseisavos: 1, octavos: 2, cuartos: 3, semis: 4, "3y4": 5, final: 6,
};

// Índice partido -> kickoff para lookups O(1) (dateOfPartido se llama muchas veces).
// Índice partido -> ronda, para el fallback de orden cuando no hay kickoff.
const KICKOFF_BY_PARTIDO: Record<string, string> = {};
const RONDA_BY_PARTIDO: Record<string, string> = {};
for (const f of Object.values(horarios as Record<string, FixtureEntry[]>).flat()) {
  if (f.kickoff && !KICKOFF_BY_PARTIDO[f.partido]) KICKOFF_BY_PARTIDO[f.partido] = f.kickoff;
}
for (const r of RONDAS_KO) {
  for (const f of CRUCES["enfr_" + r] ?? []) {
    if (f.kickoff && !KICKOFF_BY_PARTIDO[f.partido]) KICKOFF_BY_PARTIDO[f.partido] = f.kickoff;
    if (!RONDA_BY_PARTIDO[f.partido]) RONDA_BY_PARTIDO[f.partido] = r;
  }
}

function dateOfPartido(partido: string): string {
  return KICKOFF_BY_PARTIDO[partido]?.slice(0, 10) ?? "";
}

/**
 * Clave de orden cronológico para un partido, con fallback cuando no hay "kickoff" real
 * (cuartos/semis/3y4/final por ahora). Los reales (fecha ISO, empiezan por "2...") siempre
 * ordenan antes que los fallback ("zzzz..."), y entre fallbacks se respeta el orden de ronda.
 */
function sortKeyOfPartido(partido: string): string {
  const kickoff = KICKOFF_BY_PARTIDO[partido];
  if (kickoff) return kickoff;
  const orden = ORDEN_RONDA[RONDA_BY_PARTIDO[partido] ?? ""] ?? 99;
  return `zzzz-${String(orden).padStart(3, "0")}-${partido}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function signoDe(l: number, v: number): "1" | "X" | "2" {
  return l > v ? "1" : l < v ? "2" : "X";
}

const DISPARATE_UMBRAL = 4;

/**
 * Score de disparate — mide lo LOCO que fue lo que TÚ predijiste, no el resultado real.
 * Penaliza predicciones abultadas que no ocurrieron.
 * Base: diferencia absoluta goles pred vs real.
 * Bonus signo: +1 adyacente (1↔X, X↔2), +2 opuesto (1↔2).
 * Multiplicador: si total goles predichos ≥ 3 Y signo falla, ×1.5 (redondeado).
 */
function disparateScore(
  pred: { local: number; visitante: number },
  real: { local: number; visitante: number },
): number {
  const base = Math.abs(pred.local - real.local) + Math.abs(pred.visitante - real.visitante);
  const ps = signoDe(pred.local, pred.visitante);
  const rs = signoDe(real.local, real.visitante);
  const signoFalla = ps !== rs;
  let bonus = 0;
  if (signoFalla) {
    bonus = (ps === "1" && rs === "2") || (ps === "2" && rs === "1") ? 2 : 1;
  }
  const golesTotalesPred = pred.local + pred.visitante;
  const multiplicador = signoFalla && golesTotalesPred >= 3 ? 1.5 : 1;
  return Math.round((base + bonus) * multiplicador);
}

const MARCADORES_COMUNES = new Set(["0-0","1-0","0-1","1-1","2-0","0-2","2-1","1-2","2-2","3-0","0-3"]);

function pelotazoScore(
  pred: { local: number; visitante: number },
  failedFraction: number,
): number {
  const key = `${pred.local}-${pred.visitante}`;
  const rareza = MARCADORES_COMUNES.has(key) ? 1 : 2;
  return failedFraction * rareza;
}

/**
 * `extra["clasif_*"]` debería llegar como string[], pero si en algún punto de la carga
 * (Supabase → extra) no se hace el JSON.parse de vuelta, llega como string JSON crudo.
 * Este helper acepta ambas formas para que la insignia no dependa de esa capa intermedia.
 */
function toStringArray(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // no era JSON válido, se ignora
    }
  }
  return [];
}

// ---- Motor principal ----

export function computeBadges(
  players: Player[],
  real: RealResults,
  extra: RealExtra,
  rankedIds: string[],
): PlayerBadge[] {
  if (players.length === 0 || Object.keys(real).length === 0) return [];

  const n = players.length;

  // ---- Pre-cómputo por jugador ----
  interface PlayerStats {
    id: string;
    nombre: string;
    signos1x2: number;
    exactos: number;
    jugados: number;
    fallosGordos: number;        // disparateScore >= UMBRAL
    worstDisparate: { score: number; partido: string; pred: string; real: string; fecha: string };
    exactoDetails: { partido: string; pred: string; predObj: { local: number; visitante: number } }[];
    clasifAcertados: number;        // equipos que predijo clasificados a dieciseisavos y sí lo hicieron
    clasifTotal: number;            // equipos que predijo en total (normalmente 32)
    enfrentamientosAcertados: number; // cruces de dieciseisavos que YA están fijados en admin y coinciden con su predicción
    enfrentamientosTotal: number;     // cruces de dieciseisavos que predijo en total (normalmente 16)
    combinedDieciseisScore: number;   // pts clasificados + pts por enfrentamiento acertado, ambos en dieciseisavos (Estratega/Asencio)
    clasifAcertadosOctavos: number;        // equipos que predijo clasificados a octavos y sí lo hicieron
    clasifTotalOctavos: number;            // equipos que predijo en total (normalmente 16)
    enfrentamientosAcertadosOctavos: number; // cruces de octavos ya fijados en admin que coinciden con su predicción
    enfrentamientosTotalOctavos: number;     // cruces de octavos que predijo en total (normalmente 8)
    combinedOctavosScore: number;            // pts clasificados + pts por enfrentamiento acertado, ambos en octavos (Bola Blanca/Chavo del 8)
  }

  const clasifDieciseisReal = new Set(toStringArray(extra["clasif_dieciseisavos"]));
  const clasifOctavosReal = new Set(toStringArray(extra["clasif_octavos"]));

  // Cruces de dieciseisavos/octavos ya fijados por el admin (independiente de si ya se jugaron/tienen marcador).
  // Acertar el enfrentamiento = el "partido" que predijo el jugador coincide con uno de estos, ya fijados.
  const cruceDieciseisFijados = new Set((CRUCES["enfr_dieciseisavos"] ?? []).map(c => c.partido));
  const cruceOctavosFijados = new Set((CRUCES["enfr_octavos"] ?? []).map(c => c.partido));

  const stats: PlayerStats[] = players.map(p => {
    let signos1x2 = 0, exactos = 0, jugados = 0, fallosGordos = 0;
    let worstDisparate = { score: 0, partido: "", pred: "", real: "", fecha: "" };
    const exactoDetails: { partido: string; pred: string; predObj: { local: number; visitante: number } }[] = [];

    // Recorre fase de grupos + las 6 rondas de eliminatoria con el baremo de puntos que le
    // corresponde a cada una, para que Quinielas/Visionario/Ned/Fumanchú/Triplista/Ciego/Pelotazo
    // cuenten TODOS los partidos del torneo, no solo los 72 de grupos.
    const bloques: { matches: Match[]; baremo: [number, number, number] }[] = [
      { matches: p.fase_grupos, baremo: GRUPO_PTS },
      ...RONDAS_KO.map(r => ({ matches: (p as any)["enfr_" + r] as Match[], baremo: KO_PTS[r] })),
    ];

    for (const { matches, baremo } of bloques) {
      for (const m of matches) {
        const r = real[m.partido];
        if (!r) continue;
        jugados++;
        const s = scoreMatch(m.pred, r, baremo);
        if (s.hit === "exacto") { exactos++; signos1x2++; }
        else if (s.hit === "signo") signos1x2++;

        const ds = disparateScore(m.pred, r);
        if (ds >= DISPARATE_UMBRAL) fallosGordos++;

        if (ds > worstDisparate.score) {
          worstDisparate = {
            score: ds,
            partido: m.partido,
            pred: `${m.pred.local}-${m.pred.visitante}`,
            real: `${r.local}-${r.visitante}`,
            fecha: dateOfPartido(m.partido),
          };
        }
        if (s.hit === "exacto") {
          exactoDetails.push({ partido: m.partido, pred: `${m.pred.local}-${m.pred.visitante}`, predObj: m.pred });
        }
      }
    }

    // Equipos clasificados a dieciseisavos: cuenta solo si ya hay lista real
    const clasifAcertados = clasifDieciseisReal.size > 0
      ? p.clasif_dieciseisavos.filter(eq => clasifDieciseisReal.has(eq)).length
      : 0;
    const clasifTotal = p.clasif_dieciseisavos.length;
    const clasifPts = clasifAcertados * CLASIF_PTS["dieciseisavos"];

    // Cruces de dieciseisavos: lo que puntúa es ACERTAR EL ENFRENTAMIENTO (qué dos equipos se
    // cruzan), tal y como ya está fijado en Admin → Eliminatorias — NO hace falta que el partido
    // se haya jugado ni que tenga marcador. El peso reutiliza el primer escalón del baremo real
    // de esa ronda (signo = 3 pts) para no inventar un número nuevo.
    const ENFRENTAMIENTO_PTS = KO_PTS["dieciseisavos"][0];
    const enfrentamientosAcertados = p.enfr_dieciseisavos.filter(m => cruceDieciseisFijados.has(m.partido)).length;
    const enfrentamientosTotal = p.enfr_dieciseisavos.length;
    const enfrentamientoPts = enfrentamientosAcertados * ENFRENTAMIENTO_PTS;

    const combinedDieciseisScore = clasifPts + enfrentamientoPts;

    // Mismo cálculo que dieciseisavos, pero para octavos
    const clasifAcertadosOctavos = clasifOctavosReal.size > 0
      ? p.clasif_octavos.filter(eq => clasifOctavosReal.has(eq)).length
      : 0;
    const clasifTotalOctavos = p.clasif_octavos.length;
    const clasifPtsOctavos = clasifAcertadosOctavos * CLASIF_PTS["octavos"];

    const ENFRENTAMIENTO_PTS_OCTAVOS = KO_PTS["octavos"][0];
    const enfrentamientosAcertadosOctavos = p.enfr_octavos.filter(m => cruceOctavosFijados.has(m.partido)).length;
    const enfrentamientosTotalOctavos = p.enfr_octavos.length;
    const enfrentamientoPtsOctavos = enfrentamientosAcertadosOctavos * ENFRENTAMIENTO_PTS_OCTAVOS;

    const combinedOctavosScore = clasifPtsOctavos + enfrentamientoPtsOctavos;

    return {
      id: p.id, nombre: p.nombre, signos1x2, exactos, jugados, fallosGordos, worstDisparate, exactoDetails,
      clasifAcertados, clasifTotal, enfrentamientosAcertados, enfrentamientosTotal, combinedDieciseisScore,
      clasifAcertadosOctavos, clasifTotalOctavos, enfrentamientosAcertadosOctavos, enfrentamientosTotalOctavos, combinedOctavosScore,
    };
  });

  // Estratega/Asencio solo se asignan si ya hay datos con los que comparar: clasificados reales
  // rellenados, o el bracket de dieciseisavos ya fijado en Admin → Eliminatorias.
  const hasDieciseisavosData =
    clasifDieciseisReal.size > 0 || cruceDieciseisFijados.size > 0;

  // Igual que hasDieciseisavosData, pero para octavos (Bola Blanca/Chavo del 8)
  const hasOctavosData =
    clasifOctavosReal.size > 0 || cruceOctavosFijados.size > 0;

  // Pelotazo
  const exactosByPartido: Record<string, number> = {};
  for (const ps of stats) {
    for (const e of ps.exactoDetails) {
      exactosByPartido[e.partido] = (exactosByPartido[e.partido] ?? 0) + 1;
    }
  }
  const pelotazoScores: Record<string, { score: number; partido: string; pred: string; acertaron: number }> = {};
  for (const ps of stats) {
    let best = { score: 0, partido: "", pred: "", acertaron: 0 };
    for (const e of ps.exactoDetails) {
      const acertaron = exactosByPartido[e.partido] ?? 1;
      const failedFraction = (n - acertaron) / n;
      const sc = pelotazoScore(e.predObj, failedFraction);
      if (sc > best.score) best = { score: sc, partido: e.partido, pred: e.pred, acertaron };
    }
    pelotazoScores[ps.id] = best;
  }

  // Gafe + Consistente: días naturales en último puesto
  // daysLast: días únicos en último, soloLast: días únicos en último EN SOLITARIO
  const daysLastSet: Record<string, Set<string>> = Object.fromEntries(players.map(p => [p.id, new Set<string>()]));
  const soloLastSet: Record<string, Set<string>> = Object.fromEntries(players.map(p => [p.id, new Set<string>()]));
  const neverLast = new Set(players.map(p => p.id));

  // Unión de todos los partidos (grupos + las 6 rondas de eliminatoria) que aparecen en la
  // predicción de CUALQUIER jugador — no solo fase_grupos de players[0] — porque los cruces de
  // eliminatoria son específicos de cada jugador (cada uno arma su propio bracket). Se ordenan
  // por fecha/hora real (kickoff) para reconstruir la evolución cronológica correcta.
  const partidoSet = new Set<string>();
  for (const p of players) {
    for (const m of p.fase_grupos) partidoSet.add(m.partido);
    for (const r of RONDAS_KO) {
      for (const m of (p as any)["enfr_" + r] as { partido: string }[]) partidoSet.add(m.partido);
    }
  }
  const partidos = Array.from(partidoSet)
    .filter(pid => real[pid])
    .sort((a, b) => sortKeyOfPartido(a).localeCompare(sortKeyOfPartido(b)));
  const cumReal: RealResults = {};

  for (const partido of partidos) {
    cumReal[partido] = real[partido];
    const ranked = standings(players, cumReal, extra);
    const lastScore = ranked[ranked.length - 1].score.total;
    const lastPlayers = ranked.filter(r => r.score.total === lastScore);
    const dia = dateOfPartido(partido);

    for (const r of lastPlayers) {
      daysLastSet[r.player.id].add(dia);
      neverLast.delete(r.player.id);
    }
    if (lastPlayers.length === 1) {
      soloLastSet[lastPlayers[0].player.id].add(dia);
    }
  }

  const daysLast: Record<string, number> = Object.fromEntries(
    players.map(p => [p.id, daysLastSet[p.id].size])
  );
  const soloLast: Record<string, number> = Object.fromEntries(
    players.map(p => [p.id, soloLastSet[p.id].size])
  );

  // Puntos del último clasificado actual (para Consistente)
  const currentRanked = standings(players, real, extra);
  const lastPts = currentRanked[currentRanked.length - 1]?.score.total ?? 0;

  // Cohete: mayor subida de posición en un día natural
  // En empate de rise, gana la más reciente; si la diferencia es ≤1, también gana la más reciente
  interface RiseEntry { rise: number; fecha: string; partido: string }
  const maxRise: Record<string, RiseEntry> = Object.fromEntries(
    players.map(p => [p.id, { rise: 0, fecha: "", partido: "" }])
  );
  let prevPositions: Record<string, number> = {};
  const cumReal2: RealResults = {};

  for (const partido of partidos) {
    cumReal2[partido] = real[partido];
    const ranked = standings(players, cumReal2, extra);
    const positions: Record<string, number> = {};
    ranked.forEach((r, i) => { positions[r.player.id] = i + 1; });

    if (Object.keys(prevPositions).length > 0) {
      const fecha = dateOfPartido(partido);
      for (const p of players) {
        const rise = (prevPositions[p.id] ?? n) - (positions[p.id] ?? n);
        const prev = maxRise[p.id];
        // Gana si: sube más, O si sube igual/1 menos pero es más reciente
        const betterOrRecent =
          rise > prev.rise ||
          (rise > 0 && rise >= prev.rise - 1 && fecha > prev.fecha);
        if (rise > 0 && betterOrRecent) {
          maxRise[p.id] = { rise, fecha, partido };
        }
      }
    }
    prevPositions = positions;
  }

  // ---- Asignación ----

  function rankOf(id: string) { return rankedIds.indexOf(id); }

  const assignedBadges = new Set<string>(); // badge ids ya asignados
  const playerBadgeCount: Record<string, number> = Object.fromEntries(players.map(p => [p.id, 0]));
  const results: PlayerBadge[] = [];

  function buildDetail(badgeId: string, playerId: string): string {
    const s = stats.find(st => st.id === playerId);
    switch (badgeId) {
      case "quinielas":   return `${s?.signos1x2 ?? 0}/${s?.jugados ?? 0} aciertos 1X2`;
      case "visionario":  return `${s?.exactos ?? 0}/${s?.jugados ?? 0} exactos`;
      case "estratega":
      case "asencio":
        return `${s?.clasifAcertados ?? 0}/${s?.clasifTotal ?? 0} equipos + ${s?.enfrentamientosAcertados ?? 0}/${s?.enfrentamientosTotal ?? 16} enfrentamientos acertados en dieciseisavos (${s?.combinedDieciseisScore ?? 0} pts)`;
      case "arquitecto":
      case "chavo8":
        return `${s?.clasifAcertadosOctavos ?? 0}/${s?.clasifTotalOctavos ?? 0} equipos + ${s?.enfrentamientosAcertadosOctavos ?? 0}/${s?.enfrentamientosTotalOctavos ?? 8} enfrentamientos acertados en octavos (${s?.combinedOctavosScore ?? 0} pts)`;
      case "pelotazo": {
        const p = pelotazoScores[playerId];
        return p?.score > 0
          ? `${p.partido} · pred ${p.pred} · solo ${p.acertaron}/${n} lo acertaron`
          : "sin exactos aún";
      }
      case "cohete": {
        const r = maxRise[playerId];
        return r?.rise > 0
          ? `+${r.rise} posiciones el ${formatDate(r.fecha)}`
          : "sin subidas aún";
      }
      case "ned":         return `solo ${s?.fallosGordos ?? 0} de ${s?.jugados ?? 0} partidos con fallo gordo`;
      case "consistente": {
        const pts = currentRanked.find(r => r.player.id === playerId)?.score.total ?? 0;
        const diff = pts - lastPts;
        const base = `nunca en último · ${s?.jugados ?? 0} partidos`;
        return diff <= 5 ? `${base} · ⚠️ Huele a caca, a solo ${diff} pts del último` : base;
      }
      case "fumanchu": {
        const w = s?.worstDisparate;
        return w && w.score > 0
          ? `${w.partido} (${formatDate(w.fecha)}) · pred ${w.pred} · real ${w.real}`
          : "";
      }
      case "triplista":   return `${s?.fallosGordos ?? 0} de ${s?.jugados ?? 0} partidos con fallo gordo`;
      case "ciego":       return `${s?.exactos ?? 0} exactos en ${s?.jugados ?? 0} partidos`;
      case "gafe": {
        const dias = daysLast[playerId] ?? 0;
        const solo = soloLast[playerId] ?? 0;
        return `${dias} día${dias !== 1 ? "s" : ""} en último (${solo} en solitario)`;
      }
      default: return "";
    }
  }

  function assign(
    badgeId: string,
    candidates: { id: string; val: number }[],
    higherIsBetter: boolean,
    isGafe = false,
  ) {
    if (assignedBadges.has(badgeId)) return;
    const badge = BADGES.find(b => b.id === badgeId);
    if (!badge) {
      // eslint-disable-next-line no-console
      console.warn(`[badges] Ignorando "${badgeId}": no existe ese id en BADGES. ¿Renombraste el id sin actualizar assign()/buildDetail?`);
      return;
    }

    const valid = higherIsBetter
      ? candidates.filter(c => c.val > 0)
      : candidates.filter(c => c.val >= 0);

    if (valid.length === 0) return;

    const bestVal = higherIsBetter
      ? Math.max(...valid.map(c => c.val))
      : Math.min(...valid.map(c => c.val));

    let tied = valid.filter(c => c.val === bestVal);

    if (tied.length > 1) {
      if (isGafe) {
        // Gafe: al más bajo clasificado (índice mayor), desempate por días en solitario
        tied.sort((a, b) => {
          const rankDiff = rankOf(b.id) - rankOf(a.id);
          if (rankDiff !== 0) return rankDiff;
          return (soloLast[b.id] ?? 0) - (soloLast[a.id] ?? 0);
        });
      } else if (badge.positive) {
        // Positiva: al más alto clasificado (índice menor), preferir sin insignia previa
        const sinInsignia = tied.filter(c => playerBadgeCount[c.id] === 0);
        if (sinInsignia.length > 0) tied = sinInsignia;
        tied.sort((a, b) => rankOf(a.id) - rankOf(b.id));
      } else {
        // Negativa: al más bajo clasificado (índice mayor), preferir sin insignia previa
        const sinInsignia = tied.filter(c => playerBadgeCount[c.id] === 0);
        if (sinInsignia.length > 0) tied = sinInsignia;
        tied.sort((a, b) => rankOf(b.id) - rankOf(a.id));
      }
    }

    const winner = tied[0].id;
    const player = players.find(p => p.id === winner)!;
    const detail = buildDetail(badgeId, winner);
    results.push({ badge, playerId: winner, playerName: player.nombre, detail });
    assignedBadges.add(badgeId);
    playerBadgeCount[winner] = (playerBadgeCount[winner] ?? 0) + 1;
  }

  // Asignar en orden de prioridad
  assign("quinielas",   stats.map(s => ({ id: s.id, val: s.signos1x2 })),                                         true);
  assign("visionario",  stats.map(s => ({ id: s.id, val: s.exactos })),                                           true);
  if (hasOctavosData) {
    assign("arquitecto", stats.map(s => ({ id: s.id, val: s.combinedOctavosScore })),                             true);
    assign("chavo8",     stats.map(s => ({ id: s.id, val: s.combinedOctavosScore })),                             false);
  }
  if (hasDieciseisavosData) {
    assign("estratega", stats.map(s => ({ id: s.id, val: s.combinedDieciseisScore })),                            true);
    assign("asencio",   stats.map(s => ({ id: s.id, val: s.combinedDieciseisScore })),                            false);
  }
  assign("pelotazo",    players.map(p => ({ id: p.id, val: pelotazoScores[p.id]?.score ?? 0 })),                  true);
  assign("cohete",      players.map(p => ({ id: p.id, val: maxRise[p.id]?.rise ?? 0 })),                          true);
  assign("ned",         stats.map(s => ({ id: s.id, val: s.fallosGordos })),                                      false);
  assign("consistente", players
    .filter(p => neverLast.has(p.id) && (stats.find(s => s.id === p.id)?.jugados ?? 0) > 0)
    .map(p => ({ id: p.id, val: 1 })),                                                                            true);
  assign("fumanchu",    stats.map(s => ({ id: s.id, val: s.worstDisparate.score })),                              true,  false);
  assign("triplista",   stats.map(s => ({ id: s.id, val: s.fallosGordos })),                                      true,  false);
  assign("ciego",       stats.filter(s => s.jugados > 0)
    .map(s => ({ id: s.id, val: Math.round((s.exactos / s.jugados) * 1000) })),                                   false, false);
  assign("gafe",        players.map(p => ({ id: p.id, val: daysLast[p.id] ?? 0 })),                              true,  true);

  return results;
}
