/**
 * Boda Darwin & Sofía · Conector con Google Calendar
 *
 * Qué hace: cuando un invitado confirma con su correo, lo agrega como
 * invitado al evento de la boda en TU Google Calendar. Google le envía
 * la invitación oficial de calendario (con botones Sí / No / Quizás) y
 * además este script le manda un correo con su pase QR personal.
 *
 * Requisitos (ver README, paso 6):
 *  1. Servicios > agregar "Google Calendar API" (identificador: Calendar).
 *  2. Configuración del proyecto > Propiedades del script:
 *       SUPABASE_URL          https://TU-PROYECTO.supabase.co
 *       SUPABASE_SERVICE_KEY  service_role key (secreta, solo aquí)
 *       SITE_URL              https://TU-USUARIO.github.io/boda/
 *  3. Ejecutar una vez la función setup() y autorizar permisos.
 *  4. Implementar > Nueva implementación > Aplicación web
 *       Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario
 */

const TZ = 'America/Tegucigalpa';

function props_() { return PropertiesService.getScriptProperties(); }

function supa_(path, method, payload) {
  const p = props_();
  const res = UrlFetchApp.fetch(p.getProperty('SUPABASE_URL') + '/rest/v1/' + path, {
    method: method || 'get',
    contentType: 'application/json',
    payload: payload ? JSON.stringify(payload) : undefined,
    headers: {
      apikey: p.getProperty('SUPABASE_SERVICE_KEY'),
      Authorization: 'Bearer ' + p.getProperty('SUPABASE_SERVICE_KEY'),
      Prefer: 'return=representation'
    },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error('Supabase ' + res.getResponseCode() + ': ' + res.getContentText());
  return JSON.parse(res.getContentText() || '[]');
}

function settings_() { return supa_('settings?id=eq.1&select=*')[0]; }

function eventBody_(s) {
  const venue = [s.venue_name, s.venue_address, s.venue_city].filter(String).join(', ');
  return {
    summary: 'Boda ' + s.couple_names,
    location: venue,
    description: 'Nos casamos y queremos celebrarlo contigo.\nDetalles: ' + props_().getProperty('SITE_URL'),
    start: { dateTime: s.event_date, timeZone: TZ },
    end: { dateTime: s.event_end || s.event_date, timeZone: TZ },
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false
  };
}

/** Ejecutar UNA vez: crea el evento de la boda en tu calendario principal. */
function setup() {
  const p = props_();
  if (p.getProperty('EVENT_ID')) { Logger.log('El evento ya existe: ' + p.getProperty('EVENT_ID')); return; }
  const ev = Calendar.Events.insert(eventBody_(settings_()), 'primary');
  p.setProperty('EVENT_ID', ev.id);
  Logger.log('Evento creado: ' + ev.htmlLink);
}

/** Ejecutar si cambias fecha, hora o lugar en el panel: actualiza y avisa a los invitados. */
function syncEvent() {
  const id = props_().getProperty('EVENT_ID');
  Calendar.Events.patch(eventBody_(settings_()), 'primary', id, { sendUpdates: 'all' });
  Logger.log('Evento actualizado y notificado.');
}

/** Llamado por la página de invitación cuando alguien confirma. */
function doPost(e) {
  const out = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) return out({ ok: false, error: 'codigo' });

    const inv = supa_('invitations?code=eq.' + encodeURIComponent(code) + '&select=*')[0];
    if (!inv || inv.status !== 'confirmado' || !inv.email) return out({ ok: false, error: 'no aplica' });
    if (inv.calendar_sent_at) return out({ ok: true, already: true });

    lock.waitLock(20000);
    const id = props_().getProperty('EVENT_ID');
    const ev = Calendar.Events.get('primary', id);
    const attendees = ev.attendees || [];
    if (!attendees.some(function (a) { return (a.email || '').toLowerCase() === inv.email.toLowerCase(); })) {
      attendees.push({ email: inv.email, displayName: inv.family_name });
      Calendar.Events.patch({ attendees: attendees }, 'primary', id, { sendUpdates: 'all' });
    }

    sendPass_(inv);
    supa_('invitations?id=eq.' + inv.id, 'patch', { calendar_sent_at: new Date().toISOString() });
    return out({ ok: true });
  } catch (err) {
    console.error(err);
    return out({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/** Correo con el pase QR personal (además de la invitación de calendario). */
function sendPass_(inv) {
  const s = settings_();
  const url = props_().getProperty('SITE_URL') + '?c=' + inv.code;
  const qr = UrlFetchApp.fetch('https://quickchart.io/qr?size=400&margin=2&dark=722F40&text=' + encodeURIComponent(url)).getBlob().setName('pase.png');
  const fecha = Utilities.formatDate(new Date(s.event_date), TZ, "dd/MM/yyyy 'a las' h:mm a");
  const html =
    '<div style="font-family:Georgia,serif;color:#2B2124;max-width:520px">' +
    '<h2 style="color:#722F40">¡Gracias por confirmar, ' + inv.family_name + '!</h2>' +
    '<p>Reservamos <b>' + inv.confirmed_guests + '</b> lugar(es) para la boda de ' + s.couple_names + '.</p>' +
    '<p>' + fecha + '<br>' + [s.venue_name, s.venue_city].filter(String).join(', ') + '</p>' +
    '<p>Este es su pase de ingreso. Muéstrenlo en la entrada:</p>' +
    '<p><img src="cid:pase" width="220" height="220" alt="Código QR de ingreso"></p>' +
    '<p>Si necesitan cambiar su respuesta: <a href="' + url + '">' + url + '</a></p></div>';
  MailApp.sendEmail({
    to: inv.email,
    subject: 'Tu pase para la boda de ' + s.couple_names,
    htmlBody: html,
    inlineImages: { pase: qr },
    name: s.couple_names
  });
}

/** Prueba manual desde el editor: cambia el código por uno confirmado con correo. */
function testDoPost() {
  Logger.log(doPost({ postData: { contents: JSON.stringify({ code: 'PRUEBA01' }) } }).getContent());
}
