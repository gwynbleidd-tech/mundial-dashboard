"use client";

import { useState, useEffect, useMemo } from "react";
import type { Player, RealResults, RealExtra } from "@/lib/scoring";
import { normPos } from "@/lib/scoring";
import {
  setResultado, setExtra as supaSetExtra, clearExtra as supaClearExtra,
  setYoutubeUrl, type YoutubeUrls,
  fetchPortadas, uploadPortada, deletePortada, type Portada,
} from "@/lib/supabase";
import teamsData from "@/data/teams.json";
import crusesData from "@/data/cruces_eliminatoria.json";
import { C } from "@/lib/theme";

// ---- types ----

type CruceMatch = { partido: string; local: string; visitante: string; jugadores: string[] };
const CRUCES = crusesData as Record<string, CruceMatch[]>;

// ---- constants ----

const GRUPOS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;

const HONOR_FIELDS = [
  { key: "campeon",      label: "Campeón",        type: "team"   },
  { key: "subcampeon",   label: "Subcampeón",     type: "team"   },
  { key: "tercero",      label: "3er puesto",     type: "team"   },
  { key: "bota_oro",     label: "Bota de oro",    type: "player" },
  { key: "bota_plata",   label: "Bota de plata",  type: "player" },
  { key: "bota_bronce",  label: "Bota de bronce", type: "player" },
  { key: "balon_oro",    label: "Balón de oro",   type: "player" },
  { key: "balon_plata",  label: "Balón de plata", type: "player" },
  { key: "balon_bronce", label: "Balón de bronce",type: "player" },
] as const;

const CLASIF_RONDAS = [
  { key: "dieciseisavos", label: "1/16"   },
  { key: "octavos",       label: "Octavos"},
  { key: "cuartos",       label: "Cuartos"},
  { key: "semis",         label: "Semis"  },
  { key: "3y4",           label: "3º/4º"  },
  { key: "final",         label: "Final"  },
] as const;

const KO_RONDAS = [
  { key: "dieciseisavos", label: "1/16"   },
  { key: "octavos",       label: "Octavos"},
  { key: "cuartos",       label: "Cuartos"},
  { key: "semis",         label: "Semis"  },
  { key: "3y4",           label: "3º/4º"  },
  { key: "final",         label: "Final"  },
] as const;

const ADMIN_TABS = [
  { id: "partidos",       label: "Partidos"      },
  { id: "eliminatorias",  label: "Eliminatorias" },
  { id: "honor",          label: "Honor"         },
  { id: "posiciones",     label: "Posiciones"    },
  { id: "clasificados",   label: "Clasificados"  },
  { id: "portadas",       label: "Portadas"      },
] as const;

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatFechaShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

const { equipos: ALL_TEAMS, grupos: GRUPOS_EQUIPOS } = teamsData as {
  equipos: string[];
  grupos: Record<string, string[]>;
};

// ---- shared styles ----

const hStyle: React.CSSProperties = {
  fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 22,
  color: C.ink, margin: 0, letterSpacing: ".01em", textTransform: "uppercase",
};
const subStyle: React.CSSProperties = {
  color: C.muted, fontSize: 12.5, margin: "5px 0 0", letterSpacing: ".02em",
};
const inpStyle: React.CSSProperties = {
  width: 38, textAlign: "center", padding: "6px 0",
  border: `1px solid ${C.line}`, borderRadius: 3,
  fontFamily: "'DM Mono', monospace", fontSize: 14, background: C.chalk,
  color: C.ink,
};
const selStyle: React.CSSProperties = {
  flex: 1, padding: "6px 8px", border: `1px solid ${C.line}`,
  borderRadius: 3, background: C.chalk, color: C.ink, fontSize: 13,
};

type RowStatus = "idle" | "saving" | "saved" | "error";

// ---- sub-components ----

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (key === process.env.NEXT_PUBLIC_ADMIN_KEY) {
      onUnlock();
    } else {
      setError(true);
      setKey("");
    }
  }

  return (
    <div style={{ maxWidth: 320, margin: "48px auto", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <h2 style={{ ...hStyle, textAlign: "center", marginBottom: 6 }}>Admin</h2>
      <p style={{ ...subStyle, textAlign: "center", marginBottom: 24 }}>
        Introduce la clave para acceder
      </p>
      <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
        <input
          type="password"
          value={key}
          onChange={(e) => { setKey(e.target.value); setError(false); }}
          placeholder="Clave"
          autoFocus
          style={{
            flex: 1, padding: "10px 12px", border: `1px solid ${error ? C.rojo : C.line}`,
            borderRadius: 3, fontSize: 15, background: C.chalk, color: C.ink,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 18px", background: C.ink, color: C.chalk,
            border: "none", borderRadius: 3, fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}
        >
          Entrar
        </button>
      </form>
      {error && (
        <p style={{ color: C.rojo, fontSize: 12, marginTop: 8 }}>Clave incorrecta</p>
      )}
    </div>
  );
}

function SaveBtn({
  status, onClick, disabled = false,
}: {
  status: RowStatus; onClick: () => void; disabled?: boolean;
}) {
  const busy = status === "saving";
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      style={{
        minWidth: 60, padding: "5px 10px", borderRadius: 3, fontSize: 11, fontWeight: 700,
        border: "none", cursor: disabled || busy ? "default" : "pointer", flexShrink: 0,
        background: status === "saved" ? "#E6F0E9" : status === "error" ? "#F5E6E6"
          : !disabled ? C.pitch : C.line,
        color: status === "saved" ? "#1B5E3A" : status === "error" ? C.rojo
          : !disabled ? C.chalk : C.muted,
        textAlign: "center",
      }}
    >
      {busy ? "…" : status === "saved" ? "✓" : status === "error" ? "Error" : "Guardar"}
    </button>
  );
}

function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Limpiar"
      style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        border: `1px solid ${C.line}`, background: "transparent",
        color: C.muted, fontSize: 14, lineHeight: 1, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      ×
    </button>
  );
}

