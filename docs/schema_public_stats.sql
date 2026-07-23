-- Universal Fit v2.25.12
-- Contadores configurables para la animacion de apertura.

insert into public.v1_settings(key, val, updated_at)
values
  (
    'public_professors',
    to_jsonb((select count(*)::int from public.v1_accounts where kind = 'pt')),
    now()
  ),
  (
    'public_students',
    to_jsonb((select count(*)::int from public.v1_students)),
    now()
  )
on conflict (key) do nothing;

create or replace function public.v1_public_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'professors', coalesce(
      (select greatest(0, least(999999, (val #>> '{}')::int))
       from public.v1_settings where key = 'public_professors'),
      0
    ),
    'students', coalesce(
      (select greatest(0, least(999999, (val #>> '{}')::int))
       from public.v1_settings where key = 'public_students'),
      0
    )
  );
$$;

create or replace function public.admin_set_public_stats(
  p_professors int,
  p_students int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professors int := greatest(0, least(999999, coalesce(p_professors, 0)));
  v_students int := greatest(0, least(999999, coalesce(p_students, 0)));
begin
  if not public.admin_check() then
    return jsonb_build_object('ok', false, 'error', 'no_autorizado');
  end if;

  insert into public.v1_settings(key, val, updated_at)
  values
    ('public_professors', to_jsonb(v_professors), now()),
    ('public_students', to_jsonb(v_students), now())
  on conflict (key) do update
    set val = excluded.val,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'professors', v_professors,
    'students', v_students
  );
end;
$$;

revoke all on function public.v1_public_stats() from public;
grant execute on function public.v1_public_stats() to anon, authenticated;

revoke all on function public.admin_set_public_stats(int, int) from public;
grant execute on function public.admin_set_public_stats(int, int) to authenticated;
