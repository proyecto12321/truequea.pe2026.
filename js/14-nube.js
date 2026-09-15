/* ===================================================================
   TRUEQUEA PE · Base de datos en la nube (Firebase)
   Archivo: js/14-nube.js
   =================================================================== */

/* =====================================================================
   TRUEQUEA PE — BASE DE DATOS EN LA NUBE (Firebase Realtime Database)
   ---------------------------------------------------------------------
   Con esto todos los usuarios comparten la MISMA información desde
   cualquier celular o computadora.

   Cómo se conecta (si falla uno, pasa al siguiente, nunca se queda sin
   guardar):
     1) SDK de Firebase  → cambios en vivo, al instante
     2) REST de Firebase → si el SDK no carga; revisa cada 15 segundos
     3) api.php          → si lo subiste a un hosting con PHP
     4) Navegador        → siempre, como respaldo sin internet

   Tu sesión (con qué cuenta entraste) NUNCA se sube: queda en tu equipo.
   Para apagar la nube: pon activa:false aquí abajo.
   ===================================================================== */

const NUBE_CONFIG = {
  activa: true,
  raiz: 'truequea',          // carpeta dentro de la base de datos
  usarAnonimo: false,        // ponlo en true solo si activas "Anónimo" en
                             // Authentication y cierras las reglas con auth != null
  segundosRevision: 15,      // cada cuánto revisa la nube en modo REST
  firebase: {
    apiKey: "AIzaSyDwP7HQrP5mB6x_vpM_aekiOo0Jwwa8cDs",
    authDomain: "trueque-78e60.firebaseapp.com",
    databaseURL: "https://trueque-78e60-default-rtdb.firebaseio.com",
    projectId: "trueque-78e60",
    storageBucket: "trueque-78e60.firebasestorage.app",
    messagingSenderId: "619545724447",
    appId: "1:619545724447:web:c03301bf38cdc4da72b72a",
    measurementId: "G-RTMH7YDK0H"
  },
};

const SDK_APP  = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js';
const SDK_DB   = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js';
const SDK_AUTH = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js';

const NUBE = {
  activa: false, modo: 'local', ref: null, timer: null, reloj: null,
  subiendo: false, aplicando: false, huella: null, ultima: null,
  error: null, detalle: '', conectado: null, uid: null,
  /* ¡IMPORTANTE! Hasta no haber LEÍDO la nube al menos una vez, este
     equipo tiene prohibido subir. Así un equipo con datos viejos nunca
     borra lo de los demás. */
  leido: false, ultimoConteo: null, pendiente: false,
};

/* Dirección REST de la carpeta, por si el SDK no carga */
function urlRest() {
  return NUBE_CONFIG.firebase.databaseURL.replace(/\/$/, '') + '/' + NUBE_CONFIG.raiz + '.json';
}

/* Carga un script con límite de tiempo, para que nunca se quede colgado */
function cargarJsConTiempo(url, ms = 12000) {
  return Promise.race([
    cargarJs(url),
    new Promise(ok => setTimeout(() => ok(false), ms)),
  ]);
}

/* Resumen corto de los datos: evita subir o repintar de gabete */
function huellaBD(datos) {
  try {
    return [datos.usuarios.length, datos.articulos.length, datos.intercambios.length,
            datos.mensajes.length, datos.notis.length, datos.pagos.length,
            (datos.deseos || []).length, (datos.seguros || []).length,
            datos.anuncios.length, (datos.favoritos || []).length,
            (datos.resenas || []).length, datos.actualizado || 0].join('-');
  } catch (e) { return String(Math.random()); }
}

/* Deja la base con todas sus listas, aunque la nube devuelva algo incompleto */
function sanear(datos) {
  ['usuarios', 'articulos', 'anuncios', 'intercambios', 'chats', 'mensajes', 'notis',
   'favoritos', 'resenas', 'pagos', 'visitas', 'deseos', 'seguros'].forEach(k => {
    if (!Array.isArray(datos[k])) datos[k] = [];
  });
  if (!datos.config) datos.config = semilla().config;
  return datos;
}

