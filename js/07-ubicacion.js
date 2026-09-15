/* ===================================================================
   TRUEQUEA PE · Ubicación real por GPS, lectura de Yape y registro exprés
   Archivo: js/07-ubicacion.js
   =================================================================== */

/* =====================================================================
   MÓDULO PRO
   · Mapa real (OpenStreetMap) con respaldo al mapa dibujado
   · Lectura automática del comprobante de Yape (OCR)
   · Registro exprés en 10 segundos
   · Plus del Premium: nivel, impulsos de regalo, estadísticas
   ===================================================================== */

const CDN = {
  /* Ya no se cargan mapas de terceros: OpenStreetMap bloquea a las apps
     que usan sus servidores gratuitos, y salían cuadros de "Access blocked". */
  ocr: 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js',
};

function cargarCss(url) {
  return new Promise(ok => {
    if (document.querySelector(`link[href="${url}"]`)) return ok(true);
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = url;
    l.onload = () => ok(true); l.onerror = () => ok(false);
    document.head.appendChild(l);
  });
}
function cargarJs(url) {
  return new Promise(ok => {
    if (document.querySelector(`script[src="${url}"]`)) return ok(true);
    const s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = () => ok(true); s.onerror = () => ok(false);
    document.head.appendChild(s);
  });
}

/* =====================================================================
   1) UBICACIÓN REAL — sin mapas de terceros
   ---------------------------------------------------------------------
   Antes esto cargaba las calles desde los servidores gratuitos de
   OpenStreetMap. Ellos NO permiten que una aplicación los use así y
   terminaron bloqueando: por eso salían los cuadros de "Access blocked"
   y los 403.

   Ahora la ubicación funciona sin depender de nadie:
   · El mapa dibujado del sistema (siempre funciona, hasta sin internet)
   · Tu ubicación REAL por GPS del celular
   · Distancias de verdad en kilómetros
   · Botón que abre Google Maps, que sí puede usar cualquiera
   ===================================================================== */

const UBIC = { viendo: false, reloj: null, ultima: null };

/* Pide el GPS del equipo y devuelve la posición real */
function ubicacionReal(opciones = {}) {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal(new Error('Este equipo no tiene GPS disponible'));
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lon: p.coords.longitude,
                precision: Math.round(p.coords.accuracy || 0), cuando: Date.now() }),
      e => mal(new Error(e.code === 1 ? 'Tienes que darle permiso a la ubicación'
                        : e.code === 3 ? 'El GPS tardó demasiado' : 'No se pudo ubicar')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000, ...opciones });
  });
}

/* Guarda mi ubicación real en mi cuenta */
async function marcarMiUbicacion(silencioso) {
  const u = yo();
  if (!u) { abrirAuth('login'); return null; }
  try {
    if (!silencioso) avisar('📍 Buscando tu ubicación...');
    const p = await ubicacionReal();
    u.lat = p.lat; u.lon = p.lon;
    u.ubicadoEn = new Date().toISOString();
    u.precision = p.precision;
    UBIC.ultima = p;
    guardar();
    if (!silencioso) avisar(`📍 Listo: ubicación exacta (±${p.precision} m)`, 'ok');
    pintarMapa(); pintarLista();
    if (typeof pintarPanelPro === 'function') pintarPanelPro();
    return p;
  } catch (e) {
    if (!silencioso) avisar(e.message, 'err');
    return null;
  }
}

/* Sigue mi ubicación mientras me muevo (solo Premium) */
function seguirUbicacion(encender) {
  const u = yo();
  if (!u || !u.premium) return;
  if (!encender) {
    if (UBIC.reloj) navigator.geolocation.clearWatch(UBIC.reloj);
    UBIC.reloj = null; UBIC.viendo = false;
    return;
  }
  if (!navigator.geolocation) return avisar('Este equipo no tiene GPS', 'err');
  UBIC.viendo = true;
  UBIC.reloj = navigator.geolocation.watchPosition(p => {
    const yoAhora = yo();
    if (!yoAhora) return;
    yoAhora.lat = p.coords.latitude;
    yoAhora.lon = p.coords.longitude;
    yoAhora.precision = Math.round(p.coords.accuracy || 0);
    yoAhora.ubicadoEn = new Date().toISOString();
    UBIC.ultima = { lat: p.coords.latitude, lon: p.coords.longitude };
    guardar();
    pintarMapa();
    if (typeof pintarPanelPro === 'function') pintarPanelPro();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 15000 });
  avisar('📡 Siguiendo tu ubicación mientras te mueves', 'ok');
}

