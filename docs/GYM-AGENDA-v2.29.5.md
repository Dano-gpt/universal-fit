# Candidata v2.29.5 — gimnasios, agenda y continuidad

Estado: candidata, NO publicada. Incluye los cambios de integridad de datos anteriores.
Repositorio: https://github.com/Dano-gpt/universal-fit.git
Rama: `candidata/integridad-datos-v2.29.5`.

## Alcance del MVP

- Profesor y alumno pueden crear, editar y cancelar entrenamientos: día, hora argentina, duración, gimnasio, sede y nota. El profesor cuenta con una agenda de todos sus alumnos y filtro por alumno. Las colisiones de alumno o profesor se rechazan en el servidor con bloqueo transaccional.
- Confirmación, reprogramación y cancelación preparan una cola de mensajes para ambos participantes. Recordatorios 24 horas y 1 hora antes, cuando todavía sean fechas futuras. La cancelación retira los recordatorios pendientes, conserva el turno y genera avisos de cancelación.
- Exportación `.ics` para Google Calendar, Apple Calendar u Outlook, con alarma de 1 hora. Se usan timestamps UTC; toda la interfaz de agenda presenta Argentina, UTC−3.
- Alta de alumno directo: `membershipMode: 'gym'`, `gymId`, `gymBranchId`, `gymBranchName`, `trainer_uid: null`, `pending: false`. Email/contraseña, confirmación de correo cuando la configuración de Supabase lo requiera y finalización del alta al primer login. No se crea un profesor ficticio.
- El alumno directo tiene cuenta e historial propios, hábitos, medidas, progreso, agenda, rutina inicial editable y cambio de sede. La plantilla es de Universal Fit, no una rutina oficial de SportClub.
- Personal del gimnasio: autorizado por el administrador por email de cuenta existente, para una sede o toda la red. Accede solo a alumnos directos de las sedes asignadas. Puede revisar progreso, ajustar rutina y agendar; no se reasigna a sí mismo como entrenador particular del alumno.
- Identidad SportClub configurada: amarillo `#FFD300`, negro, blanco y grises `#18191E`/`#202128`, tipografía Arial/Helvetica. Se aplica al alumno directo, no a alumnos con profesor particular.

La agenda es propia de Universal Fit. No está conectada al sistema de cupos, clases ni membresías de SportClub. Un turno no confirma una reserva oficial del gimnasio.

## Catálogo y fuentes

Directorio oficial: https://www.sportclub.com.ar/sedes
Sitio y paleta: https://www.sportclub.com.ar/
Fuente pública que utiliza la web: `https://vhzfd7sis7qzlcy63dcjgc2cqa0lovrs.lambda-url.sa-east-1.on.aws/v1/sedes?limit=1500`.
Extraído el 12/10/2026: 1.064 registros activos, sin paginación faltante ni identificadores duplicados. Incluye sedes SportClub, Familia SportClub, clubes y espacios asociados, conservando sus nombres originales.

`v2/sportclub-catalog.b64` contiene JSON UTF-8 comprimido con gzip y codificado en Base64. Incluye nombre, slug, dirección, provincia, barrio/zona, categoría, teléfono, email, mapa, horarios y actividades. La interfaz lo descomprime con `DecompressionStream`; necesita un navegador moderno. Este catálogo evita depender de CORS o de la disponibilidad de la web oficial en cada inicio. Tiene fecha de extracción, no es un listado actualizado en tiempo real.

El administrador puede importar esta versión del catálogo a la base desde “Actualizar catálogo en la base”. Para refrescar el archivo desde la web oficial se necesita una nueva extracción; ese botón no promete una descarga en tiempo real. No se debe mezclar la clave pública que expone la web del proveedor con ninguna credencial propia de Universal Fit.

## Archivos y datos

- `v2/gym-agenda.js`: nuevo flujo de alta, catálogo, identidad, agenda, rutina autónoma, portal de personal y opciones de administración. Extiende las funciones actuales; no reemplaza las vistas de alumnos tradicionales.
- `v2/gym-agenda.css`: tema y grillas responsivas. No usa logos externos ni modifica el banner publicitario aprobado.
- `deploy/schema_gym_agenda.sql`: tablas de gimnasio, sedes, responsables, turnos y cola de recordatorios; RLS y funciones con comprobación de permisos. Funciones de guardado usan bloqueo y combinación de cambios contra copia base para conservar modificaciones concurrentes.
- `supabase/functions/appointment-reminders/index.ts`: worker programado; lee `v1_push_subs`, envía Web Push con VAPID, limpia endpoints vencidos y reintenta errores. Lease y etiquetas de notificación evitan que cron duplique trabajo activo.
- `deploy/schedule_appointment_reminders.sql`: cron cada minuto con pg_net y secreto de Vault.
- `supabase/config.toml`: solo la nueva función; el worker valida su propio secreto de cron.
- `scripts/qa-gym-agenda.mjs`: catálogo, calendario exportable, solapamientos y pruebas reales de PostgreSQL en una base embebida de PGlite, sin Supabase productivo.
- `v2/index.html`: rangos de repeticiones, cierre con confirmación de guardado y protección de sincronización. El guardado usa comprobación de `updated_at` para detectar carreras; si el registro cambió en el servidor, reintenta. Se corrigió `fmtDMY` para no desplazar un día cuando recibe `YYYY-MM-DD`.

