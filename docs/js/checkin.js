let scanner = null;
let current = null;
let busy = false;

requireAdmin(() => {
  loadTotals();
  $("#start").addEventListener("click", startCamera);
  $("#stop").addEventListener("click", stopCamera);
  $("#manual").addEventListener("submit", (e) => { e.preventDefault(); lookup($("#manual-code").value); });
  $("#r-save").addEventListener("click", save);
  $("#r-next").addEventListener("click", reset);
});

async function loadTotals() {
  const { data } = await sb.from("invitations").select("confirmed_guests,checked_in_guests,max_guests,status");
  if (!data) return;
  const conf = data.reduce((a, i) => a + i.confirmed_guests, 0);
  const inn = data.reduce((a, i) => a + i.checked_in_guests, 0);
  $("#totals").innerHTML = `<div class="stat"><b>${inn}</b><span>han ingresado</span></div><div class="stat"><b>${conf}</b><span>confirmados</span></div>`;
}

function extractCode(text) {
  const t = String(text || "").trim();
  try { const c = new URL(t).searchParams.get("c"); if (c) return c.toUpperCase(); } catch (_) { /* no es URL */ }
  return t.toUpperCase();
}

async function startCamera() {
  scanner = scanner || new Html5Qrcode("reader");
  try {
    await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } },
      (text) => { if (!busy) lookup(text); });
    $("#start").hidden = true; $("#stop").hidden = false;
  } catch (err) {
    toast("No se pudo abrir la cámara. Revisa el permiso del navegador o escribe el código.", true);
  }
}

async function stopCamera() {
  if (scanner && scanner.isScanning) await scanner.stop();
  $("#start").hidden = false; $("#stop").hidden = true;
}

async function lookup(raw) {
  const code = extractCode(raw);
  if (!code) return;
  busy = true;
  const { data, error } = await sb.from("invitations").select("*").eq("code", code).maybeSingle();
  if (error || !data) {
    toast(`El código ${code} no corresponde a ninguna invitación.`, true);
    setTimeout(() => (busy = false), 1500);
    return;
  }
  current = data;
  try { if (scanner && scanner.isScanning) scanner.pause(true); } catch (_) { /* ya pausado */ }

  const expected = data.status === "confirmado" ? data.confirmed_guests : data.max_guests;
  const remaining = Math.max(0, expected - data.checked_in_guests);
  $("#r-name").textContent = data.family_name;
  const statusText = {
    confirmado: `Confirmó ${data.confirmed_guests} de ${data.max_guests} lugares.`,
    pendiente: `No confirmó. Tiene ${data.max_guests} lugares asignados.`,
    no_asiste: `Respondió que no asistiría. Tenía ${data.max_guests} lugares.`
  }[data.status];
  $("#r-status").textContent = statusText + (data.guest_names ? ` Nombres: ${data.guest_names.replace(/\n/g, ", ")}.` : "");
  $("#r-done").hidden = data.checked_in_guests === 0;
  $("#r-done").textContent = `Ya ingresaron ${data.checked_in_guests} persona(s) con este código.`;
  $("#r-count").value = remaining || 1;
  $("#r-count").max = data.max_guests;
  $("#result").hidden = false;
  $("#r-count").focus();
}

async function save() {
  if (!current) return;
  const n = Number($("#r-count").value);
  if (!Number.isInteger(n) || n < 1) { toast("Indica cuántas personas ingresan.", true); return; }
  const total = current.checked_in_guests + n;
  if (total > current.max_guests &&
      !confirm(`Con este registro serían ${total} personas y la invitación tiene ${current.max_guests} lugares. ¿Registrar de todos modos?`)) return;
  $("#r-save").disabled = true;
  const { error } = await sb.from("invitations")
    .update({ checked_in_guests: total, checked_in_at: new Date().toISOString() })
    .eq("id", current.id);
  $("#r-save").disabled = false;
  if (error) { toast(error.message, true); return; }
  toast(`Ingreso registrado: ${current.family_name} (${n})`);
  loadTotals();
  reset();
}

function reset() {
  current = null;
  $("#result").hidden = true;
  $("#manual-code").value = "";
  busy = false;
  try { if (scanner) scanner.resume(); } catch (_) { /* cámara no estaba pausada */ }
}
