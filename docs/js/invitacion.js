// =====================================================================
// OWE · Invitación del invitado
// Sobre, portada con video, animaciones al bajar, galería con visor,
// confirmación con contador de personas y pase QR con pétalos.
// =====================================================================

// Fotos que se muestran si todavía no se han subido fotos desde el panel
// [archivo, orientación] · el orden está pensado para que la cuadrícula no deje huecos
const DEFAULT_GALLERY = [
  ["01", "h"], ["02", "v"], ["04", "v"], ["08", "v"], ["09", "v"],
  ["11", "v"], ["03", "h"], ["12", "v"], ["16", "v"], ["14", "v"]
].map(([n, o]) => ({ src: `img/galeria/${n}.jpg`, caption: "", orient: o }));

// Icono según la actividad del programa (por palabra clave)
const PROGRAM_ICONS = [
  [/bienvenida|recepci[oó]n|llegada/i, '<path d="M8 40V18l16-10 16 10v22"/><path d="M19 40V27h10v13"/>'],
  [/ceremonia|misa|iglesia|boda civil|votos/i, '<circle cx="18" cy="28" r="9"/><circle cx="30" cy="28" r="9"/><path d="M15 15l3 4 3-4M27 15l3 4 3-4"/>'],
  [/c[oó]ctel|brindis|bebidas/i, '<path d="M12 8h12l-6 12zM18 20v16M13 36h10"/><path d="M28 12h10l-5 10zM33 22v14M29 36h8"/>'],
  [/cena|comida|banquete|almuerzo/i, '<circle cx="24" cy="26" r="11"/><circle cx="24" cy="26" r="6"/><path d="M7 12v10M5 12v6a2 2 0 0 0 4 0v-6M7 24v14M41 12c-3 2-3 9 0 12v14"/>'],
  [/fiesta|baile|m[uú]sica|vals/i, '<path d="M18 34V12l18-4v22"/><circle cx="14" cy="34" r="4"/><circle cx="32" cy="30" r="4"/>'],
  [/pastel|torta|postre/i, '<path d="M10 40h28M12 40V28h24v12M15 28v-6h18v6M24 22v-6"/><path d="M24 12c-1 1-1 3 0 4 1-1 1-3 0-4z"/>'],
  [/foto|sesi[oó]n/i, '<rect x="7" y="14" width="34" height="24" rx="3"/><circle cx="24" cy="26" r="7"/><path d="M17 14l3-5h8l3 5"/>']
];
const DEFAULT_ICON = '<path d="M24 40c-8-6-15-11-15-19a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 8-7 13-15 19z"/>';

