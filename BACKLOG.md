# Backlog — Porra Mundial 2026

Hoja de ruta por fases. Convención de tipo:
- 🎨 **visual** — solo presentación, usa datos que ya existen (predictions.json o scoring.ts). Bajo riesgo.
- 🗄️ **datos** — necesita un campo/tabla nuevo o capturar información que aún no se guarda.
- ⚙️ **lógica** — toca el motor de puntuación o introduce backend nuevo.

---

## v1.1 — Pulido visual

### Pantalla "Clasificación"
- 🎨 Mostrar aciertos como ratios: **"X/N 1X2"** y **"Y/N resultado exacto"**, donde N = partidos jugados.
  - ⚠️ **Importante:** "1X2 acertados" incluye TAMBIÉN los exactos (criterio del grupo).
    En `lib/scoring.ts`, `signos` y `exactos` son **excluyentes** (un exacto no suma a `signos`).
    Por tanto el número a mostrar como "1X2" es `signos + exactos`, NO `signos`.
    El de "resultado exacto" es `exactos`. N = `partidosJugados`. Todo ya en el `Breakdown`.
- 🎨 Resaltar podio: medalla/balón de oro (1º), plata (2º), bronce (3º).
- 🎨 Marcar al último: farolillo rojo / balón de playa.
  - ⚠️ No mostrar el farolillo mientras todos van a 0 puntos (arranque del torneo): sería arbitrario.
    Activarlo solo cuando haya diferenciación real (p.ej. ≥1 partido jugado / puntos > 0).

### Pantalla "Por día"
- 🎨 Selector de día directo (date-picker o lista de días), además de las flechas ←/→.
- 🎨 Código de color por predicción de cada jugador: **rojo** = fallo, **naranja** = acierto 1X2 sin
  exacto, **verde** = resultado exacto. (Lo da `scoreMatch().hit`.)
- 🎨 Cada partido como **desplegable**: al abrir, una línea por jugador con su predicción.
- 🎨 A la derecha de cada predicción, los **puntos ganados** en ese partido.
  - ⚠️ Revisar `lib/scoring.ts`: `scorePlayer` suma totales pero puede no exponer el desglose
    partido-a-partido. Quizá haya que añadir un helper que devuelva, por partido, {pts, hit}.
    `scoreMatch` ya calcula ambos; solo hay que exponerlo.
- 🗄️ **Links de YouTube** (resúmenes) por partido en la vista "Por día".
  - Necesita un sitio donde guardar el enlace por partido. Opciones: campo nuevo en la tabla
    `resultados` de Supabase (ej. `youtube_url`), editable desde el Admin. Es el único punto
    de este bloque que NO es puramente visual.

### Pantalla "Jugador"
> Todo este bloque muestra la **predicción del jugador**, NO el resultado real. Sale de
> `predictions.json`, es puramente visual y no depende de la Fase 2 del Admin.
- 🎨 Cuadro de honor completo del jugador (campeón, subcampeón, 3º, botas oro/plata/bronce,
  balones oro/plata/bronce). Datos en `cuadro_honor`.
- 🎨 Rediseño de fase de grupos: barra lateral con los 12 grupos; al seleccionar uno, mostrar
  la **clasificación de grupo PREDICHA por el jugador** (de `posicion_grupos`), con los equipos
  que ESE jugador predice que pasan de ronda resaltados en verde, y debajo los resultados que
  predijo para cada partido del grupo (de `fase_grupos`).
- 🎨 Visualización de los **cruces predichos** por el jugador (de `enfr_dieciseisavos` … `enfr_final`).

### Transversal (v1.1)
- 🎨 **Cierre de predicciones / integridad:** mostrar visiblemente "Predicciones cerradas el [fecha]".
  Refuerza la confianza; las predicciones ya son inmutables (estáticas en Git).
- 🎨 **Estado "en directo" / pendiente:** usando la hora de inicio (`kickoff`), marcar visualmente
  los partidos que están por jugarse / jugándose / pendientes de resultado.

---

## v1.5 — Fase 2 del Admin (resultados extra)  ⚠️ IMPRESCINDIBLE antes de eliminatorias

Sin esto, la puntuación final es INCORRECTA: campeón (50 pts), botas, balones, posiciones de
grupo y clasificados por ronda salen a 0 para todos. El motor (`scoring.ts`) ya lo calcula;
falta capturar los datos reales.

- 🗄️ Sección en el Admin para introducir el **cuadro de honor real** (campeón, subcampeón, 3º,
  botas, balones) → tabla `resultados_extra`, claves: `campeon`, `subcampeon`, `tercero`,
  `bota_oro`…`balon_bronce`.
- 🗄️ Introducir **posiciones reales de cada grupo** → claves tipo `1_GRUPO_A`, `2_GRUPO_A`…
- 🗄️ Introducir **clasificados reales por ronda** → claves `clasif_dieciseisavos`…`clasif_final`
  (listas, guardadas como JSON serializado, ver `lib/supabase.ts`).

---

## v2.0 — Funcionalidades nuevas

- 🗄️⚙️ **API de resultados de partidos.** Automatizar el rellenado de la tabla `resultados`.
  - Requiere tabla de mapeo de nombres (ES ↔ nombre de la API: "Países Bajos" ↔ "Netherlands").
  - Conservar el Admin manual como respaldo (límites de cuota / latencia de las APIs gratuitas).
- 🗄️ **Incluir los cruces (eliminatorias) en todas las pantallas**, no solo grupos.
  - Depende de tener clasificados reales (v1.5) y de fechas de eliminatoria (vía API).
- 📊 **Gráfica de evolución de la puntuación.**
  - Decisión tomada: el eje temporal usa la **fecha del partido**, no la fecha de introducción
    del resultado (hace la gráfica determinista y reconstruible).
  - Alternativa de diseño a valorar: evolución **por partido** en vez de por día.
- 🎨 **Compartir clasificación:** botón que genera imagen/texto del ranking para pegar en el grupo.
  (Encaja con la dimensión social mejor que un foro y cuesta mucho menos.)
- 🔔 **Notificaciones** al actualizar resultados.
- 🎨 **Mejora general de UX/UI** para un acabado más elegante.

---

## Aparcado / a valorar

- 💬 **Foro con comentarios e imágenes.** Más complejo de lo que parece: requiere identidad de
  usuario (hoy no hay login), almacenamiento de imágenes y moderación mínima. Valorar si el
  grupo de WhatsApp ya cubre esta necesidad antes de mantener algo así.

---

## Notas de arquitectura para no perder

- **Predicciones**: estáticas e inmutables (`data/predictions.json`), histórico en Git.
- **Resultados reales**: Supabase (`resultados` + `resultados_extra`). `updated_at` ya se guarda.
- **Puntuación**: `lib/scoring.ts`, 40 reglas, en el cliente. Fuente de verdad de los puntos.
- **Horarios de grupos**: `data/horarios_grupos.json` (hora peninsular española).
- Para "1X2 acertados" recordar: `signos + exactos` (son excluyentes en el Breakdown).
