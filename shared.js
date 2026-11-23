// Utilidades comunes
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const fmt = n => "$ " + Number(n || 0).toLocaleString("en-US");

// Ordena por el campo "orden" y luego por nombre
export const byOrden = (a, b) =>
  (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre), "es");

// Comprime una imagen (File o Blob) a WebP y la devuelve como data URL
export async function comprimirImagen(file, max = 800, calidad = 0.8) {
  const bm = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bm.width * s);
  c.height = Math.round(bm.height * s);
  c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
  let url = c.toDataURL("image/webp", calidad);
  // Firestore admite hasta 1 MB por documento: si queda grande, bajamos calidad
  let q = calidad;
  while (url.length > 700000 && q > 0.3) { q -= 0.1; url = c.toDataURL("image/webp", q); }
  return url;
}

// Igual pero conservando transparencia (íconos y logo)
export async function comprimirPNG(file, max = 300) {
  const bm = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bm.width * s);
  c.height = Math.round(bm.height * s);
  c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

// Textos por defecto de la carta
export const AJUSTES_BASE = {
  nota: "Imágenes ilustrativas, la presentación podría variar",
  pie: "© La Matriarca Barranquilla · Todos los derechos reservados",
  logo: "",
  fondo: ""
};
