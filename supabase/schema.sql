-- ============================================================
-- Porra Mundial 2026 — esquema de Supabase
-- Pega esto en el SQL Editor de tu proyecto Supabase y ejecútalo.
-- ============================================================

-- Tabla única: resultados reales de los partidos.
-- Las predicciones NO van aquí (son estáticas, viven en data/predictions.json).
create table if not exists public.resultados (
  partido      text primary key,          -- ej. "México-Sudáfrica" (debe coincidir EXACTO con el label del JSON)
  fase         text not null,             -- 'grupos' | 'dieciseisavos' | 'octavos' | 'cuartos' | 'semis' | '3y4' | 'final'
  local        smallint,                  -- goles equipo local (null = aún no jugado)
  visitante    smallint,                  -- goles equipo visitante
  updated_at   timestamptz not null default now()
);

-- Tabla opcional para el cuadro de honor real (campeón, botas, balones, posiciones de grupo).
-- Clave-valor simple para no multiplicar tablas.
create table if not exists public.resultados_extra (
  clave        text primary key,          -- ej. 'campeon', 'bota_oro', '1_GRUPO_A', 'clasif_octavos'
  valor        text,                      -- nombre de equipo o jugador; para listas, JSON serializado
  updated_at   timestamptz not null default now()
);

-- Trigger para mantener updated_at al día
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_resultados_touch on public.resultados;
create trigger trg_resultados_touch before update on public.resultados
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_extra_touch on public.resultados_extra;
create trigger trg_extra_touch before update on public.resultados_extra
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Row Level Security
-- Lectura: pública (cualquiera ve los resultados).
-- Escritura: la hace el cliente con la anon key, pero la pantalla Admin
--            está protegida por una clave en variable de entorno (ver README).
--            Para una porra entre amigos esto es suficiente.
-- ============================================================

alter table public.resultados        enable row level security;
alter table public.resultados_extra  enable row level security;

-- Todos pueden leer
create policy "lectura publica resultados"
  on public.resultados for select using (true);
create policy "lectura publica extra"
  on public.resultados_extra for select using (true);

-- Escritura abierta a la anon key (la verja real es la clave del Admin en el cliente).
-- Si algún día migras a Supabase Auth (magic-link), cambia 'true' por 'auth.role() = 'authenticated''.
create policy "escritura resultados"
  on public.resultados for all using (true) with check (true);
create policy "escritura extra"
  on public.resultados_extra for all using (true) with check (true);

-- ============================================================
-- (Opcional) Semilla: precarga los 72 partidos de grupos vacíos
-- para que aparezcan en la pantalla Admin desde el principio.
-- Mejor que lo genere la app leyendo el JSON; aquí solo un ejemplo.
-- ============================================================
-- insert into public.resultados (partido, fase) values
--   ('México-Sudáfrica', 'grupos'),
--   ('Corea del Sur-República Checa', 'grupos')
-- on conflict (partido) do nothing;