(async function () {
  const code = (new URLSearchParams(location.search).get("c") || "").trim().toUpperCase();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let settings = null;
  let inv = null;

  // ---------- Sobre de entrada ----------
  const body = document.body;
  const openEnvelope = () => {
    if (!body.classList.contains("is-sealed")) return;
    body.classList.add("opening");
    try { sessionStorage.setItem("owe-opened", "1"); } catch {}
    setTimeout(() => {
      body.classList.remove("is-sealed");
      body.classList.add("opened");
      playHero();
      revealHero();
    }, reduceMotion ? 0 : 1500);
  };
  $("#open-env").addEventListener("click", openEnvelope);
  $("#envelope").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openEnvelope(); });
  let alreadyOpened = false;
  try { alreadyOpened = sessionStorage.getItem("owe-opened") === "1"; } catch {}
  if (alreadyOpened || location.hash) {
    body.classList.remove("is-sealed"); body.classList.add("opened", "opening");
  } else {
    $("#open-env").focus({ preventScroll: true });
  }

  function playHero() {
    const v = $("#hero-video");
    if (reduceMotion || !v) return;
    v.play().catch(() => {});
  }
  function revealHero() { $$(".hero .reveal").forEach((el, i) => { el.style.setProperty("--d", `${0.15 + i * 0.12}s`); el.classList.add("in"); }); }
  if (body.classList.contains("opened")) { playHero(); revealHero(); }

  // ---------- Datos del evento ----------
  const { data: s, error } = await sb.from("settings").select("*").eq("id", 1).single();
  if (error || !s) { $("#names").textContent = "No pudimos cargar la invitación."; return; }
  settings = s;

  const [n1, n2] = String(s.couple_names).split(/\s*(?:&|\by\b)\s*/);
  document.title = `${s.couple_names} · Nos casamos`;
  if (n2) {
    $("#names").innerHTML = `<span class="n1">${esc(n1)}</span><span class="amp">&amp;</span><span class="n2">${esc(n2)}</span>`;
  } else {
    $("#names").textContent = s.couple_names;
  }
  // En las letras caligráficas el "&" va en cursiva serif (el de la caligráfica no se lee bien)
  const withAmp = (txt) => esc(txt).replace(/\s*&amp;\s*/g, ' <span class="amp-i">&amp;</span> ');
  $("#env-names").innerHTML = withAmp(s.couple_names);
  $("#signature").innerHTML = withAmp(s.couple_names);
  $("#footer").innerHTML = withAmp(s.couple_names);
  const mono = s.monogram || "";
  $$("[data-mono]").forEach((t) => {
    const [a, b] = mono.split(/\s*&\s*/);
    t.innerHTML = b !== undefined
      ? `<tspan>${esc(a)}</tspan><tspan class="amp-t" dx="2">&amp;</tspan><tspan dx="2">${esc(b)}</tspan>`
      : esc(mono);
  });
  fitMonograms();

  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-HN", {
    timeZone: C.TIMEZONE, weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).formatToParts(new Date(s.event_date)).map((p) => [p.type, p.value]));
  $("#date").innerHTML = `<span class="wd">${esc(parts.weekday)}</span><span class="dmy">${esc(parts.month)} <b>${esc(parts.day)}</b> ${esc(parts.year)}</span>`;
  $("#foot-date").textContent = `${parts.day} · ${parts.month} · ${parts.year}`;
  $("#place").textContent = [s.venue_name, s.venue_city].filter(Boolean).join(" · ");
  $("#message").textContent = s.welcome_message || "";
  $("#d-date").textContent = fmtLongDate(s.event_date);
  $("#d-time").textContent = fmtTime(s.event_date);
  $("#d-venue").textContent = venueText(s);
  $("#dress-title").textContent = s.dress_code || "Formal";
  if (s.hero_kicker) $("#hero-kicker").textContent = s.hero_kicker;
  if (s.band_quote_1) $("#quote-1").textContent = `“${s.band_quote_1.replace(/^[“"]|[”"]$/g, "")}”`;
  if (s.band_quote_2) $("#quote-2").textContent = s.band_quote_2;
  if (s.dress_note) $("#dress-note").textContent = s.dress_note;
  const palette = Array.isArray(s.dress_palette) ? s.dress_palette : [];
  const avoid = Array.isArray(s.dress_avoid) ? s.dress_avoid : [];
  const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "#cccccc");
  $("#swatches").innerHTML = palette.map((c) =>
    `<li><span class="sw" style="--c:${safeColor(c.color)}"></span><b>${esc(c.nombre)}</b>${c.detalle ? `<small>${esc(c.detalle)}</small>` : ""}</li>`).join("");
  $("#swatches").style.setProperty("--n", Math.min(palette.length, 5));
  $("#avoid").innerHTML = avoid.length
    ? `<span class="avoid-label">Les pedimos evitar</span>` + avoid.map((c) =>
        `<span class="sw no" style="--c:${safeColor(c.color)}" title="${esc(c.nombre)}"></span><span class="avoid-name">${esc(c.nombre)}</span>`).join("")
    : "";
  $("#dress").hidden = !palette.length && !avoid.length && !s.dress_code;
  if (s.maps_url) { $("#maps").href = s.maps_url; $("#maps").hidden = false; }
  $("#gcal-top").href = googleCalendarLink(s);
  if (s.hero_photo_path) {
    const url = photoUrl(s.hero_photo_path);
    $("#hero").classList.add("has-photo");
    $("#hero").style.setProperty("--hero-img", `url("${url}")`);
    $("#hero-video").setAttribute("poster", url);
  }
  if (s.rsvp_deadline) {
    const dl = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${s.rsvp_deadline}T12:00:00Z`));
    $("#deadline-date").textContent = dl;
    $("#deadline").hidden = false;
  }

  // Programa
  const program = Array.isArray(s.program) ? s.program : [];
  $("#program").innerHTML = program.map((p, i) => {
    const icon = (PROGRAM_ICONS.find(([re]) => re.test(p.actividad || "")) || [, DEFAULT_ICON])[1];
    return `<li class="reveal" style="--d:${i * 0.08}s">
      <span class="p-ico"><svg viewBox="0 0 48 48" aria-hidden="true">${icon}</svg></span>
      <span class="p-text"><time>${esc(p.hora)}</time><strong>${esc(p.actividad)}</strong></span>
    </li>`;
  }).join("");
  $("#program-block").hidden = program.length === 0;

  // ---------- Cuenta regresiva ----------
  const cd = $("#countdown");
  const units = [["d", "días"], ["h", "horas"], ["m", "minutos"], ["s", "segundos"]];
  cd.innerHTML = units.map(([k, l]) => `<div><b data-u="${k}">0</b><span>${l}</span></div>`).join("");
  const last = {};
  const tick = () => {
    const ms = new Date(s.event_date) - new Date();
    if (ms <= 0) { cd.innerHTML = '<div style="min-width:auto;padding:.8rem 1.4rem"><b style="font-size:2rem">¡Hoy es el día!</b></div>'; clearInterval(timer); return; }
    const val = { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
    for (const [k] of units) {
      if (last[k] === val[k]) continue;
      const b = cd.querySelector(`[data-u="${k}"]`);
      b.textContent = k === "d" ? val[k] : String(val[k]).padStart(2, "0");
      if (last[k] !== undefined && !reduceMotion) { b.classList.remove("tick"); void b.offsetWidth; b.classList.add("tick"); }
      last[k] = val[k];
    }
  };
  tick(); const timer = setInterval(tick, 1000);

  // ---------- Galería ----------
  const { data: photos } = await sb.from("photos").select("*").order("sort").order("created_at");
  const gallery = photos && photos.length
    ? photos.map((p) => ({ src: photoUrl(p.path), caption: p.caption || "" }))
    : DEFAULT_GALLERY;
  $("#gallery").innerHTML = gallery.slice(0, 10).map((p, i) =>
    `<figure class="reveal ${p.orient === "h" ? "landscape" : ""}" style="--d:${(i % 3) * 0.1}s" data-i="${i}" tabindex="0" role="button" aria-label="Ver foto ${i + 1}">
      <img loading="lazy" src="${esc(p.src)}" alt="${esc(p.caption || "Foto de los novios")}">
      ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}
    </figure>`).join("");
  // Si una foto falla al cargar, se reintenta una vez; si vuelve a fallar se oculta
  $$("#gallery img").forEach((img) => {
    img.addEventListener("error", () => {
      if (!img.dataset.retry) {
        img.dataset.retry = "1";
        const src = img.getAttribute("src");
        setTimeout(() => { img.src = src + (src.includes("?") ? "&" : "?") + "r=" + Date.now(); }, 400);
      } else {
        img.closest("figure").hidden = true;
      }
    });
    if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event("error"));
  });
  // Fotos subidas desde el panel: se detecta la orientación al cargar
  $$("#gallery figure:not(.landscape) img").forEach((img) => {
    const mark = () => { if (img.naturalWidth > img.naturalHeight * 1.15) img.closest("figure").classList.add("landscape"); };
    img.complete ? mark() : img.addEventListener("load", mark, { once: true });
  });
  setupLightbox(gallery.slice(0, 10));

  // ---------- Animaciones al bajar, navegación y parallax ----------
  setupScrollEffects();

  // ---------- Invitación personal ----------
  if (!code) { $("#no-code").hidden = false; $("#greeting").textContent = "Nos casamos y queremos compartirlo contigo."; return; }
  const { data: invData } = await sb.rpc("get_invitation", { p_code: code });
  if (!invData) { $("#bad-code").hidden = false; $("#greeting").textContent = "Nos casamos y queremos compartirlo contigo."; return; }
  inv = invData;

  $("#env-to").textContent = inv.family_name;
  $("#greeting").textContent = `${inv.family_name}, nos casamos y queremos que estén con nosotros.`;
  $("#reply-for").textContent = inv.family_name;
  $("#seats").textContent = inv.max_guests === 1
    ? "Hemos reservado 1 lugar en tu honor"
    : `Hemos reservado ${inv.max_guests} lugares en su honor`;

  // Contador de personas (el select oculto conserva el valor)
  const sel = $("#guests");
  sel.innerHTML = Array.from({ length: inv.max_guests }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  const out = $("#guests-out");
  const setGuests = (n) => {
    n = Math.min(inv.max_guests, Math.max(1, n));
    sel.value = String(n); out.textContent = n;
    out.classList.remove("bump"); void out.offsetWidth; out.classList.add("bump");
    $$("#stepper .step")[0].disabled = n <= 1;
    $$("#stepper .step")[1].disabled = n >= inv.max_guests;
    $("#guests-hint").textContent = n === 1 ? "1 persona" : `${n} personas de ${inv.max_guests}`;
  };
  $("#stepper").addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (b) setGuests(Number(sel.value) + Number(b.dataset.step));
  });

  const form = $("#rsvp");
  form.addEventListener("change", () => { $("#yes-fields").hidden = form.attending.value !== "yes"; });

  function showForm() {
    $("#confirmed").hidden = true; form.hidden = false;
    if (inv.status === "confirmado") form.attending.value = "yes";
    if (inv.status === "no_asiste") form.attending.value = "no";
    setGuests(inv.confirmed_guests || inv.max_guests);
    $("#names-input").value = inv.guest_names || "";
    $("#email").value = inv.email || "";
    $("#note").value = inv.message || "";
    $("#yes-fields").hidden = form.attending.value !== "yes";
    requestAnimationFrame(() => form.classList.add("in"));
  }

  function showDone() {
    form.hidden = true; $("#confirmed").hidden = false;
    if (inv.status === "confirmado") {
      $("#done-title").textContent = "¡Gracias!";
      $("#done-text").textContent = inv.confirmed_guests === 1
        ? "Qué alegría. Te esperamos; reservamos 1 lugar para ti."
        : `Qué alegría. Los esperamos; reservamos ${inv.confirmed_guests} lugares.`;
      $("#entry").hidden = false;
      $("#ticket-names").innerHTML = esc(settings.couple_names).replace(/\s*&amp;\s*/g, ' <span class="amp-i">&amp;</span> ');
      $("#ticket-family").textContent = inv.family_name;
      $("#ticket-seats").textContent = inv.confirmed_guests === 1 ? "1 persona" : `${inv.confirmed_guests} personas`;
      renderQR($("#qr"), inviteUrl(inv.code), 200);
      setTimeout(() => { $("#qr-dl").href = qrDataUrl($("#qr")) || "#"; }, 150);
      $("#gcal").href = googleCalendarLink(settings);
      $("#ics").href = icsFile(settings);
    } else {
      $("#done-title").textContent = "Gracias por avisarnos";
      $("#done-text").textContent = "Los vamos a extrañar. Si cambian sus planes, pueden actualizar su respuesta aquí mismo.";
      $("#entry").hidden = true;
    }
  }

  $("#change").addEventListener("click", showForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const attending = form.attending.value;
    if (!attending) { toast("Elige si asistirán o no.", true); return; }
    const email = $("#email").value.trim();
    if (attending === "yes" && email && !$("#email").checkValidity()) { toast("Revisa el correo electrónico.", true); return; }

    $("#send").disabled = true;
    $("#send").textContent = "Enviando…";
    const { data, error } = await sb.rpc("submit_rsvp", {
      p_code: code,
      p_attending: attending === "yes",
      p_guests: attending === "yes" ? Number(sel.value) : 0,
      p_names: $("#names-input").value,
      p_email: email,
      p_message: $("#note").value
    });
    $("#send").disabled = false;
    $("#send").textContent = "Enviar respuesta";
    if (error) { toast(error.message, true); return; }
    inv = data;
    if (inv.status === "confirmado" && inv.email) requestCalendarInvite(inv.code);
    showDone();
    $("#rsvp-block").scrollIntoView({ behavior: "smooth", block: "start" });
    if (inv.status === "confirmado") petals();
  });

  if (inv.status === "pendiente") showForm(); else showDone();
})();

// ---------------------------------------------------------------------
function setupScrollEffects() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Aparecer al entrar en pantalla
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$("main .reveal, footer .reveal").forEach((el) => io.observe(el));

  // Navegación flotante: aparece después de la portada y marca la sección actual
  const nav = $("#dots-nav");
  const links = $$("a", nav);
  const sections = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const bands = $$(".band");
  const prog = $("#program");
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    nav.classList.toggle("show", y > vh * 0.75);
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top < vh * 0.45) current = s;
    links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${current?.id}` && !a.classList.contains("nav-cta")));
    if (reduce) return;
    // Parallax de las bandas
    for (const b of bands) {
      const r = b.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      const p = (r.top + r.height / 2 - vh / 2) / vh;
      b.style.setProperty("--py", `${(p * -12).toFixed(2)}%`);
    }
    // La línea del programa se dibuja al bajar
    if (prog) {
      const r = prog.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / r.height));
      prog.style.setProperty("--prog", p.toFixed(3));
    }
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
  if (reduce && prog) prog.style.setProperty("--prog", 1);
}

