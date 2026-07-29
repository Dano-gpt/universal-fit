import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const errors = [];
const required = [
  "CNAME",
  "index.html",
  "og-image.png",
  "robots.txt",
  "sitemap.xml",
  "v2/index.html",
  "v2/anim.js",
  "v2/manifest.json",
  "v2/sw.js",
  "v2/version.txt",
  "v2/icon-192.png",
  "v2/icon-512.png",
  ".github/workflows/daily-database-backup.yml",
  "docs/BACKUP-RESTORE.md",
];

for (const file of required) {
  if (!existsSync(path.join(root, file))) errors.push(`Falta el archivo requerido: ${file}`);
}

const read = (file) => readFile(path.join(root, file), "utf8");
const version = (await read("v2/version.txt")).trim();
const packageJson = JSON.parse(await read("package.json"));
const app = await read("v2/index.html");

if (!/^v\d+\.\d+\.\d+$/.test(version)) errors.push(`Versión inválida: ${version}`);
if (`v${packageJson.version}` !== version) errors.push("package.json y v2/version.txt no coinciden");
if (!app.includes(`const UF_VERSION='${version}'`)) errors.push("UF_VERSION no coincide con version.txt");
if ((await read("CNAME")).trim() !== "universalfit.com.ar") errors.push("CNAME inválido");
if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(app)) errors.push("v2/index.html contiene marcadores de conflicto");

for (const [, attributes, source] of app.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/application\/ld\+json/i.test(attributes)) continue;
  try {
    new vm.Script(source, { filename: "v2/index.html" });
  } catch (error) {
    errors.push(`JavaScript inválido: ${error.message}`);
  }
}

const relativeStart = app.indexOf("function validDay(");
const relativeEnd = app.indexOf("function latestWorkoutFeedback(", relativeStart);
if (relativeStart < 0 || relativeEnd < 0) {
  errors.push("No se pudo probar el cálculo de semanas y meses desde el inicio");
} else {
  try {
    const periodContext = { today: () => "2026-07-25" };
    new vm.Script(app.slice(relativeStart, relativeEnd)).runInNewContext(periodContext);
    const cases = [
      periodContext.relativePeriodIndex("2026-01-01", "2026-01-01", "week") === 1,
      periodContext.relativePeriodIndex("2026-01-07", "2026-01-01", "week") === 1,
      periodContext.relativePeriodIndex("2026-01-08", "2026-01-01", "week") === 2,
      periodContext.relativePeriodIndex("2026-02-14", "2026-01-15", "month") === 1,
      periodContext.relativePeriodIndex("2026-02-15", "2026-01-15", "month") === 2,
      periodContext.relativePeriodBounds("2026-01-01", "week", 2).from === "2026-01-08",
      periodContext.relativePeriodBounds("2026-01-31", "month", 2).from === "2026-02-28",
    ];
    if (cases.some((result) => !result)) errors.push("El cálculo relativo no supera sus casos de semana y mes desde el inicio");
  } catch (error) {
    errors.push(`No se pudo ejecutar el cálculo relativo: ${error.message}`);
  }
}

const newsStart = app.indexOf("function renderStudentNews(");
const newsEnd = app.indexOf("function renderPeriodMedia(", newsStart);
if (newsStart < 0 || newsEnd < 0) {
  errors.push("No se pudo probar la respuesta contextual de novedades");
} else {
  try {
    const newsContext = {
      S: { ui: {} },
      studentNovelties: () => [
        { key: "message:1", text: "Mensaje del alumno", kind: "message" },
        { key: "video:1", text: "Video de técnica", kind: "video", video: { exId: "ex1", name: "Sentadilla", url: "video.mp4" } },
      ],
      filterStudentNovelties: (_student, list) => list,
      studentNoveltyFilters: () => ({ status: "all", type: "all" }),
      noveltyStore: () => ({}),
      noveltyIcon: (kind) => kind,
      noveltyReplyEditor: () => "",
      videoBox: () => "<video></video>",
      esc: (value) => String(value ?? ""),
      fn: (value) => String(value ?? "").split(" ")[0],
    };
    new vm.Script(app.slice(newsStart, newsEnd)).runInNewContext(newsContext);
    const html = newsContext.renderStudentNews({ id: "student1", name: "Alumno Demo" });
    const replyActions = (html.match(/Responder ahora/g) || []).length;
    if (replyActions !== 2 || !html.includes("Mensaje del alumno") || !html.includes("Video de técnica") || !html.includes("Guardar devolución")) {
      errors.push("La respuesta contextual no aparece tanto en mensajes como en videos");
    }
  } catch (error) {
    errors.push(`No se pudo ejecutar la vista de novedades: ${error.message}`);
  }
}