/* Abrir en Google Maps: nunca se bloquea y todos lo tienen */
function verEnMapa(lat, lon, titulo) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  window.open(url, '_blank', 'noopener');
}
function comoLlegar(lat, lon) {
  const u = yo();
  const desde = (u && u.lat) ? `&origin=${u.lat},${u.lon}` : '';
  window.open(`https://www.google.com/maps/dir/?api=1${desde}&destination=${lat},${lon}`,
              '_blank', 'noopener');
}

/* Estos nombres se mantienen para que nada se rompa: ahora solo
   refrescan el mapa dibujado del sistema. */
function mapaRealInicio() { return false; }
function mapaRealPro()    { return false; }

/* =====================================================================
   2) LECTURA AUTOMÁTICA DEL YAPE
   El sistema lee la captura, comprueba el monto, el nombre y el número
   de operación, y activa el Premium solo si todo cuadra.
   ===================================================================== */
let OCR_LISTO = null;
async function hayOCR() {
  if (window.Tesseract) return true;
  if (OCR_LISTO !== null) return OCR_LISTO;
  OCR_LISTO = await cargarJs(CDN.ocr) && !!window.Tesseract;
  return OCR_LISTO;
}
function limpiar(t) {
  return String(t || '').toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/* Revisa el texto leído de la captura */
function analizarYape(texto, montoPedido) {
  const t = limpiar(texto);
  const motivos = [];

  const esYape = /YAPE|YAPEAS|YAPEO|TE YAPEO|PAGO EXITOSO|TRANSFERENCIA EXITOSA/.test(t);
  if (!esYape) motivos.push('No parece una captura de Yape.');

  /* montos que aparecen después de S/ */
  const montos = [...t.matchAll(/S\s*\/?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)/g)]
    .map(m => parseFloat(m[1].replace(',', '.'))).filter(n => !isNaN(n));
  const monto = montos.length ? Math.max(...montos) : null;
  if (monto === null) motivos.push('No encontramos el monto en la imagen.');
  else if (monto + 0.001 < montoPedido) motivos.push(`El monto leído es S/ ${monto.toFixed(2)} y se pide S/ ${montoPedido.toFixed(2)}.`);

  /* nombre de quien recibe */
  const destino = limpiar(BD.config.yapeNombre || 'Angel Levano').split(' ').filter(Boolean);
  const nombre = destino[0] || 'ANGEL';
  const apellido = destino[1] || '';
  const nombreOk = t.includes(nombre) &&
    (!apellido || t.includes(apellido) || new RegExp(nombre + '\\s+' + apellido[0] + '\\b').test(t));
  if (!nombreOk) motivos.push(`No vimos el nombre de ${BD.config.yapeNombre || 'Angel Levano'} en la captura.`);

  /* número de operación */
  const op = t.match(/(?:OPERACION|OPERACIÓN|CODIGO|CÓDIGO|N[°º]|NRO|NUMERO)\D{0,14}(\d{5,})/) ||
             t.match(/\b(\d{8,})\b/) || t.match(/\b(\d{6,7})\b/);
  const codigo = op ? op[1] : null;
  if (!codigo) motivos.push('No encontramos el número de operación.');

  const repetido = codigo && (BD.config.yapeCodigos || []).includes(codigo);
  if (repetido) motivos.push('Esa captura ya se usó antes para otro pago.');

  return { ok: !motivos.length, monto, nombreOk, codigo, repetido, motivos, texto: t.slice(0, 400) };
}

/* Lee la imagen y devuelve el análisis */
async function revisarComprobante(dataURL, montoPedido) {
  if (!(await hayOCR())) return { disponible: false };
  try {
    const r = await Tesseract.recognize(dataURL, 'spa', {});
    return { disponible: true, ...analizarYape(r.data.text, montoPedido) };
  } catch (e) {
    return { disponible: false, error: e.message };
  }
}

