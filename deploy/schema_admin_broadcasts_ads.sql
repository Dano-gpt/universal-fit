-- Universal Fit v2.29.1
-- Avisos generales de Administracion y cancelacion auditable de publicidad.
-- Ejecutar en Supabase SQL Editor al aprobar esta version candidata.

alter table public.v1_ads
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_reason text;

create table if not exists public.v1_admin_broadcasts (
  id bigserial primary key,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1000),
  audience text not null default 'all' check (audience in ('pt', 'al', 'all')),
  active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

alter table public.v1_admin_broadcasts enable row level security;
alter table public.v1_admin_broadcasts
  add column if not exists audience text not null default 'all';

create or replace function public.v1_active_ads()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'ads', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'texto', a.texto,
          'url', a.url,
          'color', a.color,
          'until', a.until
        ) order by a.id desc)
        from public.v1_ads a
        where a.active = true
          and a.cancelled_at is null
          and (a.until is null or a.until > now())
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.admin_list_ads_v229()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_check() then
    return jsonb_build_object('ok', false, 'error', 'no_autorizado');
  end if;

  return jsonb_build_object(
    'ok', true,
    'ads', coalesce(
      (select jsonb_agg(to_jsonb(a) order by a.id desc) from public.v1_ads a),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.admin_cancel_ad(p_id bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := left(trim(coalesce(p_reason, '')), 500);
begin
  if not public.admin_check() then
    return jsonb_build_object('ok', false, 'error', 'no_autorizado');
  end if;
  if v_reason = '' then
    return jsonb_build_object('ok', false, 'error', 'motivo_requerido');
  end if;

  update public.v1_ads
     set active = false,
         cancelled_at = now(),
         cancelled_reason = v_reason
   where id = p_id
     and cancelled_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.v1_active_admin_broadcasts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', auth.uid() is not null,
    'broadcasts', case when auth.uid() is null then '[]'::jsonb else coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'title', b.title,
        'body', b.body,
        'created_at', b.created_at
      ) order by b.id desc)
       from (
         select * from public.v1_admin_broadcasts
          where active = true
            and (audience = 'all' or audience = case when exists (select 1 from public.v1_accounts a where a.id = auth.uid() and a.kind = 'pt') then 'pt' else 'al' end)
          order by id desc limit 5
       ) b),
      '[]'::jsonb
    ) end
  );
$$;

drop function if exists public.admin_create_broadcast(text, text);

create or replace function public.admin_create_broadcast(p_title text, p_body text, p_audience text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := left(trim(coalesce(p_title, '')), 120);
  v_body text := left(trim(coalesce(p_body, '')), 1000);
  v_audience text := lower(trim(coalesce(p_audience, 'all')));
  v_id bigint;
  v_recipients jsonb;
begin
  if not public.admin_check() then
    return jsonb_build_object('ok', false, 'error', 'no_autorizado');
  end if;
  if v_title = '' or v_body = '' then
    return jsonb_build_object('ok', false, 'error', 'mensaje_requerido');
  end if;
  if v_audience not in ('pt', 'al', 'all') then
    return jsonb_build_object('ok', false, 'error', 'destinatario_invalido');
  end if;

  insert into public.v1_admin_broadcasts(title, body, audience, created_by)
  values(v_title, v_body, v_audience, auth.uid())
  returning id into v_id;

  select coalesce(jsonb_agg(uid), '[]'::jsonb) into v_recipients
  from (
    select id as uid from public.v1_accounts where kind = 'pt' and v_audience in ('pt', 'all')
    union
    select user_uid as uid from public.v1_students where user_uid is not null and v_audience in ('al', 'all')
  ) recipients;

  return jsonb_build_object('ok', true, 'id', v_id, 'audience', v_audience, 'recipients', v_recipients);
end;
$$;

create or replace function public.admin_list_broadcasts(p_limit int default 12)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_check() then
    return jsonb_build_object('ok', false, 'error', 'no_autorizado');
  end if;
  return jsonb_build_object(
    'ok', true,
    'broadcasts', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'body', body,
        'audience', audience,
        'active', active,
        'created_at', created_at
      ) order by id desc)
       from (select * from public.v1_admin_broadcasts order by id desc limit greatest(1, least(coalesce(p_limit, 12), 50))) b),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.v1_active_ads() from public;
revoke all on function public.v1_active_admin_broadcasts() from public;
grant execute on function public.v1_active_ads() to anon, authenticated;
grant execute on function public.v1_active_admin_broadcasts() to authenticated;
grant execute on function public.admin_list_ads_v229() to authenticated;
grant execute on function public.admin_cancel_ad(bigint, text) to authenticated;
grant execute on function public.admin_create_broadcast(text, text, text) to authenticated;
grant execute on function public.admin_list_broadcasts(int) to authenticated;
