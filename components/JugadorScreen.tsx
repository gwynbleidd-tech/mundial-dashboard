"use client";

import { useState } from "react";
import type { Player, RealResults, RealExtra, Match } from "@/lib/scoring";
import { scorePlayer, scoreMatch, GRUPO_PTS } from "@/lib/scoring";
import { C } from "@/lib/theme";

// ---- constants ----

const GRUPOS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;

const KO_RONDAS = [
  { key: "dieciseisavos", label: "1/16 de final",   short: "1/16" },
  { key: "octavos",       label: "Octavos de final", short: "Octavos" },
  { key: "cuartos",       label: "Cuartos de final", short: "Cuartos" },
  { key: "semis",         label: "Semifinales",       short: "Semis" },
  { key: "3y4",           label: "3er y 4º puesto",  short: "3º y 4º" },
  { key: "final",         label: "Final",             short: "Final" },
] as const;

// ---- constants de color (idénticos a JornadaScreen) ----

const HIT_COLOR: Record<"exacto" | "signo" | "fallo", string> = {
  exacto: "#2E8B57",
  signo:  "#B87333",
  fallo:  C.rojo,
};

// ---- helpers ----

const hStyle: React.CSSProperties = {
  fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 22,
  color: C.ink, margin: 0, letterSpacing: ".01em", textTransform: "uppercase",
};

const secLabel: React.CSSProperties = {
  fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 15,
  color: C.ink, margin: 0, letterSpacing: ".04em", textTransform: "uppercase",
};

function buildEquipoGrupoMap(player: Player): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pos of player.posicion_grupos) {
    const m = pos.puesto.match(/GRUPO ([A-L])/);
    if (m) map[pos.equipo] = m[1];
  }
  return map;
}

// ---- subcomponents ----

function PredScore({ local, visitante }: { local: number; visitante: number }) {
  return (
    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
      {local}<span style={{ color: C.muted, margin: "0 2px" }}>–</span>{visitante}
    </span>
  );
}

type Hit = "exacto" | "signo" | "fallo";

function MatchRow({
  local, visitante, pred, hit, pts,
}: {
  local: string; visitante: string;
  pred: { local: number; visitante: number };
  hit?: Hit | null;
  pts?: number | null;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 0", borderBottom: `1px solid ${C.chalk}`,
    }}>
      <span style={{
        flex: 1, fontSize: 13, color: C.ink,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {local} <span style={{ color: C.muted }}>–</span> {visitante}
      </span>
      <PredScore local={pred.local} visitante={pred.visitante} />
      {pts !== undefined && (
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: pts != null && pts > 0 ? (hit ? HIT_COLOR[hit] : C.pitch) : C.line,
          fontWeight: pts != null && pts > 0 ? 700 : 400,
          flexShrink: 0, whiteSpace: "nowrap", minWidth: 44, textAlign: "right",
        }}>
          {pts != null ? `+${pts} pts` : "–"}
        </span>
      )}
    </div>
  );
}