const noveltyFilterStart = app.indexOf("function studentNoveltyFilters(");
const noveltyFilterEnd = app.indexOf("function setNoveltyStatus(", noveltyFilterStart);
if (noveltyFilterStart < 0 || noveltyFilterEnd < 0) {
  errors.push("No se pudo probar los filtros de novedades");
} else {
  try {
    const filterContext = { S: { ui: {} }, noveltyStore: (student) => student.noveltyStatus };
    new vm.Script(app.slice(noveltyFilterStart, noveltyFilterEnd)).runInNewContext(filterContext);
    const student = { id: "student1", noveltyStatus: { "message:seen": { seen: true }, "video:done": { seen: true, responded: true } } };
    const list = [
      { key: "message:new", kind: "message" },
      { key: "message:seen", kind: "message" },
      { key: "video:done", kind: "video" },
    ];
    const filters = filterContext.studentNoveltyFilters(student);
    filters.status = "seen";
    const seen = filterContext.filterStudentNovelties(student, list).map((item) => item.key);
    filters.status = "unanswered";
    filters.type = "message";
    const unansweredMessages = filterContext.filterStudentNovelties(student, list).map((item) => item.key);
    if (!seen.includes("message:seen") || !seen.includes("video:done") || !unansweredMessages.includes("message:new") || !unansweredMessages.includes("message:seen") || unansweredMessages.includes("video:done")) {
      errors.push("Los filtros combinados de novedades no respetan vistos, sin responder y tipo");
    }
  } catch (error) {
    errors.push(`No se pudo ejecutar los filtros de novedades: ${error.message}`);
  }
}

const demoSeedStart = app.indexOf("function ensureLocalDemoNovedades()");
const demoSeedEnd = app.indexOf("/* helpers */", demoSeedStart);
if (demoSeedStart < 0 || demoSeedEnd < 0) {
  errors.push("No se pudo probar la carga aislada de novedades demo");
} else {
  try {
    const demoStudent = { id: "demo_student", name: "Juan P.", techVids: [], noveltyStatus: {}, msgs: [] };
    const demoContext = {
      LOCAL_DEMO: true,
      S: { students: [demoStudent], notifs: [] },
      routineOf: () => ({ id: "routine" }),
      allEx: () => [{ id: "exercise", name: "Press banca" }],
      today: () => "2026-07-25",
    };
    new vm.Script(app.slice(demoSeedStart, demoSeedEnd)).runInNewContext(demoContext);
    demoContext.ensureLocalDemoNovedades();
    if (
      demoContext.S.notifs.length < 2 ||
      !demoStudent.techVids.some((video) => video.demoSample) ||
      !demoStudent.noveltyStatus["notif:demo-checkin-juan"]?.responded ||
      !demoStudent.noveltyStatus["notif:demo-visto-juan"]?.seen ||
      !demoStudent.msgs.some((message) => message.id === "demo-reply-juan")
    ) {
      errors.push("El modo demo no carga novedades de mensaje, video y respuesta de ejemplo");
    }
  } catch (error) {
    errors.push(`No se pudo ejecutar la carga demo: ${error.message}`);
  }
}

