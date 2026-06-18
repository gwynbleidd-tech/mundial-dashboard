"use client";

import { useState, useEffect } from "react";
import { CLIPETO_FRASES } from "@/lib/clipeto-frases";
import { C } from "@/lib/theme";

const SHOW_PROBABILITY = 0.3;

export default function ClipetoToast() {
  const [show, setShow] = useState(false);
  const [frase, setFrase] = useState("");
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Runs client-only, after hydration — avoids SSR/client mismatch
    if (Math.random() < SHOW_PROBABILITY) {
      setFrase(CLIPETO_FRASES[Math.floor(Math.random() * CLIPETO_FRASES.length)]);
      setShow(true);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [show]);

  if (!show || dismissed) return null;

  function dismiss() {
    setVisible(false);
    setTimeout(() => setDismissed(true), 260);
  }

  return (
    <>
      {/* Backdrop — tap anywhere outside to close */}
      <div
        onClick={dismiss}
        style={{ position: "fixed", inset: 0, zIndex: 300 }}
      />

      {/* Toast */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(52px + env(safe-area-inset-bottom) + 16px)",
          left: "50%",
          width: "calc(100% - 32px)",
          maxWidth: 428,
          zIndex: 301,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(10px)",
          transition: "opacity .25s ease, transform .25s ease",
          background: C.chalk,
          border: `1px solid ${C.line}`,
          borderRadius: 12,
          padding: "12px 14px",
          boxShadow: "0 4px 20px rgba(0,0,0,.13)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/clipeto/clipeto.svg"
          alt="Clipeto"
          style={{ height: 34, width: "auto", flexShrink: 0, marginTop: 1 }}
        />
        <p style={{
          flex: 1, margin: 0,
          fontSize: 13, color: C.ink, lineHeight: 1.45,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          {frase}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          style={{
            flexShrink: 0,
            width: 22, height: 22,
            border: `1px solid ${C.line}`,
            borderRadius: "50%",
            background: "transparent",
            color: C.muted,
            fontSize: 15, lineHeight: 1,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
    </>
  );
}
