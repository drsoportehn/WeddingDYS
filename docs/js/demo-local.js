// =====================================================================
// MODO DEMO LOCAL
// Se activa solo cuando config.js todavía tiene los valores de ejemplo
// (o con ?demo=1 en la URL). Reemplaza Supabase por una base de datos
// falsa guardada en el navegador (localStorage), para probar todo sin
// cuentas. Con llaves reales de Supabase este archivo no hace nada.
// Para borrar los datos de prueba: abre cualquier página con ?reset=1
// =====================================================================
(function () {
  const C = window.CONFIG;
  const qs = new URLSearchParams(location.search);
  const placeholder = !C.SUPABASE_URL || C.SUPABASE_URL.includes("TU-PROYECTO");
  if (!placeholder && qs.get("demo") !== "1") return;

  const KEY = "owe-demo-db";
  const FILES = "owe-demo-file:";
  if (qs.get("reset") === "1") {
    Object.keys(localStorage).filter((k) => k === KEY || k.startsWith(FILES)).forEach((k) => localStorage.removeItem(k));
  }

  // La dirección del sitio pasa a ser la carpeta local actual
  C.SITE_URL = location.origin + location.pathname.replace(/[^/]*$/, "");
  C.CALENDAR_WEBHOOK_URL = "";

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
  const now = () => new Date().toISOString();
  const code8 = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

  function invitation(r) {
    return Object.assign({
      id: uuid(), code: code8(), family_name: "", side: null, phone: null, email: null,
      max_guests: 1, status: "pendiente", confirmed_guests: 0, guest_names: null, message: null,
      responded_at: null, calendar_sent_at: null, checked_in_guests: 0, checked_in_at: null,
      notes: null, created_at: now()
    }, r);
  }

  function seed() {
    return {
      settings: [{
        id: 1, couple_names: "Darwin & Sofía", monogram: "D & S",
        event_date: "2027-10-30T22:00:00.000Z", event_end: "2027-10-31T06:00:00.000Z",
        rsvp_deadline: "2027-06-30", venue_name: "Villa Shalom",
        venue_city: "Santa Rosa de Copán, Honduras", venue_address: "", maps_url: "",
        dress_code: "Formal",
        welcome_message: "Queremos celebrar este día con las personas que más queremos. Nos encantaría que nos acompañen.",
        program: [
          { hora: "3:00 p. m.", actividad: "Bienvenida" },
          { hora: "4:00 p. m.", actividad: "Ceremonia" },
          { hora: "5:00 p. m.", actividad: "Cóctel" },
          { hora: "6:30 p. m.", actividad: "Cena" },
          { hora: "8:00 p. m.", actividad: "Fiesta" }
        ],
        hero_kicker: "Con la bendición de Dios y de nuestras familias",
        band_quote_1: "Dos caminos que se encontraron para seguir siendo uno solo.",
        band_quote_2: "Para siempre",
        dress_note: "Nos encantaría verlos en los tonos de nuestra boda",
        dress_palette: [
          { nombre: "Arena", detalle: "Champagne", color: "#D7C2A5" },
          { nombre: "Blush", detalle: "Rosa suave", color: "#E7CAC4" },
          { nombre: "Moca", detalle: "Café cálido", color: "#80635B" },
          { nombre: "Negro", detalle: "Clásico", color: "#1E1B1C" }
        ],
        dress_avoid: [{ nombre: "Blanco", color: "#FFFFFF" }, { nombre: "Rojo vino", color: "#722F40" }],
        hero_photo_path: null, updated_at: now()
      }],
      photos: [],
      invitations: [
        invitation({ code: "PRUEBA01", family_name: "Familia Prueba", side: "Novio", max_guests: 4 }),
        invitation({ code: "PRUEBA02", family_name: "Pareja Prueba", side: "Novia", max_guests: 2 }),
        invitation({ code: "PRUEBA03", family_name: "Invitado Prueba", side: "Ambos", max_guests: 1 })
      ],
      session: null
    };
  }

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { return seed(); } };
  const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  if (!localStorage.getItem(KEY)) save(seed());
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const err = (message) => ({ data: null, error: { message } });

  function validate(table, row) {
    if (table !== "invitations") return null;
    if (!row.family_name) return "El nombre es obligatorio.";
    if (row.max_guests < 1 || row.max_guests > 20) return "Los lugares deben estar entre 1 y 20.";
    if (row.confirmed_guests > row.max_guests) return "Hay más confirmados que lugares.";
    return null;
  }

  // ---------- Constructor de consultas (subconjunto de supabase-js) ----------
  class Query {
    constructor(table) { this.t = table; this.op = "select"; this.filters = []; this.orders = []; this.mode = "many"; }
    select() { if (this.op === "select") this.op = "select"; this.returning = true; return this; }
    eq(col, val) { this.filters.push([col, val]); return this; }
    order(col, o = {}) { this.orders.push([col, o.ascending !== false]); return this; }
    single() { this.mode = "single"; return this; }
    maybeSingle() { this.mode = "maybe"; return this; }
    insert(rows) { this.op = "insert"; this.payload = rows; return this; }
    update(vals) { this.op = "update"; this.payload = vals; return this; }
    delete() { this.op = "delete"; return this; }
    then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }

    run() {
      const db = load();
      if (this.t !== "settings" && this.t !== "photos" && this.t !== "invitations") return err(`Tabla desconocida: ${this.t}`);
      // Mismas reglas que RLS: escribir requiere admin; invitados no leen la tabla de invitaciones
      if (this.op !== "select" && !db.session) return err("Necesitas iniciar sesión como administrador.");
      if (this.t === "invitations" && this.op === "select" && !db.session) return { data: [], error: null };

      let rows = db[this.t];
      const match = (r) => this.filters.every(([c, v]) => r[c] === v);

      if (this.op === "insert") {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r) =>
          this.t === "invitations" ? invitation(clone(r))
            : Object.assign({ id: uuid(), caption: null, sort: 0, created_at: now() }, clone(r)));
        for (const r of list) {
          const e = validate(this.t, r);
          if (e) return err(e);
          if (this.t === "invitations" && rows.some((x) => x.code === r.code)) return err("Ese código ya existe.");
        }
        db[this.t] = rows.concat(list); save(db);
        return { data: clone(list), error: null };
      }
      if (this.op === "update") {
        const hit = rows.filter(match);
        for (const r of hit) {
          const next = Object.assign({}, r, clone(this.payload));
          const e = validate(this.t, next);
          if (e) return err(e);
          Object.assign(r, next);
        }
        save(db);
        return { data: clone(hit), error: null };
      }
      if (this.op === "delete") {
        db[this.t] = rows.filter((r) => !match(r)); save(db);
        return { data: null, error: null };
      }

      let out = rows.filter(match);
      if (this.orders.length) {
        out = out.slice().sort((a, b) => {
          for (const [c, asc] of this.orders) {
            const x = a[c], y = b[c];
            if (x === y) continue;
            const cmp = typeof x === "string" ? x.localeCompare(y, "es") : (x ?? 0) - (y ?? 0);
            return asc ? cmp : -cmp;
          }
          return 0;
        });
      }
      out = clone(out);
      if (this.mode === "single") return out.length === 1 ? { data: out[0], error: null } : err("No se encontró el registro.");
      if (this.mode === "maybe") return { data: out[0] || null, error: null };
      return { data: out, error: null };
    }
  }

  // ---------- Funciones públicas (equivalentes a las de schema.sql) ----------
  function publicInv(i) {
    if (!i) return null;
    const { code, family_name, max_guests, status, confirmed_guests, guest_names, email, message, responded_at } = i;
    return { code, family_name, max_guests, status, confirmed_guests, guest_names, email, message, responded_at };
  }

  const rpcs = {
    is_admin: (db) => !!db.session,
    get_invitation: (db, p) => publicInv(db.invitations.find((i) => i.code === String(p.p_code || "").trim().toUpperCase())),
    submit_rsvp: (db, p) => {
      const inv = db.invitations.find((i) => i.code === String(p.p_code || "").trim().toUpperCase());
      if (!inv) throw new Error("Código de invitación no válido");
      const dl = db.settings[0].rsvp_deadline;
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());
      if (dl && today > dl) throw new Error("La fecha límite para confirmar ya pasó. Escríbenos directamente.");
      if (p.p_attending && (!p.p_guests || p.p_guests < 1 || p.p_guests > inv.max_guests)) {
        throw new Error(`El número de asistentes debe estar entre 1 y ${inv.max_guests}`);
      }
      const trimOrNull = (s) => (s && String(s).trim()) || null;
      Object.assign(inv, {
        status: p.p_attending ? "confirmado" : "no_asiste",
        confirmed_guests: p.p_attending ? p.p_guests : 0,
        guest_names: trimOrNull(p.p_names)?.slice(0, 500) ?? null,
        email: trimOrNull(p.p_email)?.toLowerCase() || inv.email,
        message: trimOrNull(p.p_message)?.slice(0, 1000) ?? null,
        responded_at: now()
      });
      save(db);
      return publicInv(inv);
    }
  };

  // ---------- Fotos (guardadas como data URL) ----------
  const toDataUrl = (blob) => new Promise((ok, ko) => {
    const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob);
  });

  const storage = {
    from: () => ({
      getPublicUrl: (path) => ({ data: { publicUrl: localStorage.getItem(FILES + path) || "" } }),
      upload: async (path, blob) => {
        if (!load().session) return err("Necesitas iniciar sesión como administrador.");
        try { localStorage.setItem(FILES + path, await toDataUrl(blob)); }
        catch { return err("El navegador se quedó sin espacio para fotos de prueba. Borra algunas."); }
        return { data: { path }, error: null };
      },
      remove: async (paths) => { paths.forEach((p) => localStorage.removeItem(FILES + p)); return { data: null, error: null }; }
    })
  };

  const auth = {
    getSession: async () => ({ data: { session: load().session }, error: null }),
    signInWithPassword: async ({ email, password }) => {
      if (!email || !password) return err("Correo o contraseña incorrectos.");
      const db = load(); db.session = { user: { email } }; save(db);
      return { data: { session: db.session }, error: null };
    },
    signOut: async () => { const db = load(); db.session = null; save(db); return { error: null }; }
  };

  window.supabase = {
    createClient: () => ({
      from: (t) => new Query(t),
      rpc: async (name, params = {}) => {
        const db = load();
        if (!rpcs[name]) return err(`Función desconocida: ${name}`);
        try { return { data: rpcs[name](db, params), error: null }; }
        catch (e) { return err(e.message); }
      },
      storage,
      auth
    })
  };

  // Aviso visible para no confundir el demo con la versión real
  document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("div");
    b.textContent = "Modo demo local · los datos viven solo en este navegador · cualquier correo y contraseña sirven para entrar";
    b.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#722F40;color:#fff;font:12px/1.4 system-ui,sans-serif;text-align:center;padding:6px 12px;opacity:.92";
    document.body.appendChild(b);
  });
})();
