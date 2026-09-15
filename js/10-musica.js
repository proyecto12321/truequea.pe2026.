/* ===================================================================
   TRUEQUEA PE · Reproductor de música con comandos por voz
   Archivo: js/10-musica.js
   =================================================================== */

/* =====================================================================
   MÚSICA — reproductor estilo iOS con comandos por voz
   ---------------------------------------------------------------------
   Por qué antes no sonaba nada: las canciones se guardaban como texto en
   localStorage, que solo aguanta unos 5 MB en TOTAL. Un mp3 de 4 MB pasa
   a pesar 5.5 MB al convertirlo, así que reventaba y no guardaba ninguna.

   Ahora se guardan en IndexedDB como archivo de verdad (Blob): no tiene
   ese tope, suena al instante y queda guardado aunque cierres.

   Aviso honesto: no puedo incluir canciones de artistas dentro del
   sistema ni bajarlas de internet, porque esa música tiene dueño.
   Tú cargas las tuyas una vez y desde ahí las pides por voz o escribiendo.
   ===================================================================== */

const MUSICA = {
  audio: null, lista: [], indice: -1, sonando: false,
  ctx: null, nodos: null, ambiental: false, volumen: 0.6,
  db: null, urlActual: null, escuchando: false, repetir: false, azar: false,
};

/* ---------------------------------------------------------------------
   Almacén de verdad: IndexedDB
   --------------------------------------------------------------------- */
function abrirAlmacen() {
  if (MUSICA.db) return Promise.resolve(MUSICA.db);
  return new Promise((ok, mal) => {
    const p = indexedDB.open('truequea_musica', 1);
    p.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('temas'))
        db.createObjectStore('temas', { keyPath: 'id' });
    };
    p.onsuccess = e => { MUSICA.db = e.target.result; ok(MUSICA.db); };
    p.onerror = () => mal(new Error('No se pudo abrir el almacén de música'));
  });
}
function tx(modo) {
  return abrirAlmacen().then(db => db.transaction('temas', modo).objectStore('temas'));
}
function guardarTema(tema) {
  return tx('readwrite').then(s => new Promise((ok, mal) => {
    const r = s.put(tema);
    r.onsuccess = () => ok(true);
    r.onerror = () => mal(new Error('No entró la canción'));
  }));
}
function borrarTema(id) {
  return tx('readwrite').then(s => new Promise(ok => { s.delete(id).onsuccess = () => ok(true); }));
}
function leerTemas() {
  return tx('readonly').then(s => new Promise(ok => {
    const r = s.getAll();
    r.onsuccess = () => ok((r.result || []).sort((a, b) => a.cuando - b.cuando));
    r.onerror = () => ok([]);
  })).catch(() => []);
}

async function cargarMusica() {
  try {
    MUSICA.lista = await leerTemas();
    if ($('#musCuerpo')) pintarReproductor();
  } catch (e) { MUSICA.lista = []; }
}

/* ---------------------------------------------------------------------
   Música ambiental generada por el sistema (libre, sin dueño)
   --------------------------------------------------------------------- */
function ambientalEncender() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return avisar('Tu navegador no permite generar sonido', 'err');
    if (!MUSICA.ctx) MUSICA.ctx = new AC();
    if (MUSICA.ctx.state === 'suspended') MUSICA.ctx.resume();
    const ctx = MUSICA.ctx;
    if (MUSICA.audio && !MUSICA.audio.paused) MUSICA.audio.pause();

    const maestro = ctx.createGain();
    maestro.gain.value = MUSICA.volumen * 0.45;
    const eco = ctx.createDelay(1.2); eco.delayTime.value = 0.42;
    const ecoVol = ctx.createGain(); ecoVol.gain.value = 0.32;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 1900;
    maestro.connect(filtro); filtro.connect(ctx.destination);
    maestro.connect(eco); eco.connect(ecoVol); ecoVol.connect(eco); ecoVol.connect(filtro);

    const escala = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    let paso = 0;
    const tocar = () => {
      if (!MUSICA.ambiental) return;
      const nota = escala[Math.floor(Math.random() * escala.length)] / (paso % 8 < 4 ? 1 : 2);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = paso % 3 === 0 ? 'sine' : 'triangle';
      o.frequency.value = nota;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.4);
      o.connect(g); g.connect(maestro);
      o.start(); o.stop(ctx.currentTime + 3.6);
      paso++;
      MUSICA.temporizador = setTimeout(tocar, 900 + Math.random() * 900);
    };
    MUSICA.ambiental = true;
    MUSICA.nodos = { maestro };
    tocar();
    pintarReproductor();
    return true;
  } catch (e) { avisar('No se pudo iniciar la música: ' + e.message, 'err'); }
}
function ambientalApagar() {
  MUSICA.ambiental = false;
  clearTimeout(MUSICA.temporizador);
  if (MUSICA.nodos && MUSICA.nodos.maestro) {
    try { MUSICA.nodos.maestro.gain.value = 0; } catch (e) {}
  }
  pintarReproductor();
}

