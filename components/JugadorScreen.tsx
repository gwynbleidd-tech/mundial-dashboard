import type { Player, RealResults, RealExtra, Pred, RealScore } from "@/lib/scoring";
import { scorePlayer } from "@/lib/scoring";
import { C } from "@/lib/theme";

// ---- helpers de visualización ----

const TONES = {
  exacto: { bg: "#E6F0E9", fg: "#1B5E3A" },
  signo:  { bg: "#F6EFD6", fg: "#C8A23A" },
  fallo:  { bg: "#F5E6E6", fg: "#C0392B" },
  pend:   { bg: "transparent", fg: C.muted },
} as const;
type Tone = keyof typeof TONES;

function Pill({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  const t = TONES[tone];
  return (
    <span style={{
      background: t.bg, color: t.fg, fontSize: 10, fontWeight: 700,
      padding: "2px 7px", borderRadius: 10, display: "inline-block",
      border: tone === "pend" ? `1px dashed ${C.line}` : "none",
    }}>
      {children}
    </span>
  );
}

function Score({ a, b }: { a: number; b: number }) {
  return (
    <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
      {a}<span style={{ color: C.muted, margin: "0 3px" }}>–</span>{b}
    </span>
  );
}

function HonorCard({ label, val, big }: { label: string; val: string | null | undefined; big?: boolean }) {
  return (
    <div style={{
      flex: big ? "1 1 140px" : "1 1 90px",
      border: `1px solid ${C.line}`, borderRadius: 3, padding: "8px 10px",
      background: big ? C.ink : "transparent",
    }}>
      <div style={{
        fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase",
        color: big ? C.gold : C.muted, fontWeight: 700,
      }}>{label}</div>
      <div style={{
        fontSize: big ? 16 : 13, fontWeight: 700, marginTop: 2,
        color: big ? C.chalk : C.ink,
      }}>{val || "—"}</div>
    </div>
  );
}

// Puntuación de un partido de grupos: baremo [signo=2, diferencia=1, exacto=3]
function scoreGrupo(pred: Pred, real: RealScore): { pts: number; hit: "exacto" | "signo" | "fallo" } {
  const sign = (l: number, v: number) => l > v ? "1" : l < v ? "2" : "X";
  if (sign(pred.local, pred.visitante) !== sign(real.local, real.visitante)) {
    return { pts: 0, hit: "fallo" };
  }
  let pts = 2;
  if (pred.local - pred.visitante === real.local - real.visitante) pts++;
  if (pred.local === real.local && pred.visitante === real.visitante) pts += 3;
  const hit = pred.local === real.local && pred.visitante === real.visitante
    ? "exacto" : "signo";
  return { pts, hit };
}

const hStyle: React.CSSProperties = {
  fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 22,
  color: C.ink, margin: 0, letterSpacing: ".01em", textTransform: "uppercase",
};

// ---- componente principal ----

interface Props {
  players: Player[];
  picked: string;
  onPick: (id: string) => void;
  real: RealResults;
  extra: RealExtra;
}

export default function JugadorScreen({ players, picked, onPick, real, extra }: Props) {
  const player = players.find((p) => p.id === picked) ?? players[0];
  if (!player) return null;

  const score = scorePlayer(player, real, extra);
  const h = player.cuadro_honor;

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

      {/* Cabecera del jugador */}
      <h2 style={hStyle}>{player.nombre}</h2>
      <p style={{ color: C.muted, fontSize: 12.5, margin: "5px 0 0", letterSpacing: ".02em" }}>
        {score.total} pts · {score.exactos} exactos · {score.signos} signos
      </p>

      {/* Cuadro de honor */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <HonorCard label="Campeón" val={h.campeon} big />
        <HonorCard label="Subcampeón" val={h.subcampeon} />
        <HonorCard label="3º" val={h.tercero} />
        <HonorCard label="Bota de oro" val={h.bota_oro} />
        <HonorCard label="Balón de oro" val={h.balon_oro} />
      </div>

      {/* Quiniela - fase de grupos */}
      <h3 style={{ ...hStyle, fontSize: 15, marginTop: 26 }}>
        Quiniela · fase de grupos
      </h3>
      <div style={{ marginTop: 10 }}>
        {player.fase_grupos.map((m, i) => {
          const r = real[m.partido];
          const s = r ? scoreGrupo(m.pred, r) : null;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 4px", borderBottom: `1px solid ${C.line}`, fontSize: 13.5,
            }}>
              <span style={{ flex: 1, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.local} <span style={{ color: C.muted }}>v</span> {m.visitante}
              </span>
              <span style={{ width: 52, textAlign: "center", color: C.muted, flexShrink: 0 }}>
                <Score a={m.pred.local} b={m.pred.visitante} />
              </span>
              <span style={{ width: 52, textAlign: "center", flexShrink: 0 }}>
                {r
                  ? <Score a={r.local} b={r.visitante} />
                  : <span style={{ color: C.line }}>· – ·</span>}
              </span>
              <span style={{ width: 64, textAlign: "right", flexShrink: 0 }}>
                {s
                  ? <Pill tone={s.hit}>{s.pts > 0 ? `+${s.pts}` : "0"}</Pill>
                  : <Pill tone="pend">—</Pill>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
