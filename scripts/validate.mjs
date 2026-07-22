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

const expected = [
  "function activeWorkoutFor",
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
  "Ver historia de entrenamiento",
  "Comentario de tu entrenador para esta vez",
];
for (const marker of expected) {
  if (!app.includes(marker)) errors.push(`Falta la funcionalidad aprobada: ${marker}`);
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
