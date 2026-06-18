/**
 * Cliente de Supabase + helpers de lectura/escritura de resultados.
 * Requiere: npm install @supabase/supabase-js
 */
import { createClient } from "@supabase/supabase-js";
import type { RealResults, RealExtra } from "./scoring";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);

export type YoutubeUrls = Record<string, string>;

/** Lee todos los resultados de partidos y los devuelve junto con los youtube_url. */
export async function fetchResultados(): Promise<{ results: RealResults; youtube: YoutubeUrls }> {
  const { data, error } = await supabase
    .from("resultados")
    .select("partido, local, visitante, youtube_url");
  if (error) throw error;
  const results: RealResults = {};
  const youtube: YoutubeUrls = {};
  for (const row of data ?? []) {
    if (row.local != null && row.visitante != null) {
      results[row.partido] = { local: row.local, visitante: row.visitante };
    }
    if (row.youtube_url) youtube[row.partido] = row.youtube_url;
  }
  return { results, youtube };
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

/** Guarda/actualiza el youtube_url de un partido sin tocar el marcador. */
export async function setYoutubeUrl(partido: string, youtube_url: string | null) {
  const { error } = await supabase
    .from("resultados")
    .update({ youtube_url })
    .eq("partido", partido);
  if (error) throw error;
}

/** Guarda/actualiza un valor extra (cuadro de honor, posiciones, clasificados). */
export async function setExtra(clave: string, valor: string) {
  const { error } = await supabase
    .from("resultados_extra")
    .upsert({ clave, valor }, { onConflict: "clave" });
  if (error) throw error;
}

/** Vacía un valor extra (honor/posición) poniéndolo a ""; el motor ignora valores vacíos. */
export async function clearExtra(clave: string) {
  const { error } = await supabase
    .from("resultados_extra")
    .upsert({ clave, valor: "" }, { onConflict: "clave" });
  if (error) throw error;
}