/* =====================================================================
   ARRANQUE
   ===================================================================== */
async function iniciarNube() {
  if (!NUBE_CONFIG.activa || !NUBE_CONFIG.firebase.databaseURL) {
    NUBE.detalle = 'La nube está apagada en la configuración.';
    marcarModo(); return;
  }

  /* 1) primero probamos con una consulta simple: así sabemos exactamente
        qué pasa (si la base existe, si las reglas dejan leer, etc.) */
  const prueba = await probarNube();
  if (!prueba.ok) {
    NUBE.activa = false;
    NUBE.error = prueba.error;
    NUBE.detalle = prueba.detalle;
    marcarModo();
    if (prueba.reglas) {
      /* Falta publicar las Reglas: lo decimos con calma, con el botón para
         ver el diagnóstico, y seguimos reintentando solos cada 30 segundos. */
      avisarConBoton('Falta publicar las Reglas en Firebase. Mientras tanto se guarda en este equipo.',
                     'Ver cómo arreglarlo', verDiagnostico);
      reintentarSolo();
    }
    return;
  }

  /* 2) intentamos el SDK, que trae los cambios en vivo */
  const hayApp = await cargarJsConTiempo(SDK_APP);
  const hayDb  = hayApp ? await cargarJsConTiempo(SDK_DB) : false;

  if (hayApp && hayDb && window.firebase) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(NUBE_CONFIG.firebase);

      /* la entrada anónima es opcional: si falla, seguimos igual */
      if (NUBE_CONFIG.usarAnonimo) {
        try {
          await cargarJsConTiempo(SDK_AUTH);
          if (firebase.auth) {
            const cred = await firebase.auth().signInAnonymously();
            NUBE.uid = cred && cred.user ? cred.user.uid : null;
          }
        } catch (e) { NUBE.uid = null; }
      }

      NUBE.ref = firebase.database().ref(NUBE_CONFIG.raiz);
      NUBE.activa = true;
      NUBE.modo = 'sdk';
      NUBE.error = null;
      NUBE.detalle = 'Conectada en vivo con el SDK de Firebase.';
      SERVIDOR.activo = false;

      firebase.database().ref('.info/connected').on('value', s => {
        NUBE.conectado = !!s.val();
        marcarModo();
      });

      NUBE.ref.on('value',
        s => aplicarDesdeNube(s.val()),
        e => {                                   // si el SDK falla, pasamos a REST
          NUBE.detalle = 'El SDK falló (' + e.message + '). Seguimos por REST.';
          arrancarRest();
        });
      marcarModo();
      return;
    } catch (e) {
      NUBE.detalle = 'No se pudo iniciar el SDK: ' + e.message;
    }
  } else {
    NUBE.detalle = 'No cargó el SDK de Firebase; usamos la conexión REST.';
  }

  /* 3) si el SDK no cargó pero la base SÍ responde, trabajamos por REST */
  arrancarRest(prueba.datos);
}

/* Consulta de prueba: dice en criollo qué está pasando */
async function probarNube() {
  const url = urlRest();
  try {
    const r = await fetch(url + '?shallow=true', { cache: 'no-store' });
    let cuerpo = '';
    try { cuerpo = (await r.clone().text()).slice(0, 200); } catch (e) {}

    if (r.status === 401 || r.status === 403) {
      return { ok: false, error: 'permiso denegado',
        detalle: 'Firebase respondió ' + r.status + ' ' + cuerpo +
                 '. Las Reglas de la Realtime Database no están dejando entrar.',
        reglas: true };
    }
    if (r.status === 404) {
      return { ok: false, error: 'base no encontrada',
        detalle: 'La dirección responde 404. Revisa que la Realtime Database exista en el proyecto ' +
                 (NUBE_CONFIG.firebase.projectId || '') + ' y que la URL sea la correcta.' };
    }
    if (!r.ok) {
      return { ok: false, error: 'código ' + r.status, detalle: 'Firebase respondió ' + r.status + ' ' + cuerpo };
    }
    return { ok: true, datos: await r.json() };
  } catch (e) {
    return { ok: false, error: 'sin conexión',
      detalle: 'No se pudo llegar a Firebase (' + e.message + '). Puede ser falta de internet, ' +
               'o el navegador bloqueando la conexión.' };
  }
}

