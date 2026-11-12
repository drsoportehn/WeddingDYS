// =====================================================================
// CONFIGURACIÓN: reemplaza estos 3 valores (ver README, pasos 2 a 5)
// La "anon key" es pública por diseño: la seguridad la dan las reglas RLS.
// =====================================================================
window.CONFIG = {
  SUPABASE_URL: "https://evnjxclmzzoduimmdxfm.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bmp4Y2xtenpvZHVpbW1keGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MTQzMzAsImV4cCI6MjExMDA5MDMzMH0.7RuCIU7C8DxktA6FrXPezmHkGmDWKXwm1rhST8BjodY",
  // Dirección pública de la invitación (GitHub Pages), terminada en /
  SITE_URL: "https://drsoportehn.github.io/WeddingDYS/",
  // URL del Web App de Google Apps Script (envío de invitación de calendario).
  // Déjalo vacío para desactivar el envío automático.
  CALENDAR_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbyfSsBvBPpSTeNnZQc8n3EKRyovmnzNYQTghYKioap99KUhxleJnPyn8PBYyYPoosB9/exec",
  TIMEZONE: "America/Tegucigalpa",
  TZ_OFFSET: "-06:00"
};

// Mientras no tengamos la dirección de GitHub Pages, los enlaces y QR usan la dirección actual
if (window.CONFIG.SITE_URL.includes("TU-USUARIO")) {
  window.CONFIG.SITE_URL = location.origin + location.pathname.replace(/[^/]*$/, "");
}
