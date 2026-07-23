# Backups diarios de Universal Fit

El workflow `daily-database-backup.yml` genera todos los días una exportación completa de PostgreSQL, la cifra antes de subirla y conserva 30 puntos diarios en GitHub Actions.

## Estado del proyecto

El panel de Supabase informa que el proyecto está en el plan Free, que no incluye backups programados. Por eso se usa este respaldo externo. El workflow queda inactivo hasta configurar sus dos secretos: nunca se guarda una conexión o una clave dentro del código.

## Activación

En el repositorio de GitHub, configurar estos secretos:

- `SUPABASE_DB_URL`: conexión directa de PostgreSQL del proyecto Supabase, con contraseña y SSL.
- `BACKUP_ENCRYPTION_KEY`: frase aleatoria larga, exclusiva para cifrar y restaurar backups.

La clave de cifrado debe guardarse también en un gestor de contraseñas externo. Si se pierde, los respaldos no se pueden recuperar.

Después de configurar los secretos, ejecutar manualmente **Backup diario de Supabase** una vez y comprobar que el artifact contiene:

- `universal-fit-AAAA-MM-DDTHH-MM-SSZ.dump.enc`
- su archivo `.sha256`

La programación normal se ejecuta a las 00:15 de Argentina.

## Restauración controlada

1. Descargar un artifact desde GitHub Actions.
2. Verificar su integridad:

   ```bash
   sha256sum -c universal-fit-*.dump.enc.sha256
   ```

3. Descifrarlo con la misma clave:

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
     -in universal-fit-AAAA-MM-DDTHH-MM-SSZ.dump.enc \
     -out universal-fit.dump \
     -pass env:BACKUP_ENCRYPTION_KEY
   ```

4. Restaurar primero en una base nueva de prueba:

   ```bash
   pg_restore --clean --if-exists --no-owner \
     --dbname "$RESTORE_DATABASE_URL" universal-fit.dump
   ```

5. Validar cuentas, alumnos, rutinas, entrenamientos y comentarios antes de considerar una restauración productiva.

Los archivos binarios del bucket de videos no forman parte de `pg_dump`; este proceso respalda la base PostgreSQL completa y la metadata de Storage.