/* Muestra en pantalla lo que fue leyendo */
function estadoLectura(html, clase = '') {
  const c = document.getElementById('lecturaYape');
  if (c) { c.className = 'lectura ' + clase; c.innerHTML = html; c.hidden = false; }
}

/* =====================================================================
   3) REGISTRO EXPRÉS — nombre, celular y 4 números
   ===================================================================== */
function abrirExpress() {
  $('#formExpress').reset();
  $('#exCiudad').innerHTML = LISTA_CIUDADES.map(c => `<option>${c}</option>`).join('');
  $('#exCiudad').value = 'Chincha Alta';
  $('#errEx').hidden = true;
  cerrar('mAuth'); abrir('mExpress');
}
async function crearExpress() {
  const nombre = $('#exNombre').value.trim();
  const tel = $('#exTel').value.replace(/\D/g, '');
  const pin = $('#exPin').value.replace(/\D/g, '');
  const err = m => { const c = $('#errEx'); c.textContent = m; c.hidden = false; };

  if (nombre.length < 2) return err('Escribe tu nombre.');
  if (tel.length < 9)    return err('Escribe tu celular (9 números).');
  if (pin.length !== 4)  return err('El PIN debe tener 4 números.');
  if (BD.usuarios.some(u => (u.telefono || '').replace(/\D/g, '') === tel))
    return err('Ese celular ya tiene cuenta. Entra con tu PIN.');

  const base = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '') || 'usuario';
  const r = await registrarSeguro({
    nombre, email: `${base}${tel.slice(-4)}@truequea.pe`, pin,
    telefono: tel, ciudad: $('#exCiudad').value, express: true,
  });
  if (r.err) return err(r.err);
  cerrar('mExpress');
  trasEntrar(r.usuario, `¡Listo, ${r.usuario.nombre}! Tu cuenta ya está creada`);
  mostrarCodigo(r.usuario);
}

/* =====================================================================
   4) EL PLUS DEL PREMIUM
   ===================================================================== */