function setupLightbox(items) {
  const dlg = $("#lightbox"), img = $("#lb-img"), cap = $("#lb-cap");
  let i = 0;
  const show = (n) => {
    i = (n + items.length) % items.length;
    img.src = items[i].src; img.alt = items[i].caption || "Foto de los novios";
    cap.textContent = items[i].caption || "";
    img.style.animation = "none"; void img.offsetWidth; img.style.animation = "";
  };
  const open = (n) => { show(n); dlg.showModal(); };
  $("#gallery").addEventListener("click", (e) => { const f = e.target.closest("figure"); if (f) open(Number(f.dataset.i)); });
  $("#gallery").addEventListener("keydown", (e) => {
    const f = e.target.closest("figure");
    if (f && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(Number(f.dataset.i)); }
  });
  dlg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lb]");
    if (b) { b.dataset.lb === "close" ? dlg.close() : show(i + Number(b.dataset.lb)); return; }
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(i + 1);
    if (e.key === "ArrowLeft") show(i - 1);
  });
  let x0 = null;
  dlg.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 45) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });
}

// Lluvia de pétalos al confirmar
function petals() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $("#petals"), ctx = cv.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const colors = ["#E7CAC4", "#D9A9A6", "#B89565", "#E9D9BC", "#C98C95", "#FFFFFF"];
  const ps = Array.from({ length: 90 }, () => ({
    x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.8,
    r: 5 + Math.random() * 7, vy: 1 + Math.random() * 1.8, vx: -0.6 + Math.random() * 1.2,
    a: Math.random() * Math.PI * 2, va: -0.05 + Math.random() * 0.1, sw: Math.random() * 2,
    c: colors[Math.floor(Math.random() * colors.length)]
  }));
  const t0 = performance.now();
  const frame = (t) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const fade = Math.max(0, 1 - Math.max(0, t - t0 - 4500) / 1500);
    for (const p of ps) {
      p.y += p.vy; p.x += p.vx + Math.sin((t / 600) + p.sw) * 0.6; p.a += p.va;
      ctx.save(); ctx.globalAlpha = 0.9 * fade; ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (fade > 0) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

// Centra y ajusta el monograma caligráfico dentro de su sello.
// Las letras caligráficas tienen trazos que sobresalen (la "S"), así que se mide la caja real.
function fitMonograms() {
  const run = () => $$("[data-mono][data-cx]").forEach((t) => {
    t.removeAttribute("transform");
    const cx = Number(t.dataset.cx), cy = Number(t.dataset.cy), maxW = Number(t.dataset.maxw);
    let b = t.getBBox();
    if (!b.width) return;
    const k = Math.min(1, maxW / b.width);
    const dx = cx - (b.x + b.width / 2);
    const dy = cy - (b.y + b.height / 2) + b.height * 0.06; // leve compensación óptica hacia abajo
    // escala alrededor del centro del sello y luego corrige el desplazamiento
    t.setAttribute("transform", `translate(${cx} ${cy}) scale(${k}) translate(${-cx + dx} ${-cy + dy})`);
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(run));
}
