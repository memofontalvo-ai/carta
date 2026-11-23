// Panel de administración de la carta.
import {
  configured, auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, arrayRemove
} from "./db.js";
import { $, $$, esc, fmt, byOrden, comprimirImagen, comprimirPNG, AJUSTES_BASE } from "./shared.js";
import { VERSION, FECHA, CAMBIOS } from "./version.js";
import { extraerDeHTML, construirDatos } from "./seed.js";

/* ============ estado ============ */
let grupos = [], categorias = [], productos = [], ajustes = { ...AJUSTES_BASE };
let tab = "platos", fCat = "", fQ = "";
let iniciado = false;

const TABS = [["platos", "Platos"], ["carta", "Editar en carta"], ["categorias", "Categorías"], ["grupos", "Grupos"], ["ajustes", "Ajustes"], ["importar", "Importar"]];

/* ============ ayudas ============ */
let tT;
function toast(msg, malo) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast on" + (malo ? " bad" : "");
  clearTimeout(tT); tT = setTimeout(() => t.classList.remove("on"), 3500);
}
function modal(html) { const o = $("#ov"); o.innerHTML = '<div class="dlg">' + html + "</div>"; o.hidden = false; }
function cerrarModal() { $("#ov").hidden = true; $("#ov").innerHTML = ""; }
const conIds = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
const ordenEn = (p, c) => p.ordenes?.[c] ?? p.orden ?? 0;
const nombreCat = id => categorias.find(c => c.id === id)?.nombre || "(eliminada)";
const nombreGrupo = id => grupos.find(g => g.id === id)?.nombre || "—";
const catsOrdenadas = () => [...categorias].sort((a, b) =>
  ((grupos.find(g => g.id === a.grupo)?.orden ?? 99) - (grupos.find(g => g.id === b.grupo)?.orden ?? 99)) || byOrden(a, b));
const resumenPrecio = p => (p.precios || []).map(x => (x.e ? x.e + " " : "") + fmt(x.v)).join(" · ");
const errPermiso = e => toast(e.code === "permission-denied"
  ? "Tu correo no tiene permiso para modificar la carta. Revisa las reglas de Firestore."
  : "Error: " + e.message, true);

async function trocear(operaciones, tam = 100) {
  for (let i = 0; i < operaciones.length; i += tam) {
    const b = writeBatch(db);
    operaciones.slice(i, i + tam).forEach(f => f(b));
    await b.commit();
  }
}

