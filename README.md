# Porra Mundial 2026

Dashboard para visualizar las predicciones de 8 jugadores sobre el Mundial 2026,
calcular puntos según las reglas de la porra y mostrar la clasificación en vivo.

Proyecto casero. Prioridad: rapidez y sencillez.

## Stack

- **Next.js** (App Router) — desplegado en **Vercel**.
- **Predicciones**: estáticas en `data/predictions.json` (no cambian nunca).
- **Resultados reales**: tabla en **Supabase**, editables desde la pantalla Admin.
- **Puntuación**: motor en el cliente (`lib/scoring.ts`), 40 reglas, recalcula al vuelo.
- **PWA**: manifest + service worker (fase final).

## Flujo de datos

```
predictions.json (estático) ─┐
                             ├─► lib/scoring.ts (navegador) ─► clasificación / fichas / por jornada
Supabase (resultados) ───────┘
                             ▲
                        pantalla Admin (protegida por NEXT_PUBLIC_ADMIN_KEY)
```

## Puesta en marcha

1. **Crea el proyecto en Supabase** (lo haces tú; este kit no toca credenciales).
   - Panel de Supabase → New project.
   - Cuando esté listo: SQL Editor → pega y ejecuta `supabase/schema.sql`.
   - Project Settings → API → copia `Project URL` y `anon public key`.

2. **Variables de entorno.**
   - `cp .env.local.example .env.local` y rellena los tres valores.
   - En Vercel, añade esas mismas tres variables en Project Settings → Environment Variables.

3. **Instala y arranca.**
   ```bash
   npm install
   npm run dev
   ```

4. **Despliega.** Conecta el repo de GitHub a Vercel. Cada push despliega solo.

## Qué construir (para Claude Code)

El prototipo validado (`PorraMundial2026.jsx`) define el diseño y las 4 pantallas.
Replícalo en Next.js con datos reales:

- **Clasificación** — ranking por `standings()` de `lib/scoring.ts`, barras proporcionales.
- **Por jornada** — partidos de J1/J2/J3 con la predicción de los 8 jugadores lado a lado.
- **Jugador** — cuadro de honor + quiniela con puntos por partido.
- **Admin** — formulario que escribe en Supabase vía `setResultado()`, protegido por
  `NEXT_PUBLIC_ADMIN_KEY` (input de clave que desbloquea la pantalla).

Datos: importa `data/predictions.json` directamente (es estático). Resultados:
`fetchResultados()` y `fetchExtra()` de `lib/supabase.ts`.

### Diferencias del prototipo respecto a V1 real

- El prototipo solo puntúa fase de grupos. `lib/scoring.ts` ya cubre **las 40 reglas**
  (grupos, posiciones, clasificados, eliminatorias, cuadro de honor). Úsalo tal cual.
- El prototipo trae resultados simulados; aquí vienen de Supabase.
- Las posiciones de grupo, clasificados por ronda y cuadro de honor reales se guardan
  en la tabla `resultados_extra` y la pantalla Admin debe permitir editarlos (fase 2 del Admin).

## Archivos de este kit

```
data/
  predictions.json     ← 8 jugadores, predicciones completas + reglas de puntuación
  scoring-rules.md     ← las 40 reglas en formato legible
lib/
  scoring.ts           ← motor de puntuación (40 reglas)
  supabase.ts          ← cliente + helpers de lectura/escritura
supabase/
  schema.sql           ← tabla + RLS, para pegar en Supabase
.env.local.example     ← plantilla de variables
```

## Nota de seguridad

`NEXT_PUBLIC_ADMIN_KEY` es visible en el cliente (cualquiera con las DevTools puede
verla). Protege de "trasteo accidental", no de un ataque. Para una porra entre amigos
basta. Si quieres cerrarlo de verdad: migra a Supabase Auth (magic-link) y cambia la
política RLS de escritura a `auth.role() = 'authenticated'`. Son ~15 min.

## Resultados reales por API (futuro, V2)

No incluido en V1 a propósito: las APIs de fútbol usan nombres de equipo distintos a
los del JSON en español ("Países Bajos" vs "Netherlands"), así que requiere una tabla
de mapeo. Cuando se quiera, se añade un cron que rellene la tabla `resultados`.
