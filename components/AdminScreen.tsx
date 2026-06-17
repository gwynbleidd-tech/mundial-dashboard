"use client";

import { useState } from "react";
import type { Player, RealResults } from "@/lib/scoring";
import { setResultado } from "@/lib/supabase";
import { C } from "@/lib/theme";

// ---- estilos compartidos ----

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

// ---- tipos internos ----

type RowStatus = "idle" | "saving" | "saved" | "error";

interface RowEdit {
  local: string;
  visitante: string;
  status: RowStatus;
}

// ---- componente de lock ----

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

// ---- componente principal ----

interface Props {
  players: Player[];
  real: RealResults;
  onResultSaved: (partido: string, local: number, visitante: number) => void;
}

export default function AdminScreen({ players, real, onResultSaved }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;

  const fixtures = players[0]?.fase_grupos ?? [];

  function getRow(partido: string): RowEdit {
    if (edits[partido]) return edits[partido];
    const r = real[partido];
    return {
      local: r?.local?.toString() ?? "",
      visitante: r?.visitante?.toString() ?? "",
      status: "idle",
    };
  }

  function setField(partido: string, field: "local" | "visitante", raw: string) {
    const v = raw === "" ? "" : String(Math.max(0, parseInt(raw) || 0));
    const current = getRow(partido);
    setEdits((prev) => ({
      ...prev,
      [partido]: { ...current, [field]: v, status: "idle" },
    }));
  }

  async function save(partido: string) {
    const row = getRow(partido);
    const local = parseInt(row.local);
    const visitante = parseInt(row.visitante);
    if (isNaN(local) || isNaN(visitante)) return;

    setEdits((prev) => ({ ...prev, [partido]: { ...row, status: "saving" } }));
    try {
      await setResultado(partido, "grupos", local, visitante);
      setEdits((prev) => ({ ...prev, [partido]: { ...row, status: "saved" } }));
      onResultSaved(partido, local, visitante);
      // limpia el indicador de guardado tras 2 s
      setTimeout(() => {
        setEdits((prev) => {
          const current = prev[partido];
          if (current?.status === "saved") {
            return { ...prev, [partido]: { ...current, status: "idle" } };
          }
          return prev;
        });
      }, 2000);
    } catch {
      setEdits((prev) => ({ ...prev, [partido]: { ...row, status: "error" } }));
    }
  }

  return (
    <div>
      <h2 style={hStyle}>Resultados reales</h2>
      <p style={subStyle}>Introduce el marcador final. La clasificación se recalcula al instante.</p>

      <div style={{ marginTop: 14 }}>
        {fixtures.map((m, i) => {
          const row = getRow(m.partido);
          const canSave = row.local !== "" && row.visitante !== "" && row.status !== "saving";
          const isSaving = row.status === "saving";
          const isSaved = row.status === "saved";
          const isError = row.status === "error";

          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 2px", borderBottom: `1px solid ${C.line}`, fontSize: 13,
              }}
            >
              <span style={{ flex: 1, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.local} – {m.visitante}
              </span>

              <input
                inputMode="numeric"
                value={row.local}
                onChange={(e) => setField(m.partido, "local", e.target.value)}
                style={inpStyle}
                aria-label={`${m.local} goles`}
              />
              <span style={{ color: C.muted }}>:</span>
              <input
                inputMode="numeric"
                value={row.visitante}
                onChange={(e) => setField(m.partido, "visitante", e.target.value)}
                style={inpStyle}
                aria-label={`${m.visitante} goles`}
              />

              <button
                onClick={() => save(m.partido)}
                disabled={!canSave}
                style={{
                  width: 60, padding: "5px 0", borderRadius: 3, fontSize: 11, fontWeight: 700,
                  border: "none", cursor: canSave ? "pointer" : "default",
                  background: isSaved ? "#E6F0E9" : isError ? "#F5E6E6" : canSave ? C.pitch : C.line,
                  color: isSaved ? "#1B5E3A" : isError ? C.rojo : canSave ? C.chalk : C.muted,
                  flexShrink: 0,
                }}
              >
                {isSaving ? "…" : isSaved ? "✓" : isError ? "Error" : "Guardar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