const lastExerciseStart = app.indexOf("function lastExerciseEntry(");
const lastExerciseEnd = app.indexOf("function bestKg(", lastExerciseStart);
if (lastExerciseStart < 0 || lastExerciseEnd < 0) {
  errors.push("No se pudo probar la precarga del último entrenamiento");
} else {
  try {
    const historyContext = {};
    new vm.Script(app.slice(lastExerciseStart, lastExerciseEnd)).runInNewContext(historyContext);
    const student = {
      logs: [
        { date: "2026-07-12", completedAt: "2026-07-12T10:00:00.000Z", entries: [{ exerciseId: "press", sets: [{ kg: 40, reps: 10 }, { kg: 45, reps: 8 }] }] },
        { date: "2026-07-20", completedAt: "2026-07-20T10:00:00.000Z", entries: [{ exerciseId: "press", sets: [{ kg: 47.5, reps: 9 }, { kg: 50, reps: 7 }] }] },
      ],
    };
    const last = historyContext.lastExerciseEntry(student, "press");
    const mark = historyContext.lastMark(student, "press");
    if (last?.date !== "2026-07-20" || last?.sets?.[0]?.kg !== 47.5 || last?.sets?.[1]?.kg !== 50 || mark?.kg !== 50) {
      errors.push("La precarga no recupera los pesos de cada serie del último entrenamiento");
    }
  } catch (error) {
    errors.push(`No se pudo ejecutar la precarga del último entrenamiento: ${error.message}`);
  }
}

const customStart = app.indexOf("function customExerciseLibrary()");
const customEnd = app.indexOf("function hasPlan(", customStart);
if (customStart < 0 || customEnd < 0) {
  errors.push("No se pudo probar la biblioteca de ejercicios personalizados");
} else {
  try {
    let sequence = 0;
    const customContext = { S: {}, uid: () => `test_${++sequence}` };
    new vm.Script(app.slice(customStart, customEnd)).runInNewContext(customContext);
    const first = customContext.rememberCustomExercise({ name: "Remo especial", category: "Espalda", sets: 3, reps: 12, note: "Primera técnica" });
    const updated = customContext.rememberCustomExercise({ name: "Remo especial", category: "Espalda", sets: 4, reps: 10, note: "Técnica actualizada" });
    const copyA = customContext.routineExerciseFromLibrary(updated);
    const copyB = customContext.routineExerciseFromLibrary(updated);
    if (
      customContext.S.customExercises.length !== 1 ||
      first.libraryId !== updated.libraryId ||
      updated.note !== "Técnica actualizada" ||
      copyA.id === copyB.id ||
      copyA.customLibraryId !== updated.libraryId
    ) {
      errors.push("La biblioteca personalizada no guarda, actualiza o reutiliza ejercicios correctamente");
    }
  } catch (error) {
    errors.push(`No se pudo ejecutar la biblioteca personalizada: ${error.message}`);
  }
}

const adStart = app.indexOf("function adBanner()");
const adEnd = app.indexOf("function updateAd()", adStart);
if (adStart < 0 || adEnd < 0) {
  errors.push("No se pudo probar el estilo de publicidad");
} else {
  try {
    const adContext = {
      AD: { texto: "Plan Pro | Conocé los beneficios", url: "https://universalfit.com.ar" },
      ADSEEN: false,
      esc: (value) => String(value),
    };
    new vm.Script(app.slice(adStart, adEnd)).runInNewContext(adContext);
    const banner = adContext.adBanner();
    if (!banner.includes("ufAdBanner") || !banner.includes("Plan Pro") || !banner.includes("Conocé los beneficios") || banner.includes("AD.color")) {
      errors.push("El banner no usa la composición blanca y verde esperada");
    }
  } catch (error) {
    errors.push(`No se pudo ejecutar el banner de publicidad: ${error.message}`);
  }
}

