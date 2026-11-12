# Invitación web de la boda · ambiente de prueba

Sitio estático en **GitHub Pages** con base de datos, inicio de sesión y fotos en **Supabase**, y un pequeño **Google Apps Script** que envía la invitación de Google Calendar. Todo funciona en planes gratuitos y no necesitas dominio propio.

## Qué incluye

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html?c=CODIGO` | Invitados | Invitación personalizada, cuenta regresiva, lugar, programa, galería, confirmación con número de asistentes (1 hasta los lugares asignados), pase QR, botón de Google Calendar y archivo .ics |
| `admin.html` | Administrador | Resumen, alta de invitaciones (una a una o en lote), lugares por familia, QR y enlace por invitación, envío por WhatsApp, exportar CSV, editar fecha, lugar, programa y mensaje, subir fotos y elegir portada |
| `checkin.html` | Staff (con usuario admin) | Escanea el QR con la cámara del celular o recibe el código a mano y registra cuántas personas ingresan |

El mismo QR sirve para dos cosas: si lo abre el invitado, ve su invitación; si lo escanea el staff desde `checkin.html`, registra el ingreso.

## Lo que necesitas (todo gratis)

1. Una cuenta de **GitHub**.
2. Una cuenta de **Supabase** (puedes entrar con GitHub).
3. Tu cuenta de **Google** (Calendar y Gmail).

No necesitas comprar dominio para probar. La dirección será `https://TU-USUARIO.github.io/boda/`. Si después quieren algo como `darwinysofia.com`, se compra aparte (suele costar entre 10 y 15 USD al año) y se conecta en GitHub Pages sin cambiar el código.

---

## Paso 1 · Crear el proyecto en Supabase

1. Entra a supabase.com, crea un proyecto nuevo y guarda la contraseña de la base de datos.
2. Abre `supabase/schema.sql`, cambia `TU_CORREO@gmail.com` por tu correo de administrador.
3. En Supabase ve a **SQL Editor > New query**, pega todo el archivo y pulsa **Run**. Crea las tablas, las reglas de seguridad, el espacio de fotos y tres invitaciones de prueba (`PRUEBA01` con 4 lugares, `PRUEBA02` con 2 y `PRUEBA03` con 1).

## Paso 2 · Crear el usuario administrador

1. **Authentication > Users > Add user > Create new user**, con el mismo correo del paso anterior y una contraseña. Marca la opción de confirmar el correo automáticamente.
2. Recomendado: en **Authentication > Sign In / Providers**, desactiva que usuarios nuevos puedan registrarse solos. Aunque alguien se registrara, no tendría permisos, pero así queda más limpio.
3. Si alguien más va a usar el check-in (por ejemplo, la organizadora), crea su usuario igual y agrega su correo en **Table Editor > admins**.

## Paso 3 · Copiar las llaves de Supabase

En **Project Settings > API** (o **API Keys**) copia:

- **Project URL** (`https://xxxx.supabase.co`).
- **anon / publishable key**. Esta va en la página y es pública por diseño; lo que protege los datos son las reglas de seguridad del paso 1.
- **service_role / secret key**. Esta es secreta: solo va en el Apps Script (paso 6). Nunca la pongas en `config.js` ni en GitHub.

## Paso 4 · Publicar en GitHub Pages

1. Crea un repositorio **público** llamado `boda` (GitHub Pages gratuito requiere repositorio público; no contiene ningún secreto).
2. Sube todo el contenido de esta carpeta (incluida la carpeta oculta `.github`).
3. En el repositorio: **Settings > Pages > Build and deployment > Deploy from a branch**, rama `main`, carpeta `/docs`. Guarda.
4. En uno o dos minutos la página queda en `https://TU-USUARIO.github.io/boda/`.

## Paso 5 · Configurar `docs/js/config.js`

Reemplaza `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SITE_URL` (la dirección del paso anterior, terminada en `/`). Sube el cambio. Por ahora deja `CALENDAR_WEBHOOK_URL` vacío.

En este punto ya puedes probar todo menos el correo de calendario:

- `https://TU-USUARIO.github.io/boda/admin.html` para entrar al panel.
- `https://TU-USUARIO.github.io/boda/?c=PRUEBA01` para ver la invitación de prueba.

## Paso 6 · Conectar Google Calendar (envío automático)

1. Entra a script.google.com con tu cuenta y crea un proyecto nuevo.
2. Borra el contenido y pega `apps-script/Code.gs`.
3. En el menú izquierdo, **Servicios (+) > Google Calendar API > Agregar**.
4. **Configuración del proyecto (engranaje) > Propiedades del script**, agrega:
   - `SUPABASE_URL` con la Project URL.
   - `SUPABASE_SERVICE_KEY` con la service_role key.
   - `SITE_URL` con la dirección de GitHub Pages terminada en `/`.
5. En el editor elige la función `setup` y pulsa **Ejecutar**. Autoriza los permisos. Se crea el evento de la boda en tu calendario principal.
6. **Implementar > Nueva implementación > Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**. Copia la URL que termina en `/exec`.
7. Pégala en `CALENDAR_WEBHOOK_URL` dentro de `config.js` y sube el cambio.

Desde ahí, cuando alguien confirma con su correo:

- Google le envía la invitación oficial del evento (aparece en su calendario con Sí / No / Quizás). Los invitados no ven la lista de otros invitados.
- Recibe además un correo con su pase QR.
- En el panel, la columna **Calendario** cambia a "Enviada".

Si cambias la fecha, la hora o el lugar en el panel, ejecuta `syncEvent` en el Apps Script para actualizar el evento y avisar a todos.

## Paso 7 · Evitar que Supabase se pause

Los proyectos gratuitos de Supabase se pausan después de una semana sin actividad. El archivo `.github/workflows/keepalive.yml` consulta la base de datos dos veces por semana. Para activarlo, en GitHub ve a **Settings > Secrets and variables > Actions** y agrega `SUPABASE_URL` y `SUPABASE_ANON_KEY`. Puedes probarlo en **Actions > Mantener Supabase activo > Run workflow**.

## Guion de prueba

1. Entra a `admin.html`, revisa **Datos del evento** y sube un par de fotos; marca una como portada.
2. En **Invitaciones**, crea una con tu número de WhatsApp y 3 lugares. Abre **QR y enlace** y prueba "Enviar por WhatsApp".
3. Abre el enlace en tu celular, confirma 2 personas con tu correo. Debes ver el pase QR, el botón de Google Calendar y, si hiciste el paso 6, recibir la invitación y el correo.
4. En otro celular abre `checkin.html`, inicia sesión, activa la cámara y escanea el QR. Registra el ingreso y revisa el contador.
5. Prueba también con `PRUEBA03` (1 lugar): el formulario no permite confirmar más de 1.

## Límites a tener en cuenta

- Supabase gratuito: 500 MB de base de datos y 1 GB de archivos. Las fotos se reducen a 1600 px antes de subirse, así que caben cientos.
- Gmail desde Apps Script permite alrededor de 100 correos por día en cuentas personales; para 40 a 70 invitados sobra.
- La imagen QR del correo se genera con el servicio gratuito quickchart.io. En la página, el QR se genera en el navegador.
- Los códigos de invitación son de 8 caracteres aleatorios. Quien tenga el enlace puede responder por esa familia, igual que con una invitación impresa.