function pintarPlusPro() {
  const u = yo();
  const caja = $('#plusPro');
  if (!caja) return;
  if (!u || !u.premium) { caja.hidden = true; return; }
  caja.hidden = false;

  const n = nivelPro(u);
  const libres = impulsosDisponibles(u);
  const mios = BD.articulos.filter(a => a.usuario === u.id);
  const vistas = mios.reduce((s, a) => s + (a.vistas || 0), 0);
  const favs = mios.reduce((s, a) => s + (a.favs || 0), 0);
  const interesados = mios.reduce((s, a) => s + interesadosDe(a).length, 0);
  const rep = reputacion(u.id);
  const top = ranking(50).findIndex(x => x.u.id === u.id) + 1;

  const barra = n.siguiente
    ? Math.min(100, Math.round((n.trueques - n.min) / (n.siguiente.min - n.min) * 100)) : 100;

  caja.innerHTML = `
    <div class="pro-tarjetas">
      <!-- tarjeta 3D del nivel -->
      <div class="tarjeta3d nivel" style="--brillo:${n.color}">
        <div class="cara3d">
          <span class="chip3d">TARJETA PREMIUM</span>
          <div class="nivel-emo">${n.emo}</div>
          <b class="nivel-nom">Nivel ${esc(n.nombre)}</b>
          <span class="nivel-user">${esc(u.nombre)}</span>
          <div class="nivel-barra"><i style="width:${barra}%"></i></div>
          <span class="nivel-pie">${n.siguiente
            ? `Te faltan ${n.faltan} trueque(s) para ${n.siguiente.emo} ${n.siguiente.nombre}`
            : 'Llegaste al nivel más alto 🎉'}</span>
        </div>
      </div>

      <!-- impulsos de regalo -->
      <div class="tarjeta3d regalo">
        <div class="cara3d">
          <span class="chip3d">REGALO DEL MES</span>
          <div class="nivel-emo">🚀</div>
          <b class="nivel-nom">${libres} impulso${libres === 1 ? '' : 's'} gratis</b>
          <span class="nivel-user">Sube una publicación al primer lugar sin pagar</span>
          <button class="btn oro sm" data-accion="usar-impulso" ${libres ? '' : 'disabled'}>
            ${libres ? 'Usar uno ahora' : 'Ya usaste los 3 de este mes'}</button>
        </div>
      </div>

      <!-- verificación -->
      <div class="tarjeta3d verificado">
        <div class="cara3d">
          <span class="chip3d">CUENTA VERIFICADA</span>
          <div class="nivel-emo">🛡️</div>
          <b class="nivel-nom">${confianza(u).puntos}/100 de confianza</b>
          <span class="nivel-user">Tu insignia sale en cada publicación y en el chat</span>
          <span class="eti oro">${esc(confianza(u).etiqueta)}</span>
        </div>
      </div>
    </div>

    <div class="pro-stats">
      <div><b>${vistas}</b><span>👁 Vistas de mis cosas</span></div>
      <div><b>${favs}</b><span>❤️ Guardados</span></div>
      <div><b>${interesados}</b><span>🔥 Interesados</span></div>
      <div><b>${rep.prom.toFixed(1)}</b><span>⭐ Mis estrellas</span></div>
      <div><b>#${top || '—'}</b><span>🏆 Puesto en el ranking</span></div>
      <div><b>${mios.length}</b><span>📦 Publicaciones</span></div>
    </div>

    <div class="pro-mias">
      <h4>📊 Cómo va cada publicación mía</h4>
      ${mios.length ? mios.slice(0, 6).map(a => {
        const max = Math.max(1, ...mios.map(x => x.vistas || 0));
        return `<div class="mia-fila">
          <img src="${foto(a)}" alt="" data-art="${a.id}">
          <div class="mia-info">
            <b>${esc(a.titulo)}</b>
            <div class="mia-barra"><i style="width:${((a.vistas || 0) / max * 100).toFixed(0)}%"></i></div>
          </div>
          <span class="mia-num">👁 ${a.vistas || 0} · ❤️ ${a.favs || 0}</span>
          <button class="btn-t" data-interesados="${a.id}">Interesados</button>
        </div>`;
      }).join('') : '<p class="nota">Todavía no publicaste nada.</p>'}
    </div>

    <div class="pro-soporte">
      <div><b>⚡ Soporte Premium directo</b>
        <span>Escríbele al administrador y te responde primero.</span></div>
      <a class="wa" target="_blank" rel="noopener"
         href="${esc(waAdmin(`Hola, soy ${u.nombre}, cuenta Premium de Truequea PE. Necesito ayuda con:`))}">
         💬 Escribir al soporte</a>
    </div>`;
}

/* Usar uno de los impulsos de regalo */
function usarImpulsoGratis() {
  const u = yo();
  if (!u || !u.premium) return;
  if (impulsosDisponibles(u) <= 0) return avisar('Ya usaste los 3 impulsos de este mes', 'err');
  const mios = BD.articulos.filter(a => a.usuario === u.id && !impulsoActivo(a));
  if (!mios.length) return avisar('No tienes publicaciones para impulsar', 'err');

  const opciones = mios.slice(0, 8).map(a =>
    `<button class="btn suave sm" data-impulsogratis="${a.id}" style="width:100%;justify-content:flex-start;margin-bottom:6px">
       📦 ${esc(a.titulo)}</button>`).join('');
  confirmar('Usar un impulso de regalo',
    `Te quedan ${impulsosDisponibles(u)} este mes. Elige cuál subir al primer lugar por 24 horas.`,
    () => {}, 'Cerrar', opciones);
}
function aplicarImpulsoGratis(artId) {
  const u = yo();
  const a = BD.articulos.find(x => x.id == artId);
  if (!u || !a || impulsosDisponibles(u) <= 0) return;
  a.impulso = { desde: new Date().toISOString(),
                hasta: new Date(Date.now() + 24 * 3600000).toISOString(), regalo: true };
  u.impulsosGratis = Math.max(0, (u.impulsosGratis || 0) - 1);
  guardar();
  cerrar('mConfirmar');
  avisar(`🚀 "${a.titulo}" está en el primer lugar por 24 horas`, 'ok');
  pintarLista(); pintarPanelPro();
}
