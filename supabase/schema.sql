-- ============================================================================
-- Techni-Pac — Script de création de la base de données Supabase
-- À exécuter une seule fois dans : Supabase → SQL Editor → New query → Run
-- ============================================================================

-- Chaque table stocke ses enregistrements sous la forme id + data (JSON),
-- ce qui correspond exactement à la structure utilisée par l'application.

create table if not exists clients (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists planning (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists devis_a_faire (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists devis_en_cours (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists facturation (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  id smallint primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Met à jour automatiquement updated_at à chaque modification d'une ligne.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array['clients','reports','planning','devis_a_faire','devis_en_cours','facturation','settings']
  loop
    execute format('drop trigger if exists set_updated_at on %I;', t);
    execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
-- Sécurité (RLS) : seules les personnes connectées (vous et votre secrétaire,
-- comptes créés dans Authentication → Users) peuvent lire et modifier les
-- données. Personne d'autre ne peut y accéder, même en connaissant l'adresse
-- du site.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['clients','reports','planning','devis_a_faire','devis_en_cours','facturation','settings']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "authenticated_full_access" on %I;', t);
    execute format(
      'create policy "authenticated_full_access" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- Active la réplication en temps réel (pour que tous les appareils connectés
-- voient les changements des autres instantanément).
-- ============================================================================

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table clients';
  exception when others then null; end;
  begin
    execute 'alter publication supabase_realtime add table reports';
  exception when others then null; end;
  begin
    execute 'alter publication supabase_realtime add table planning';
  exception when others then null; end;
  begin
    execute 'alter publication supabase_realtime add table devis_a_faire';
  exception when others then null; end;
  begin
    execute 'alter publication supabase_realtime add table devis_en_cours';
  exception when others then null; end;
  begin
    execute 'alter publication supabase_realtime add table facturation';
  exception when others then null; end;
  begin
    execute 'alter publication supabase_realtime add table settings';
  exception when others then null; end;
end $$;
