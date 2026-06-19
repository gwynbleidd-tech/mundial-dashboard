/**
 * Motor de insignias — Porra Mundial 2026
 */

import type { Player, RealResults, RealExtra } from "@/lib/scoring";
import { scoreMatch, GRUPO_PTS, standings } from "@/lib/scoring";
import horarios from "@/data/horarios_grupos.json";

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
// Positivas priority 0..5: menor priority = más valiosa = en empate va al más alto clasificado
// Negativas priority 6..9: mayor priority = más grave = en empate va al más bajo clasificado
// Gafe (9) siempre al último

export const BADGES: Badge[] = [
  { id: "quinielas",   emoji: "🎯", name: "Quinielas",    positive: true,  priority: 0, description: "El rey del signo. Adivina quién gana aunque no sepa el marcador ni de qué país es el equipo." },
  { id: "visionario",  emoji: "🔮", name: "Visionario",   positive: true,  priority: 1, description: "No predice partidos, los recibe en sueños. Más exactos que el resto juntos." },
  { id: "pelotazo",    emoji: "🎰", name: "Pelotazo",     positive: true,  priority: 2, description: "Acertó ese marcador rarísimo que nadie más vio venir. Suerte o genialidad, tú decides." },
  { id: "cohete",      emoji: "🚀", name: "Cohete",       positive: true,  priority: 3, description: "De cero a héroe en una jornada. La mayor subida de posiciones de un tirón." },
  { id: "ned",         emoji: "🧑‍🏫", name: "Ned Flanders", positive: true,  priority: 4, description: "Sus predicciones son tan correctas que aburren. El vecino responsable que todos odian un poco." },
  { id: "consistente", emoji: "🪨", name: "Consistente",  positive: true,  priority: 5, description: "Nunca ha tocado fondo. Como una roca, pero con quinielas." },
  { id: "fumanchu",    emoji: "💨", name: "Fumanchú",     positive: false, priority: 6, description: "Predijo un marcador tan disparatado que huele a humo. El problema no fue el partido, fuiste tú." },
  { id: "triplista",   emoji: "🏀", name: "Triplista",    positive: false, priority: 7, description: "No falla uno, los falla todos. Consistencia en el desastre, hay que reconocérselo." },
  { id: "ciego",       emoji: "🙈", name: "Ciego",        positive: false, priority: 8, description: "El peor ratio exactos/partidos. Tiene los ojos abiertos pero no ve nada." },
  { id: "gafe",        emoji: "🪦", name: "Gafe",         positive: false, priority: 9, description: "Más tiempo en el pozo que un cubo. Lidera el ranking de últimos puestos con autoridad." },
];

// ---- Helpers ----

type FixtureEntry = { partido: string; kickoff: string };

const ALL_FIXTURES: FixtureEntry[] = Object.values(
  horarios as Record<string, FixtureEntry[]>
).flat();

function dateOfPartido(partido: string): string {
  return ALL_FIXTURES.find(f => f.partido === partido)?.kickoff.slice(0, 10) ?? "";
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
  }

  const stats: PlayerStats[] = players.map(p => {
    let signos1x2 = 0, exactos = 0, jugados = 0, fallosGordos = 0;
    let worstDisparate = { score: 0, partido: "", pred: "", real: "", fecha: "" };
    const exactoDetails: { partido: string; pred: string; predObj: { local: number; visitante: number } }[] = [];

    for (const m of p.fase_grupos) {
      const r = real[m.partido];
      if (!r) continue;
      jugados++;
      const s = scoreMatch(m.pred, r, GRUPO_PTS);
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
    return { id: p.id, nombre: p.nombre, signos1x2, exactos, jugados, fallosGordos, worstDisparate, exactoDetails };
  });

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

  const partidos = players[0]?.fase_grupos.map(m => m.partido).filter(p => real[p]) ?? [];
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
    const badge = BADGES.find(b => b.id === badgeId)!;

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
