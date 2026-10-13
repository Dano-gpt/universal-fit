// Ejecutar desde pg_cron. Recordatorios a ambos participantes, incluso con la app cerrada.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async(req)=>{
  const workerToken=Deno.env.get('APPOINTMENT_CRON_SECRET');
  if(!workerToken||req.headers.get('x-cron-secret')!==workerToken)return new Response('Unauthorized',{status:401});
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pub=Deno.env.get('VAPID_PUBLIC_KEY'),priv=Deno.env.get('VAPID_PRIVATE_KEY');
  if(!url||!key||!pub||!priv)return Response.json({ok:false,error:'Missing reminder environment'},{status:503});
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:info@universalfit.com.ar',pub,priv);
  const db=createClient(url,key,{auth:{persistSession:false}});
  const {data:jobs,error}=await db.rpc('v1_claim_appointment_reminders');
  if(error)return Response.json({ok:false,error:error.message},{status:500});
  let delivered=0,failed=0;
  for(const job of jobs||[]){
    const {data:current,error:currentError}=await db.from('v1_appointment_reminders').select('cancelled').eq('id',job.id).single();
    if(currentError||current?.cancelled)continue;
    try{
      const {data:subs,error:subError}=await db.from('v1_push_subs').select('endpoint,sub').eq('user_uid',job.user_uid);
      if(subError)throw subError;
      const errors=[];
      for(const entry of subs||[]){
        try{await webpush.sendNotification(entry.sub,JSON.stringify({title:'Tu entrenamiento · Universal Fit',body:job.message,tag:'appointment-'+job.id,url:'https://universalfit.com.ar/v2/?agenda=1'}));}
        catch(e){const status=(e as {statusCode?:number}).statusCode;if(status===404||status===410){await db.from('v1_push_subs').delete().eq('endpoint',entry.endpoint);}else errors.push(String(e));}
      }
      if(errors.length)throw new Error(errors.join('; ').slice(0,500));
      const {error:markError}=await db.from('v1_appointment_reminders').update({delivered_at:new Date().toISOString(),lease_until:null,last_error:subs?.length?null:'Sin dispositivos suscriptos; disponible en la app'}).eq('id',job.id);
      if(markError)throw markError;delivered++;
    }catch(e){failed++;await db.from('v1_appointment_reminders').update({lease_until:null,next_attempt_at:new Date(Date.now()+Math.min(60,2**Math.min(job.attempts,6))*60000).toISOString(),last_error:String(e).slice(0,500)}).eq('id',job.id);}
  }
  return Response.json({ok:true,delivered,failed});
});