/* ---------------------------------------------------------------------
   Reproductor
   --------------------------------------------------------------------- */
function asegurarAudio() {
  if (MUSICA.audio) return MUSICA.audio;
  const a = new Audio();
  a.volume = MUSICA.volumen;
  a.preload = 'metadata';
  a.addEventListener('ended', () => {
    if (MUSICA.repetir) { a.currentTime = 0; a.play(); }
    else siguienteTema();
  });
  a.addEventListener('timeupdate', pintarProgreso);
  a.addEventListener('loadedmetadata', pintarProgreso);
  a.addEventListener('play',  () => { MUSICA.sonando = true;  pintarReproductor(); });
  a.addEventListener('pause', () => { MUSICA.sonando = false; pintarReproductor(); });
  a.addEventListener('error', () => {
    avisar('Ese archivo no se pudo reproducir. Prueba con un mp3.', 'err');
  });
  MUSICA.audio = a;
  return a;
}

function tocarTema(i) {
  if (!MUSICA.lista.length) { avisar('Primero agrega tus canciones 🎵', 'err'); return false; }
  MUSICA.indice = ((i % MUSICA.lista.length) + MUSICA.lista.length) % MUSICA.lista.length;
  const t = MUSICA.lista[MUSICA.indice];
  const a = asegurarAudio();
  if (MUSICA.ambiental) ambientalApagar();
  /* soltamos la dirección anterior para no llenar la memoria */
  if (MUSICA.urlActual) { try { URL.revokeObjectURL(MUSICA.urlActual); } catch (e) {} }
  MUSICA.urlActual = URL.createObjectURL(t.archivo);
  a.src = MUSICA.urlActual;
  const prom = a.play();
  if (prom && prom.catch) prom.catch(() => avisar('Toca ▶ una vez para que el navegador deje sonar'));
  pintarReproductor();
  return true;
}
function alternarTema() {
  if (MUSICA.ambiental) return ambientalApagar();
  if (!MUSICA.lista.length) return avisar('Primero agrega tus canciones 🎵', 'err');
  const a = asegurarAudio();
  if (MUSICA.indice < 0 || !a.src) return tocarTema(0);
  if (a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
  else a.pause();
}
function siguienteTema() {
  if (!MUSICA.lista.length) return;
  if (MUSICA.azar) return tocarTema(Math.floor(Math.random() * MUSICA.lista.length));
  tocarTema(MUSICA.indice + 1);
}
function anteriorTema() { if (MUSICA.lista.length) tocarTema(MUSICA.indice - 1); }
function pararMusica() {
  if (MUSICA.ambiental) ambientalApagar();
  if (MUSICA.audio) MUSICA.audio.pause();
}

/* Busca una canción por su nombre, aunque lo escriban a medias */
function buscarTema(texto) {
  const q = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!q) return -1;
  const limpio = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let exacto = MUSICA.lista.findIndex(t => limpio(t.titulo) === q);
  if (exacto >= 0) return exacto;
  let contiene = MUSICA.lista.findIndex(t => limpio(t.titulo).includes(q));
  if (contiene >= 0) return contiene;
  /* por palabras sueltas: gana la que más coincide */
  const palabras = q.split(/\s+/).filter(p => p.length > 2);
  let mejor = -1, puntos = 0;
  MUSICA.lista.forEach((t, i) => {
    const n = limpio(t.titulo);
    let p = 0;
    palabras.forEach(w => { if (n.includes(w)) p++; });
    if (p > puntos) { puntos = p; mejor = i; }
  });
  return puntos ? mejor : -1;
}

