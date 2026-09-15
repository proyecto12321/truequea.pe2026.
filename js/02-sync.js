/* ===================================================================
   TRUEQUEA PE · Sincronización segura: fusión, borrados y copias
   Archivo: js/02-sync.js
   =================================================================== */

/* =====================================================================
   SINCRONIZACIÓN SEGURA — que nunca más se borre nada
   ---------------------------------------------------------------------
   Antes cada equipo subía TODA la base de golpe y el último que escribía
   pisaba a los demás. Si una computadora tenía datos viejos, borraba a
   todos los usuarios y publicaciones de los otros.

   Ahora:
   · Cada registro tiene su propio identificador único y su fecha de
     cambio (mod). Al sincronizar se FUSIONA registro por registro y gana
     el más reciente: nada desaparece.
   · Borrar deja una "lápida" con la fecha. Solo así se borra de verdad
     en todos lados, y solo lo que se borró a propósito.
   · No se sube NADA hasta haber leído primero la nube. Esto solo ya
     evita el 90% de los desastres.
   · Antes de cada subida se guarda una copia de seguridad local, por si
     acaso.
   ===================================================================== */

const COLECCIONES = ['usuarios', 'articulos', 'anuncios', 'intercambios', 'chats',
                     'mensajes', 'notis', 'favoritos', 'resenas', 'pagos',
                     'deseos', 'seguros'];

/* --- Identificadores únicos de verdad -------------------------------
   Antes: 101, 102, 103...  → dos celulares creaban el mismo número.
   Ahora: la hora exacta en milisegundos + azar. Imposible que choquen. */
function nuevoId() {
  const base = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  BD.seq = base;
  return base;
}

/* --- Registro de borrados (lápidas) --------------------------------- */
function tumba(coleccion, id) {
  if (!BD.borrados) BD.borrados = {};
  BD.borrados[coleccion + ':' + id] = Date.now();
}

/* Limpia lápidas de más de 90 días para que no crezcan sin fin */
function limpiarTumbas(t) {
  const limite = Date.now() - 90 * 86400000;
  Object.keys(t || {}).forEach(k => { if (t[k] < limite) delete t[k]; });
  return t || {};
}

/* --- Sombra: recuerda cómo estaba cada registro para saber qué cambió */
const SOMBRA = {};
function sinMod(r) {
  const c = { ...r };
  delete c.mod;
  return JSON.stringify(c);
}

/* Marca con la hora los registros que cambiaron y anota los que se
   borraron. Se llama solo, antes de cada guardado. */
function estampar() {
  const ahora = Date.now();
  COLECCIONES.forEach(k => {
    if (!Array.isArray(BD[k])) BD[k] = [];
    const antes = SOMBRA[k];
    const ahoraMapa = {};
    BD[k].forEach(r => {
      if (r.id === undefined || r.id === null) r.id = nuevoId();
      const txt = sinMod(r);
      ahoraMapa[r.id] = txt;
      if (!antes) { if (!r.mod) r.mod = ahora; return; }
      if (antes[r.id] !== txt) r.mod = ahora;          // cambió o es nuevo
      else if (!r.mod) r.mod = ahora;
    });
    /* lo que estaba y ya no está, se borró a propósito */
    if (antes) {
      Object.keys(antes).forEach(id => {
        if (!(id in ahoraMapa)) tumba(k, id);
      });
    }
    SOMBRA[k] = ahoraMapa;
  });
  if (!BD.config.mod) BD.config.mod = ahora;
  BD.borrados = limpiarTumbas(BD.borrados);
}

/* La configuración también lleva su fecha: si el admin cambia el precio,
   ese cambio gana sobre el de los demás equipos. */
let SOMBRA_CONFIG = null;
function estamparConfig() {
  const txt = JSON.stringify({ ...BD.config, mod: 0 });
  if (SOMBRA_CONFIG !== null && SOMBRA_CONFIG !== txt) BD.config.mod = Date.now();
  SOMBRA_CONFIG = txt;
}

/* =====================================================================
   FUSIÓN — lo mío + lo de la nube, sin perder nada
   ===================================================================== */