/* ============ acceso ============ */
if (!configured) {
  $("#login").hidden = false;
  $("#fLogin").innerHTML = '<p class="err" style="color:#f7a617">Falta configurar Firebase: abre <b>firebase-config.js</b> y pega los datos de tu proyecto (ver LEEME.md).</p>';
} else {
  onAuthStateChanged(auth, u => {
    if (u) { $("#login").hidden = true; $("#panel").hidden = false; $("#quien").textContent = u.email; arrancar(); }
    else { $("#panel").hidden = true; $("#login").hidden = false; }
  });
  $("#fLogin").addEventListener("submit", async e => {
    e.preventDefault(); $("#loginErr").textContent = "";
    try { await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#pass").value); }
    catch (er) {
      $("#loginErr").textContent = /invalid|wrong|user-not-found/.test(er.code)
        ? "Correo o contraseña incorrectos." : "No se pudo entrar: " + er.message;
    }
  });
  $("#salir").onclick = () => signOut(auth);
}

function arrancar() {
  if (iniciado) return; iniciado = true;
  $("#tabs").innerHTML = TABS.map(([k, n]) => '<button data-t="' + k + '">' + n + "</button>").join("");
  $("#tabs").onclick = e => { const b = e.target.closest("[data-t]"); if (b) { tab = b.dataset.t; pintar(); } };
  onSnapshot(collection(db, "grupos"), s => { grupos = conIds(s); refrescar(); }, errPermiso);
  onSnapshot(collection(db, "categorias"), s => { categorias = conIds(s); refrescar(); }, errPermiso);
  onSnapshot(collection(db, "productos"), s => { productos = conIds(s); refrescar(); }, errPermiso);
  onSnapshot(doc(db, "config", "general"), s => { ajustes = { ...AJUSTES_BASE, ...(s.data() || {}) }; if (tab === "ajustes") pintar(); }, () => {});
  $("#vista").addEventListener("click", clicVista);
  $("#ov").addEventListener("click", e => { if (e.target.id === "ov") cerrarModal(); });
  $("#verBtn").addEventListener("click", () => modal("<h3>Historial de versiones</h3>" + CAMBIOS.map(c => "<p><b>v" + esc(c[0]) + "</b> · " + esc(c[1]) + "<br>" + esc(c[2]) + "</p>").join("") + '<button class="b" data-a="cancelar">Cerrar</button>'));
  pintar();
}
function refrescar() {
  if (tab === "platos" && $("#lista")) { const f = $("#fCat"); if (f) f.innerHTML = opcionesCat(); listaPlatos(); }
  else if (tab === "categorias" || tab === "grupos") pintar();
}
function pintar() {
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
  ({ platos: vPlatos, carta: vCarta, categorias: vCategorias, grupos: vGrupos, ajustes: vAjustes, importar: vImportar })[tab]();
}

/* ============ EDITAR EN FORMATO CARTA ============ */
function vCarta() {
  $("#vista").innerHTML = '<p class="mut" style="margin-bottom:8px">Navega como en la carta y toca un plato para editarlo. Los platos ocultos también aparecen aquí.</p>' +
    '<iframe id="marcoCarta" src="index.html?editar=1" title="Carta"></iframe>';
}
window.addEventListener("message", e => {
  if (e.origin !== location.origin || !e.data) return;
  if (e.data.editarPlato) { const p = productos.find(x => x.id === e.data.editarPlato); if (p) formPlato(p); }
  else if (e.data.nuevoPlato) formPlato(null, e.data.nuevoPlato);
});

/* ============ PLATOS ============ */
function opcionesCat() {
  return '<option value="">Todas las categorías</option>' +
    catsOrdenadas().map(c => '<option value="' + c.id + '"' + (fCat === c.id ? " selected" : "") + ">" + esc(nombreGrupo(c.grupo)) + " · " + esc(c.nombre) + "</option>").join("") +
    '<option value="_sin"' + (fCat === "_sin" ? " selected" : "") + '>— Sin categoría —</option>';
}
function vPlatos() {
  $("#vista").innerHTML =
    '<div class="tool"><select id="fCat">' + opcionesCat() + "</select>" +
    '<input id="fQ" placeholder="Buscar plato…" value="' + esc(fQ) + '">' +
    '<button class="b pri" data-a="nuevoPlato">+ Nuevo plato</button></div><div id="lista"></div>';
  $("#fCat").onchange = e => { fCat = e.target.value; listaPlatos(); };
  $("#fQ").oninput = e => { fQ = e.target.value; listaPlatos(); };
  listaPlatos();
}
function platosFiltrados() {
  const ids = new Set(categorias.map(c => c.id));
  let l = productos.filter(p => {
    if (fCat === "_sin") return !(p.categorias || []).some(c => ids.has(c));
    if (fCat) return (p.categorias || []).includes(fCat);
    return true;
  });
  if (fQ.trim()) { const q = fQ.trim().toLowerCase(); l = l.filter(p => (p.nombre + " " + (p.etiqueta || "")).toLowerCase().includes(q)); }
  return l.sort((a, b) => fCat && fCat !== "_sin"
    ? ordenEn(a, fCat) - ordenEn(b, fCat) || String(a.nombre).localeCompare(String(b.nombre), "es")
    : String(a.nombre).localeCompare(String(b.nombre), "es"));
}
function listaPlatos() {
  const cont = $("#lista"); if (!cont) return;
  const l = platosFiltrados(), puedeOrdenar = fCat && fCat !== "_sin" && !fQ.trim();
  if (!l.length) { cont.innerHTML = '<div class="box"><p>No hay platos aquí. Usa “+ Nuevo plato” o la pestaña Importar.</p></div>'; return; }
  cont.innerHTML = '<p class="mut" style="margin-bottom:8px">' + l.length + " platos</p>" + l.map((p, i) =>
    '<div class="row" data-id="' + p.id + '"><div class="th">' + (p.foto ? '<img loading="lazy" src="' + p.foto + '" alt="">' : "") + '</div>' +
    '<div class="info"><b>' + esc(p.nombre) + (p.visible === false ? '<span class="pill g">Oculto</span>' : "") + (p.agotado ? '<span class="pill">Agotado</span>' : "") +
    "</b><small>" + esc(resumenPrecio(p)) + "<br>" + esc((p.categorias || []).map(nombreCat).join(", ") || "Sin categoría") + "</small></div>" +
    '<div class="acts">' +
    (puedeOrdenar ? '<button class="b sm" data-a="subir" ' + (i === 0 ? "disabled" : "") + '>↑</button><button class="b sm" data-a="bajar" ' + (i === l.length - 1 ? "disabled" : "") + ">↓</button>" : "") +
    '<button class="b sm" data-a="editarPlato">Editar</button><button class="b sm" data-a="duplicar">Duplicar</button>' +
    '<button class="b sm red" data-a="borrarPlato">Eliminar</button></div></div>').join("");
}

async function moverPlato(id, dir) {
  const l = platosFiltrados(), i = l.findIndex(p => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]];
  const ops = [];
  l.forEach((p, n) => { if (ordenEn(p, fCat) !== n + 1) ops.push(b => b.update(doc(db, "productos", p.id), { ["ordenes." + fCat]: n + 1 })); });
  try { await trocear(ops); } catch (e) { errPermiso(e); }
}