async function agregarCanciones(files) {
  const lista = Array.from(files).filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|ogg|wav|aac)$/i.test(f.name));
  if (!lista.length) return avisar('Elige archivos de música (mp3, m4a...)', 'err');
  avisar('Guardando la música...');
  let ok = 0;
  for (const f of lista) {
    try {
      const tema = {
        id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        titulo: f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim().slice(0, 80),
        archivo: f, tam: f.size, cuando: Date.now(),
      };
      await guardarTema(tema);
      MUSICA.lista.push(tema);
      ok++;
    } catch (e) { avisar('No entró "' + f.name + '": ' + e.message, 'err'); }
  }
  pintarReproductor();
  if (ok) avisar(`${ok} canción(es) guardada(s) 🎵`, 'ok');
}

async function quitarTema(i) {
  const t = MUSICA.lista[i];
  if (!t) return;
  await borrarTema(t.id);
  MUSICA.lista.splice(i, 1);
  if (MUSICA.indice >= MUSICA.lista.length) MUSICA.indice = MUSICA.lista.length - 1;
  if (!MUSICA.lista.length && MUSICA.audio) { MUSICA.audio.pause(); MUSICA.audio.removeAttribute('src'); }
  pintarReproductor();
}

function tiempoTxt(s) {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + String(r).padStart(2, '0');
}
function pintarProgreso() {
  const a = MUSICA.audio;
  const b = $('#musProg'), t = $('#musTiempo');
  if (!a || !b) return;
  b.style.width = (a.duration ? (a.currentTime / a.duration * 100) : 0) + '%';
  if (t) t.textContent = tiempoTxt(a.currentTime) + ' / ' + tiempoTxt(a.duration);
}

