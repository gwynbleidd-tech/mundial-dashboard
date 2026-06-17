import horarios from "@/data/horarios_grupos.json";
import { scorePlayer } from "@/lib/scoring";
import { HITOS, partialExtra } from "@/lib/hitos";
import type { Player, RealResults, RealExtra } from "@/lib/scoring";

interface MatchEntry { partido: string; kickoff: string; }

const ALL_MATCHES: MatchEntry[] = (
  Object.values(horarios as Record<string, MatchEntry[]>)
    .flat()
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
);

export interface EvoRow {
  label: string;   // fecha abreviada ("12 jun") o nombre del partido o etiqueta del hito
  date: string;    // YYYY-MM-DD
  isHito: boolean;
  scores: Record<string, number>; // playerId → puntos acumulados
}

function computeScores(players: Player[], real: RealResults, extra: RealExtra): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of players) out[p.id] = scorePlayer(p, real, extra).total;
  return out;
}

function formatDayLabel(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * Un punto por día con eventos (días de partido + fechas de hito con datos).
 * Cada punto acumula todos los resultados y extras hasta esa fecha (inclusive).
 * Prueba de coincidencia: el último punto debe igualar el total de la clasificación General
 * para todos los jugadores (descontando claves de extra no cubiertas por ningún hito aún).
 */
export function buildEvolutionByDay(
  players: Player[],
  real: RealResults,
  extra: RealExtra,
): EvoRow[] {
  const playedMatches = ALL_MATCHES.filter(m => real[m.partido]);
  if (playedMatches.length === 0) return [];

  const firstDate = playedMatches[0].kickoff.slice(0, 10);
  const lastMatchDate = playedMatches[playedMatches.length - 1].kickoff.slice(0, 10);

  const hitoDatesWithData = HITOS
    .filter(h => h.fecha && h.clavesExtra.some(k => extra[k] !== undefined))
    .map(h => h.fecha);

  const lastDate = [...hitoDatesWithData, lastMatchDate].sort().at(-1)!;

  // Event days = days with match results OR hito data, within [firstDate, lastDate]
  const matchDays = new Set(playedMatches.map(m => m.kickoff.slice(0, 10)));
  const hitoDaySet = new Set(hitoDatesWithData);
  const allEventDays = [
    ...new Set([...matchDays, ...hitoDaySet]),
  ].sort().filter(d => d >= firstDate && d <= lastDate);

  return allEventDays.map(date => {
    const pReal: RealResults = {};
    for (const m of ALL_MATCHES) {
      if (m.kickoff.slice(0, 10) > date) break;
      if (real[m.partido]) pReal[m.partido] = real[m.partido];
    }
    const pExtra = partialExtra(extra, date); // inclusive: hito en este día SÍ cuenta

    return {
      label: formatDayLabel(date),
      date,
      isHito: hitoDaySet.has(date),
      scores: computeScores(players, pReal, pExtra),
    };
  });
}

type MatchEvent = { type: "match"; match: MatchEntry };
type HitoEvent  = { type: "hito";  hito: (typeof HITOS)[0] };
type Event = MatchEvent | HitoEvent;

/**
 * Un punto por partido (en orden de kickoff) + hitos insertados tras el último partido
 * de su fase. Para partidos en el mismo día que un hito, el hito va después.
 * Para partidos: pExtra usa fecha anterior al hito (strict), así el escalón es visible.
 */
export function buildEvolutionByMatch(
  players: Player[],
  real: RealResults,
  extra: RealExtra,
): EvoRow[] {
  const played = ALL_MATCHES.filter(m => real[m.partido]);
  if (played.length === 0) return [];

  const lastPlayedDate = played[played.length - 1].kickoff.slice(0, 10);

  const hitosWithData = HITOS.filter(
    h => h.fecha && h.fecha <= lastPlayedDate && h.clavesExtra.some(k => extra[k] !== undefined),
  );

  // Build events: for each date, first matches then hitos
  const allEventDates = [
    ...new Set([
      ...played.map(m => m.kickoff.slice(0, 10)),
      ...hitosWithData.map(h => h.fecha),
    ]),
  ].sort();

  const events: Event[] = [];
  for (const date of allEventDates) {
    for (const match of played.filter(m => m.kickoff.slice(0, 10) === date)) {
      events.push({ type: "match", match });
    }
    for (const hito of hitosWithData.filter(h => h.fecha === date)) {
      events.push({ type: "hito", hito });
    }
  }

  const points: EvoRow[] = [];
  const cumulativeReal: RealResults = {};

  for (const ev of events) {
    if (ev.type === "match") {
      cumulativeReal[ev.match.partido] = real[ev.match.partido];
      const matchDate = ev.match.kickoff.slice(0, 10);
      // strict=true: hito en el mismo día no cuenta aún (vendrá como punto separado después)
      const pExtra = partialExtra(extra, matchDate, true);
      points.push({
        label: ev.match.partido,
        date: matchDate,
        isHito: false,
        scores: computeScores(players, { ...cumulativeReal }, pExtra),
      });
    } else {
      // Hito: mismos resultados acumulados, pero con extras de este hito incluidos
      const pExtra = partialExtra(extra, ev.hito.fecha);
      points.push({
        label: ev.hito.etiqueta,
        date: ev.hito.fecha,
        isHito: true,
        scores: computeScores(players, { ...cumulativeReal }, pExtra),
      });
    }
  }

  return points;
}