let fotoForm = "", plato = null;
function formPlato(p, catPre) {
  plato = p; fotoForm = p?.foto || "";
  const sel = new Set(p?.categorias || (catPre ? [catPre] : fCat && fCat !== "_sin" ? [fCat] : []));
  const porGrupo = grupos.slice().sort(byOrden).map(g => {
    const cs = categorias.filter(c => c.grupo === g.id).sort(byOrden);
    return cs.length ? "<h4>" + esc(g.nombre) + "</h4>" + cs.map(c => '<label class="chk"><input type="checkbox" name="cat" value="' + c.id + '"' + (sel.has(c.id) ? " checked" : "") + "> " + esc(c.nombre) + "</label>").join("") : "";
  }).join("");
  const etiquetas = [...new Set(productos.map(x => x.etiqueta).filter(Boolean))].sort();
  const precios = (p?.precios?.length ? p.precios : [{ e: "", v: "" }]);
  modal('<h2>' + (p && p.id ? "Editar plato" : "Nuevo plato") + '</h2>' +
    '<label>Nombre</label><input id="pNombre" value="' + esc(p?.nombre || "") + '" maxlength="120">' +
    '<label>Categorías donde aparece</label><div class="cats">' + (porGrupo || '<span class="mut">Primero crea una categoría.</span>') + "</div>" +
    '<label>Etiqueta (texto pequeño naranja, opcional)</label><input id="pEtiq" list="dlEt" value="' + esc(p?.etiqueta || "") + '" placeholder="Ej. Los Fuertes del Mar"><datalist id="dlEt">' + etiquetas.map(e => '<option value="' + esc(e) + '">').join("") + "</datalist>" +
    '<label>Precio(s) — si hay varios (Copa / Botella) agrega una línea por cada uno</label><div id="pPrecios"></div><button class="b sm" type="button" data-a="masPrecio">+ Agregar precio</button>' +
    '<label>Foto</label><div class="prev" id="pPrev"></div><input type="file" id="pFoto" accept="image/*"> <button class="b sm" type="button" data-a="quitarFoto" style="margin-top:6px">Quitar foto</button>' +
    '<label class="chk"><input type="checkbox" id="pVis"' + (p?.visible === false ? "" : " checked") + '> Mostrar en la carta</label>' +
    '<label class="chk"><input type="checkbox" id="pAgo"' + (p?.agotado ? " checked" : "") + '> Marcar como agotado</label>' +
    '<div class="foot"><button class="b" data-a="cancelar">Cancelar</button><button class="b pri" data-a="guardarPlato">Guardar</button></div>');
  precios.forEach(x => filaPrecio(x.e, x.v));
  pintarFoto();
  $("#pFoto").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { fotoForm = await comprimirImagen(f, 800, 0.8); pintarFoto(); } catch { toast("No se pudo leer esa imagen.", true); }
  };
}
function filaPrecio(e = "", v = "") {
  const d = document.createElement("div"); d.className = "prow";
  d.innerHTML = '<input class="pe" placeholder="Etiqueta (ej. Copa)" value="' + esc(e) + '"><input class="pv" type="number" min="0" step="100" placeholder="Valor" value="' + esc(v) + '"><button class="b sm red" type="button" data-a="quitarPrecio">×</button>';
  $("#pPrecios").appendChild(d);
}
function pintarFoto() { $("#pPrev").innerHTML = fotoForm ? '<img src="' + fotoForm + '" alt="">' : "Sin foto"; }