function pintarReproductor() {
  const c = $('#musCuerpo');
  if (!c) return;
  const t = MUSICA.lista[MUSICA.indice];
  const sonando = MUSICA.sonando || MUSICA.ambiental;
  const pesoTotal = MUSICA.lista.reduce((s, x) => s + (x.tam || 0), 0);

  c.innerHTML = `
    <div class="ios-tarjeta ${sonando ? 'sonando' : ''}">
      <div class="ios-arte">
        <div class="ios-onda">${[...Array(5)].map((_, i) =>
          `<i style="animation-delay:${i * .12}s"></i>`).join('')}</div>
        <span>${MUSICA.ambiental ? '🌙' : '🎵'}</span>
      </div>
      <div class="ios-info">
        <b>${MUSICA.ambiental ? 'Ambiente Truequea'
             : esc(t ? t.titulo : (MUSICA.lista.length ? 'Listo para sonar' : 'Sin música todavía'))}</b>
        <span>${MUSICA.ambiental ? 'Música del sistema · libre de derechos'
              : (MUSICA.lista.length ? `${MUSICA.indice + 1 || 1} de ${MUSICA.lista.length} · ${(pesoTotal/1048576).toFixed(1)} MB`
                                     : 'Agrega tus canciones')}</span>
      </div>
    </div>

    <div class="ios-barra" id="musBarra"><i id="musProg"></i></div>
    <div class="ios-tiempo"><span id="musTiempo">0:00 / 0:00</span></div>

    <div class="ios-controles">
      <button type="button" id="musAzar" class="chico ${MUSICA.azar ? 'on' : ''}" title="Aleatorio">🔀</button>
      <button type="button" id="musAnt" aria-label="Anterior">⏮</button>
      <button type="button" class="grande" id="musPlay" aria-label="Reproducir">${sonando ? '⏸' : '▶'}</button>
      <button type="button" id="musSig" aria-label="Siguiente">⏭</button>
      <button type="button" id="musRep" class="chico ${MUSICA.repetir ? 'on' : ''}" title="Repetir">🔁</button>
    </div>

    <div class="ios-vol">
      <span>🔈</span>
      <input type="range" id="musVol" min="0" max="100" value="${Math.round(MUSICA.volumen * 100)}">
      <span>🔊</span>
    </div>

    <div class="ios-voz">
      <button type="button" class="btn ${MUSICA.escuchando ? 'rojo' : 'pri'} sm" id="musVoz">
        ${MUSICA.escuchando ? '🔴 Escuchando... habla' : '🎤 Pedir por voz'}</button>
      <span class="nota">Di: “reproduce <b>el nombre</b>”, “siguiente”, “para la música”</span>
    </div>

    <div class="ios-acciones">
      <label class="btn suave sm" for="musArchivos">🎵 Agregar mis canciones</label>
      <input type="file" id="musArchivos" accept="audio/*" multiple hidden>
      <button class="btn suave sm" type="button" id="musAmbiente">
        ${MUSICA.ambiental ? '⏹ Parar el ambiente' : '🌙 Música del sistema'}</button>
    </div>

    ${MUSICA.lista.length ? `
      <div class="ios-lista">
        ${MUSICA.lista.map((x, i) => `
          <div class="ios-fila ${i === MUSICA.indice && MUSICA.sonando ? 'on' : ''}">
            <button type="button" class="ios-tocar" data-tema="${i}">
              <span class="n">${i === MUSICA.indice && MUSICA.sonando ? '▶' : i + 1}</span>
              <span class="tit">${esc(x.titulo)}</span>
              <span class="mb">${((x.tam || 0)/1048576).toFixed(1)} MB</span></button>
            <button type="button" class="ios-x" data-quitatema="${i}" aria-label="Quitar">✕</button>
          </div>`).join('')}
      </div>` : `
      <p class="nota" style="margin-top:12px">
        <b>Esto toca TU música, la que tengas en tu equipo.</b><br>
        Toca “Agregar mis canciones”, elige tus mp3 una sola vez y quedan guardados aquí.
        Después los pides por voz o escribiendo: “reproduce…”.<br><br>
        <b>Por qué no salen Grupo 5, Bad Bunny u Ozuna:</b> esa música tiene dueño. No puedo
        bajarla ni dejarla dentro del sistema, sería piratearla. Si tienes el mp3, cárgalo y
        suena igual. Si no, el asistente te la abre en YouTube o Spotify.<br><br>
        Y si quieres algo de fondo sin cargar nada, usa <b>🌙 Música del sistema</b>:
        esa la crea el propio programa y es libre.</p>`}`;

  $('#musPlay').onclick = alternarTema;
  $('#musAnt').onclick = anteriorTema;
  $('#musSig').onclick = siguienteTema;
  $('#musAzar').onclick = () => { MUSICA.azar = !MUSICA.azar; pintarReproductor(); };
  $('#musRep').onclick = () => { MUSICA.repetir = !MUSICA.repetir; pintarReproductor(); };
  $('#musVoz').onclick = escucharVoz;
  $('#musVol').oninput = e => {
    MUSICA.volumen = Number(e.target.value) / 100;
    if (MUSICA.audio) MUSICA.audio.volume = MUSICA.volumen;
    if (MUSICA.nodos && MUSICA.nodos.maestro) MUSICA.nodos.maestro.gain.value = MUSICA.volumen * 0.45;
  };
  $('#musArchivos').onchange = e => { agregarCanciones(e.target.files); e.target.value = ''; };
  $('#musAmbiente').onclick = () => MUSICA.ambiental ? ambientalApagar() : ambientalEncender();
  $('#musBarra').onclick = e => {
    const a = MUSICA.audio;
    if (!a || !a.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration;
  };
  $$('#musCuerpo [data-tema]').forEach(b => b.onclick = () => tocarTema(Number(b.dataset.tema)));
  $$('#musCuerpo [data-quitatema]').forEach(b => b.onclick = () => quitarTema(Number(b.dataset.quitatema)));
  pintarProgreso();
}

function abrirMusica() {
  abrir('mMusica');
  cargarMusica();
  pintarReproductor();
}

/* =====================================================================
   COMANDOS: por voz o escritos
   Entiende: "reproduce X", "pon X", "siguiente", "anterior", "para",
             "sube el volumen", "modo ambiente"...
   ===================================================================== */
function ordenMusical(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!t) return null;

  if (/^(para|pausa|detente|detener|silencio|apaga|stop)/.test(t) || /para la musica|pausa la musica/.test(t)) {
    pararMusica();
    return '⏸ Listo, paré la música.';
  }
  if (/siguiente|proxima|proximo|otra cancion|cambia/.test(t)) {
    if (!MUSICA.lista.length) return faltaMusica();
    siguienteTema();
    return '⏭ Va la siguiente: <b>' + esc(MUSICA.lista[MUSICA.indice].titulo) + '</b>';
  }
  if (/anterior|atras|la de antes/.test(t)) {
    if (!MUSICA.lista.length) return faltaMusica();
    anteriorTema();
    return '⏮ Volvimos a <b>' + esc(MUSICA.lista[MUSICA.indice].titulo) + '</b>';
  }
  if (/sube.*volumen|mas fuerte|mas alto/.test(t)) {
    MUSICA.volumen = Math.min(1, MUSICA.volumen + 0.2);
    if (MUSICA.audio) MUSICA.audio.volume = MUSICA.volumen;
    pintarReproductor();
    return '🔊 Volumen al ' + Math.round(MUSICA.volumen * 100) + '%';
  }
  if (/baja.*volumen|mas bajo|mas despacio/.test(t)) {
    MUSICA.volumen = Math.max(0, MUSICA.volumen - 0.2);
    if (MUSICA.audio) MUSICA.audio.volume = MUSICA.volumen;
    pintarReproductor();
    return '🔉 Volumen al ' + Math.round(MUSICA.volumen * 100) + '%';
  }
  if (/ambiente|relajante|musica del sistema|lounge/.test(t)) {
    ambientalEncender();
    return '🌙 Puse el <b>ambiente Truequea</b>, la música del propio sistema.';
  }
  if (/aleatorio|al azar|shuffle/.test(t)) {
    MUSICA.azar = true; pintarReproductor();
    if (MUSICA.lista.length) siguienteTema();
    return '🔀 Modo aleatorio activado.';
  }
  if (/repite|repetir|loop/.test(t)) {
    MUSICA.repetir = !MUSICA.repetir; pintarReproductor();
    return MUSICA.repetir ? '🔁 Repetiré la canción.' : 'Ya no repito.';
  }
  if (/que suena|que cancion|cual es esta/.test(t)) {
    if (MUSICA.ambiental) return '🌙 Suena el ambiente del sistema.';
    const a = MUSICA.lista[MUSICA.indice];
    return a && MUSICA.sonando ? '🎵 Suena <b>' + esc(a.titulo) + '</b>' : 'Ahora no hay nada sonando.';
  }

  /* "reproduce / pon / toca / escucha [una cancion de] X" */
  const m = t.match(/^(?:reproduce|pon|ponme|toca|tocar|escuchar|escucha|play|quiero escuchar|dale)\s+(?:la\s+)?(?:cancion\s+)?(?:de\s+)?(?:una\s+)?(.*)$/);
  if (m) {
    /* se limpian las muletillas: "una cancion de", "el tema de", "algo de"... */
    let pedido = m[1]
      .replace(/^(por favor|porfa)\s+/, '')
      .replace(/^(una|un|el|la|los|las)\s+/, '')
      .replace(/^(cancion|cancion es|tema|musica|temita|rolita)\s+/, '')
      .replace(/^(de|del|de la|de los)\s+/, '')
      .replace(/^(una|un)\s+/, '')
      .trim();
    /* si pidió una canción concreta, se le responde aunque no tenga nada cargado */
    if (pedido && !/^(musica|algo|lo que sea|cualquiera)$/.test(pedido)) {
      const j = buscarTema(pedido);
      if (j >= 0) { tocarTema(j); return '▶ Va <b>' + esc(MUSICA.lista[j].titulo) + '</b>'; }
      return sinEsaCancion(pedido);
    }
    if (!MUSICA.lista.length) return faltaMusica();
    if (!pedido || /musica|algo|lo que sea|cualquiera/.test(pedido)) {
      tocarTema(MUSICA.azar ? Math.floor(Math.random() * MUSICA.lista.length) : 0);
      return '▶ Va sonando <b>' + esc(MUSICA.lista[MUSICA.indice].titulo) + '</b>';
    }
    const i = buscarTema(pedido);
    if (i >= 0) {
      tocarTema(i);
      return '▶ Va <b>' + esc(MUSICA.lista[i].titulo) + '</b>';
    }
    return sinEsaCancion(pedido);
  }
  return null;
}

