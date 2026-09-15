/* ===================================================================
   TRUEQUEA PE · Puente opcional con api.php
   Archivo: js/13-servidor.js
   =================================================================== */

/* =====================================================================
   PUENTE CON api.php  (opcional)
   ---------------------------------------------------------------------
   · Si abres index.html con doble clic (file://) no pasa nada: todo
     sigue guardándose en el navegador, como hasta ahora.
   · Si lo subes a un hosting con PHP o lo pones en XAMPP, detecta
     api.php solo y ahí guarda la base para que TODOS vean lo mismo.
   · La sesión (quién está conectado) SIEMPRE queda en el navegador:
     nunca se comparte con el servidor.
   ===================================================================== */
const SERVIDOR = { activo: false, url: 'api.php', timer: null, enviando: false, ultimo: null };

/* guardar() ahora también manda los datos al servidor, sin bloquear nada */
const guardarSoloLocal = guardar;
guardar = function () {
  guardarSoloLocal();
  if (SERVIDOR.activo) programarEnvio();
};

function programarEnvio() {
  clearTimeout(SERVIDOR.timer);
  SERVIDOR.timer = setTimeout(enviarAlServidor, 1400);
}

async function enviarAlServidor() {
  if (!SERVIDOR.activo || SERVIDOR.enviando) return;
  SERVIDOR.enviando = true;
  try {
    const copia = { ...BD, sesion: null };   // la sesión no viaja
    const r = await fetch(SERVIDOR.url + '?a=guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(copia),
    });
    const j = await r.json();
    if (j.ok) { SERVIDOR.ultimo = new Date(); marcarModo(); }
    else avisar('El servidor no pudo guardar: ' + (j.error || ''), 'err');
  } catch (e) {
    SERVIDOR.activo = false; marcarModo();
  } finally {
    SERVIDOR.enviando = false;
  }
}

async function conectarServidor() {
  /* si la base en la nube está encendida, ella manda */
  if (typeof NUBE_CONFIG !== 'undefined' && NUBE_CONFIG.activa) { marcarModo(); return; }
  if (!/^https?:$/.test(location.protocol)) { marcarModo(); return; }
  try {
    const est = await (await fetch(SERVIDOR.url + '?a=estado')).json();
    if (!est.ok) { marcarModo(); return; }
    SERVIDOR.activo = true;

    const res = await (await fetch(SERVIDOR.url + '?a=cargar')).json();
    if (res.ok && res.hay && res.datos && Array.isArray(res.datos.usuarios)) {
      const miSesion = BD.sesion;               // conservo mi sesión local
      BD = res.datos;
      BD.sesion = miSesion;
      if (!BD.visitas) BD.visitas = [];
      if (!BD.deseos)  BD.deseos = [];
      if (!BD.seguros) BD.seguros = [];
      guardarSoloLocal();
      /* vuelvo a pintar todo con los datos del servidor */
      aplicarMarca(); pintarCiudades(); pintarCategorias();
      pintarNav(); pintarLista(); pintarMapa(); pintarPremium();
      if (yo() && yo().rol === 'admin') pintarAdmin();
      avisar('Conectado al servidor: todos ven los mismos datos', 'ok');
    } else {
      enviarAlServidor();                        // primera vez: subo lo que tengo
      avisar('Servidor listo. Se subieron los datos iniciales.', 'ok');
    }
  } catch (e) {
    SERVIDOR.activo = false;                     // no hay PHP: sigo en local
  }
  marcarModo();
}

/* Cartelito en el pie que dice dónde se están guardando los datos */
function marcarModo() {
  const pie = document.querySelector('.pie-base');
  if (!pie) return;
  let s = document.getElementById('modoDatos');
  if (!s) {
    s = document.createElement('span');
    s.id = 'modoDatos';
    s.style.cssText = 'display:block;margin-top:6px;font-size:12px';
    pie.appendChild(s);
  }
  s.innerHTML = SERVIDOR.activo
    ? `🟢 Modo servidor (api.php) — todos ven los mismos datos${
        SERVIDOR.ultimo ? ' · guardado ' + SERVIDOR.ultimo.toLocaleTimeString() : ''}`
    : '🔵 Modo local — los datos se guardan solo en este navegador';
}

document.addEventListener('DOMContentLoaded', () => setTimeout(conectarServidor, 400));
