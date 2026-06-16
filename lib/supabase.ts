/**
 * Cliente de Supabase + helpers de lectura/escritura de resultados.
 * Requiere: npm install @supabase/supabase-js
 */
import { createClient } from "@supabase/supabase-js";
import type { RealResults, RealExtra } from "./scoring";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);

/** Lee todos los resultados de partidos y los devuelve como mapa { partido: {local, visitante} }. */
export async function fetchResultados(): Promise<RealResults> {
  const { data, error } = await supabase
    .from("resultados")
    .select("partido, local, visitante");
  if (error) throw error;
  const out: RealResults = {};
  for (const row of data ?? []) {
    if (row.local != null && row.visitante != null) {
      out[row.partido] = { local: row.local, visitante: row.visitante };
    }
  }
  return out;
}

/** Lee el cuadro de honor real, posiciones y clasificados como mapa clave-valor. */
export async function fetchExtra(): Promise<RealExtra> {
  const { data, error } = await supabase.from("resultados_extra").select("clave, valor");
  if (error) throw error;
  const out: RealExtra = {};
  for (const row of data ?? []) {
    if (row.valor == null) continue;
    // las listas (clasif_*) se guardan como JSON serializado
    try { out[row.clave] = JSON.parse(row.valor); }
    catch { out[row.clave] = row.valor; }
  }
  return out;
}

/** Guarda/actualiza el marcador de un partido (upsert). Lo usa la pantalla Admin. */
export async function setResultado(partido: string, fase: string, local: number | null, visitante: number | null) {
  const { error } = await supabase
    .from("resultados")
    .upsert({ partido, fase, local, visitante }, { onConflict: "partido" });
  if (error) throw error;
}