/* =====================================================================
   DIAGNÓSTICO COMPLETO — 4 pruebas, una por una
   ===================================================================== */
async function diagnosticoNube() {
  const base = NUBE_CONFIG.firebase.databaseURL.replace(/\/$/, '');
  const pasos = [];

  /* 1. ¿hay internet? */
  try {
    await fetch(base + '/.json?shallow=true', { cache: 'no-store', mode: 'cors' });
    pasos.push({ n: '1. Internet y dirección', ok: true, txt: 'La base responde: ' + base });
  } catch (e) {
    pasos.push({ n: '1. Internet y dirección', ok: false,
      txt: 'No se pudo llegar a ' + base + ' (' + e.message + ').' });
    return pasos;
  }

  /* 2. ¿deja leer la raíz? */
  try {
    const r = await fetch(base + '/.json?shallow=true', { cache: 'no-store' });
    const cuerpo = (await r.text()).slice(0, 160);
    pasos.push({ n: '2. Permiso de LECTURA', ok: r.ok,
      txt: r.ok ? 'Firebase deja leer. Contenido de la raíz: ' + (cuerpo || 'vacía')
                : 'Firebase respondió ' + r.status + ': ' + cuerpo });
  } catch (e) {
    pasos.push({ n: '2. Permiso de LECTURA', ok: false, txt: e.message });
  }

  /* 3. ¿deja escribir? (escribe y borra una marca de prueba) */
  const marca = base + '/_prueba_truequea.json';
  try {
    const w = await fetch(marca, { method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuando: Date.now(), de: 'Truequea PE' }) });
    const cuerpo = (await w.text()).slice(0, 160);
    if (w.ok) {
      await fetch(marca, { method: 'DELETE' });
      pasos.push({ n: '3. Permiso de ESCRITURA', ok: true, txt: 'Firebase deja guardar. Todo bien.' });
    } else {
      pasos.push({ n: '3. Permiso de ESCRITURA', ok: false,
        txt: 'Firebase respondió ' + w.status + ': ' + cuerpo });
    }
  } catch (e) {
    pasos.push({ n: '3. Permiso de ESCRITURA', ok: false, txt: e.message });
  }

  /* 4. ¿está la carpeta de la app? */
  try {
    const r = await fetch(urlRest() + '?shallow=true', { cache: 'no-store' });
    const cuerpo = (await r.text()).slice(0, 160);
    pasos.push({ n: '4. Carpeta /' + NUBE_CONFIG.raiz, ok: r.ok,
      txt: r.ok ? (cuerpo === 'null' ? 'Todavía está vacía: se llenará al primer cambio.'
                                     : 'Ya tiene datos: ' + cuerpo)
                : 'Firebase respondió ' + r.status + ': ' + cuerpo });
  } catch (e) {
    pasos.push({ n: '4. Carpeta /' + NUBE_CONFIG.raiz, ok: false, txt: e.message });
  }
  return pasos;
}

const REGLAS_SUGERIDAS = `{
  "rules": {
    ".read": true,
    ".write": true
  }
}`;

