// Utilidades compartidas por invitación, panel y check-in
const C = window.CONFIG;
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function photoUrl(path) {
  if (!path) return "";
  return sb.storage.from("fotos").getPublicUrl(path).data.publicUrl;
}

function inviteUrl(code) {
  const base = C.SITE_URL.endsWith("/") ? C.SITE_URL : C.SITE_URL + "/";
  return `${base}?c=${encodeURIComponent(code)}`;
}

function fmtDate(iso, opts) {
  return new Intl.DateTimeFormat("es-HN", { timeZone: C.TIMEZONE, ...opts }).format(new Date(iso));
}
const fmtLongDate = (iso) => fmtDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtTime = (iso) => fmtDate(iso, { hour: "numeric", minute: "2-digit" });

// "2027-10-30T16:00" (hora de Honduras) <-> ISO UTC
function localInputToIso(v) { return v ? new Date(`${v}:00${C.TZ_OFFSET}`).toISOString() : null; }
function isoToLocalInput(iso) {
  if (!iso) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: C.TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const utcStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function venueText(s) {
  return [s.venue_name, s.venue_address, s.venue_city].filter(Boolean).join(", ");
}

function googleCalendarLink(s) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Boda ${s.couple_names}`,
    dates: `${utcStamp(s.event_date)}/${utcStamp(s.event_end || s.event_date)}`,
    location: venueText(s),
    details: `Nos casamos. Más detalles: ${C.SITE_URL}`,
    ctz: C.TIMEZONE
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function icsFile(s) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Boda//ES", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:boda-${utcStamp(s.event_date)}@invitacion`,
    `DTSTAMP:${utcStamp(new Date().toISOString())}`,
    `DTSTART:${utcStamp(s.event_date)}`,
    `DTEND:${utcStamp(s.event_end || s.event_date)}`,
    `SUMMARY:Boda ${s.couple_names}`,
    `LOCATION:${venueText(s).replace(/,/g, "\\,")}`,
    `DESCRIPTION:Más detalles: ${C.SITE_URL}`,
    "END:VEVENT", "END:VCALENDAR"
  ];
  return URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
}

// Pide al Apps Script que agregue el correo como invitado al evento de Google Calendar.
function requestCalendarInvite(code) {
  if (!C.CALENDAR_WEBHOOK_URL) return;
  fetch(C.CALENDAR_WEBHOOK_URL, {
    method: "POST", mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ code })
  }).catch(() => {});
}

function renderQR(el, text, size = 220) {
  el.innerHTML = "";
  new QRCode(el, { text, width: size, height: size, colorDark: "#722F40", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
}

function qrDataUrl(el) {
  const canvas = el.querySelector("canvas");
  return canvas ? canvas.toDataURL("image/png") : el.querySelector("img")?.src;
}

function toast(msg, isError = false) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = isError ? "toast show error" : "toast show";
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = "toast"), 3500);
}

// Login de administrador compartido por panel y check-in
async function requireAdmin(onReady) {
  const box = $("#auth");
  const app = $("#app");
  const show = async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { box.hidden = false; app.hidden = true; return; }
    const { data: ok } = await sb.rpc("is_admin");
    if (!ok) {
      box.hidden = false; app.hidden = true;
      $("#auth-error").textContent = "Este usuario no tiene permiso de administrador.";
      await sb.auth.signOut();
      return;
    }
    box.hidden = true; app.hidden = false;
    $("#who") && ($("#who").textContent = session.user.email);
    onReady(session);
  };
  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#auth-error").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("#auth-email").value.trim(), password: $("#auth-pass").value });
    if (error) { $("#auth-error").textContent = "Correo o contraseña incorrectos."; return; }
    show();
  });
  $("#logout")?.addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
  show();
}