/* Cuando piden una canción que no está cargada: se dice de frente y se
   ofrece abrirla en YouTube o Spotify, que es lo legal y lo que sirve. */
function sinEsaCancion(pedido) {
  const q = encodeURIComponent(pedido);
  return `No tengo <b>“${esc(pedido)}”</b> guardada 😕<br>
    Solo puedo reproducir la música que <b>tú cargues</b>: las canciones de los artistas
    tienen dueño y no puedo bajarlas ni guardarlas dentro del sistema.<br><br>
    <b>Dos caminos:</b><br>
    <a class="btn suave sm" target="_blank" rel="noopener"
       href="https://www.youtube.com/results?search_query=${q}">▶ Escucharla en YouTube</a>
    <a class="btn suave sm" target="_blank" rel="noopener"
       href="https://open.spotify.com/search/${q}">🎧 Buscarla en Spotify</a>
    <button class="btn suave sm" type="button" data-accion="musica">🎵 Cargar mis mp3</button>
    ${MUSICA.lista.length ? `<br><br><b>Lo que sí tengo:</b> ${
      MUSICA.lista.slice(0, 8).map(x => esc(x.titulo)).join(' · ')}` : ''}`;
}

function faltaMusica() {
  return `Todavía no cargaste ninguna canción 🎵<br><br>
    <b>Cómo funciona, en criollo:</b> este reproductor toca la música que tú tengas en tu
    equipo. No puedo traer canciones de Grupo 5, Bad Bunny, Anuel ni de nadie desde internet,
    porque esa música tiene dueño y repartirla sería piratearla.<br><br>
    Abre el reproductor, toca <b>“Agregar mis canciones”</b>, elige tus mp3 una sola vez y
    desde ahí me las pides por voz o escribiendo “reproduce…”.
    <br><button class="btn suave sm" type="button" data-accion="musica">🎵 Abrir el reproductor</button>`;
}

