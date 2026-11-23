// Convierte la carta HTML "v2" (la que hicimos antes) en datos para Firestore.
// No usa Firebase: es lógica pura, por eso se puede probar sola.
const P = "2026/05/";

export const GRUPOS_BASE = [
  { id: "cocina",   nombre: "Cocina",    color: "#d86842", icono: P + "Cocina.png",   orden: 1 },
  { id: "patomar",  nombre: "Pa´tomar",  color: "#3d99a4", icono: P + "Pa-tomar.png", orden: 2 },
  { id: "desayuno", nombre: "Desayuno",  color: "#afc848", icono: P + "Desayuno.png", orden: 3 },
  { id: "postres",  nombre: "Postres",   color: "#f7a617", icono: P + "Postres.png",  orden: 4 }
];

// [id, nombre, grupo, color, archivo del ícono]
export const CATEGORIAS_BASE = [
  ["entradas", "Entradas", "cocina", "#399aa3", "entradas.png"],
  ["papicar", "Pa´picar", "cocina", "#d5683f", "pa-picar.png"],
  ["ensaladas", "Ensaladas", "cocina", "#afc848", "ensalada.png"],
  ["recomendados", "Recomendados del Chef", "cocina", "#a93317", "Recomendaciones-del-chef.png"],
  ["chicharroneria", "Chicharronería", "cocina", "#a93317", "Chicharroneria.png"],
  ["carnes", "Carnes y parrilla", "cocina", "#e14b3a", "carnes-y-parrillas.png"],
  ["mar", "Mar", "cocina", "#399aa3", "mar.png"],
  ["infantil", "Menú infantil", "cocina", "#d5683f", "menu-infantil.png"],
  ["cocteles", "Cócteles", "patomar", "#ab3318", "cocteleS.png"],
  ["vinos", "Vinos", "patomar", "#f7a617", "vinos.png"],
  ["licores", "Licores", "patomar", "#e14b3a", "licores.png"],
  ["cervezas", "Cervezas", "patomar", "#3d99a4", "cervezas.png"],
  ["bebidasfrias", "Bebidas frías", "patomar", "#afc848", "bebidas-frias.png"],
  ["bebidacaliente", "Bebida caliente", "patomar", "#d5683f", "bebida-caliente.png"],
  ["desayuno", "Desayuno", "desayuno", "#afc848", null],
  ["postres", "Postres", "postres", "#f7a617", null]
];

// Lee del archivo HTML v2 los datos RAW (texto) e IMGS (fotos en base64)
export function extraerDeHTML(texto) {
  const a = texto.indexOf("var RAW=");
  const b = texto.indexOf("var IMGS=", a);
  const c = texto.indexOf("var P=", b);
  if (a < 0 || b < 0 || c < 0) throw new Error("Este archivo no parece la carta HTML v2.");
  const limpiar = s => s.trim().replace(/;$/, "");
  const raw = JSON.parse(limpiar(texto.slice(a + 8, b)));
  const imgs = JSON.parse(limpiar(texto.slice(b + 9, c)));
  return { raw, imgs };
}

export function parsearPrecios(s) {
  return String(s).split(";").filter(Boolean).map(x => {
    const i = x.indexOf("=");
    return { e: x.slice(0, i), v: Number(x.slice(i + 1)) };
  });
}

export function construirDatos(raw, imgs) {
  const grupos = GRUPOS_BASE.map(g => ({ ...g, icono: imgs[g.icono] || "", visible: true }));
  const categorias = CATEGORIAS_BASE.map(([id, nombre, grupo, color, ico], i) => ({
    id, nombre, grupo, color, orden: i + 1, visible: true,
    icono: ico ? (imgs[P + ico] || "") : ""
  }));

  const productos = [];
  const porClave = new Map();
  CATEGORIAS_BASE.forEach(([catId]) => {
    const lineas = (raw[catId] || "").split("\n").filter(Boolean);
    lineas.forEach((linea, pos) => {
      const [nombre, etiqueta, precios, ruta] = linea.split("|");
      const clave = nombre + "|" + ruta;
      let p = porClave.get(clave);
      if (!p) {
        p = {
          id: "p" + String(productos.length + 1).padStart(4, "0"),
          nombre, etiqueta: etiqueta || "",
          precios: parsearPrecios(precios),
          categorias: [], ordenes: {},
          foto: imgs[ruta] || "", visible: true, agotado: false
        };
        porClave.set(clave, p);
        productos.push(p);
      }
      if (!p.categorias.includes(catId)) p.categorias.push(catId);
      p.ordenes[catId] = pos + 1;
    });
  });

  const ajustes = {
    nota: "Imágenes ilustrativas, la presentación podría variar",
    pie: "© La Matriarca Barranquilla · Todos los derechos reservados",
    logo: imgs[P + "LOGO.png"] || "",
    fondo: imgs[P + "dsc01376.webp"] || ""
  };
  return { grupos, categorias, productos, ajustes };
}
