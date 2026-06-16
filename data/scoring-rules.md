# Reglas de puntuación — Mundial 2026

Extraídas de `ADMIN!D8:D47` del Excel de administrador. Estas son las 40 reglas
oficiales de la porra. El motor de puntuación (`lib/scoring.ts`) debe implementarlas
exactamente con estos valores.

> Los puntos viven en `data/predictions.json` bajo la clave `scoring`, así que la
> fuente de verdad es el JSON; esta tabla es la referencia legible para humanos.

## Fase de grupos (por partido)

| Regla | Puntos |
|---|---|
| Signo 1X2 acertado (local / empate / visitante) | 2 |
| Diferencia/distancia de goles acertada (requiere signo correcto) | +1 |
| Resultado exacto (requiere signo correcto) | +3 |

Los tres son acumulables sobre un mismo partido: signo + diferencia + exacto = hasta 6 pts.
El bonus de diferencia y el de exacto **solo** se conceden si el signo es correcto.

## Posición final en el grupo (por equipo, por puesto)

| Regla | Puntos |
|---|---|
| Posición exacta 1º del grupo | 5 |
| Posición exacta 2º del grupo | 5 |
| Posición exacta 3º del grupo | 5 |
| Posición exacta 4º del grupo | 5 |

## Eliminatorias — clasificación de equipos a cada ronda

| Regla | Puntos |
|---|---|
| Equipo clasificado para dieciseisavos | 3 |
| Equipo clasificado para octavos | 10 |
| Equipo clasificado para cuartos | 15 |
| Equipo clasificado para semifinales | 20 |
| Equipo clasificado para 3º y 4º puesto | 15 |
| Equipo clasificado para la final | 25 |

Se concede por cada equipo acertado que efectivamente alcance esa ronda,
con independencia del cruce concreto.

## Eliminatorias — pronóstico de cada cruce (signo / diferencia / exacto)

| Ronda | Signo | Diferencia | Exacto |
|---|---|---|---|
| Dieciseisavos | 3 | +2 | +5 |
| Octavos | 3 | +2 | +5 |
| Cuartos | 4 | +2 | +6 |
| Semifinales | 6 | +4 | +10 |
| 3º y 4º puesto | 10 | +5 | +15 |
| Final | 12 | +6 | +18 |

Misma mecánica que en grupos: diferencia y exacto requieren signo correcto.
En eliminatorias, el "signo" se evalúa sobre el resultado de los 90/120 min según
como se registre el resultado real (a confirmar al cargar resultados de eliminatoria).

## Cuadro de honor

| Regla | Puntos |
|---|---|
| Campeón | 50 |
| Subcampeón | 40 |
| 3º puesto | 30 |
| Bota de Oro (máximo goleador) | 30 |
| Bota de Plata (2º goleador) | 20 |
| Bota de Bronce (3º goleador) | 10 |
| Balón de Oro (mejor jugador) | 30 |
| Balón de Plata (2º mejor jugador) | 20 |
| Balón de Bronce (3º mejor jugador) | 10 |

## Nota sobre el ajuste por desvío (`**`)

El Excel contempla un "% de ajuste por desvío en diferencia/distancia de goles"
(celda `ADMIN!D49`), pero en los ficheros entregados está **sin configurar (vacío)**.
Por tanto el bonus de diferencia funciona como un valor plano (todo o nada), que es
como lo implementa el prototipo. Si en el futuro se quiere activar el ajuste
proporcional, este es el único punto del motor que habría que tocar.
