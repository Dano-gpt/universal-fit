-- Candidata v2.29.5. Ejecutar SOLAMENTE al aprobar el despliegue.
-- Las reservas pertenecen a Universal Fit, no al sistema oficial del gimnasio.
create table if not exists public.v1_gyms (
 id text primary key, name text not null, theme jsonb not null, active boolean not null default true
);
insert into public.v1_gyms(id,name,theme) values ('sportclub','SportClub','{"accent":"#FFD300","bg":"#18191E","card":"#202128","ink":"#FFFFFF","font":"Arial, Helvetica, sans-serif"}')
on conflict(id) do update set name=excluded.name,theme=excluded.theme;
create table if not exists public.v1_gym_branches (
 gym_id text references public.v1_gyms(id), id text, name text not null, details jsonb not null,
 active boolean not null default true, primary key(gym_id,id)
);
create table if not exists public.v1_gym_staff (
 user_uid uuid references auth.users(id) on delete cascade, gym_id text references public.v1_gyms(id),
 branch_id text, active boolean not null default true, primary key(user_uid,gym_id)
);
alter table public.v1_gyms enable row level security;
alter table public.v1_gym_branches enable row level security;
alter table public.v1_gym_staff enable row level security;
drop policy if exists gym_catalog_public on public.v1_gyms;
create policy gym_catalog_public on public.v1_gyms for select to anon,authenticated using(active);
drop policy if exists gym_branches_public on public.v1_gym_branches;
create policy gym_branches_public on public.v1_gym_branches for select to anon,authenticated using(active);
drop policy if exists gym_staff_self on public.v1_gym_staff;
create policy gym_staff_self on public.v1_gym_staff for select to authenticated using(user_uid=auth.uid());