async function guardarPlato() {
  const nombre = $("#pNombre").value.trim();
  if (!nombre) return toast("Escribe el nombre del plato.", true);
  const validos = $$(".prow").map(r => ({ e: $(".pe", r).value.trim(), raw: $(".pv", r).value.trim(), v: Number($(".pv", r).value) })).filter(x => x.raw !== "" && !Number.isNaN(x.v) && x.v >= 0);
  if (!validos.length) return toast("Agrega al menos un precio.", true);
  const cats = $$('input[name="cat"]:checked').map(i => i.value);
  const ordenes = {}, previos = plato?.ordenes || {};
  cats.forEach(c => {
    if (previos[c] != null) ordenes[c] = previos[c];
    else ordenes[c] = Math.max(0, ...productos.filter(x => (x.categorias || []).includes(c)).map(x => ordenEn(x, c))) + 1;
  });
  const data = {
    nombre, etiqueta: $("#pEtiq").value.trim(),
    precios: validos.map(x => ({ e: x.e, v: x.v })),
    categorias: cats, ordenes, foto: fotoForm || "",
    visible: $("#pVis").checked, agotado: $("#pAgo").checked,
    orden: plato?.orden ?? Math.max(0, ...productos.map(x => x.orden ?? 0)) + 1
  };
  try {
    const ref = plato?.id ? doc(db, "productos", plato.id) : doc(collection(db, "productos"));
    await setDoc(ref, data);
    cerrarModal(); toast("Plato guardado.");
  } catch (e) { errPermiso(e); }
}

/* ============ CATEGORÍAS ============ */
function vCategorias() {
  const l = catsOrdenadas();
  $("#vista").innerHTML = '<div class="tool"><p class="mut" style="flex:1">Las categorías son los botones de cada grupo (Entradas, Mar, Vinos…).</p><button class="b pri" data-a="nuevaCat">+ Nueva categoría</button></div>' +
    (l.length ? l.map((c, i) => {
      const mismos = l.filter(x => x.grupo === c.grupo), k = mismos.findIndex(x => x.id === c.id);
      const n = productos.filter(p => (p.categorias || []).includes(c.id)).length;
      return '<div class="row" data-id="' + c.id + '"><span class="sw" style="background:' + esc(c.color || "#999") + '"></span><div class="info"><b>' + esc(c.nombre) +
        (c.visible === false ? '<span class="pill g">Oculta</span>' : "") + "</b><small>" + esc(nombreGrupo(c.grupo)) + " · " + n + " platos</small></div>" +
        '<div class="acts"><button class="b sm" data-a="subirCat"' + (k === 0 ? " disabled" : "") + '>↑</button><button class="b sm" data-a="bajarCat"' + (k === mismos.length - 1 ? " disabled" : "") + '>↓</button>' +
        '<button class="b sm" data-a="editarCat">Editar</button><button class="b sm red" data-a="borrarCat">Eliminar</button></div></div>';
    }).join("") : '<div class="box"><p>Aún no hay categorías. Crea un grupo y luego una categoría, o usa la pestaña Importar.</p></div>');
}
let icoForm = "", cat = null;
function formCat(c) {
  cat = c; icoForm = c?.icono || "";
  if (!grupos.length) return toast("Primero crea un grupo (pestaña Grupos).", true);
  modal("<h2>" + (c ? "Editar categoría" : "Nueva categoría") + '</h2><label>Nombre</label><input id="cNombre" value="' + esc(c?.nombre || "") + '" maxlength="60">' +
    '<label>Grupo</label><select id="cGrupo">' + grupos.slice().sort(byOrden).map(g => '<option value="' + g.id + '"' + (c?.grupo === g.id ? " selected" : "") + ">" + esc(g.nombre) + "</option>").join("") + "</select>" +
    '<label>Color del botón</label><input type="color" id="cColor" value="' + esc(c?.color || "#399aa3") + '">' +
    '<label>Ícono (PNG blanco con fondo transparente, opcional)</label><div id="cPrev" class="prevw" style="background:' + esc(c?.color || "#399aa3") + '"></div><br><input type="file" id="cIco" accept="image/*"> <button class="b sm" type="button" data-a="quitarIco">Quitar ícono</button>' +
    '<label class="chk"><input type="checkbox" id="cVis"' + (c?.visible === false ? "" : " checked") + '> Mostrar en la carta</label>' +
    '<div class="foot"><button class="b" data-a="cancelar">Cancelar</button><button class="b pri" data-a="guardarCat">Guardar</button></div>');
  pintarIco("#cPrev"); $("#cColor").oninput = e => $("#cPrev").style.background = e.target.value;
  $("#cIco").onchange = async e => { const f = e.target.files[0]; if (f) { icoForm = await comprimirPNG(f, 256); pintarIco("#cPrev"); } };
}
function pintarIco(sel) { $(sel).innerHTML = icoForm ? '<img alt="" src="' + icoForm + '">' : '<span class="mut">Sin ícono</span>'; }
async function guardarCat() {
  const nombre = $("#cNombre").value.trim(); if (!nombre) return toast("Escribe el nombre.", true);
  const grupo = $("#cGrupo").value;
  const data = { nombre, grupo, color: $("#cColor").value, icono: icoForm || "", visible: $("#cVis").checked,
    orden: cat && cat.grupo === grupo ? cat.orden : Math.max(0, ...categorias.filter(x => x.grupo === grupo).map(x => x.orden ?? 0)) + 1 };
  try { await setDoc(cat ? doc(db, "categorias", cat.id) : doc(collection(db, "categorias")), data); cerrarModal(); toast("Categoría guardada."); } catch (e) { errPermiso(e); }
}
async function borrarCat(id) {
  const afectados = productos.filter(p => (p.categorias || []).includes(id));
  if (!confirm("¿Eliminar la categoría “" + nombreCat(id) + "”?\n\n" + (afectados.length ? "Los " + afectados.length + " platos que tiene NO se borran: solo dejan de aparecer en esta categoría." : "Está vacía.") + "\nEsta acción no se puede deshacer.")) return;
  try {
    await trocear(afectados.map(p => b => b.update(doc(db, "productos", p.id), { categorias: arrayRemove(id) })));
    await deleteDoc(doc(db, "categorias", id)); toast("Categoría eliminada.");
  } catch (e) { errPermiso(e); }
}
async function moverEnLista(lista, id, dir, coleccion) {
  const i = lista.findIndex(x => x.id === id), j = i + dir; if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  const ops = []; lista.forEach((x, n) => { if (x.orden !== n + 1) ops.push(b => b.update(doc(db, coleccion, x.id), { orden: n + 1 })); });
  try { await trocear(ops); } catch (e) { errPermiso(e); }
}