const expected = [
  "function activeWorkoutFor",
  "function lastExerciseEntry",
  "Precargamos los pesos de tu último entrenamiento",
  "function finishWorkout",
  "Finalizar día de entrenamiento",
  "Comentario para tu entrenador",
  "Nota general para tu entrenador",
  "Grabar un video nuevo",
  "function storageVideoUpload",
  "function saveTechFeedback",
  "function deleteTechVideo",
  "Devolución para el alumno",
  "Borrar este video",
  "function trainerWorkoutDetails",
  "function saveWorkoutExerciseFeedback",
  "function latestWorkoutFeedback",
  "function vPtWorkoutHistory",
  "Configuración del alumno",
  "Novedades de hoy",
  "Avances desde el inicio",
  "function studentTrainingStart",
  "function relativePeriodIndex",
  "function relativePeriodBounds",
  "function studentNovelties",
  "function filterStudentNovelties",
  "function clearStudentNoveltyFilters",
  "Sin responder",
  "Ver todas las novedades",
  "function setNoveltyStatus",
  "function deleteStudentNovelty",
  "function sendNoveltyReply",
  "function noveltyReplyEditor",
  "replyToNovelty",
  "Enviar respuesta",
  "Respuesta de tu entrenador",
  "Marcar respondida",
  "No usa semanas ni meses calendario",
  "Comentario de tu entrenador para esta vez",
  "admin-settings-grid",
  "admin-directory-grid",
  "function historyPeriodMatch",
  "La ficha y todo el historial se conservan siempre",
  "Responsive fluido: móvil, tablet, notebook y monitor",
  "function forgotPassword",
  "resetPasswordForEmail",
  "Olvidé mi contraseña",
  "function togglePasswordVisibility",
  "PASSWORD_RECOVERY",
  "updateUser({password:p})",
  "Crear contraseña nueva",
  "function ensureLatestAppVersion",
  "updateViaCache:'none'",
  "controllerchange",
  "cache:'no-store'",
  "visibilitychange",
  "uf_reload_version",
  "function customExerciseLibrary",
  "function rememberCustomExercise",
  "function addExFromLibrary",
  "Mis ejercicios personalizados",
  "Guardar y agregar ejercicio",
  "customExercises:customExerciseLibrary()",
  "customExercises:((acc.data&&acc.data.customExercises)||[]).slice()",
  "ufAdBanner",
  "AD_BANNER_GREEN='#0B5B50'",
  "ufAdStylePreview",
  "function adBanner",
  "function animateGateNumber",
  "function loadPublicStats",
  "Profesores inscriptos",
  "Alumnos que usan la app",
  "function adminSavePublicStats",
  "Indicadores de la pantalla inicial",
  "admin_set_public_stats",
  "v1_public_stats",
];
for (const marker of expected) {
  if (!app.includes(marker)) errors.push(`Falta la funcionalidad aprobada: ${marker}`);
}

for (const marker of [
  `<div id="gate"><div style="position:absolute;bottom:18px;left:0;right:0;text-align:center;color:rgba(255,255,255,.75);font-size:12px;font-weight:700">${version}</div>`,
  `const UF_VERSION='${version}'`,
  `const APP_VER='${version}'`,
]) {
  if (!app.includes(marker)) errors.push(`Referencia de versión desactualizada: falta ${marker}`);
}

if (app.includes('onclick="deleteStudent(')) {
  errors.push("La vista del profesor todavía permite borrar definitivamente un alumno");
}

const backupWorkflow = await read(".github/workflows/daily-database-backup.yml");
for (const marker of ["cron: \"15 3 * * *\"", "pg_dump", "aes-256-cbc", "retention-days: 30"]) {
  if (!backupWorkflow.includes(marker)) errors.push(`Backup diario incompleto: falta ${marker}`);
}

const publicStatsSchema = await read("docs/schema_public_stats.sql");
for (const marker of [
  "create or replace function public.v1_public_stats()",
  "create or replace function public.admin_set_public_stats(",
  "if not public.admin_check()",
  "grant execute on function public.v1_public_stats() to anon, authenticated",
  "grant execute on function public.admin_set_public_stats(int, int) to authenticated",
]) {
  if (!publicStatsSchema.includes(marker)) errors.push(`Esquema de indicadores incompleto: falta ${marker}`);
}

const serviceWorker = await read("v2/sw.js");
for (const marker of [
  `const CACHE = 'uf-shell-v6-${version.slice(1)}'`,
  "url.pathname.endsWith('/version.txt')",
  "fetch(req, { cache: 'no-store' })",
  "self.skipWaiting()",
  "self.clients.claim()",
]) {
  if (!serviceWorker.includes(marker)) errors.push(`Actualización automática incompleta: falta ${marker}`);
}

for (const file of ["index.html", "v2/index.html", "v2/anim.js", "v2/sw.js"]) {
  const content = await read(file);
  if (/service[_-]?role/i.test(content)) errors.push(`${file} parece contener una clave service_role`);
  if (/AKIA[0-9A-Z]{16}/.test(content)) errors.push(`${file} parece contener una clave AWS`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validación correcta: ${version}, ${required.length} archivos y funcionalidades aprobadas presentes.`);
