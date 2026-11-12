let invitations = [];
let settings = null;

const STATUS = { pendiente: "Pendiente", confirmado: "Confirmado", no_asiste: "No asiste" };

requireAdmin(async () => {
  bindTabs();
  bindInvitations();
  bindSettings();
  bindPhotos();
  await loadSettings();
  await Promise.all([loadInvitations(), loadPhotos()]);
});

// ---------------- Pestañas ----------------
function bindTabs() {
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => {
    $$(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b ? "true" : "false"));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  }));
}

// ---------------- Invitaciones ----------------
async function loadInvitations() {
  const { data, error } = await sb.from("invitations").select("*").order("family_name");
  if (error) { toast("No se pudieron cargar las invitaciones: " + error.message, true); return; }
  invitations = data;
  renderStats();
  renderInvitations();
}

function renderStats() {
  const sum = (f) => invitations.reduce((a, i) => a + f(i), 0);
  const stats = [
    [invitations.length, "invitaciones"],
    [sum((i) => i.max_guests), "lugares asignados"],
    [sum((i) => i.confirmed_guests), "personas confirmadas"],
    [sum((i) => (i.status === "pendiente" ? i.max_guests : 0)), "lugares sin respuesta"],
    [sum((i) => (i.status === "no_asiste" ? i.max_guests : 0)), "lugares que no asisten"],
    [sum((i) => i.checked_in_guests), "personas ya ingresaron"]
  ];
  $("#stats").innerHTML = stats.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");

  const recent = invitations.filter((i) => i.responded_at)
    .sort((a, b) => new Date(b.responded_at) - new Date(a.responded_at)).slice(0, 10);
  $("#recent").innerHTML = recent.length
    ? recent.map((i) => `<tr><td>${esc(i.family_name)}</td><td><span class="badge ${i.status}">${STATUS[i.status]}</span></td><td>${i.confirmed_guests}</td><td>${esc(i.message || "")}</td><td>${fmtDate(i.responded_at, { dateStyle: "medium", timeStyle: "short" })}</td></tr>`).join("")
    : `<tr><td colspan="5">Todavía no hay respuestas. Envía las primeras invitaciones desde la pestaña Invitaciones.</td></tr>`;
}

function renderInvitations() {
  const q = $("#search").value.trim().toLowerCase();
  const f = $("#filter").value;
  const rows = invitations.filter((i) =>
    (!f || i.status === f) && (!q || i.family_name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)));
  $("#inv-body").innerHTML = rows.length ? rows.map((i) => `
    <tr data-id="${i.id}">
      <td><strong>${esc(i.family_name)}</strong><br><span class="hint">${esc(i.side || "")}${i.phone ? " · " + esc(i.phone) : ""}</span></td>
      <td><code class="code">${esc(i.code)}</code></td>
      <td><input class="num" type="number" min="1" max="20" value="${i.max_guests}" data-act="max" aria-label="Lugares de ${esc(i.family_name)}"></td>
      <td><span class="badge ${i.status}">${STATUS[i.status]}</span></td>
      <td>${i.confirmed_guests}</td>
      <td>${i.checked_in_guests}</td>
      <td>${i.calendar_sent_at ? "Enviada" : (i.email ? "Pendiente" : "Sin correo")}</td>
      <td style="white-space:nowrap">
        <button class="btn small" data-act="qr">QR y enlace</button>
        <button class="btn danger small" data-act="del">Eliminar</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="8">No hay invitaciones que coincidan.</td></tr>`;
}