function HonorRow({ items }: { items: { label: string; val: string | null | undefined }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
      {items.map(({ label, val }) => (
        <div key={label} style={{
          flex: 1, border: `1px solid ${C.line}`, borderRadius: 4, padding: "7px 8px",
          minWidth: 0,
        }}>
          <div style={{
            fontSize: 8, letterSpacing: ".08em", textTransform: "uppercase",
            color: C.muted, fontWeight: 700, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700, marginTop: 3, color: C.ink,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {val || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%", display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "14px 0 10px",
        border: "none", background: "none", cursor: "pointer",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <span style={{ ...secLabel }}>{label}</span>
      <span style={{
        fontSize: 16, color: C.muted,
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform .15s ease",
        display: "inline-block",
      }}>›</span>
    </button>
  );
}

function GroupView({
  grupo, player, clasificados, equipoGrupo, real,
}: {
  grupo: string;
  player: Player;
  clasificados: Set<string>;
  equipoGrupo: Record<string, string>;
  real: RealResults;
}) {
  const positions = player.posicion_grupos
    .filter((p) => p.puesto.includes(`GRUPO ${grupo}`))
    .sort((a, b) => parseInt(a.puesto[0]) - parseInt(b.puesto[0]));

  const matches = player.fase_grupos.filter(
    (m) => equipoGrupo[m.local] === grupo && equipoGrupo[m.visitante] === grupo
  );

  return (
    <div>
      {/* Clasificación del grupo */}
      <div style={{ marginBottom: 14 }}>
        {positions.map((pos, i) => {
          const clasif = clasificados.has(pos.equipo);
          return (
            <div key={pos.equipo} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 0", borderBottom: `1px solid ${C.chalk}`,
            }}>
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 12,
                color: C.muted, width: 14, flexShrink: 0, textAlign: "right",
              }}>
                {i + 1}
              </span>
              <span style={{
                flex: 1, fontSize: 14, fontWeight: 700,
                color: clasif ? "#2E7D55" : C.muted,
              }}>
                {pos.equipo}
              </span>
              {clasif && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
                  textTransform: "uppercase", color: "#2E7D55",
                  border: "1px solid #2E7D55", borderRadius: 2,
                  padding: "1px 5px", flexShrink: 0,
                }}>
                  Clasif.
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Partidos del grupo */}
      {matches.map((m, i) => {
        const r = real[m.partido];
        const s = r ? scoreMatch(m.pred, r, GRUPO_PTS) : null;
        return (
          <MatchRow key={i} local={m.local} visitante={m.visitante} pred={m.pred}
            hit={s ? s.hit as Hit : null}
            pts={s ? s.pts : null}
          />
        );
      })}
    </div>
  );
}

// ---- main component ----

interface Props {
  players: Player[];
  picked: string;
  onPick: (id: string) => void;
  real: RealResults;
  extra: RealExtra;
}

export default function JugadorScreen({ players, picked, onPick, real, extra }: Props) {
  const [grupoTab, setGrupoTab] = useState<string>("todos");
  const [rondaTab, setRondaTab] = useState<string>("dieciseisavos");
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["honor"]));

  const player = players.find((p) => p.id === picked) ?? players[0];
  if (!player) return null;

  const score = scorePlayer(player, real, extra);
  const h = player.cuadro_honor;
  const equipoGrupo = buildEquipoGrupoMap(player);
  const clasificados = new Set(player.clasif_dieciseisavos);

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div>
      {/* Selector de jugador */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            style={{
              fontSize: 12, padding: "6px 10px", borderRadius: 20,
              cursor: "pointer", fontWeight: 700,
              border: `1px solid ${p.id === picked ? C.ink : C.line}`,
              background: p.id === picked ? C.ink : "transparent",
              color: p.id === picked ? C.chalk : C.ink,
            }}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {/* Cabecera */}
      <h2 style={hStyle}>{player.nombre}</h2>
      <p style={{ color: C.muted, fontSize: 12.5, margin: "5px 0 0", letterSpacing: ".02em" }}>
        {score.total} puntos · {score.signos + score.exactos} 1X2 · {score.exactos} exactos
      </p>

      {/* ── CUADRO DE HONOR ── */}
      <div style={{ marginTop: 22 }}>
        <SectionToggle label="Cuadro de honor" open={openSections.has("honor")} onToggle={() => toggleSection("honor")} />
        {openSections.has("honor") && <div style={{ marginTop: 10 }}>

        {/* Campeón */}
        <div style={{
          background: C.ink, borderRadius: 4, padding: "12px 14px", marginBottom: 6,
        }}>
          <div style={{
            fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase",
            color: C.gold, fontWeight: 700,
          }}>
            Campeón
          </div>
          <div style={{
            fontFamily: "'Anton', sans-serif", fontSize: 22, color: C.chalk,
            letterSpacing: ".01em", marginTop: 2,
          }}>
            {h.campeon || "—"}
          </div>
        </div>

        {/* Subcampeón + 3º */}
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {[
            { label: "Subcampeón", val: h.subcampeon },
            { label: "3er puesto", val: h.tercero },
          ].map(({ label, val }) => (
            <div key={label} style={{
              flex: 1, border: `1px solid ${C.line}`, borderRadius: 4,
              padding: "8px 10px", minWidth: 0,
            }}>
              <div style={{
                fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase",
                color: C.muted, fontWeight: 700,
              }}>
                {label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: C.ink }}>
                {val || "—"}
              </div>
            </div>
          ))}
        </div>

        {/* Botas */}
        <HonorRow items={[
          { label: "Bota de oro",    val: h.bota_oro },
          { label: "Bota de plata",  val: h.bota_plata },
          { label: "Bota de bronce", val: h.bota_bronce },
        ]} />

        {/* Balones */}
        <HonorRow items={[
          { label: "Balón de oro",    val: h.balon_oro },
          { label: "Balón de plata",  val: h.balon_plata },
          { label: "Balón de bronce", val: h.balon_bronce },
        ]} />
        </div>}
      </div>

      {/* ── FASE DE GRUPOS ── */}
      <div style={{ marginTop: 6 }}>
        <SectionToggle label="Fase de grupos" open={openSections.has("grupos")} onToggle={() => toggleSection("grupos")} />
        {openSections.has("grupos") && <div style={{ marginTop: 12 }}>

        {/* Pestañas de grupo */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(["todos", ...GRUPOS] as const).map((g) => {
            const active = grupoTab === g;
            return (
              <button
                key={g}
                onClick={() => setGrupoTab(g)}
                style={{
                  padding: "5px 11px", borderRadius: 20,
                  border: `1px solid ${active ? C.ink : C.line}`,
                  background: active ? C.ink : "transparent",
                  color: active ? C.chalk : C.muted,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {g === "todos" ? "Todos" : g}
              </button>
            );
          })}
        </div>

        {/* Contenido de la pestaña */}
        <div style={{ marginTop: 12 }}>
          {grupoTab === "todos" ? (
            player.fase_grupos.map((m, i) => {
              const r = real[m.partido];
              const s = r ? scoreMatch(m.pred, r, GRUPO_PTS) : null;
              return (
                <MatchRow key={i} local={m.local} visitante={m.visitante} pred={m.pred}
                  hit={s ? s.hit as Hit : null}
                  pts={s ? s.pts : null}
                />
              );
            })
          ) : (
            <GroupView
              grupo={grupoTab}
              player={player}
              clasificados={clasificados}
              equipoGrupo={equipoGrupo}
              real={real}
            />
          )}
        </div>
        </div>}
      </div>

      {/* ── FASE FINAL ── */}
      <div style={{ marginTop: 6, marginBottom: 16 }}>
        <SectionToggle label="Fase Final" open={openSections.has("final")} onToggle={() => toggleSection("final")} />
        {openSections.has("final") && <div style={{ marginTop: 12 }}>

        {/* Pestañas de ronda */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
          {KO_RONDAS.map(({ key, short }) => {
            const active = rondaTab === key;
            return (
              <button
                key={key}
                onClick={() => setRondaTab(key)}
                style={{
                  padding: "5px 11px", borderRadius: 20,
                  border: `1px solid ${active ? C.ink : C.line}`,
                  background: active ? C.ink : "transparent",
                  color: active ? C.chalk : C.muted,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                {short}
              </button>
            );
          })}
        </div>

        {/* Partidos de la ronda seleccionada */}
        {(() => {
          const matches = (player as unknown as Record<string, Match[]>)[`enfr_${rondaTab}`];
          const ronda = KO_RONDAS.find((r) => r.key === rondaTab);
          return (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: ".06em",
                textTransform: "uppercase", color: C.muted, marginBottom: 6,
              }}>
                {ronda?.label}
              </div>
              {matches?.length
                ? matches.map((m, i) => (
                    <MatchRow key={i} local={m.local} visitante={m.visitante} pred={m.pred} />
                  ))
                : <p style={{ color: C.muted, fontSize: 13 }}>Sin partidos</p>}
            </div>
          );
        })()}
        </div>}
      </div>
    </div>
  );
}
