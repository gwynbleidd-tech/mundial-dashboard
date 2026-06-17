import type { RealExtra } from "@/lib/scoring";
import horarios from "@/data/horarios_grupos.json";

export interface Hito {
  id: string;
  etiqueta: string;
  fecha: string; // YYYY-MM-DD, derivada del JSON, no hardcodeada
  clavesExtra: string[];
}

const GRUPOS = "ABCDEFGHIJKL".split("");
const posicionGrupoKeys = [1, 2, 3, 4].flatMap(n => GRUPOS.map(g => `${n}_GRUPO_${g}`));

function lastGroupDate(): string {
  return (Object.values(horarios as Record<string, { kickoff: string }[]>)
    .flat()
    .map(m => m.kickoff.slice(0, 10))
    .sort()
    .at(-1))!;
}

export const HITOS: Hito[] = [
  {
    id: "fin_grupos",
    etiqueta: "Fin grupos",
    fecha: lastGroupDate(),
    clavesExtra: [...posicionGrupoKeys, "clasif_dieciseisavos"],
  },
  // Future: fin_dieciseisavos, fin_octavos, fin_cuartos, fin_semis, fin_3y4, fin_final
];

/**
 * Filtra extra a solo las claves de hitos con fecha <= upToDate.
 * strict=true usa < (para puntos de partido cuando el hito cae el mismo día).
 */
export function partialExtra(extra: RealExtra, upToDate: string, strict = false): RealExtra {
  const allowed = new Set<string>();
  for (const h of HITOS) {
    if (!h.fecha) continue;
    const included = strict ? h.fecha < upToDate : h.fecha <= upToDate;
    if (included) for (const k of h.clavesExtra) allowed.add(k);
  }
  return Object.fromEntries(Object.entries(extra).filter(([k]) => allowed.has(k)));
}