/* ============ GRUPOS ============ */
function vGrupos() {
  const l = grupos.slice().sort(byOrden);
  $("#vista").innerHTML = '<div class="tool"><p class="mut" style="flex:1">Los grupos son los botones de la pantalla de inicio (Cocina, Pa´tomar, Desayuno, Postres…). Si un grupo tiene una sola categoría, el cliente entra directo a ella.</p><button class="b pri" data-a="nuevoGrupo">+ Nuevo grupo</button></div>' +
    (l.length ? l.map((g, i) => '<div class="row" data-id="' + g.id + '"><span class="sw" style="background:' + esc(g.color || "#999") + '"></span><div class="info"><b>' + esc(g.nombre) +
      (g.visible === false ? '<span class="pill g">Oculto</span>' : "") + "</b><small>" + categorias.filter(c => c.grupo === g.id).length + ' categorías</small></div><div class="acts">' +
      '<button class="b sm" data-a="subirGrupo"' + (i === 0 ? " disabled" : "") + '>↑</button><button class="b sm" data-a="bajarGrupo"' + (i === l.length - 1 ? " disabled" : "") + '>↓</button>' +
      '<button class="b sm" data-a="editarGrupo">Editar</button><button class="b sm red" data-a="borrarGrupo">Eliminar</button></div></div>').join("") : '<div class="box"><p>Aún no hay grupos.</p></div>');
}
let grp = null;
function formGrupo(g) {
  grp = g; icoForm = g?.icono || "";
  modal("<h2>" + (g ? "Editar grupo" : "Nuevo grupo") + '</h2><label>Nombre</label><input id="gNombre" value="' + esc(g?.nombre || "") + '" maxlength="40">' +
    '<label>Color del botón</label><input type="color" id="gColor" value="' + esc(g?.color || "#d86842") + '">' +
    '<label>Ícono pequeño (PNG, opcional)</label><div id="gPrev" class="prevw" style="background:' + esc(g?.color || "#d86842") + '"></div><br><input type="file" id="gIco" accept="image/*"> <button class="b sm" type="button" data-a="quitarIcoG">Quitar ícono</button>' +
    '<label class="chk"><input type="checkbox" id="gVis"' + (g?.visible === false ? "" : " checked") + '> Mostrar en la carta</label>' +
    '<div class="foot"><button class="b" data-a="cancelar">Cancelar</button><button class="b pri" data-a="guardarGrupo">Guardar</button></div>');
  pintarIco("#gPrev"); $("#gColor").oninput = e => $("#gPrev").style.background = e.target.value;
  $("#gIco").onchange = async e => { const f = e.target.files[0]; if (f) { icoForm = await comprimirPNG(f, 120); pintarIco("#gPrev"); } };
}
async function guardarGrupo() {
  const nombre = $("#gNombre").value.trim(); if (!nombre) return toast("Escribe el nombre.", true);
  const data = { nombre, color: $("#gColor").value, icono: icoForm || "", visible: $("#gVis").checked, orden: grp?.orden ?? Math.max(0, ...grupos.map(x => x.orden ?? 0)) + 1 };
  try { await setDoc(grp ? doc(db, "grupos", grp.id) : doc(collection(db, "grupos")), data); cerrarModal(); toast("Grupo guardado."); } catch (e) { errPermiso(e); }
}
async function borrarGrupo(id) {
  if (categorias.some(c => c.grupo === id)) return toast("Ese grupo todavía tiene categorías. Muévelas o elimínalas primero.", true);
  if (!confirm("¿Eliminar el grupo “" + nombreGrupo(id) + "”?")) return;
  try { await deleteDoc(doc(db, "grupos", id)); toast("Grupo eliminado."); } catch (e) { errPermiso(e); }
}