/* Muestra el diagnóstico en pantalla */
async function verDiagnostico() {
  $('#diagCuerpo').innerHTML = `<h2>🔌 Diagnóstico de la nube</h2>
    <p class="sub">Probando la conexión con Firebase, espera unos segundos...</p>
    <div class="lectura cargando"><b>Revisando</b></div>`;
  abrir('mDiag');
  const pasos = await diagnosticoNube();
  const malo = pasos.find(p => !p.ok);

  $('#diagCuerpo').innerHTML = `
    <h2>🔌 Diagnóstico de la nube</h2>
    <p class="sub">Proyecto <b>${esc(NUBE_CONFIG.firebase.projectId)}</b> ·
      ${esc(NUBE_CONFIG.firebase.databaseURL)}</p>
    <div class="diag">
      ${pasos.map(p => `<div class="diag-fila ${p.ok ? 'si' : 'no'}">
        <span class="diag-emo">${p.ok ? '✅' : '❌'}</span>
        <div><b>${esc(p.n)}</b><span>${esc(p.txt)}</span></div>
      </div>`).join('')}
    </div>
    ${malo ? `
      <div class="diag-arreglo">
        <b>Cómo arreglarlo, paso a paso</b>
        <ol>
          <li>Entra a <b>console.firebase.google.com</b> y elige el proyecto
              <b>${esc(NUBE_CONFIG.firebase.projectId)}</b>.</li>
          <li>Menú izquierdo → <b>Realtime Database</b> (no Firestore).</li>
          <li>Pestaña <b>Reglas</b> (Rules).</li>
          <li>Borra todo lo que haya y pega esto:</li>
        </ol>
        <pre class="reglas">${esc(REGLAS_SUGERIDAS)}</pre>
        <button class="btn suave sm" type="button" id="btnCopiarReglas">📋 Copiar las reglas</button>
        <ol start="5">
          <li>Toca <b>Publicar</b> (Publish). Si no publicas, no sirve de nada.</li>
          <li>Vuelve aquí y toca <b>Probar otra vez</b>. La app se conecta sola.</li>
        </ol>
        <p class="nota">Estas reglas dejan entrar a cualquiera que tenga el enlace de tu base.
          Sirven para arrancar. Cuando ya esté funcionando te paso las reglas cerradas.</p>
      </div>` : `
      <div class="diag-arreglo bien">
        <b>✅ Todo en orden</b>
        <p class="nota">La nube está lista. Si el cartelito del pie todavía dice “modo local”,
          toca “Probar otra vez”.</p>
      </div>`}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
      <button class="btn pri" type="button" id="btnDiagReintentar">🔄 Probar otra vez</button>
      <a class="btn suave" target="_blank" rel="noopener"
         href="https://console.firebase.google.com/project/${esc(NUBE_CONFIG.firebase.projectId)}/database">
         Abrir Firebase</a>
    </div>`;

  const bc = $('#btnCopiarReglas');
  if (bc) bc.addEventListener('click', () => {
    navigator.clipboard?.writeText(REGLAS_SUGERIDAS)
      .then(() => avisar('Reglas copiadas ✔', 'ok'))
      .catch(() => avisar('Selecciona el texto y cópialo a mano'));
  });
  $('#btnDiagReintentar').addEventListener('click', async () => {
    await reconectarNube();
    verDiagnostico();
  });
}

/* =====================================================================
   MODO REST — sin SDK: leemos y escribimos con consultas normales
   ===================================================================== */
function arrancarRest() {
  NUBE.activa = true;
  NUBE.modo = 'rest';
  NUBE.error = null;
  SERVIDOR.activo = false;
  bajarRest();
  clearInterval(NUBE.reloj);
  NUBE.reloj = setInterval(bajarRest, Math.max(8, NUBE_CONFIG.segundosRevision) * 1000);
  marcarModo();
}

async function bajarRest() {
  if (!NUBE.activa || NUBE.modo !== 'rest' || NUBE.subiendo) return;
  try {
    const r = await fetch(urlRest(), { cache: 'no-store' });
    if (!r.ok) throw new Error('código ' + r.status);
    const datos = await r.json();
    aplicarDesdeNube(datos);
    NUBE.error = null;
  } catch (e) {
    NUBE.error = e.message;
    marcarModo();
  }
}

async function subirRest(copia) {
  const r = await fetch(urlRest(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(copia),
  });
  if (!r.ok) throw new Error('código ' + r.status);
}

/* =====================================================================
   BAJAR Y SUBIR
   ===================================================================== */
