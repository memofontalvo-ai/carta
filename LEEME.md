# Carta digital La Matriarca Barranquilla — guía de instalación

Esta carpeta es una página web completa con dos partes:

- **La carta** (`index.html`): lo que ven los clientes.
- **El panel** (`admin.html`): donde tú entras con tu correo y contraseña para agregar, quitar y cambiar categorías, platos, precios, fotos y textos.

Los datos y las fotos se guardan en **Firebase (Firestore)** y la página se publica gratis en **GitHub Pages**. No necesitas tarjeta de crédito: las fotos se guardan comprimidas dentro de Firestore.

Tiempo estimado: 20–30 minutos la primera vez.

---

## PARTE A — Crear la base de datos en Firebase

1. Entra a **https://console.firebase.google.com** con tu cuenta de Google.
2. **Agregar proyecto** → ponle un nombre (por ejemplo `carta-matriarca`) → desactiva Google Analytics → **Crear proyecto**.
3. En el menú de la izquierda: **Compilación → Firestore Database → Crear base de datos**.
   - Ubicación: elige una cercana (por ejemplo `southamerica-east1`, São Paulo).
   - Modo: **Producción** → Crear.
4. **Compilación → Authentication → Comenzar → Correo electrónico/contraseña → Habilitar → Guardar.**
   Luego pestaña **Users (Usuarios) → Agregar usuario**: escribe TU correo y una contraseña segura. Ese será tu acceso al panel.
5. Vuelve a **Firestore Database → pestaña Reglas**. Borra lo que haya y pega el contenido del archivo `firestore.rules` de esta carpeta.
   **Importante:** cambia `TU_CORREO@gmail.com` por el mismo correo del paso 4. Pulsa **Publicar**.
6. Ícono de engranaje (arriba a la izquierda) → **Configuración del proyecto** → baja hasta **Tus apps** → botón **Web `</>`** → ponle un apodo → **Registrar app**.
   Te mostrará un bloque `const firebaseConfig = { ... }`. Copia solo lo que está entre las llaves.
7. Abre el archivo `firebase-config.js` de esta carpeta y reemplaza los valores de ejemplo por los tuyos. Guarda.

## PARTE B — Publicar en GitHub Pages

1. Entra a tu repositorio en GitHub (si aún no tienes uno: **New repository**, nombre por ejemplo `carta`, público).
2. **Add file → Upload files** y arrastra **el contenido** de esta carpeta (no el .zip: descomprímelo primero): `index.html`, `admin.html`, `firebase-config.js`, `firestore.rules`, y las carpetas `css` y `js`. Pulsa **Commit changes**.
3. **Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / carpeta `/ (root)` → Save.**
4. Espera 1–2 minutos. GitHub te mostrará la dirección, algo como `https://tuusuario.github.io/carta/`.
   - **Carta para los clientes:** esa dirección.
   - **Tu panel:** esa dirección + `admin.html`.

## PARTE C — Cargar la carta que ya hicimos (solo la primera vez)

1. Abre el panel (`.../admin.html`) y entra con tu correo y contraseña.
2. Pestaña **Importar** → elige el archivo `carta-la-matriarca-barranquilla-v2.html` (el de 8 MB con las fotos) → **Importar a la base de datos**.
3. Espera a que diga “Listo”. Se cargan los 4 grupos, las 16 categorías, unos 368 platos con sus precios y fotos, el logo y el fondo.
4. Abre la carta y compruébala.

> No repitas la importación después de empezar a editar: los platos importados volverían a su estado original.

---

## Cómo usar el panel

| Pestaña | Para qué sirve |
|---|---|
| **Platos** | Filtrar por categoría o buscar un plato. **+ Nuevo plato**, **Editar**, **Duplicar**, **Eliminar**. Cuando filtras por una categoría puedes cambiar el orden con las flechas ↑ ↓. |
| **Categorías** | Los botones de cada grupo (Entradas, Mar, Vinos…). Crear, renombrar, cambiar color e ícono, ocultar, ordenar, eliminar. Al eliminar una categoría, los platos NO se borran: solo dejan de aparecer en ella. |
| **Grupos** | Los botones de la pantalla de inicio (Cocina, Pa´tomar, Desayuno, Postres). Si un grupo tiene una sola categoría, el cliente entra directo a ella. |
| **Ajustes** | Mensaje de inicio, texto del pie de página, logo y fondo. |
| **Importar** | Carga inicial desde la carta HTML v2. |

**Dentro de cada plato puedes cambiar:** nombre, categorías (un plato puede estar en varias), etiqueta naranja, precio o varios precios (Copa/Botella, Trago/Botella), foto, “mostrar/ocultar” y “agotado” (se ve atenuado con la marca *Agotado*).

Los cambios se ven en la carta al instante, sin volver a publicar nada.

## Cosas que debes saber

- **Fotos:** al subirlas se reducen automáticamente (máx. 800 px) para que quepan en la base de datos. Usa fotos claras y cuadradas o casi cuadradas.
- **Seguridad:** cualquiera puede *ver* la carta, pero solo el correo que pusiste en `firestore.rules` puede *cambiarla*. No compartas tu contraseña. La dirección `admin.html` no aparece enlazada en la carta.
- **Costo:** el plan gratuito de Firebase (Spark) permite 50 000 lecturas y 20 000 escrituras al día y 1 GB de datos. Una visita a la carta usa unas decenas de lecturas, así que alcanza para cientos de visitas diarias. Si algún día se pasa del límite, la carta deja de cargar ese día; podrías subir al plan de pago.
- **Código QR:** puedes generar un QR con la dirección de la carta para ponerlo en las mesas.
- **Dominio propio:** si quieres `carta.lamatriarca.com`, GitHub Pages lo permite (Settings → Pages → Custom domain).
- **Esta versión no incluye** el menú lateral con las otras sedes: es solo la carta de Barranquilla.

## Si algo falla

- *“Falta configurar Firebase”*: no pegaste bien los datos en `firebase-config.js`.
- *“Tu correo no tiene permiso…”*: el correo de `firestore.rules` no es el mismo con el que entraste, o no publicaste las reglas.
- *La carta dice “La carta todavía no tiene platos”*: aún no hiciste la importación (Parte C) o no hay categorías visibles.
- *No puedo entrar al panel*: revisa que el usuario exista en Authentication y que Correo/contraseña esté habilitado.

## Versiones
Cada vez que se cambie la carta, se edita `version.js`: se sube el número (`VERSION`), la `FECHA` y se agrega una línea al inicio de `CAMBIOS`. La versión se ve en el pie de la carta ("v1.1") y en el panel (toca la versión para ver el historial).