/* ---------------------------------------------------------------------
   Escuchar por micrófono
   --------------------------------------------------------------------- */
function escucharVoz(destino) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    avisar('Tu navegador no tiene reconocimiento de voz. Usa Chrome, o escríbelo.', 'err');
    return;
  }
  if (MUSICA.escuchando && MUSICA.rec) { MUSICA.rec.stop(); return; }

  const rec = new SR();
  MUSICA.rec = rec;
  rec.lang = 'es-PE';
  rec.interimResults = false;
  rec.maxAlternatives = 3;

  rec.onstart = () => {
    MUSICA.escuchando = true;
    pintarReproductor();
    if ($('#botEstado')) $('#botEstado').textContent = '🔴 Escuchando...';
    avisar('🎤 Te escucho, habla', 'ok');
  };
  rec.onerror = e => {
    MUSICA.escuchando = false; pintarReproductor();
    if ($('#botEstado')) $('#botEstado').textContent = 'Te explico todo en criollo';
    avisar(e.error === 'not-allowed'
      ? 'Tienes que darle permiso al micrófono'
      : 'No te escuché bien, intenta otra vez', 'err');
  };
  rec.onend = () => {
    MUSICA.escuchando = false; pintarReproductor();
    if ($('#botEstado')) $('#botEstado').textContent = 'Te explico todo en criollo';
  };
  rec.onresult = ev => {
    const dicho = ev.results[0][0].transcript;
    const r = ordenMusical(dicho);
    if (typeof abrirBot === 'function' && $('#bot') && !$('#bot').hidden) {
      botDecir('yo', '🎤 ' + esc(dicho));
      botDecir('bot', r || 'No te entendí. Prueba: “reproduce” y el nombre de tu canción.');
    } else if (r) {
      avisar(String(r).replace(/<[^>]+>/g, ''), 'ok');
    } else {
      avisar('No entendí: "' + dicho + '"', 'err');
    }
  };
  try { rec.start(); } catch (e) { avisar('No se pudo abrir el micrófono', 'err'); }
}