function aplicarDesdeNube(datos) {
  const vacia = !datos || !Array.isArray(datos.usuarios) || !datos.usuarios.length;

  if (vacia) {
    /* La nube está vacía de verdad: la estrenamos con lo nuestro */
    NUBE.leido = true;
    subirANube(true);
    marcarModo();
    return;
  }

  const h = huellaBD(datos);
  const primeraVez = !NUBE.leido;
  NUBE.leido = true;
  if (!primeraVez && h === NUBE.huella) { NUBE.ultima = new Date(); marcarModo(); return; }
  NUBE.huella = h;

  NUBE.aplicando = true;
  const antes = { u: BD.usuarios.length, a: BD.articulos.length };

  /* FUSIÓN: lo mío + lo de la nube, gana el más reciente de cada registro */
  const hubo = fusionar(sanear(datos));
  sanear(BD);
  guardarSoloLocal();

  const despues = { u: BD.usuarios.length, a: BD.articulos.length };
  NUBE.ultimoConteo = despues;
  if (primeraVez) guardarCopia('al conectar con la nube');

  if (hubo) refrescarTodo();
  setTimeout(() => { NUBE.aplicando = false; }, 700);

  /* si yo tenía cosas que la nube no tiene, las subo */
  if (despues.u > (datos.usuarios || []).length ||
      despues.a > (datos.articulos || []).length || NUBE.pendiente) {
    NUBE.pendiente = false;
    programarNube();
  }
  NUBE.ultima = new Date();
  marcarModo();
}

function refrescarTodo() {
  try {
    aplicarPlan(); aplicarMarca();
    pintarCiudades(); pintarCategorias();
    pintarNav(); pintarLista(); pintarMapa(); pintarPremium();
    const u = yo();
    if (u && $('#v-cuenta').classList.contains('on')) pintarCuenta();
    if (u && u.rol === 'admin' && $('#v-admin').classList.contains('on')) pintarAdmin();
    if (App.chat && $('#mChat').classList.contains('on')) pintarChat();
  } catch (e) { console.warn('refresco', e); }
}

function programarNube() {
  if (!NUBE.activa || NUBE.aplicando) return;
  clearTimeout(NUBE.timer);
  NUBE.timer = setTimeout(() => subirANube(), 1200);
}

async function subirANube(primeraVez = false) {
  if (!NUBE.activa || NUBE.subiendo) return;

  /* PROHIBIDO subir sin haber leído antes: así nadie pisa a los demás */
  if (!NUBE.leido && !primeraVez) { NUBE.pendiente = true; return; }

  NUBE.subiendo = true;
  try {
    estampar();
    estamparConfig();
    const copia = JSON.parse(JSON.stringify({ ...BD, sesion: null, actualizado: Date.now() }));

    /* red de seguridad: si de golpe fuera a desaparecer medio sistema, paramos */
    const revision = subidaSegura(copia);
    if (!revision.ok) {
      guardarCopia('subida frenada');
      avisarConBoton('Frenamos una subida rara: ' + revision.motivo +
        ' Tus datos están a salvo en este equipo.', 'Ver copias', verCopias);
      return;
    }

    const texto = JSON.stringify(copia);
    if (texto.length > 7 * 1024 * 1024) {
      avisar('La base pesa mucho. Baja la copia JSON y borra publicaciones viejas.', 'err');
      return;
    }
    NUBE.huella = huellaBD(copia);

    if (NUBE.modo === 'sdk' && NUBE.ref) await NUBE.ref.set(copia);
    else await subirRest(copia);

    NUBE.ultima = new Date();
    NUBE.error = null;
    if (primeraVez) avisar('Base de datos creada en la nube ✔', 'ok');
  } catch (e) {
    NUBE.error = e.message;
    NUBE.pendiente = true;
    if (/permission|denied|401|403/i.test(e.message)) {
      NUBE.detalle = 'Firebase rechazó la escritura: revisa las Reglas.';
      NUBE.activa = false;
    }
  } finally {
    NUBE.subiendo = false;
    marcarModo();
  }
}