/* ============ AJUSTES ============ */
let logoF = "", fondoF = "";
function vAjustes() {
  logoF = ajustes.logo || ""; fondoF = ajustes.fondo || "";
  $("#vista").innerHTML = '<div class="box"><h3>Textos y apariencia</h3><label>Mensaje de la pantalla de inicio</label><input id="aNota" value="' + esc(ajustes.nota) + '">' +
    '<label>Texto al pie de la página</label><input id="aPie" value="' + esc(ajustes.pie) + '">' +
    '<label>Logo (PNG con fondo transparente)</label><div class="prevw" id="aLogo"></div><br><input type="file" id="aLogoF" accept="image/*">' +
    '<label>Imagen de fondo</label><div class="prev" id="aFondo" style="width:200px;height:110px"></div><input type="file" id="aFondoF" accept="image/*">' +
    '<div class="foot"><button class="b pri" data-a="guardarAjustes">Guardar ajustes</button></div></div>';
  const pv = () => { $("#aLogo").innerHTML = logoF ? '<img alt="" src="' + logoF + '">' : '<span class="mut">Sin logo (se mostrará el nombre)</span>'; $("#aFondo").innerHTML = fondoF ? '<img alt="" src="' + fondoF + '">' : "Sin fondo"; };
  pv();
  $("#aLogoF").onchange = async e => { const f = e.target.files[0]; if (f) { logoF = await comprimirPNG(f, 400); pv(); } };
  $("#aFondoF").onchange = async e => { const f = e.target.files[0]; if (f) { fondoF = await comprimirImagen(f, 1280, 0.6); pv(); } };
}
async function guardarAjustes() {
  try { await setDoc(doc(db, "config", "general"), { nota: $("#aNota").value.trim(), pie: $("#aPie").value.trim(), logo: logoF, fondo: fondoF }); toast("Ajustes guardados."); } catch (e) { errPermiso(e); }
}

