import type { Player, Breakdown } from "@/lib/scoring";
import { C } from "@/lib/theme";

interface RankedEntry {
  player: Player;
  score: Breakdown;
}

interface Props {
  ranked: RankedEntry[];
  loading: boolean;
  onPick: (id: string) => void;
}

const PODIO = ["🥇", "🥈", "🥉"];

export default function ClasificacionScreen({ ranked, loading, onPick }: Props) {
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: C.muted }}>
        Cargando…
      </div>
    );
  }

  const maxPts = ranked.length > 0 ? ranked[0].score.total : 0;
  const anyPlayed = ranked.some(r => r.score.partidosJugados > 0);
  const lastIdx = ranked.length - 1;
  const showLantern = anyPlayed && ranked.length > 1 && ranked[lastIdx].score.total < ranked[0].score.total;

  return (
    <div>
      {maxPts === 0 && (
        <p style={{
          fontSize: 12, color: C.muted, textAlign: "center",
          marginBottom: 16, letterSpacing: ".03em",
        }}>
          Torneo aún no empezado · todos a 0 pts
        </p>
      )}
      {ranked.map((r, i) => {
        const n = r.score.partidosJugados;
        const signos1x2 = r.score.signos + r.score.exactos;
        const badge = anyPlayed && i < 3 ? PODIO[i] : (showLantern && i === lastIdx ? "🏮" : null);

        return (
          <button
            key={r.player.id}
            onClick={() => onPick(r.player.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 4px",
              borderTop: "none", borderLeft: "none", borderRight: "none",
              borderBottom: `1px solid ${C.line}`,
              background: "none", cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ width: 34, flexShrink: 0, textAlign: "center" }}>
              {badge ? (
                <div style={{ fontSize: 26, lineHeight: 1 }}>{badge}</div>
              ) : (
                <div style={{
                  fontFamily: "'Anton', sans-serif", fontSize: 26,
                  color: C.muted, lineHeight: 1,
                }}>
                  {i + 1}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.ink }}>
                {r.player.nombre}
              </div>
              <div style={{ height: 6, background: C.chalk, borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: maxPts > 0 ? `${(r.score.total / maxPts) * 100}%` : "0%",
                  background: i === 0 ? C.gold : C.pitch,
                  borderRadius: 3,
                  transition: "width .4s ease",
                }} />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, color: C.ink, lineHeight: 1 }}>
                {r.score.total}
              </div>
              {n > 0 && (
                <>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: ".01em", marginTop: 2 }}>
                    {signos1x2}/{n} 1X2
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: C.muted, letterSpacing: ".01em" }}>
                    {r.score.exactos}/{n} exactos
                  </div>
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