/* guardar() ahora también manda todo a la nube */
const guardarAntesDeNube = guardar;
guardar = function () {
  try { estampar(); estamparConfig(); } catch (e) { /* nunca romper el guardado */ }
  guardarAntesDeNube();
  programarNube();
};

/* =====================================================================
   CARTELITO DEL PIE
   ===================================================================== */
marcarModo = function () {
  const pie = document.querySelector('.pie-base');
  if (!pie) return;
  let s = document.getElementById('modoDatos');
  if (!s) {
    s = document.createElement('span');
    s.id = 'modoDatos';
    s.style.cssText = 'display:block;margin-top:6px;font-size:12px';
    pie.appendChild(s);
  }
  const hora = NUBE.ultima ? ' · ' + NUBE.ultima.toLocaleTimeString() : '';
  if (NUBE.activa && NUBE.modo === 'sdk') {
    s.innerHTML = NUBE.conectado === false
      ? '🟡 Nube conectada, esperando señal — se guardará al volver el internet'
      : `🟢 Base de datos en la nube (Firebase, en vivo) — todos ven lo mismo${hora}`;
  } else if (NUBE.activa && NUBE.modo === 'rest') {
    s.innerHTML = `🟢 Base de datos en la nube (Firebase) — se revisa cada
      ${NUBE_CONFIG.segundosRevision} s${hora}`;
  } else if (SERVIDOR.activo) {
    s.innerHTML = '🔵 Modo servidor (api.php) — todos ven los mismos datos';
  } else {
    s.innerHTML = '⚪ Modo local — los datos se guardan solo en este navegador'
      + (NUBE.error ? ` <span style="opacity:.75">(${esc(NUBE.error)})</span>` : '');
  }
};

function sincronizarAhora() {
  if (!NUBE.activa) { reconectarNube(); return; }
  subirANube();
  avisar('Sincronizando con la nube...', 'ok');
}

/* Vuelve a intentar la conexión sin recargar la página */
async function reconectarNube() {
  avisar('Probando la conexión con Firebase...');
  NUBE.error = null; NUBE.huella = null;
  clearInterval(NUBE.reloj);
  await iniciarNube();
  if (typeof pintarEstadoNube === 'function') pintarEstadoNube();
  avisar(NUBE.activa ? 'Conectado a la nube ✔' : 'Todavía no se puede: ' + (NUBE.error || ''),
         NUBE.activa ? 'ok' : 'err');
}

/* Reintenta solo cada 30 segundos: apenas publiques las Reglas, se conecta
   sin que tengas que recargar nada. */
function reintentarSolo() {
  clearInterval(NUBE.reintento);
  NUBE.reintento = setInterval(async () => {
    if (NUBE.activa) { clearInterval(NUBE.reintento); return; }
    const p = await probarNube();
    if (p.ok) {
      clearInterval(NUBE.reintento);
      avisar('¡Listo! Ya se conectó a la nube 🎉', 'ok');
      iniciarNube();
    }
  }, 30000);
}

/* Aviso que se queda un rato y trae un botón para actuar */
function avisarConBoton(texto, etiqueta, accion) {
  const c = document.getElementById('avisoNube') || (() => {
    const d = document.createElement('div');
    d.id = 'avisoNube'; d.className = 'aviso-nube';
    document.body.appendChild(d);
    return d;
  })();
  c.innerHTML = `<span>☁️ ${esc(texto)}</span>
    <button class="btn pri sm" type="button">${esc(etiqueta)}</button>
    <button class="cerrar-aviso" type="button" aria-label="Cerrar">✕</button>`;
  c.classList.add('on');
  c.querySelector('.btn').onclick = () => { c.classList.remove('on'); accion(); };
  c.querySelector('.cerrar-aviso').onclick = () => c.classList.remove('on');
}

document.addEventListener('DOMContentLoaded', () => setTimeout(iniciarNube, 600));
