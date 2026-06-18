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

export interface Portada {
  id: number;
  titulo: string | null;
  fecha: string;
  storage_path: string;
  url: string;
  created_at: string;
  aspect_ratio: number | null;
}

export async function fetchPortadas(): Promise<Portada[]> {
  const { data, error } = await supabase
    .from("portadas")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Portada[];
}

export async function uploadPortada(
  file: File,
  titulo: string,
  fecha: string,
  aspect_ratio: number | null,
): Promise<Portada> {
  const ext = file.name.includes(".") ? file.name.split(".").pop()! : "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("portadas")
    .upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from("portadas").getPublicUrl(path);
  const { data, error: insErr } = await supabase
    .from("portadas")
    .insert({ titulo: titulo.trim() || null, fecha, storage_path: path, url: publicUrl, aspect_ratio })
    .select()
    .single();
  if (insErr) throw insErr;
  return data as Portada;
}

export async function deletePortada(id: number, storage_path: string): Promise<void> {
  const { error } = await supabase.from("portadas").delete().eq("id", id);
  if (error) throw error;
  await supabase.storage.from("portadas").remove([storage_path]);
}

/** Vacía un valor extra (honor/posición) poniéndolo a ""; el motor ignora valores vacíos. */
export async function clearExtra(clave: string) {
  const { error } = await supabase
    .from("resultados_extra")
    .upsert({ clave, valor: "" }, { onConflict: "clave" });
  if (error) throw error;
}