function fusionar(nube) {
  if (!nube || typeof nube !== 'object') return false;
  const tumbas = limpiarTumbas({ ...(BD.borrados || {}), ...(nube.borrados || {}) });
  let cambios = 0;

  COLECCIONES.forEach(k => {
    const mios = Array.isArray(BD[k]) ? BD[k] : [];
    const suyos = Array.isArray(nube[k]) ? nube[k] : [];
    const mapa = new Map();

    mios.forEach(r => { if (r && r.id !== undefined) mapa.set(String(r.id), r); });
    suyos.forEach(r => {
      if (!r || r.id === undefined) return;
      const clave = String(r.id);
      const mio = mapa.get(clave);
      if (!mio) { mapa.set(clave, r); cambios++; return; }
      /* gana el que se modificó después */
      if ((r.mod || 0) > (mio.mod || 0)) { mapa.set(clave, r); cambios++; }
    });

    /* se van solo los que alguien borró a propósito después del último cambio */
    const lista = [...mapa.values()].filter(r => {
      const t = tumbas[k + ':' + r.id];
      return !(t && t >= (r.mod || 0));
    });
    if (lista.length !== mios.length) cambios++;
    BD[k] = lista;
  });

  /* configuración: gana la más reciente */
  if (nube.config && (nube.config.mod || 0) > (BD.config.mod || 0)) {
    const sesion = BD.sesion;
    BD.config = nube.config;
    BD.sesion = sesion;
    cambios++;
  }
  /* visitas: se suman por día, no se pisan */
  const dias = {};
  [...(BD.visitas || []), ...(nube.visitas || [])].forEach(v => {
    if (!v || !v.dia) return;
    const p = dias[v.dia];
    if (!p) dias[v.dia] = { ...v, usuarios: [...(v.usuarios || [])] };
    else {
      p.total = Math.max(p.total || 0, v.total || 0);
      (v.usuarios || []).forEach(id => { if (!p.usuarios.includes(id)) p.usuarios.push(id); });
    }
  });
  BD.visitas = Object.values(dias).sort((a, b) => a.dia.localeCompare(b.dia)).slice(-120);

  BD.borrados = tumbas;
  BD.seq = Math.max(BD.seq || 0, nube.seq || 0);
  return cambios > 0;
}

/* =====================================================================
   COPIA DE SEGURIDAD LOCAL — el paracaídas
   Guarda las 5 últimas versiones buenas. Si algo se borra, se recupera.
   ===================================================================== */
const LLAVE_COPIAS = LLAVE + '_copias';

function guardarCopia(motivo) {
  try {
    const copias = JSON.parse(localStorage.getItem(LLAVE_COPIAS) || '[]');
    copias.unshift({
      cuando: Date.now(), motivo,
      usuarios: BD.usuarios.length, articulos: BD.articulos.length,
      datos: JSON.stringify({ ...BD, sesion: null }),
    });
    localStorage.setItem(LLAVE_COPIAS, JSON.stringify(copias.slice(0, 5)));
  } catch (e) { /* si no hay espacio, seguimos igual */ }
}

function listaCopias() {
  try { return JSON.parse(localStorage.getItem(LLAVE_COPIAS) || '[]'); }
  catch (e) { return []; }
}

function restaurarCopia(i) {
  const c = listaCopias()[i];
  if (!c) return;
  confirmar('Restaurar copia de seguridad',
    `Se volverá a como estaba el ${new Date(c.cuando).toLocaleString()}: ` +
    `${c.usuarios} usuarios y ${c.articulos} publicaciones. Lo de ahora se guarda como copia antes de cambiar.`,
    () => {
      guardarCopia('antes de restaurar');
      const sesion = BD.sesion;
      BD = sanear(JSON.parse(c.datos));
      BD.sesion = sesion;
      Object.keys(SOMBRA).forEach(k => delete SOMBRA[k]);
      guardarSoloLocal();
      estampar();
      guardar();
      refrescarTodo();
      avisar('Copia restaurada ✔', 'ok');
    }, 'Sí, restaurar');
}

/* =====================================================================
   RED DE SEGURIDAD — nunca subir una base sospechosamente vacía
   ===================================================================== */
function subidaSegura(copia) {
  const antes = NUBE.ultimoConteo;
  const ahora = { u: copia.usuarios.length, a: copia.articulos.length };
  if (!antes) { NUBE.ultimoConteo = ahora; return { ok: true }; }

  /* si de golpe desaparecería más de la mitad de todo, paramos */
  const perdidaU = antes.u - ahora.u;
  const perdidaA = antes.a - ahora.a;
  if ((antes.u >= 4 && perdidaU > antes.u / 2) || (antes.a >= 4 && perdidaA > antes.a / 2)) {
    return { ok: false,
      motivo: `Se iban a borrar ${perdidaU} usuario(s) y ${perdidaA} publicación(es) de golpe.` };
  }
  NUBE.ultimoConteo = ahora;
  return { ok: true };
}
