-- Ejecutar después de desplegar appointment-reminders.
-- Configurar APPOINTMENT_CRON_SECRET en Edge Function y el mismo valor en Vault
-- bajo el nombre appointment_cron_secret. No incluir valores reales en Git.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='appointment_cron_secret') then
  raise exception 'Falta appointment_cron_secret en Vault; configurar antes de activar el envío';
 end if;
 perform cron.unschedule(jobid) from cron.job where jobname='universal-fit-appointment-reminders';
 perform cron.schedule('universal-fit-appointment-reminders','* * * * *',$cron$
  select net.http_post(
   url:='https://vrtahknnofapgwuhaslq.supabase.co/functions/v1/appointment-reminders',
   headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='appointment_cron_secret' limit 1)),
   body:='{}'::jsonb
  );
 $cron$);
end $$;
