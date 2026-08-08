create table if not exists public.admin_impersonation_log (
  id bigserial primary key,
  admin_uid uuid not null,
  target_uid uuid not null,
  target_kind text not null check (target_kind in ('pt','al')),
  target_email text,
  started_at timestamptz not null default now()
  );

alter table public.admin_impersonation_log enable row level security;

drop policy if exists admin_impersonation_log_select on public.admin_impersonation_log;
create policy admin_impersonation_log_select on public.admin_impersonation_log
for select using (auth.uid() = 'ac05eb3e-5679-4ac2-9dae-3c54fac2cdf6'::uuid);

create or replace function public.admin_list_impersonations(p_limit int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rows jsonb;
begin
if auth.uid() <> 'ac05eb3e-5679-4ac2-9dae-3c54fac2cdf6'::uuid then
return jsonb_build_object('ok', false, 'error', 'not_admin');
end if;
select coalesce(jsonb_agg(t), '[]'::jsonb) into v_rows from (
  select target_email, target_kind, started_at from public.admin_impersonation_log
  order by started_at desc limit greatest(1, least(p_limit, 200))
  ) t;
return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;

grant execute on function public.admin_list_impersonations(int) to authenticated;