function bindInvitations() {
  $("#search").addEventListener("input", renderInvitations);
  $("#filter").addEventListener("change", renderInvitations);

  $("#add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const row = {
      family_name: $("#f-name").value.trim(),
      max_guests: Number($("#f-max").value),
      side: $("#f-side").value,
      phone: $("#f-phone").value.trim() || null,
      email: $("#f-email").value.trim().toLowerCase() || null,
      notes: $("#f-notes").value.trim() || null
    };
    const { error } = await sb.from("invitations").insert(row);
    if (error) { toast(error.message, true); return; }
    e.target.reset(); $("#f-max").value = 2;
    toast("Invitación agregada");
    loadInvitations();
  });

  $("#bulk-add").addEventListener("click", async () => {
    const rows = $("#bulk").value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, max, phone, side] = l.split(";").map((x) => (x || "").trim());
      return { family_name: name, max_guests: Math.min(20, Math.max(1, Number(max) || 1)), phone: phone || null, side: side || null };
    }).filter((r) => r.family_name);
    if (!rows.length) { toast("Pega al menos una línea con el formato indicado.", true); return; }
    const { error } = await sb.from("invitations").insert(rows);
    if (error) { toast(error.message, true); return; }
    $("#bulk").value = "";
    toast(`${rows.length} invitaciones agregadas`);
    loadInvitations();
  });

  $("#inv-body").addEventListener("change", async (e) => {
    if (e.target.dataset.act !== "max") return;
    const id = e.target.closest("tr").dataset.id;
    const inv = invitations.find((i) => i.id === id);
    const n = Number(e.target.value);
    if (n < inv.confirmed_guests) {
      toast(`Ya confirmaron ${inv.confirmed_guests}; no puedes asignar menos lugares.`, true);
      e.target.value = inv.max_guests; return;
    }
    const { error } = await sb.from("invitations").update({ max_guests: n }).eq("id", id);
    if (error) { toast(error.message, true); e.target.value = inv.max_guests; return; }
    toast("Lugares actualizados");
    loadInvitations();
  });

  $("#inv-body").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const inv = invitations.find((i) => i.id === btn.closest("tr").dataset.id);
    if (btn.dataset.act === "qr") openQR(inv);
    if (btn.dataset.act === "del") {
      if (!confirm(`¿Eliminar la invitación de ${inv.family_name}? Esto no se puede deshacer.`)) return;
      const { error } = await sb.from("invitations").delete().eq("id", inv.id);
      if (error) { toast(error.message, true); return; }
      toast("Invitación eliminada");
      loadInvitations();
    }
  });

  $("#export").addEventListener("click", () => {
    const cols = ["family_name", "code", "side", "phone", "email", "max_guests", "status", "confirmed_guests", "guest_names", "checked_in_guests", "message"];
    const head = ["Invitación", "Código", "Lado", "Teléfono", "Correo", "Lugares", "Estado", "Confirmados", "Nombres", "Ingresaron", "Mensaje"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [head.map(q).join(","), ...invitations.map((i) => cols.map((c) => q(c === "status" ? STATUS[i.status] : i[c])).join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "invitados-boda.csv"; a.click();
  });

  $("#qr-close").addEventListener("click", () => $("#qr-dialog").close());
}

function openQR(inv) {
  const url = inviteUrl(inv.code);
  $("#qr-title").textContent = inv.family_name;
  $("#qr-link").textContent = url;
  renderQR($("#qr-box"), url, 240);
  setTimeout(() => {
    $("#qr-download").href = qrDataUrl($("#qr-box")) || "#";
    $("#qr-download").download = `QR-${inv.code}.png`;
  }, 150);
  const text = `Hola ${inv.family_name}. ${settings ? settings.couple_names : "Nosotros"} nos casamos y queremos que nos acompañen. Aquí está su invitación: ${url}`;
  const phone = (inv.phone || "").replace(/\D/g, "");
  $("#qr-wa").href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  $("#qr-copy").onclick = async () => { await navigator.clipboard.writeText(url); toast("Enlace copiado"); };
  $("#qr-dialog").showModal();
}

// ---------------- Datos del evento ----------------
async function loadSettings() {
  const { data, error } = await sb.from("settings").select("*").eq("id", 1).single();
  if (error) { toast(error.message, true); return; }
  settings = data;
  $("#s-names").value = data.couple_names || "";
  $("#s-mono").value = data.monogram || "";
  $("#s-date").value = isoToLocalInput(data.event_date);
  $("#s-end").value = isoToLocalInput(data.event_end);
  $("#s-deadline").value = data.rsvp_deadline || "";
  $("#s-dress").value = data.dress_code || "";
  $("#s-venue").value = data.venue_name || "";
  $("#s-city").value = data.venue_city || "";
  $("#s-address").value = data.venue_address || "";
  $("#s-maps").value = data.maps_url || "";
  $("#s-msg").value = data.welcome_message || "";
  $("#s-program").value = (data.program || []).map((p) => `${p.hora} | ${p.actividad}`).join("\n");
  $("#s-kicker").value = data.hero_kicker || "";
  $("#s-quote1").value = data.band_quote_1 || "";
  $("#s-quote2").value = data.band_quote_2 || "";
  $("#s-dress-note").value = data.dress_note || "";
  renderColors("#palette-list", data.dress_palette || [], true);
  renderColors("#avoid-list", data.dress_avoid || [], false);
}

// Editor de colores (paleta sugerida y colores a evitar)
function renderColors(sel, items, withDetail) {
  $(sel).innerHTML = "";
  items.forEach((c) => addColorRow(sel, c, withDetail));
}
function addColorRow(sel, c = {}, withDetail) {
  const row = document.createElement("div");
  row.className = "color-row";
  row.innerHTML = `
    <input type="color" value="${esc(c.color || "#D7C2A5")}" aria-label="Color">
    <input class="c-name" placeholder="Nombre (ej. Arena)" value="${esc(c.nombre || "")}" aria-label="Nombre del color">
    ${withDetail ? `<input class="c-detail" placeholder="Detalle (ej. Champagne)" value="${esc(c.detalle || "")}" aria-label="Detalle">` : ""}
    <button class="btn danger small" type="button" aria-label="Quitar color">Quitar</button>`;
  row.querySelector("button").addEventListener("click", () => row.remove());
  $(sel).appendChild(row);
}
function readColors(sel) {
  return $$(".color-row", $(sel)).map((r) => {
    const o = { nombre: r.querySelector(".c-name").value.trim(), color: r.querySelector("input[type=color]").value.toUpperCase() };
    const d = r.querySelector(".c-detail");
    if (d) o.detalle = d.value.trim();
    return o;
  }).filter((o) => o.nombre);
}

function bindSettings() {
  $("#palette-add").addEventListener("click", () => addColorRow("#palette-list", {}, true));
  $("#avoid-add").addEventListener("click", () => addColorRow("#avoid-list", { color: "#FFFFFF" }, false));
  $("#settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const start = localInputToIso($("#s-date").value);
    const end = localInputToIso($("#s-end").value);
    if (new Date(end) <= new Date(start)) { toast("La hora de fin debe ser posterior al inicio.", true); return; }
    const program = $("#s-program").value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [hora, ...rest] = l.split("|");
      return { hora: hora.trim(), actividad: rest.join("|").trim() || hora.trim() };
    });
    const { error } = await sb.from("settings").update({
      couple_names: $("#s-names").value.trim(),
      monogram: $("#s-mono").value.trim(),
      event_date: start, event_end: end,
      rsvp_deadline: $("#s-deadline").value || null,
      dress_code: $("#s-dress").value.trim(),
      venue_name: $("#s-venue").value.trim(),
      venue_city: $("#s-city").value.trim(),
      venue_address: $("#s-address").value.trim(),
      maps_url: $("#s-maps").value.trim(),
      welcome_message: $("#s-msg").value.trim(),
      hero_kicker: $("#s-kicker").value.trim(),
      band_quote_1: $("#s-quote1").value.trim(),
      band_quote_2: $("#s-quote2").value.trim(),
      dress_note: $("#s-dress-note").value.trim(),
      dress_palette: readColors("#palette-list"),
      dress_avoid: readColors("#avoid-list"),
      program, updated_at: new Date().toISOString()
    }).eq("id", 1);
    if (error) { toast(error.message, true); return; }
    toast("Cambios guardados");
    loadSettings();
  });
}

