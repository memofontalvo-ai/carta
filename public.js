// Carta pública: lee grupos, categorías y platos desde Firestore.
import { configured, db, collection, doc, onSnapshot, query, where } from "./db.js";
import { $, esc, fmt, byOrden, AJUSTES_BASE } from "./shared.js";
import { VERSION } from "./version.js";

const app = $("#app");
if (!configured) {
  app.innerHTML = '<div class="msg">Falta configurar Firebase.<br>Abre el archivo <b>firebase-config.js</b> y pega los datos de tu proyecto (mira la guía LEEME.md).</div>';
  throw new Error("Firebase sin configurar");
}

let grupos = [], categorias = [], ajustes = { ...AJUSTES_BASE };
let listosBase = { g: false, c: false };
const prods = {}, subs = {}, cargado = {};
let vista = { t: "home" };
let filtro = "", mostrados = 15, actuales = [];
const PAGINA = 15;

/* ---------- datos ---------- */
const conIds = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
const alFallar = e => { app.innerHTML = '<div class="msg">No se pudo cargar la carta.<br><small>' + esc(e.message) + '</small></div>'; };

onSnapshot(collection(db, "grupos"), s => { grupos = conIds(s); listosBase.g = true; refrescar(); }, alFallar);
onSnapshot(collection(db, "categorias"), s => { categorias = conIds(s); listosBase.c = true; refrescar(); }, alFallar);
onSnapshot(doc(db, "config", "general"), s => { ajustes = { ...AJUSTES_BASE, ...(s.data() || {}) }; tema(); refrescar(); }, () => {});

function cargarProductos(catId) {
  if (subs[catId]) return;
  subs[catId] = onSnapshot(
    query(collection(db, "productos"), where("categorias", "array-contains", catId)),
    s => { prods[catId] = conIds(s); cargado[catId] = true; if (vista.t === "cat" && vista.id === catId) pintarGrilla(); },
    alFallar
  );
}

const catsVisibles = () => categorias.filter(c => c.visible !== false).sort(byOrden);
const catsDe = gid => catsVisibles().filter(c => c.grupo === gid);
const gruposVisibles = () => grupos.filter(g => g.visible !== false && catsDe(g.id).length).sort(byOrden);

/* ---------- apariencia ---------- */
function tema() {
  $("#bg").style.backgroundImage = ajustes.fondo ? "url(" + ajustes.fondo + ")" : "";
  $("#logoLink").innerHTML = ajustes.logo
    ? '<img class="logo" alt="La Matriarca" src="' + ajustes.logo + '">'
    : '<span class="logo-txt">La Matriarca</span>';
  $("#pie").innerHTML = esc(ajustes.pie || "") + '<div class="ver">v' + VERSION + '</div>';
}

/* ---------- pantallas ---------- */
function pantallaInicio() {
  const gs = gruposVisibles();
  if (!gs.length) { app.innerHTML = '<div class="msg">La carta todavía no tiene platos.</div>'; return; }
  let h = '<div class="home"><p class="note cal">' + esc(ajustes.nota) + "</p>";
  gs.forEach(g => {
    const cs = catsDe(g.id);
    const destino = cs.length === 1 ? "#/c/" + cs[0].id : "#/g/" + g.id;
    h += '<a class="hb" style="background:' + esc(g.color || "#f7a617") + '" href="' + destino + '">' +
      (g.icono ? '<img alt="" src="' + g.icono + '">' : "") + "<span>" + esc(g.nombre) + "</span></a>";
  });
  app.innerHTML = h + "</div>";
}

function pantallaGrupo(id) {
  const g = grupos.find(x => x.id === id);
  if (!g) return pantallaInicio();
  let h = '<h1 class="title cg">' + esc(g.nombre) + '</h1><div class="tiles">';
  catsDe(id).forEach(c => {
    h += '<a class="tile" style="background:' + esc(c.color || "#399aa3") + '" href="#/c/' + c.id + '">' +
      (c.icono ? '<img alt="" src="' + c.icono + '">' : "") + "<span>" + esc(c.nombre) + "</span></a>";
  });
  app.innerHTML = h + '</div><div class="center"><a class="btn" href="#/">Regresar al Menú</a></div>';
}