// ---- AdminContent ----

function ConfirmBar({ message, onCancel, onConfirm }: {
  message: string; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 10px", margin: "2px 0 6px",
      background: "#FFF8EE", border: `1px solid #E8D5A0`, borderRadius: 3, fontSize: 12,
    }}>
      <span style={{ flex: 1, color: C.ink }}>{message}</span>
      <button
        onClick={onCancel}
        style={{
          padding: "3px 8px", borderRadius: 3, fontSize: 11, fontWeight: 700,
          border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer",
        }}
      >Cancelar</button>
      <button
        onClick={onConfirm}
        style={{
          padding: "3px 8px", borderRadius: 3, fontSize: 11, fontWeight: 700,
          border: "none", background: C.rojo, color: "#fff", cursor: "pointer",
        }}
      >Confirmar</button>
    </div>
  );
}

function AdminContent({ players, real, extra, youtube, onResultSaved, onResultCleared, onExtraSaved, onYoutubeSaved }: {
  players: Player[];
  real: RealResults;
  extra: RealExtra;
  youtube: YoutubeUrls;
  onResultSaved: (partido: string, local: number, visitante: number) => void;
  onResultCleared: (partido: string) => void;
  onExtraSaved: (clave: string, valor: string | string[]) => void;
  onYoutubeSaved: (partido: string, url: string | null) => void;
}) {
  const [adminTab, setAdminTab] = useState<typeof ADMIN_TABS[number]["id"]>("partidos");
  const [confirmClear, setConfirmClear] = useState<string | null>(null);

  // ── Partidos / Eliminatorias shared edits state ──
  const [edits, setEdits] = useState<Record<string, { local: string; visitante: string; status: RowStatus }>>({});
  const [ytEdits, setYtEdits] = useState<Record<string, { url: string; status: RowStatus }>>({});

  // ── Eliminatorias state ──
  const [koRonda, setKoRonda] = useState("dieciseisavos");
  const [koFilter, setKoFilter] = useState("");
  const [koHideSaved, setKoHideSaved] = useState(false);

  // ── Honor state ──
  const [honorVals, setHonorVals] = useState<Record<string, string>>({});
  const [honorStatus, setHonorStatus] = useState<Record<string, RowStatus>>({});

  // ── Posiciones state ──
  const [ordenGrupos, setOrdenGrupos] = useState<Record<string, string[]>>({});
  const [ordenTerceros, setOrdenTerceros] = useState<string[]>([]);
  const [posStatus, setPosStatus] = useState<Record<string, RowStatus>>({});
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);

  // ── Clasificados state (Original) ──
  const [clasifSels, setClasifSels] = useState<Record<string, Set<string>>>({});
  const [clasifStatus, setClasifStatus] = useState<Record<string, RowStatus>>({});
  const [clasifRonda, setClasifRonda] = useState("dieciseisavos");

  // ── Portadas state ──
  const [portadasList, setPortadasList] = useState<Portada[]>([]);
  const [portadasLoading, setPortadasLoading] = useState(false);
  const [portFile, setPortFile] = useState<File | null>(null);
  const [portFileKey, setPortFileKey] = useState(0);
  const [portTitulo, setPortTitulo] = useState("");
  const [portFecha, setPortFecha] = useState(getTodayISO());
  const [portUploadStatus, setPortUploadStatus] = useState<RowStatus>("idle");
  const [portUploadError, setPortUploadError] = useState("");
  const [confirmDeletePortada, setConfirmDeletePortada] = useState<number | null>(null);

  function switchTab(id: typeof adminTab) {
    setAdminTab(id);
    setConfirmClear(null);
  }

  // Populate honor y clasificados desde extra
  useEffect(() => {
    const hv: Record<string, string> = {};
    for (const f of HONOR_FIELDS) {
      const v = extra[f.key];
      hv[f.key] = typeof v === "string" ? v : "";
    }
    setHonorVals(hv);

    const cs: Record<string, Set<string>> = {};
    for (const r of CLASIF_RONDAS) {
      const v = extra["clasif_" + r.key];
      cs[r.key] = new Set(Array.isArray(v) ? v : []);
    }
    setClasifSels(cs);
  }, [extra]);

  const playerSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) {
      for (const [k, v] of Object.entries(p.cuadro_honor)) {
        if ((k.startsWith("bota_") || k.startsWith("balon_")) && v) {
          set.add(v as string);
        }
      }
    }
    return [...set].sort();
  }, [players]);

  // ── Shared match helpers ──

  function getRow(partido: string) {
    if (edits[partido]) return edits[partido];
    const r = real[partido];
    return { local: r?.local?.toString() ?? "", visitante: r?.visitante?.toString() ?? "", status: "idle" as RowStatus };
  }

  function setField(partido: string, field: "local" | "visitante", raw: string) {
    const v = raw === "" ? "" : String(Math.max(0, parseInt(raw) || 0));
    setEdits((prev) => ({ ...prev, [partido]: { ...getRow(partido), [field]: v, status: "idle" } }));
  }

  async function saveMatch(partido: string, fase: string) {
    const row = getRow(partido);
    const local = parseInt(row.local);
    const visitante = parseInt(row.visitante);
    if (isNaN(local) || isNaN(visitante)) return;
    setEdits((prev) => ({ ...prev, [partido]: { ...row, status: "saving" } }));
    try {
      await setResultado(partido, fase, local, visitante);
      setEdits((prev) => ({ ...prev, [partido]: { ...row, status: "saved" } }));
      onResultSaved(partido, local, visitante);
      setTimeout(() => setEdits((prev) => {
        const c = prev[partido];
        if (c?.status === "saved") return { ...prev, [partido]: { ...c, status: "idle" } };
        return prev;
      }), 2000);
    } catch {
      setEdits((prev) => ({ ...prev, [partido]: { ...row, status: "error" } }));
    }
  }

  async function clearMatch(partido: string, fase: string) {
    setConfirmClear(null);
    try {
      await setResultado(partido, fase, null, null);
      setEdits((prev) => { const n = { ...prev }; delete n[partido]; return n; });
      onResultCleared(partido);
    } catch {
      setConfirmClear("match_" + partido);
    }
  }

  // ── YouTube helpers ──
  function getYtRow(partido: string) {
    if (ytEdits[partido]) return ytEdits[partido];
    return { url: youtube[partido] ?? "", status: "idle" as RowStatus };
  }

  function setYtField(partido: string, val: string) {
    setYtEdits((prev) => ({ ...prev, [partido]: { url: val, status: "idle" } }));
  }

  async function saveYoutube(partido: string) {
    const row = getYtRow(partido);
    const url = row.url.trim();
    if (url && !url.startsWith("http")) return;
    setYtEdits((prev) => ({ ...prev, [partido]: { url, status: "saving" } }));
    try {
      await setYoutubeUrl(partido, url || null);
      setYtEdits((prev) => ({ ...prev, [partido]: { url, status: "saved" } }));
      onYoutubeSaved(partido, url || null);
      setTimeout(() => setYtEdits((prev) => {
        const c = prev[partido];
        if (c?.status === "saved") return { ...prev, [partido]: { ...c, status: "idle" } };
        return prev;
      }), 2000);
    } catch {
      setYtEdits((prev) => ({ ...prev, [partido]: { url, status: "error" } }));
    }
  }

  // ── Honor helpers ──
  async function saveHonor(key: string) {
    const val = honorVals[key] ?? "";
    setHonorStatus((prev) => ({ ...prev, [key]: "saving" }));
    try {
      await supaSetExtra(key, val);
      onExtraSaved(key, val);
      setHonorStatus((prev) => ({ ...prev, [key]: "saved" }));
      setTimeout(() => setHonorStatus((prev) => {
        if (prev[key] === "saved") return { ...prev, [key]: "idle" };
        return prev;
      }), 2000);
    } catch {
      setHonorStatus((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  async function clearHonor(key: string) {
    setConfirmClear(null);
    try {
      await supaClearExtra(key);
      setHonorVals((prev) => ({ ...prev, [key]: "" }));
      onExtraSaved(key, "");
    } catch {
      setConfirmClear(key);
    }
  }

  // ── DESEMPATE MATEMÁTICO GRUPOS ──
  const calcularClasificacionGrupo = (grupoChar: string) => {
    const equiposGrupo = GRUPOS_EQUIPOS[grupoChar] ?? [];
    const stats: Record<string, { equipo: string; pts: number; dg: number; gf: number }> = {};
    equiposGrupo.forEach(t => {
      stats[t] = { equipo: t, pts: 0, dg: 0, gf: 0 };
    });

    const partidosGrupo = (players[0]?.fase_grupos ?? []).filter(m => {
      return equiposGrupo.includes(m.local) && equiposGrupo.includes(m.visitante);
    });

    partidosGrupo.forEach(m => {
      const res = real[m.partido];
      if (!res || res.local === null || res.visitante === null) return;
      const gl = res.local;
      const gv = res.visitante;

      stats[m.local].gf += gl;
      stats[m.local].dg += (gl - gv);
      stats[m.visitante].gf += gv;
      stats[m.visitante].dg += (gv - gl);

      if (gl > gv) stats[m.local].pts += 3;
      else if (gl < gv) stats[m.visitante].pts += 3;
      else {
        stats[m.local].pts += 1;
        stats[m.visitante].pts += 1;
      }
    });

    const listaEquipos = Object.values(stats);

    listaEquipos.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;

      const empatados = listaEquipos.filter(e => e.pts === a.pts).map(e => e.equipo);
      if (empatados.length > 1) {
        let ptsA = 0, ptsB = 0, gfA = 0, gfB = 0, gcA = 0, gcB = 0;
        
        partidosGrupo.forEach(m => {
          const res = real[m.partido];
          if (!res || res.local === null || res.visitante === null) return;
          if (empatados.includes(m.local) && empatados.includes(m.visitante)) {
            if (m.local === a.equipo) { 
              ptsA += res.local > res.visitante ? 3 : res.local === res.visitante ? 1 : 0; 
              gfA += res.local; gcA += res.visitante; 
            }
            if (m.visitante === a.equipo) { 
              ptsA += res.visitante > res.local ? 3 : res.local === res.visitante ? 1 : 0; 
              gfA += res.visitante; gcA += res.local; 
            }
            if (m.local === b.equipo) { 
              ptsB += res.local > res.visitante ? 3 : res.local === res.visitante ? 1 : 0; 
              gfB += res.local; gcB += res.visitante; 
            }
            if (m.visitante === b.equipo) { 
              ptsB += res.visitante > res.local ? 3 : res.local === res.visitante ? 1 : 0; 
              gfB += res.visitante; gcB += res.local; 
            }
          }
        });

        if (ptsB !== ptsA) return ptsB - ptsA;
        const dgA = gfA - gcA; const dgB = gfB - gcB;
        if (dgB !== dgA) return dgB - dgA;
        if (gfB !== gfA) return gfB - gfA;
      }

      if (b.dg !== a.dg) return b.dg - a.dg;
      return b.gf - a.gf;
    });

    return listaEquipos;
  };

  // Inicializar o recalcular las posiciones al entrar a la pestaña
  useEffect(() => {
    if (adminTab === "posiciones") {
      const init: Record<string, string[]> = {};
      GRUPOS.forEach(g => {
        const guardadas: string[] = [];
        for (let r = 1; r <= 4; r++) {
          const v = extra[normPos(`${r}º GRUPO ${g}`)];
          if (typeof v === "string" && v) guardadas.push(v);
        }
        if (guardadas.length === 4) {
          init[g] = guardadas;
        } else {
          init[g] = calcularClasificacionGrupo(g).map(e => e.equipo);
        }
      });
      setOrdenGrupos(init);

      // Cargar orden personalizado de mejores terceros si existe
      const guardadosTerceros: string[] = [];
      for (let r = 1; r <= 12; r++) {
        const v = extra[normPos(`${r}º TERCEROS`)];
        if (typeof v === "string" && v) guardadosTerceros.push(v);
      }
      if (guardadosTerceros.length === 12) {
        setOrdenTerceros(guardadosTerceros);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab, real, extra, players]);

  // Base calculada matemáticamente de terceros
  const listaTercerosCalculados = useMemo(() => {
    const terceros: Array<{ equipo: string; grupo: string; pts: number; dg: number; gf: number }> = [];
    Object.entries(ordenGrupos).forEach(([g, equipos]) => {
      const tercerEquipo = equipos[2]; 
      if (!tercerEquipo) return;
      const orig = calcularClasificacionGrupo(g).find(e => e.equipo === tercerEquipo);
      if (orig) {
        terceros.push({ equipo: tercerEquipo, grupo: g, pts: orig.pts, dg: orig.dg, gf: orig.gf });
      }
    });
    return terceros.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      return b.gf - a.gf;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenGrupos]);

  // Si no hay un orden manual guardado previamente, sigue el cálculo matemático base
  useEffect(() => {
    const guardadosTerceros: string[] = [];
    for (let r = 1; r <= 12; r++) {
      const v = extra[normPos(`${r}º TERCEROS`)];
      if (typeof v === "string" && v) guardadosTerceros.push(v);
    }
    if (guardadosTerceros.length !== 12) {
      setOrdenTerceros(listaTercerosCalculados.map(t => t.equipo));
    }
  }, [listaTercerosCalculados, extra]);

  // Handlers para Drag & Drop NATIVO
  const handleDragStart = (idx: number, grupo: string | null) => {
    setDraggedIdx(idx);
    setDraggedGroup(grupo);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDropGrupo = (targetIdx: number, grupo: string) => {
    if (draggedIdx === null || draggedGroup !== grupo) return;
    const nuevaLista = [...ordenGrupos[grupo]];
    const [removido] = nuevaLista.splice(draggedIdx, 1);
    nuevaLista.splice(targetIdx, 0, removido);
    setOrdenGrupos(prev => ({ ...prev, [grupo]: nuevaLista }));
    setDraggedIdx(null);
    setDraggedGroup(null);
  };

  const handleDropTerceros = (targetIdx: number) => {
    if (draggedIdx === null || draggedGroup !== "terceros") return;
    const nuevaLista = [...ordenTerceros];
    const [removido] = nuevaLista.splice(draggedIdx, 1);
    nuevaLista.splice(targetIdx, 0, removido);
    setOrdenTerceros(nuevaLista);
    setDraggedIdx(null);
    setDraggedGroup(null);
  };

  async function savePosicionesGrupo(g: string) {
    setPosStatus((prev) => ({ ...prev, [g]: "saving" }));
    try {
      const equipos = ordenGrupos[g] ?? [];
      for (let i = 0; i < equipos.length; i++) {
        const key = normPos(`${i + 1}º GRUPO ${g}`);
        await supaSetExtra(key, equipos[i]);
        onExtraSaved(key, equipos[i]);
      }
      setPosStatus((prev) => ({ ...prev, [g]: "saved" }));
      setTimeout(() => setPosStatus((prev) => {
        if (prev[g] === "saved") return { ...prev, [g]: "idle" };
        return prev;
      }), 2000);
    } catch {
      setPosStatus((prev) => ({ ...prev, [g]: "error" }));
    }
  }

  async function clearPosicionesGrupo(g: string) {
    setConfirmClear(null);
    try {
      for (let i = 1; i <= 4; i++) {
        const key = normPos(`${i}º GRUPO ${g}`);
        await supaClearExtra(key);
        onExtraSaved(key, "");
      }
      setOrdenGrupos(prev => ({
        ...prev,
        [g]: calcularClasificacionGrupo(g).map(e => e.equipo)
      }));
    } catch {
      setConfirmClear("grupo_" + g);
    }
  }

  async function savePosicionesTerceros() {
    setPosStatus((prev) => ({ ...prev, terceros: "saving" }));
    try {
      for (let i = 0; i < ordenTerceros.length; i++) {
        const key = normPos(`${i + 1}º TERCEROS`);
        await supaSetExtra(key, ordenTerceros[i]);
        onExtraSaved(key, ordenTerceros[i]);
      }
      setPosStatus((prev) => ({ ...prev, terceros: "saved" }));
      setTimeout(() => setPosStatus((prev) => {
        if (prev.terceros === "saved") return { ...prev, terceros: "idle" };
        return prev;
      }), 2000);
    } catch {
      setPosStatus((prev) => ({ ...prev, terceros: "error" }));
    }
  }

  async function clearPosicionesTerceros() {
    setConfirmClear(null);
    try {
      for (let i = 1; i <= 12; i++) {
        const key = normPos(`${i}º TERCEROS`);
        await supaClearExtra(key);
        onExtraSaved(key, "");
      }
      setOrdenTerceros(listaTercerosCalculados.map(t => t.equipo));
    } catch {
      setConfirmClear("terceros");
    }
  }

  // ── Clasificados helpers (Original) ──
  function toggleTeam(ronda: string, equipo: string) {
    setClasifSels((prev) => {
      const sel = new Set(prev[ronda] ?? []);
      sel.has(equipo) ? sel.delete(equipo) : sel.add(equipo);
      return { ...prev, [ronda]: sel };
    });
  }

  async function saveClasif(ronda: string) {
    const arr = [...(clasifSels[ronda] ?? new Set())];
    clasifStatus[ronda] = "saving";
    setClasifStatus({ ...clasifStatus });
    try {
      await supaSetExtra("clasif_" + ronda, JSON.stringify(arr));
      onExtraSaved("clasif_" + ronda, arr);
      setClasifStatus((prev) => ({ ...prev, [ronda]: "saved" }));
      setTimeout(() => setClasifStatus((prev) => {
        if (prev[ronda] === "saved") return { ...prev, [ronda]: "idle" };
        return prev;
      }), 2000);
    } catch {
      setClasifStatus((prev) => ({ ...prev, [ronda]: "error" }));
    }
  }

  async function clearClasif(ronda: string) {
    setConfirmClear(null);
    try {
      await supaSetExtra("clasif_" + ronda, JSON.stringify([]));
      setClasifSels((prev) => ({ ...prev, [ronda]: new Set() }));
      onExtraSaved("clasif_" + ronda, []);
    } catch {
      setClasifStatus((prev) => ({ ...prev, [ronda]: "error" }));
    }
  }

  // ── Portadas helpers ──
  useEffect(() => {
    if (adminTab !== "portadas") return;
    setPortadasLoading(true);
    fetchPortadas().then(setPortadasList).catch(() => {}).finally(() => setPortadasLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab]);

  async function handleUploadPortada() {
    if (!portFile) return;
    setPortUploadStatus("saving");
    setPortUploadError("");
    try {
      const aspect_ratio = await new Promise<number | null>((resolve) => {
        const objUrl = URL.createObjectURL(portFile);
        const img = new Image();
        img.onload = () => { resolve(img.naturalWidth / img.naturalHeight); URL.revokeObjectURL(objUrl); };
        img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(null); };
        img.src = objUrl;
      });
      const portada = await uploadPortada(portFile, portTitulo, portFecha, aspect_ratio);
      setPortadasList((prev) => [portada, ...prev]);
      setPortFile(null);
      setPortFileKey((k) => k + 1);
      setPortTitulo("");
      setPortFecha(getTodayISO());
      setPortUploadStatus("saved");
      setTimeout(() => setPortUploadStatus("idle"), 2000);
    } catch (e) {
      setPortUploadError(e instanceof Error ? e.message : "Error al subir");
      setPortUploadStatus("error");
    }
  }

  async function handleDeletePortada(id: number, storage_path: string) {
    setConfirmDeletePortada(null);
    try {
      await deletePortada(id, storage_path);
      setPortadasList((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <h2 style={hStyle}>Admin</h2>

      {/* Navegación de Pestañas */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 16, marginBottom: 20 }}>
        {ADMIN_TABS.map(({ id, label }) => {
          const active = adminTab === id;
          return (
            <button
              key={id}
              onClick={() => switchTab(id)}
              style={{
                padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: "pointer",
                border: `1px solid ${active ? C.ink : C.line}`,
                background: active ? C.ink : "transparent",
                color: active ? C.chalk : C.muted,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── PARTIDOS ── */}
      {adminTab === "partidos" && (
        <div>
          <p style={subStyle}>Marcadores finales de fase de grupos.</p>
          <div style={{ marginTop: 14 }}>
            {(players[0]?.fase_grupos ?? []).map((m, i) => {
              const row = getRow(m.partido);
              const canSave = row.local !== "" && row.visitante !== "" && row.status !== "saving";
              const confirming = confirmClear === "match_" + m.partido;
              const ytRow = getYtRow(m.partido);
              const ytInvalid = !!ytRow.url && !ytRow.url.startsWith("http");
              return (
                <div key={i}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 2px",
                    borderBottom: real[m.partido] ? "none" : `1px solid ${C.line}`,
                    fontSize: 13,
                  }}>
                    <span style={{ flex: 1, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.local} – {m.visitante}
                    </span>
                    <input inputMode="numeric" value={row.local}
                      onChange={(e) => setField(m.partido, "local", e.target.value)}
                      style={inpStyle} aria-label={`${m.local} goles`} />
                    <span style={{ color: C.muted }}>:</span>
                    <input inputMode="numeric" value={row.visitante}
                      onChange={(e) => setField(m.partido, "visitante", e.target.value)}
                      style={inpStyle} aria-label={`${m.visitante} goles`} />
                    <SaveBtn status={row.status} onClick={() => saveMatch(m.partido, "grupos")} disabled={!canSave} />
                    {real[m.partido] && !confirming && <ClearBtn onClick={() => setConfirmClear("match_" + m.partido)} />}
                  </div>
                  {confirming && (
                    <ConfirmBar
                      message={`¿Limpiar resultado de ${m.local} – ${m.visitante}?`}
                      onCancel={() => setConfirmClear(null)}
                      onConfirm={() => clearMatch(m.partido, "grupos")}
                    />
                  )}
                  {real[m.partido] && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px 8px", borderBottom: `1px solid ${C.line}` }}>
                      <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>YT</span>
                      <input
                        type="text"
                        value={ytRow.url}
                        onChange={(e) => setYtField(m.partido, e.target.value)}
                        placeholder="https://youtube.com/…"
                        style={{
                          flex: 1, padding: "4px 6px", border: `1px solid ${ytInvalid ? C.rojo : C.line}`,
                          borderRadius: 3, fontFamily: "'DM Mono', monospace", fontSize: 11, background: C.chalk, color: C.ink,
                        }}
                      />
                      <SaveBtn status={ytRow.status} onClick={() => saveYoutube(m.partido)} disabled={ytInvalid || ytRow.status === "saving"} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ELIMINATORIAS ── */}
      {adminTab === "eliminatorias" && (() => {
        const cruces: CruceMatch[] = CRUCES["enfr_" + koRonda] ?? [];
        const lower = koFilter.toLowerCase();
        const filtered = cruces.filter((m) => {
          if (lower && !m.partido.toLowerCase().includes(lower)) return false;
          if (koHideSaved && real[m.partido]) return false;
          return true;
        });
        const savedCount = cruces.filter((m) => real[m.partido]).length;

        return (
          <div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              {KO_RONDAS.map(({ key, label }) => {
                const active = koRonda === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setKoRonda(key); setKoFilter(""); setConfirmClear(null); }}
                    style={{
                      padding: "5px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${active ? C.ink : C.line}`, background: active ? C.ink : "transparent", color: active ? C.chalk : C.muted,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <input
                type="search"
                value={koFilter}
                onChange={(e) => { setKoFilter(e.target.value); setConfirmClear(null); }}
                placeholder="Filtrar por equipo…"
                style={{ flex: 1, padding: "6px 10px", border: `1px solid ${C.line}`, borderRadius: 3, fontSize: 13, background: C.chalk, color: C.ink }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={koHideSaved} onChange={(e) => setKoHideSaved(e.target.checked)} style={{ cursor: "pointer" }} />
                Solo pendientes
              </label>
            </div>

            <p style={{ ...subStyle, marginBottom: 10 }}>{savedCount}/{cruces.length} con resultado · {filtered.length} visibles</p>

            <div>
              {filtered.length === 0 && <p style={{ color: C.muted, fontSize: 13, textAlign: "center", paddingTop: 16 }}>Sin partidos</p>}
              {filtered.map((m) => {
                const row = getRow(m.partido);
                const canSave = row.local !== "" && row.visitante !== "" && row.status !== "saving";
                const confirming = confirmClear === "match_" + m.partido;
                const ytRow = getYtRow(m.partido);
                const ytInvalid = !!ytRow.url && !ytRow.url.startsWith("http");
                return (
                  <div key={m.partido}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 2px",
                      borderBottom: real[m.partido] ? "none" : `1px solid ${C.line}`, fontSize: 13,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.local} – {m.visitante}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{m.jugadores.length} {m.jugadores.length === 1 ? "jugador" : "jugadores"}</div>
                      </div>
                      <input inputMode="numeric" value={row.local} onChange={(e) => setField(m.partido, "local", e.target.value)} style={inpStyle} aria-label={`${m.local} goles`} />
                      <span style={{ color: C.muted }}>:</span>
                      <input inputMode="numeric" value={row.visitante} onChange={(e) => setField(m.partido, "visitante", e.target.value)} style={inpStyle} aria-label={`${m.visitante} goles`} />
                      <SaveBtn status={row.status} onClick={() => saveMatch(m.partido, koRonda)} disabled={!canSave} />
                      {real[m.partido] && !confirming && <ClearBtn onClick={() => setConfirmClear("match_" + m.partido)} />}
                    </div>
                    {confirming && (
                      <ConfirmBar
                        message={`¿Limpiar resultado de ${m.local} – ${m.visitante}?`}
                        onCancel={() => setConfirmClear(null)}
                        onConfirm={() => clearMatch(m.partido, koRonda)}
                      />
                    )}
                    {real[m.partido] && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 2px 8px", borderBottom: `1px solid ${C.line}` }}>
                        <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>YT</span>
                        <input
                          type="text"
                          value={ytRow.url}
                          onChange={(e) => setYtField(m.partido, e.target.value)}
                          placeholder="https://youtube.com/…"
                          style={{
                            flex: 1, padding: "4px 6px", border: `1px solid ${ytInvalid ? C.rojo : C.line}`,
                            borderRadius: 3, fontFamily: "'DM Mono', monospace", fontSize: 11, background: C.chalk, color: C.ink,
                          }}
                        />
                        <SaveBtn status={ytRow.status} onClick={() => saveYoutube(m.partido)} disabled={ytInvalid || ytRow.status === "saving"} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── HONOR ── */}
      {adminTab === "honor" && (
        <div>
          <datalist id="player-datalist">
            {playerSuggestions.map((name) => <option key={name} value={name} />)}
          </datalist>
          {HONOR_FIELDS.map(({ key, label, type }) => {
            const val = honorVals[key] ?? "";
            const status = honorStatus[key] ?? "idle";
            const confirming = confirmClear === key;
            return (
              <div key={key}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: confirming ? "none" : `1px solid ${C.line}` }}>
                  <span style={{ width: 110, flexShrink: 0, fontSize: 12, color: C.muted, fontWeight: 700 }}>{label}</span>
                  {type === "team" ? (
                    <select value={val} onChange={(e) => setHonorVals((prev) => ({ ...prev, [key]: e.target.value }))} style={selStyle}>
                      <option value="">—</option>
                      {ALL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input type="text" list="player-datalist" value={val} onChange={(e) => setHonorVals((prev) => ({ ...prev, [key]: e.target.value }))} placeholder="Jugador" style={{ ...selStyle, flex: 1 }} />
                  )}
                  <SaveBtn status={status} onClick={() => saveHonor(key)} disabled={!val} />
                  {val && !confirming && <ClearBtn onClick={() => setConfirmClear(key)} />}
                </div>
                {confirming && (
                  <div style={{ borderBottom: `1px solid ${C.line}` }}>
                    <ConfirmBar message={`¿Limpiar ${label}?`} onCancel={() => setConfirmClear(null)} onConfirm={() => clearHonor(key)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── POSICIONES (GRID DE GRUPOS + TABLA DE TERCEROS DRAG & DROP) ── */}
      {adminTab === "posiciones" && (() => {
        const tercerosStatus = posStatus.terceros ?? "idle";
        const confirmingTerceros = confirmClear === "terceros";

        return (
          <div>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>
                Las tablas se calculan solas por desempate matemático. Arrastra las filas para solucionar empates manuales específicos si es necesario.
              </span>
            </div>

            {/* Grid Interactivo de Grupos con Drag and Drop */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
              {GRUPOS.map(g => {
                const status = posStatus[g] ?? "idle";
                const confirming = confirmClear === "grupo_" + g;
                return (
                  <div key={g} style={{ border: `1px solid ${C.line}`, borderRadius: 4, padding: 12, background: "#fff", display: "flex", flexDirection: "column" }}>
                    <h4 style={{ fontFamily: "'Anton', sans-serif", fontSize: 14, color: C.ink, margin: "0 0 8px", textTransform: "uppercase", borderBottom: `2px solid ${C.pitch}`, paddingBottom: 4 }}>
                      Grupo {g}
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, marginBottom: 10 }}>
                      {ordenGrupos[g]?.map((equipo, index) => (
                        <div
                          key={equipo}
                          draggable
                          onDragStart={() => handleDragStart(index, g)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDropGrupo(index, g)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                            background: C.chalk, border: `1px dashed ${C.line}`, borderRadius: 3,
                            cursor: "grab", userSelect: "none"
                          }}
                        >
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, width: 16 }}>{index + 1}º</span>
                          <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, flex: 1 }}>{equipo}</span>
                          <span style={{ fontSize: 12, color: C.muted, pointerEvents: "none" }}>☰</span>
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center" }}>
                      {!confirming && (
                        <button
                          onClick={() => setConfirmClear("grupo_" + g)}
                          style={{ padding: "4px 8px", borderRadius: 3, fontSize: 11, fontWeight: 700, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer" }}
                        >
                          Reiniciar
                        </button>
                      )}
                      <SaveBtn status={status} onClick={() => savePosicionesGrupo(g)} />
                    </div>
                    {confirming && (
                      <div style={{ marginTop: 6 }}>
                        <ConfirmBar message={`¿Resetear orden matemático del Grupo ${g}?`} onCancel={() => setConfirmClear(null)} onConfirm={() => clearPosicionesGrupo(g)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <hr style={{ border: "none", borderTop: `1px dashed ${C.line}`, margin: "24px 0" }} />

            {/* Tabla Interactiva de Mejores Terceros con Drag and Drop propio */}
            <div style={{ maxWidth: 520, margin: "0 auto", paddingBottom: 24 }}>
              <h3 style={{ fontFamily: "'Anton', sans-serif", fontSize: 16, color: C.ink, marginBottom: 4, textTransform: "uppercase", textAlign: "center" }}>
                Tabla de Mejores Terceros
              </h3>
              <p style={{ color: C.muted, fontSize: 12, textAlign: "center", margin: "0 0 14px" }}>
                Pasan los 8 primeros (resaltados en verde). Arrastra las filas para solucionar empates manuales si es necesario.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                {ordenTerceros.map((equipo, index) => {
                  const dataTeam = listaTercerosCalculados.find(t => t.equipo === equipo);
                  const esClasificado = index < 8;
                  return (
                    <div
                      key={equipo}
                      draggable
                      onDragStart={() => handleDragStart(index, "terceros")}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropTerceros(index)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                        background: esClasificado ? "#E6F0E9" : "#fff",
                        border: `1px solid ${esClasificado ? "#1B5E3A" : C.line}`, borderRadius: 4,
                        cursor: "grab", userSelect: "none"
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: esClasificado ? "#1B5E3A" : C.muted, width: 18 }}>
                        {index + 1}º
                      </span>
                      <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 700, flex: 1 }}>
                        {equipo} <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>(Gr. {dataTeam?.grupo ?? "?"})</span>
                      </span>
                      <div style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "'DM Mono', monospace", color: C.ink }}>
                        <span><b>PTS:</b> {dataTeam?.pts ?? 0}</span>
                        <span><b>DG:</b> {dataTeam?.dg ?? 0}</span>
                        <span><b>GF:</b> {dataTeam?.gf ?? 0}</span>
                      </div>
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 4, pointerEvents: "none" }}>☰</span>
                    </div>
                  );
                })}
              </div>

              {/* Botones de control para la tabla de terceros */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
                {!confirmingTerceros && (
                  <button
                    onClick={() => setConfirmClear("terceros")}
                    style={{ padding: "5px 10px", borderRadius: 3, fontSize: 11, fontWeight: 700, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer" }}
                  >
                    Reiniciar Terceros
                  </button>
                )}
                <SaveBtn status={tercerosStatus} onClick={savePosicionesTerceros} />
              </div>
              {confirmingTerceros && (
                <div style={{ marginTop: 6 }}>
                  <ConfirmBar message={`¿Resetear orden matemático de la tabla de terceros?`} onCancel={() => setConfirmClear(null)} onConfirm={clearPosicionesTerceros} />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── CLASIFICADOS (ORIGINAL COMO ESTABA) ── */}
      {adminTab === "clasificados" && (() => {
        const rondaLabel = CLASIF_RONDAS.find((r) => r.key === clasifRonda)?.label ?? clasifRonda;
        const count = clasifSels[clasifRonda]?.size ?? 0;
        const confirming = confirmClear === "clasif_" + clasifRonda;

        return (
          <div>
            <p style={subStyle}>Selecciona manualmente los equipos clasificados para cada ronda eliminatoria.</p>
            
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 14, marginBottom: 16 }}>
              {CLASIF_RONDAS.map(({ key, label }) => {
                const active = clasifRonda === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setClasifRonda(key); setConfirmClear(null); }}
                    style={{
                      padding: "5px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${active ? C.ink : C.line}`, background: active ? C.ink : "transparent", color: active ? C.chalk : C.muted,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {ALL_TEAMS.map((equipo) => {
                const selected = clasifSels[clasifRonda]?.has(equipo) ?? false;
                return (
                  <button
                    key={equipo}
                    onClick={() => toggleTeam(clasifRonda, equipo)}
                    style={{
                      padding: "5px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${selected ? C.pitch : C.line}`, background: selected ? C.pitch : "transparent", color: selected ? C.chalk : C.muted,
                    }}
                  >
                    {equipo}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>{count} seleccionados</span>
              <div style={{ display: "flex", gap: 8 }}>
                {!confirming && (
                  <button
                    onClick={() => setConfirmClear("clasif_" + clasifRonda)}
                    style={{ padding: "5px 10px", borderRadius: 3, fontSize: 11, fontWeight: 700, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, cursor: "pointer" }}
                  >
                    Vaciar
                  </button>
                )}
                <SaveBtn status={clasifStatus[clasifRonda] ?? "idle"} onClick={() => saveClasif(clasifRonda)} />
              </div>
            </div>
            {confirming && (
              <ConfirmBar message={`¿Vaciar clasificados de ${rondaLabel}?`} onCancel={() => setConfirmClear(null)} onConfirm={() => clearClasif(clasifRonda)} />
            )}
          </div>
        );
      })()}

      {/* ── PORTADAS ── */}
      {adminTab === "portadas" && (() => {
        const fileError = portFile && !portFile.type.startsWith("image/");
        const sizeWarning = portFile && !fileError && portFile.size > 5 * 1024 * 1024;
        const canUpload = !!portFile && !fileError && portUploadStatus !== "saving";

        return (
          <div>
            <p style={subStyle}>Subir nueva portada del día.</p>
            <div style={{ marginTop: 14 }}>
              <input
                key={portFileKey} type="file" accept="image/*"
                onChange={(e) => { setPortFile(e.target.files?.[0] ?? null); setPortUploadStatus("idle"); setPortUploadError(""); }}
                style={{ fontSize: 12.5, marginBottom: 6, display: "block" }}
              />
              {fileError && <p style={{ fontSize: 11, color: C.rojo, margin: "0 0 6px" }}>Solo se admiten imágenes.</p>}
              {sizeWarning && <p style={{ fontSize: 11, color: "#9A6700", margin: "0 0 6px" }}>El archivo supera 5 MB — puede tardar.</p>}

              <input type="text" value={portTitulo} onChange={(e) => setPortTitulo(e.target.value)} placeholder="Título (opcional)" style={{ ...selStyle, width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
              <input type="date" value={portFecha} onChange={(e) => setPortFecha(e.target.value)} style={{ ...selStyle, width: "auto", marginBottom: 12 }} />

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={handleUploadPortada} disabled={!canUpload}
                  style={{
                    padding: "6px 16px", borderRadius: 3, fontSize: 12, fontWeight: 700, border: "none", cursor: canUpload ? "pointer" : "default",
                    background: portUploadStatus === "saved" ? "#E6F0E9" : portUploadStatus === "error" ? "#F5E6E6" : canUpload ? C.pitch : C.line,
                    color: portUploadStatus === "saved" ? "#1B5E3A" : portUploadStatus === "error" ? C.rojo : canUpload ? C.chalk : C.muted,
                  }}
                >
                  {portUploadStatus === "saving" ? "…" : portUploadStatus === "saved" ? "✓ Subida" : portUploadStatus === "error" ? "Error" : "Subir"}
                </button>
                {portUploadError && <span style={{ fontSize: 11, color: C.rojo }}>{portUploadError}</span>}
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <p style={{ ...subStyle, marginBottom: 10 }}>{portadasList.length} portada{portadasList.length !== 1 ? "s" : ""} subida{portadasList.length !== 1 ? "s" : ""}</p>
              {portadasLoading ? (
                <p style={{ color: C.muted, fontSize: 13 }}>Cargando…</p>
              ) : portadasList.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13 }}>No hay portadas aún.</p>
              ) : (
                <div>
                  {portadasList.map((p) => {
                    const confirming = confirmDeletePortada === p.id;
                    return (
                      <div key={p.id}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: confirming ? "none" : `1px solid ${C.line}` }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={p.titulo ?? "Portada"} loading="lazy" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo ?? "(sin título)"}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{formatFechaShort(p.fecha)}</div>
                          </div>
                          {!confirming && <ClearBtn onClick={() => setConfirmDeletePortada(p.id)} />}
                        </div>
                        {confirming && (
                          <div style={{ borderBottom: `1px solid ${C.line}` }}>
                            <ConfirmBar message={`¿Borrar "${p.titulo ?? "esta portada"}"?`} onCancel={() => setConfirmDeletePortada(null)} onConfirm={() => handleDeletePortada(p.id, p.storage_path)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}

// ---- main export ----

interface Props {
  players: Player[];
  real: RealResults;
  extra: RealExtra;
  youtube: YoutubeUrls;
  onResultSaved: (partido: string, local: number, visitante: number) => void;
  onResultCleared: (partido: string) => void;
  onExtraSaved: (clave: string, valor: string | string[]) => void;
  onYoutubeSaved: (partido: string, url: string | null) => void;
}

export default function AdminScreen({ players, real, extra, youtube, onResultSaved, onResultCleared, onExtraSaved, onYoutubeSaved }: Props) {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;

  return (
    <AdminContent
      players={players}
      real={real}
      extra={extra}
      youtube={youtube}
      onResultSaved={onResultSaved}
      onResultCleared={onResultCleared}
      onExtraSaved={onExtraSaved}
      onYoutubeSaved={onYoutubeSaved}
    />
  );
}