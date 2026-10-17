-- Cupos de agenda para profesores. Ejecutar después de schema_gym_agenda.sql.
create table if not exists public.v1_appointment_slots(
 id uuid primary key default gen_random_uuid(),trainer_uid uuid not null references auth.users(id),
 starts_at timestamptz not null,ends_at timestamptz not null,capacity int not null check(capacity between 1 and 100),
 gym_name text not null,branch_name text not null,address text,note text,status text not null default 'open' check(status in('open','closed')),
 created_at timestamptz not null default now(),check(ends_at>starts_at and ends_at<=starts_at+interval '2 hours')
);
create index if not exists appointment_slots_trainer_start on public.v1_appointment_slots(trainer_uid,starts_at);
alter table public.v1_appointment_slots enable row level security;

create or replace function public.v1_list_appointment_slots() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('ok',true,'rows',coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at),'[]'::jsonb)) from (
  select s.*,count(a.id) filter(where a.status='scheduled') as reserved
  from public.v1_appointment_slots s left join public.v1_appointments a on a.trainer_uid=s.trainer_uid and a.starts_at=s.starts_at and a.ends_at=s.ends_at and a.status='scheduled'
  where s.status='open' and (s.trainer_uid=auth.uid() or exists(select 1 from public.v1_students st where st.user_uid=auth.uid() and st.trainer_uid=s.trainer_uid))
  group by s.id
 ) q;
$$;
revoke all on function public.v1_list_appointment_slots() from public; grant execute on function public.v1_list_appointment_slots() to authenticated;

create or replace function public.v1_save_appointment_slot(p_slot jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid:=coalesce(nullif(p_slot->>'id','')::uuid,gen_random_uuid()); v_start timestamptz:=(p_slot->>'starts_at')::timestamptz; v_end timestamptz:=(p_slot->>'ends_at')::timestamptz;
begin
 if v_start<=now() or v_end<=v_start or v_end>v_start+interval '2 hours' or coalesce((p_slot->>'capacity')::int,0)<1 then raise exception 'Cupo inválido'; end if;
 insert into public.v1_appointment_slots(id,trainer_uid,starts_at,ends_at,capacity,gym_name,branch_name,address,note,status)
 values(v_id,auth.uid(),v_start,v_end,(p_slot->>'capacity')::int,left(coalesce(p_slot->>'gym_name','Gimnasio'),100),left(coalesce(p_slot->>'branch_name','Sede a confirmar'),150),left(coalesce(p_slot->>'address',''),300),left(coalesce(p_slot->>'note',''),500),coalesce(p_slot->>'status','open'))
 on conflict(id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,capacity=excluded.capacity,gym_name=excluded.gym_name,branch_name=excluded.branch_name,address=excluded.address,note=excluded.note,status=excluded.status where v1_appointment_slots.trainer_uid=auth.uid();
 return jsonb_build_object('ok',true,'id',v_id);
end $$;
revoke all on function public.v1_save_appointment_slot(jsonb) from public; grant execute on function public.v1_save_appointment_slot(jsonb) to authenticated;

create or replace function public.v1_book_appointment_slot(p_slot uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare sl public.v1_appointment_slots%rowtype; st public.v1_students%rowtype; used int; v_id uuid:=gen_random_uuid(); ts timestamptz:=clock_timestamp();
begin
 select * into sl from public.v1_appointment_slots where id=p_slot and status='open' for update;
 select * into st from public.v1_students where user_uid=auth.uid() and trainer_uid=sl.trainer_uid;
 if not found then raise exception 'Cupo no disponible para este alumno'; end if;
 select count(*) into used from public.v1_appointments where trainer_uid=sl.trainer_uid and starts_at=sl.starts_at and ends_at=sl.ends_at and status='scheduled';
 if used>=sl.capacity then raise exception 'Este horario ya no tiene cupos disponibles'; end if;
 if exists(select 1 from public.v1_appointments where student_uid=st.user_uid and status='scheduled' and starts_at<sl.ends_at and ends_at>sl.starts_at) then raise exception 'Ya tenés otro turno en ese horario'; end if;
 insert into public.v1_appointments(id,student_id,student_uid,trainer_uid,coached,student_name,starts_at,ends_at,gym_id,gym_name,branch_name,address,note,status,created_by,updated_at)
 values(v_id,st.id::text,st.user_uid,sl.trainer_uid,true,st.data->'student'->>'name',sl.starts_at,sl.ends_at,'other',sl.gym_name,sl.branch_name,sl.address,coalesce(sl.note,''),'scheduled',auth.uid(),ts);
 insert into public.v1_appointment_reminders(appointment_id,user_uid,due_at,message,kind,version) values
 (v_id,st.user_uid,now(),'Turno confirmado: '||to_char(sl.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||' · '||sl.branch_name,'confirmation',ts),
 (v_id,sl.trainer_uid,now(),'Nuevo alumno reservado: '||(st.data->'student'->>'name')||' · '||to_char(sl.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI'),'confirmation',ts);
 if used+1=sl.capacity then insert into public.v1_appointment_reminders(appointment_id,user_uid,due_at,message,kind,version) values(v_id,sl.trainer_uid,now(),'Cupo completo: '||to_char(sl.starts_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI')||' · '||sl.branch_name,'slot_full',ts); end if;
 return jsonb_build_object('ok',true,'id',v_id,'remaining',sl.capacity-used-1);
end $$;
revoke all on function public.v1_book_appointment_slot(uuid) from public; grant execute on function public.v1_book_appointment_slot(uuid) to authenticated;
grant select on public.v1_appointment_slots to authenticated;