// ---------------- Fotos ----------------
async function loadPhotos() {
  const { data, error } = await sb.from("photos").select("*").order("sort").order("created_at");
  if (error) { toast(error.message, true); return; }
  const hero = settings ? settings.hero_photo_path : null;
  $("#photo-grid").innerHTML = data.length ? data.map((p) => `
    <figure data-id="${p.id}" data-path="${esc(p.path)}">
      <img src="${esc(photoUrl(p.path))}" alt="" class="${p.path === hero ? "is-hero" : ""}">
      <input value="${esc(p.caption || "")}" placeholder="Pie de foto" data-act="caption" aria-label="Pie de foto">
      <div class="row">
        <button class="btn small ghost" data-act="hero">${p.path === hero ? "Portada actual" : "Usar de portada"}</button>
        <button class="btn small danger" data-act="del">Eliminar</button>
      </div>
    </figure>`).join("") : `<p class="hint">Aún no hay fotos. Sube la primera con el botón de arriba.</p>`;
}

function compress(file, max = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", quality);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error(`${file.name} no es una imagen válida`));
    img.src = URL.createObjectURL(file);
  });
}

function bindPhotos() {
  $("#upload").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    let ok = 0;
    for (const [n, file] of files.entries()) {
      $("#upload-status").textContent = `Subiendo ${n + 1} de ${files.length}…`;
      try {
        const blob = await compress(file);
        const path = `galeria/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const up = await sb.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const ins = await sb.from("photos").insert({ path, sort: Date.now() % 1e9 });
        if (ins.error) throw ins.error;
        ok++;
      } catch (err) { toast(err.message, true); }
    }
    $("#upload-status").textContent = `${ok} de ${files.length} fotos subidas.`;
    e.target.value = "";
    loadPhotos();
  });

  $("#photo-grid").addEventListener("change", async (e) => {
    if (e.target.dataset.act !== "caption") return;
    const id = e.target.closest("figure").dataset.id;
    const { error } = await sb.from("photos").update({ caption: e.target.value.trim() || null }).eq("id", id);
    toast(error ? error.message : "Pie de foto guardado", !!error);
  });

  $("#photo-grid").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const fig = btn.closest("figure");
    const { id, path } = fig.dataset;
    if (btn.dataset.act === "hero") {
      const { error } = await sb.from("settings").update({ hero_photo_path: path }).eq("id", 1);
      if (error) { toast(error.message, true); return; }
      settings.hero_photo_path = path; toast("Portada actualizada"); loadPhotos();
    }
    if (btn.dataset.act === "del") {
      if (!confirm("¿Eliminar esta foto? Esto no se puede deshacer.")) return;
      await sb.storage.from("fotos").remove([path]);
      const { error } = await sb.from("photos").delete().eq("id", id);
      if (error) { toast(error.message, true); return; }
      if (settings.hero_photo_path === path) {
        await sb.from("settings").update({ hero_photo_path: null }).eq("id", 1);
        settings.hero_photo_path = null;
      }
      toast("Foto eliminada"); loadPhotos();
    }
  });
}
