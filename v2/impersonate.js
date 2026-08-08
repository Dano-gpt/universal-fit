/* Universal Fit - Suplantacion de usuarios (admin) - v2.28.0 */
var IMPERSONATE = { on: false, adminSession: null, target: null };
try { var _iv = sessionStorage.getItem('uf_imp'); if (_iv) IMPERSONATE = JSON.parse(_iv); } catch (e) {}
function _impSave() {
  try { if (IMPERSONATE.on) sessionStorage.setItem('uf_imp', JSON.stringify(IMPERSONATE)); else sessionStorage.removeItem('uf_imp'); } catch (e) {}
}
async function adminImpersonate(kind, id, name) {
  if (typeof sb === 'undefined' || !sb) { toast('La suplantacion necesita conexion a internet'); return; }
  if (!confirm('Vas a ingresar como ' + (name || 'este usuario') + ' y vas a poder ver y modificar sus datos reales, como si fueras esa persona. Continuar?')) return;
  toast('Preparando acceso...');
  const { data: sessData } = await sb.auth.getSession();
  const adminSession = (sessData && sessData.session) ? { access_token: sessData.session.access_token, refresh_token: sessData.session.refresh_token } : null;
  if (!adminSession) { toast('No pude leer tu sesion de administrador'); return; }
  let resp;
  try { resp = await sb.functions.invoke('admin-impersonate', { body: { kind: kind, id: id } }); }
  catch (e) { toast('No se pudo conectar con el servidor: ' + (e.message || e)); return; }
  const data = resp && resp.data;
  if (!data || !data.ok) {
    if (data && data.reason === 'no_account') { toast('Este alumno no tiene cuenta propia (lo gestiona su entrenador) - ingresa como su entrenador.'); }
    else { toast('No se pudo iniciar la suplantacion: ' + ((data && data.error) || (resp && resp.error && resp.error.message) || 'error desconocido')); }
    return;
  }
  const { error: vErr } = await sb.auth.verifyOtp({ email: data.email, token_hash: data.hashed_token, type: 'magiclink' });
  if (vErr) { toast('No se pudo entrar como ese usuario: ' + vErr.message); return; }
  IMPERSONATE = { on: true, adminSession: adminSession, target: { kind: kind, id: id, name: name || data.email, email: data.email } };
  _impSave();
  ADMIN = { on: false, otp: false, data: null, view: null };
  const { data: ud } = await sb.auth.getUser();
  await cloudBoot(ud.user);
  toast('Ahora estas como ' + (name || data.email));
  render();
}
async function endImpersonation() {
  if (!IMPERSONATE.on) return;
  const target = IMPERSONATE.target;
  try { if (IMPERSONATE.adminSession) await sb.auth.setSession(IMPERSONATE.adminSession); } catch (e) {}
  IMPERSONATE = { on: false, adminSession: null, target: null };
  _impSave();
  if (typeof rtStop === 'function') rtStop();
  CLOUD = { on: false, uid: null, kind: null, timer: null, hashes: {}, pushing: false };
  S = load(); S.user = null;
  ADMIN = { on: true, otp: true, data: null, view: target ? (target.kind === 'pt' ? { t: target.id } : { s: target.id }) : null };
  toast('Volviste al panel de administracion');
  await adminLoad();
  if (target && target.kind === 'pt') adminLoadBilling(target.id);
  render();
}