Las nuevas tablas se incluyen automáticamente en el backup de base completa existente. No se guardan contraseñas, claves privadas ni tokens reales en esta documentación.

## Cómo revisar

Servidor local desde el repo: `python -m http.server 4196`.

- Alumno directo SportClub: http://127.0.0.1:4196/v2/?demo=1&gymDemo=1
- Profesor tradicional: http://127.0.0.1:4196/v2/?demo=1&teacherDemo=1
- Personal de gimnasio: http://127.0.0.1:4196/v2/?demo=1&gymStaffDemo=1

Las demos usan exclusivamente localStorage, con Supabase desactivado para localhost y `demo=1`. No pueden crear usuarios ni enviar push reales. Incluyen una alumna ficticia, cuatro semanas de todos sus ejercicios, medidas y turnos. Las distintas demos comparten almacenamiento del mismo origen, por lo que el enlace seleccionado cambia la vista demo; usar perfiles separados si se quieren comparar sesiones simultáneas.

Para probar el alta completa, salir de la sesión demo e ingresar por “Soy alumno” → “Entreno en un gimnasio, sin profesor particular”. Los datos quedan solo en el navegador.

## Validación realizada

- `npm run validate`: sintaxis de app y módulo, funcionalidades anteriores, referencias de versión y catálogo completo.
- PostgreSQL embebido: migración ejecutada; alta e idempotencia, autorización de responsables por sede, prohibición de acceder a otros alumnos, turnos compartidos, superposición, reprogramación, cancelación y generación/anulación de recordatorios. Se probó que un entrenamiento nuevo del alumno conserve un cambio simultáneo de rutina del personal.
- Navegador local: catálogo y búsqueda; alumno con identidad SportClub; creación y reprogramación de un turno con datos correctos, conservado al recargar. Cancelación verificada en la base de prueba; ningún envío push real durante QA.
- TypeScript del worker: compilación de sintaxis. El envío real debe validarse al activar el worker y registrar un dispositivo de prueba autorizado.

Para repetir la prueba de PostgreSQL: instalar `@electric-sql/pglite` en una carpeta temporal y definir `QA_PGLITE_MODULE` con la ruta absoluta a su `dist/index.js`; ejecutar `node scripts/qa-gym-agenda.mjs`. Sin esa variable, se ejecutan las pruebas locales y se indica que falta la parte de base.

## Activación al aprobar publicación

No ejecutar estos pasos hasta la aprobación de esta candidata:

1. Revisar backup y ejecutar `deploy/schema_gym_agenda.sql` en el proyecto `vrtahknnofapgwuhaslq`. Es una migración aditiva; no elimina tablas ni alumnos existentes.
2. Publicar la candidata siguiendo PR, validación y merge a main. Verificar todos los números de versión.
3. Como administrador, importar el catálogo desde el nuevo panel antes de habilitar altas de gimnasio. Sin sedes cargadas, la función rechaza el alta y evita crear una ficha inválida.
4. Desplegar `appointment-reminders` con `verify_jwt=false` para esa función. Configurar `APPOINTMENT_CRON_SECRET`, `VAPID_PUBLIC_KEY` (igual a la pública actual), `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`; Supabase provee URL y clave de servicio al worker. La clave privada debe ser la del proyecto, no una generada diferente.
5. Crear en Vault `appointment_cron_secret` con el mismo secreto del worker y ejecutar `deploy/schedule_appointment_reminders.sql`. No colocar el secreto en un comando compartido ni en Git.
6. Autorizar al responsable real de la sede desde Administración. Se necesita un email existente y la sede elegida; no inventar una cuenta ni otorgar acceso a terceros.
7. Probar con una cuenta propia de QA: alta, login en dos dispositivos, reserva, push a profesor y alumno, actualización, cancelación y permisos por sede. El push solo llega a dispositivos que aceptaron notificaciones; también queda disponible en la agenda. La demo no valida recepción real.

No se realizaron migraciones ni despliegues en producción durante la preparación.