function pantallaCategoria(id) {
  const c = categorias.find(x => x.id === id);
  if (!c) return pantallaInicio();
  cargarProductos(id);
  const atras = catsDe(c.grupo).length > 1 ? "#/g/" + c.grupo : "#/";
  filtro = ""; mostrados = PAGINA;
  app.innerHTML =
    '<div class="sech">' + (c.icono ? '<img alt="" src="' + c.icono + '">' : "") + '<h1 class="cg">' + esc(c.nombre) + "</h1></div>" +
    '<select id="cat"></select><section class="grid" id="grid"></section>' +
    '<div class="more" id="more"><button class="btn" id="mb">Cargar más productos</button></div>' +
    '<div class="acts"><a class="btn" href="' + atras + '">← Regresar</a><a class="btn" href="#/">Menú</a></div>';
  $("#cat").onchange = e => { filtro = e.target.value; mostrados = PAGINA; pintarGrilla(); };
  $("#mb").onclick = () => { mostrados += PAGINA; pintarGrilla(); };
  pintarGrilla();
}

const ordenEn = (p, catId) => p.ordenes?.[catId] ?? p.orden ?? 0;
const etiquetaDe = (p, c) => p.etiqueta || c.nombre;

function precioHTML(p) {
  const pr = p.precios || [];
  if (pr.length === 1 && !pr[0].e) return '<div class="p">' + fmt(pr[0].v) + "</div>";
  return '<div class="m">' + pr.map(x => "<div><small>" + esc(x.e) + "</small><span>" + fmt(x.v) + "</span></div>").join("") + "</div>";
}

function pintarGrilla() {
  const grid = $("#grid"); if (!grid) return;
  const c = categorias.find(x => x.id === vista.id); if (!c) return;
  if (!cargado[c.id]) { grid.innerHTML = '<div class="msg" style="grid-column:1/-1">Cargando…</div>'; $("#more").style.display = "none"; return; }
  const todos = (prods[c.id] || []).filter(p => p.visible !== false)
    .sort((a, b) => ordenEn(a, c.id) - ordenEn(b, c.id) || String(a.nombre).localeCompare(String(b.nombre), "es"));
  // lista desplegable de categorías (etiquetas) con su cantidad
  const cuentas = {}; todos.forEach(p => { const e = etiquetaDe(p, c); cuentas[e] = (cuentas[e] || 0) + 1; });
  const sel = $("#cat");
  sel.innerHTML = '<option value="">Seleccionar categoría...</option>' +
    Object.keys(cuentas).sort((a, b) => a.localeCompare(b, "es")).map(e =>
      '<option value="' + esc(e) + '"' + (e === filtro ? " selected" : "") + ">" + esc(e) + " (" + cuentas[e] + ")</option>").join("");
  const lista = filtro ? todos.filter(p => etiquetaDe(p, c) === filtro) : todos;
  actuales = lista.slice(0, mostrados);
  if (!lista.length) { grid.innerHTML = '<div class="msg" style="grid-column:1/-1">Aún no hay platos en esta categoría.</div>'; }
  else grid.innerHTML = actuales.map((p, i) =>
    '<article class="card' + (p.agotado ? " ago" : "") + '" data-i="' + i + '"><div class="ph">' +
    (p.foto ? '<img alt="' + esc(p.nombre) + '" src="' + p.foto + '">' : "") + "</div><div><h3>" + esc(p.nombre) +
    (p.agotado ? '<span class="tag">Agotado</span>' : "") + '</h3><div class="c">' + esc(etiquetaDe(p, c)) + "</div>" + precioHTML(p) + "</div></article>").join("");
  $("#more").style.display = lista.length > mostrados ? "block" : "none";
}

/* ---------- foto ampliada ---------- */
function abrir(p) {
  const c = categorias.find(x => x.id === vista.id) || { nombre: "" };
  $("#mimg").src = p.foto || ""; $("#mimg").style.display = p.foto ? "block" : "none";
  $("#mn").textContent = p.nombre; $("#mc").textContent = etiquetaDe(p, c);
  $("#mp").innerHTML = precioHTML(p);
  $("#modal").classList.add("show");
}
const cerrar = () => $("#modal").classList.remove("show");
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest(".card");
  if (t) { const p = actuales[+t.getAttribute("data-i")]; if (p) abrir(p); return; }
  if (e.target.id === "modal" || e.target.id === "mx") cerrar();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });

/* ---------- navegación ---------- */
function ruta(auto) {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  vista = h[0] === "c" && h[1] ? { t: "cat", id: h[1] } : h[0] === "g" && h[1] ? { t: "grupo", id: h[1] } : { t: "home" };
  if (!auto) { cerrar(); window.scrollTo(0, 0); }
  if (!(listosBase.g && listosBase.c)) return;
  if (vista.t === "cat") pantallaCategoria(vista.id);
  else if (vista.t === "grupo") pantallaGrupo(vista.id);
  else pantallaInicio();
}
function refrescar() {
  if (!(listosBase.g && listosBase.c)) return;
  if (vista.t === "cat" && $("#grid")) pintarGrilla(); else ruta(true);
}
window.addEventListener("hashchange", () => ruta());
tema();
ruta();