/* ============ IMPORTAR ============ */
function vImportar() {
  $("#vista").innerHTML = '<div class="box"><h3>Importar la carta que ya hicimos</h3><p>Elige el archivo <b>carta-la-matriarca-barranquilla-v2.html</b> (el de 8 MB, con las fotos). Se cargarán los grupos, las categorías, los platos con su precio y sus fotos, el logo y el fondo.</p>' +
    '<p style="margin-top:8px"><b>Hazlo solo la primera vez.</b> Si lo repites, los platos importados vuelven a su estado original y se pierden los cambios que les hayas hecho.</p>' +
    '<label>Archivo</label><input type="file" id="iArch" accept=".html,text/html"><br><br><button class="b pri" data-a="importar">Importar a la base de datos</button>' +
    '<div class="prog" id="iProg" hidden><i></i></div><p id="iTxt" style="margin-top:8px"></p></div>';
}
async function importar() {
  const f = $("#iArch").files[0]; if (!f) return toast("Elige primero el archivo.", true);
  const txt = $("#iTxt"), barra = $("#iProg"); barra.hidden = false;
  const paso = (m, pct) => { txt.textContent = m; $("i", barra).style.width = pct + "%"; };
  try {
    paso("Leyendo el archivo…", 3);
    const { raw, imgs } = extraerDeHTML(await f.text());
    const d = construirDatos(raw, imgs);
    if (!confirm("Se cargarán " + d.productos.length + " platos en " + d.categorias.length + " categorías. ¿Continuar?")) { barra.hidden = true; txt.textContent = ""; return; }
    paso("Guardando grupos y categorías…", 8);
    await trocear([
      ...d.grupos.map(({ id, ...x }) => b => b.set(doc(db, "grupos", id), x)),
      ...d.categorias.map(({ id, ...x }) => b => b.set(doc(db, "categorias", id), x)),
      b => b.set(doc(db, "config", "general"), d.ajustes)
    ], 50);
    const ops = d.productos.map(({ id, ...x }) => b => b.set(doc(db, "productos", id), x));
    for (let i = 0; i < ops.length; i += 40) {
      await trocear(ops.slice(i, i + 40), 40);
      paso("Guardando platos y fotos… " + Math.min(i + 40, ops.length) + " de " + ops.length, 10 + Math.round(90 * Math.min(i + 40, ops.length) / ops.length));
    }
    paso("Listo: " + d.productos.length + " platos importados.", 100); toast("Importación terminada.");
  } catch (e) { barra.hidden = true; txt.textContent = ""; errPermiso(e); }
}

/* ============ clics ============ */
const idDe = el => el.closest("[data-id]")?.dataset.id;
async function clicVista(e) {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, id = idDe(b);
  const P = () => productos.find(x => x.id === id);
  switch (a) {
    case "nuevoPlato": return formPlato(null);
    case "editarPlato": return formPlato(P());
    case "duplicar": { const p = P(); return formPlato({ ...p, id: null, nombre: p.nombre + " (copia)" }); }
    case "borrarPlato": if (confirm("¿Eliminar “" + P().nombre + "”? No se puede deshacer.")) { try { await deleteDoc(doc(db, "productos", id)); toast("Plato eliminado."); } catch (er) { errPermiso(er); } } return;
    case "subir": return moverPlato(id, -1);
    case "bajar": return moverPlato(id, 1);
    case "nuevaCat": return formCat(null);
    case "editarCat": return formCat(categorias.find(c => c.id === id));
    case "borrarCat": return borrarCat(id);
    case "subirCat": case "bajarCat": { const c = categorias.find(x => x.id === id); return moverEnLista(categorias.filter(x => x.grupo === c.grupo).sort(byOrden), id, a === "subirCat" ? -1 : 1, "categorias"); }
    case "nuevoGrupo": return formGrupo(null);
    case "editarGrupo": return formGrupo(grupos.find(g => g.id === id));
    case "borrarGrupo": return borrarGrupo(id);
    case "subirGrupo": return moverEnLista(grupos.slice().sort(byOrden), id, -1, "grupos");
    case "bajarGrupo": return moverEnLista(grupos.slice().sort(byOrden), id, 1, "grupos");
    case "guardarAjustes": return guardarAjustes();
    case "importar": return importar();
  }
}
// Acciones dentro de las ventanas emergentes
document.querySelectorAll(".verTxt").forEach(e => e.textContent = "v" + VERSION);
document.addEventListener("click", e => {
  const b = e.target.closest("#ov [data-a]"); if (!b) return;
  switch (b.dataset.a) {
    case "cancelar": return cerrarModal();
    case "guardarPlato": return guardarPlato();
    case "masPrecio": return filaPrecio();
    case "quitarPrecio": return b.closest(".prow").remove();
    case "quitarFoto": fotoForm = ""; return pintarFoto();
    case "guardarCat": return guardarCat();
    case "quitarIco": icoForm = ""; return pintarIco("#cPrev");
    case "guardarGrupo": return guardarGrupo();
    case "quitarIcoG": icoForm = ""; return pintarIco("#gPrev");
  }
});