create or replace function public.admin_sync_gym_catalog(p_catalog jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare b jsonb; n int:=0;
begin
 if not public.admin_check() then raise exception 'No autorizado'; end if;
 if jsonb_typeof(p_catalog->'branches')<>'array' or jsonb_array_length(p_catalog->'branches')<1 then raise exception 'Catálogo inválido'; end if;
 for b in select value from jsonb_array_elements(p_catalog->'branches') loop
  insert into public.v1_gym_branches(gym_id,id,name,details,active) values('sportclub',b->>'id',b->>'name',b,true)
  on conflict(gym_id,id) do update set name=excluded.name,details=excluded.details,active=true;
  n:=n+1;
 end loop;
 update public.v1_gym_branches set active=false where gym_id='sportclub' and id not in(select value->>'id' from jsonb_array_elements(p_catalog->'branches'));
 return jsonb_build_object('ok',true,'count',n);
end $$;
revoke all on function public.admin_sync_gym_catalog(jsonb) from public;
grant execute on function public.admin_sync_gym_catalog(jsonb) to authenticated;

create or replace function public.v1_join_gym(p_document jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare st jsonb; rt jsonb; existing_id text; gid text; bid text; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Necesitás iniciar sesión'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 select id::text into existing_id from public.v1_students where user_uid=uid;
 if existing_id is not null then return jsonb_build_object('ok',true,'id',existing_id); end if;
 if exists(select 1 from public.v1_accounts where id=uid) then raise exception 'Esta cuenta ya tiene un perfil de profesor'; end if;
 st:=p_document->'student'; rt:=p_document->'routine'; gid:=st->>'gymId'; bid:=st->>'gymBranchId';
 if gid<>'sportclub' or not exists(select 1 from public.v1_gym_branches where gym_id=gid and id=bid and active) then raise exception 'Elegí una sede activa del catálogo'; end if;
 if char_length(coalesce(st->>'name','')) not between 1 and 120 or coalesce(st->>'id','') !~ '^[A-Za-z0-9_-]{3,80}$' or jsonb_typeof(rt->'days')<>'array' then raise exception 'Ficha inválida'; end if;
 st:=st||jsonb_build_object('membershipMode','gym','active',true,'pending',false,'claimed',true,'gymBranchName',(select name from public.v1_gym_branches where gym_id=gid and id=bid));
 st:=st-'trainerName'-'ext'-'adminDisabled';
 insert into public.v1_students(id,trainer_uid,user_uid,code,pending,data,updated_at)
 values(st->>'id',null,uid,upper(substr(st->>'id',1,6)),false,jsonb_build_object('student',st,'routine',rt),now());
 return jsonb_build_object('ok',true,'id',st->>'id');
end $$;
revoke all on function public.v1_join_gym(jsonb) from public;
grant execute on function public.v1_join_gym(jsonb) to authenticated;

-- Combina solamente los campos editados desde la copia original. Se ejecuta bajo lock.
create or replace function public.v1_document_item_key(v jsonb) returns text
language sql immutable as $$select coalesce(v->>'id',v->>'exerciseId',case when v ? 'date' then coalesce(v->>'date','')||':'||coalesce(v->>'dayId','')||':'||coalesce(v->>'startedAt','') end)$$;
create or replace function public.v1_merge_changed(b jsonb,l jsonb,r jsonb) returns jsonb
language plpgsql set search_path=public as $$
declare result jsonb; k text; item jsonb; bi jsonb; ri jsonb; identity text;
begin
 if l is not distinct from b then return r; end if;
 if jsonb_typeof(l)='object' and (r is null or jsonb_typeof(r)='object') then
  result:=coalesce(r,'{}'::jsonb);
  for k in select jsonb_object_keys(coalesce(b,'{}'::jsonb)||l||coalesce(r,'{}'::jsonb)) loop
   if not l ? k then
    if coalesce(b,'{}'::jsonb) ? k then result:=result-k; end if;
   else result:=jsonb_set(result,array[k],coalesce(public.v1_merge_changed(b->k,l->k,r->k),'null'::jsonb),true); end if;
  end loop;
  return result;
 end if;
 if jsonb_typeof(l)='array' and (r is null or jsonb_typeof(r)='array') and (b is null or jsonb_typeof(b)='array') then
  if not exists(select 1 from jsonb_array_elements(l||coalesce(r,'[]'::jsonb)||coalesce(b,'[]'::jsonb)) x where public.v1_document_item_key(x) is null) then
   result:='[]'::jsonb;
   for item in select value from jsonb_array_elements(l) loop
    identity:=public.v1_document_item_key(item);
    select value into bi from jsonb_array_elements(coalesce(b,'[]'::jsonb)) where public.v1_document_item_key(value)=identity limit 1;
    select value into ri from jsonb_array_elements(coalesce(r,'[]'::jsonb)) where public.v1_document_item_key(value)=identity limit 1;
    result:=result||jsonb_build_array(coalesce(public.v1_merge_changed(bi,item,ri),item));
   end loop;
   for item in select value from jsonb_array_elements(coalesce(r,'[]'::jsonb)) loop
    identity:=public.v1_document_item_key(item);
    if not exists(select 1 from jsonb_array_elements(l||coalesce(b,'[]'::jsonb)) where public.v1_document_item_key(value)=identity) then result:=result||jsonb_build_array(item); end if;
   end loop;
   return result;
  end if;
 end if;
 return l;
end $$;
revoke all on function public.v1_document_item_key(jsonb),public.v1_merge_changed(jsonb,jsonb,jsonb) from public;

create or replace function public.v1_save_gym_document(p_document jsonb,p_base jsonb default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.v1_students%rowtype; st jsonb; rt jsonb;
begin
 select * into r from public.v1_students where user_uid=auth.uid() and id::text=p_document->'student'->>'id' for update;
 if not found or r.trainer_uid is not null or r.data->'student'->>'membershipMode'<>'gym' then raise exception 'Ficha no autorizada'; end if;
 st:=public.v1_merge_changed(p_base->'student',p_document->'student',r.data->'student');rt:=public.v1_merge_changed(p_base->'routine',p_document->'routine',r.data->'routine');
 if not exists(select 1 from public.v1_gym_branches where gym_id=r.data->'student'->>'gymId' and id=st->>'gymBranchId' and active) then raise exception 'Sede inválida'; end if;
 if jsonb_typeof(st->'logs')<>'array' or jsonb_typeof(rt->'days')<>'array' then raise exception 'Documento inválido'; end if;
 st:=st||jsonb_build_object('membershipMode','gym','gymId',r.data->'student'->>'gymId','active',r.data->'student'->'active','adminDisabled',coalesce(r.data->'student'->'adminDisabled','false'::jsonb));
 st:=st-'trainerName'-'ext';
 update public.v1_students set data=jsonb_build_object('student',st,'routine',rt),updated_at=now() where id=r.id;
 return jsonb_build_object('ok',true,'document',jsonb_build_object('student',st,'routine',rt));
end $$;
revoke all on function public.v1_save_gym_document(jsonb,jsonb) from public;
grant execute on function public.v1_save_gym_document(jsonb,jsonb) to authenticated;

create or replace function public.v1_gym_workspace() returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('ok',true,'staff',coalesce((select jsonb_agg(to_jsonb(g)) from public.v1_gym_staff g where user_uid=auth.uid() and active),'[]'::jsonb),'rows',coalesce((select jsonb_agg(to_jsonb(s)) from public.v1_students s where s.trainer_uid is null and s.data->'student'->>'membershipMode'='gym' and exists(select 1 from public.v1_gym_staff g where g.user_uid=auth.uid() and g.active and g.gym_id=s.data->'student'->>'gymId' and (g.branch_id is null or g.branch_id=s.data->'student'->>'gymBranchId'))),'[]'::jsonb));
$$;
revoke all on function public.v1_gym_workspace() from public;
grant execute on function public.v1_gym_workspace() to authenticated;

create or replace function public.admin_set_gym_staff(p_email text,p_branch text default null,p_active boolean default true) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid;
begin
 if not public.admin_check() then raise exception 'No autorizado'; end if;
 select id into uid from auth.users where lower(email)=lower(trim(p_email));
 if uid is null then raise exception 'Ese email necesita una cuenta registrada'; end if;
 if p_branch is not null and not exists(select 1 from public.v1_gym_branches where gym_id='sportclub' and id=p_branch and active) then raise exception 'Sede inválida'; end if;
 insert into public.v1_gym_staff(user_uid,gym_id,branch_id,active) values(uid,'sportclub',p_branch,p_active)
 on conflict(user_uid,gym_id) do update set branch_id=excluded.branch_id,active=excluded.active;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_set_gym_staff(text,text,boolean) from public;
grant execute on function public.admin_set_gym_staff(text,text,boolean) to authenticated;

create or replace function public.v1_gym_save_member(p_document jsonb,p_base jsonb default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.v1_students%rowtype; st jsonb; rt jsonb; k text;
begin
 select * into r from public.v1_students where id::text=p_document->'student'->>'id' for update;
 if not found or r.trainer_uid is not null or not exists(select 1 from public.v1_gym_staff g where user_uid=auth.uid() and active and gym_id=r.data->'student'->>'gymId' and (branch_id is null or branch_id=r.data->'student'->>'gymBranchId')) then raise exception 'Alumno fuera de tu sede'; end if;
 st:=public.v1_merge_changed(p_base->'student',p_document->'student',r.data->'student');
 foreach k in array array['id','membershipMode','gymId','gymBranchId','gymBranchName','activeWorkout','measures','checkins','habitLog','photos','trainingStartedAt','adminDisabled','claimed','pending'] loop
  if (r.data->'student') ? k then st:=jsonb_set(st,array[k],r.data->'student'->k,true);else st:=st-k;end if;
 end loop;
 rt:=public.v1_merge_changed(p_base->'routine',p_document->'routine',r.data->'routine');
 update public.v1_students set data=jsonb_build_object('student',st,'routine',rt),updated_at=now() where id=r.id;
 return jsonb_build_object('ok',true,'document',jsonb_build_object('student',st,'routine',rt));
end $$;
revoke all on function public.v1_gym_save_member(jsonb,jsonb) from public;
grant execute on function public.v1_gym_save_member(jsonb,jsonb) to authenticated;

create table if not exists public.v1_appointments(
 id uuid primary key default gen_random_uuid(),student_id text not null,student_uid uuid not null,trainer_uid uuid,coached boolean not null default true,
 student_name text not null,starts_at timestamptz not null,ends_at timestamptz not null,
 gym_id text not null,gym_name text not null,branch_id text,branch_name text not null,address text,note text,
 status text not null default 'scheduled' check(status in('scheduled','cancelled')),
 created_by uuid not null,updated_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '2 hours'),check(char_length(note)<=500)
);
create index if not exists appointments_student_start on public.v1_appointments(student_uid,starts_at);
create index if not exists appointments_trainer_start on public.v1_appointments(trainer_uid,starts_at);
alter table public.v1_appointments enable row level security;
create table if not exists public.v1_appointment_reminders(
 id uuid primary key default gen_random_uuid(),appointment_id uuid references public.v1_appointments(id),
 user_uid uuid not null,due_at timestamptz not null,message text not null,
 kind text not null,version timestamptz not null,delivered_at timestamptz,attempts int not null default 0,
 next_attempt_at timestamptz,lease_until timestamptz,last_error text,cancelled boolean not null default false,
 unique(appointment_id,user_uid,kind,version)
);
alter table public.v1_appointment_reminders enable row level security;
drop policy if exists appointment_reminders_self on public.v1_appointment_reminders;
create policy appointment_reminders_self on public.v1_appointment_reminders for select to authenticated using(user_uid=auth.uid() and due_at<=now() and not cancelled);
create index if not exists reminders_due on public.v1_appointment_reminders(due_at) where delivered_at is null and not cancelled;
create or replace function public.v1_appointment_allowed(p_id text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.v1_students s where s.id::text=p_id and (s.user_uid=auth.uid() or s.trainer_uid=auth.uid() or exists(select 1 from public.v1_gym_staff g where g.user_uid=auth.uid() and g.active and s.trainer_uid is null and g.gym_id=s.data->'student'->>'gymId' and (g.branch_id is null or g.branch_id=s.data->'student'->>'gymBranchId'))));
$$;
revoke all on function public.v1_appointment_allowed(text) from public;
grant execute on function public.v1_appointment_allowed(text) to authenticated;
drop policy if exists appointments_participant on public.v1_appointments;
create policy appointments_participant on public.v1_appointments for select to authenticated using(public.v1_appointment_allowed(student_id));

create or replace function public.v1_list_appointments() returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('ok',true,'rows',coalesce((select jsonb_agg(to_jsonb(a) order by starts_at) from public.v1_appointments a where public.v1_appointment_allowed(a.student_id)),'[]'::jsonb));
$$;
revoke all on function public.v1_list_appointments() from public;
grant execute on function public.v1_list_appointments() to authenticated;

create or replace function public.v1_save_appointment(p_appointment jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.v1_students%rowtype; a public.v1_appointments%rowtype; b public.v1_gym_branches%rowtype; v_start timestamptz; v_end timestamptz; v_id uuid; v_trainer uuid; v_updated timestamptz:=clock_timestamp(); person uuid; label text;
begin
 select * into s from public.v1_students where id::text=p_appointment->>'student_id';
 if not found or not public.v1_appointment_allowed(s.id::text) then raise exception 'Alumno no autorizado'; end if;
 if s.user_uid is null then raise exception 'El alumno necesita activar su cuenta para recibir recordatorios'; end if;
 v_id:=(p_appointment->>'id')::uuid;v_start:=(p_appointment->>'starts_at')::timestamptz;v_end:=(p_appointment->>'ends_at')::timestamptz;
 if v_start<=now() or v_end<=v_start or v_end>v_start+interval '2 hours' then raise exception 'Elegí un horario futuro y una duración válida'; end if;
 select * into a from public.v1_appointments where id=v_id;
 if found and (a.student_id<>s.id::text or not public.v1_appointment_allowed(a.student_id)) then raise exception 'No podés reasignar ese turno'; end if;
 v_trainer:=s.trainer_uid;
 if v_trainer is null then
  select user_uid into v_trainer from public.v1_gym_staff where active and gym_id=s.data->'student'->>'gymId' and (branch_id is null or branch_id=s.data->'student'->>'gymBranchId') order by (user_uid=auth.uid()) desc,(branch_id is not null) desc,user_uid limit 1;
 end if;
 -- Serializa agendas concurrentes de ambos participantes para prevenir doble reserva.
 perform pg_advisory_xact_lock(hashtextextended(least(s.user_uid::text,coalesce(v_trainer::text,s.user_uid::text)),0));
 perform pg_advisory_xact_lock(hashtextextended(greatest(s.user_uid::text,coalesce(v_trainer::text,s.user_uid::text)),0));
 if exists(select 1 from public.v1_appointments where id<>v_id and status='scheduled' and (student_uid=s.user_uid or (s.trainer_uid is not null and coached and trainer_uid=v_trainer)) and starts_at<v_end and ends_at>v_start) then raise exception 'El horario se superpone con otro entrenamiento'; end if;
 if p_appointment->>'gym_id'='sportclub' then
  select * into b from public.v1_gym_branches where gym_id='sportclub' and id=p_appointment->>'branch_id' and active;
  if not found then raise exception 'Sede inválida'; end if;
 elsif char_length(coalesce(p_appointment->>'gym_name',''))<1 or char_length(coalesce(p_appointment->>'branch_name',''))<1 then raise exception 'Completá gimnasio y sede'; end if;
 insert into public.v1_appointments(id,student_id,student_uid,trainer_uid,coached,student_name,starts_at,ends_at,gym_id,gym_name,branch_id,branch_name,address,note,created_by,updated_at)
 values(v_id,s.id::text,s.user_uid,v_trainer,s.trainer_uid is not null,s.data->'student'->>'name',v_start,v_end,p_appointment->>'gym_id',case when b.id is not null then 'SportClub' else left(p_appointment->>'gym_name',100) end,b.id,coalesce(b.name,left(p_appointment->>'branch_name',150)),coalesce(b.details->>'address',p_appointment->>'address'),left(p_appointment->>'note',500),auth.uid(),v_updated)
 on conflict(id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,gym_id=excluded.gym_id,gym_name=excluded.gym_name,branch_id=excluded.branch_id,branch_name=excluded.branch_name,address=excluded.address,note=excluded.note,status='scheduled',updated_at=excluded.updated_at;
 update public.v1_appointment_reminders set cancelled=true where appointment_id=v_id and delivered_at is null;
 label:='Entrenamiento de '||(s.data->'student'->>'name')||' · '||to_char(v_start at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||' · '||coalesce(b.name,p_appointment->>'branch_name');
 foreach person in array array_remove(array[s.user_uid,v_trainer],null) loop
  insert into public.v1_appointment_reminders(appointment_id,user_uid,due_at,message,kind,version) values(v_id,person,now(),'Turno confirmado: '||label,'confirmation',v_updated);
  if v_start-interval '24 hours'>now() then insert into public.v1_appointment_reminders(appointment_id,user_uid,due_at,message,kind,version) values(v_id,person,v_start-interval '24 hours','Mañana: '||label,'24h',v_updated); end if;
  if v_start-interval '1 hour'>now() then insert into public.v1_appointment_reminders(appointment_id,user_uid,due_at,message,kind,version) values(v_id,person,v_start-interval '1 hour','En una hora: '||label,'1h',v_updated); end if;
 end loop;
 return jsonb_build_object('ok',true,'id',v_id);
end $$;
revoke all on function public.v1_save_appointment(jsonb) from public;
grant execute on function public.v1_save_appointment(jsonb) to authenticated;

create or replace function public.v1_cancel_appointment(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.v1_appointments%rowtype; person uuid; ts timestamptz:=clock_timestamp();
begin
 select * into a from public.v1_appointments where id=p_id for update;
 if not found or not public.v1_appointment_allowed(a.student_id) then raise exception 'Turno no autorizado'; end if;
 if a.status='cancelled' then return jsonb_build_object('ok',true); end if;
 update public.v1_appointments set status='cancelled',updated_at=ts where id=p_id;
 update public.v1_appointment_reminders set cancelled=true where appointment_id=p_id and delivered_at is null;
 foreach person in array array_remove(array[a.student_uid,a.trainer_uid],null) loop
  insert into public.v1_appointment_reminders(appointment_id,user_uid,due_at,message,kind,version) values(p_id,person,now(),'Entrenamiento cancelado · '||to_char(a.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||' · '||a.branch_name,'cancel',ts);
 end loop;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.v1_cancel_appointment(uuid) from public;
grant execute on function public.v1_cancel_appointment(uuid) to authenticated;

-- Cola del worker: solo service_role puede reclamar envíos, con lease para no duplicar cron.
create or replace function public.v1_claim_appointment_reminders() returns setof public.v1_appointment_reminders
language sql security definer set search_path=public as $$
 update public.v1_appointment_reminders set lease_until=now()+interval '5 minutes',attempts=attempts+1
 where id in(select id from public.v1_appointment_reminders where not cancelled and delivered_at is null and due_at<=now() and coalesce(next_attempt_at,due_at)<=now() and (lease_until is null or lease_until<now()) order by due_at for update skip locked limit 50) returning *;
$$;
revoke all on function public.v1_claim_appointment_reminders() from public,anon,authenticated;
grant execute on function public.v1_claim_appointment_reminders() to service_role;
grant select on public.v1_gyms,public.v1_gym_branches to anon,authenticated;
grant select on public.v1_gym_staff,public.v1_appointments,public.v1_appointment_reminders to authenticated;
