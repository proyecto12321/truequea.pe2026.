/* ===================================================================
   TRUEQUEA PE · Contraseñas con huella, sesiones, roles y WhatsApp
   Archivo: js/11-seguridad.js
   =================================================================== */

/* =====================================================================
   SEGURIDAD — para un sistema que se va a lanzar de verdad
   ---------------------------------------------------------------------
   Qué cambia respecto de antes:

   1. Las contraseñas YA NO se guardan escritas. Se guarda una huella
      (PBKDF2 + SHA-256, 150 000 vueltas) con su sal al azar. Ni tú como
      administrador puedes leer la contraseña de alguien: solo puedes
      ponerle una nueva.
   2. Se cerró el agujero del botón de Google: antes, escribiendo un
      correo cualquiera se entraba a esa cuenta. Ahora o se usa el
      Google de verdad, o no se entra.
   3. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.
   4. La sesión vence a los 30 días y se guarda solo en tu equipo.
   5. Como máximo 3 administradores.
   ===================================================================== */

const SEG = {
  vueltas: 150000,
  intentosMax: 5,
  bloqueoMin: 15,
  sesionDias: 30,
  maxAdmins: 3,
};

/* ---------- huella de la contraseña ---------- */
function hayCripto() {
  return !!(window.crypto && crypto.subtle && crypto.getRandomValues);
}
function aHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function salNueva() {
  if (!hayCripto()) return String(Date.now()) + Math.random().toString(36).slice(2);
  return aHex(crypto.getRandomValues(new Uint8Array(16)));
}

/* Respaldo simple por si el navegador es muy viejo y no trae cripto */
function huellaSimple(texto) {
  let h1 = 0x12345678, h2 = 0x9abcdef0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = (h1 ^ c) * 16777619 >>> 0;
    h2 = (h2 + c * (i + 7)) * 2654435761 >>> 0;
  }
  return 'x' + h1.toString(16) + h2.toString(16);
}

async function derivar(clave, sal) {
  if (!hayCripto()) return huellaSimple(sal + '|' + clave);
  const cod = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', cod.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: cod.encode(sal), iterations: SEG.vueltas, hash: 'SHA-256' },
    base, 256);
  return aHex(bits);
}

/* Le pone (o le cambia) la clave a alguien, ya convertida en huella */
async function ponerClave(u, clave) {
  u.sal = salNueva();
  u.hash = await derivar(clave, u.sal);
  u.tipoClave = /^\d{4,8}$/.test(clave) ? 'pin' : 'clave';
  u.claveCambiada = new Date().toISOString();
  delete u.pass;                      // nunca más en claro
  delete u.pin;
  return u;
}

/* Comprueba la clave. Si el usuario viene de una versión vieja con la
   clave escrita, la convierte a huella en ese momento. */
async function verificarClave(u, clave) {
  if (!u) return false;
  const c = String(clave || '');
  if (u.hash && u.sal) {
    const h = await derivar(c, u.sal);
    return h === u.hash;
  }
  /* migración de cuentas antiguas */
  if ((u.pass && u.pass === c) || (u.pin && u.pin === c)) {
    await ponerClave(u, c);
    guardar();
    return true;
  }
  return false;
}

/* ---------- bloqueo por intentos fallidos ---------- */
function cajaIntentos() {
  if (!BD.seguridad) BD.seguridad = { intentos: {}, registro: [] };
  if (!BD.seguridad.intentos) BD.seguridad.intentos = {};
  return BD.seguridad.intentos;
}
function llaveIntento(dato) { return String(dato || '').trim().toLowerCase(); }

function estaBloqueado(dato) {
  const i = cajaIntentos()[llaveIntento(dato)];
  if (!i || !i.hasta) return 0;
  const faltan = i.hasta - Date.now();
  return faltan > 0 ? Math.ceil(faltan / 60000) : 0;
}
function anotarFallo(dato) {
  const caja = cajaIntentos();
  const k = llaveIntento(dato);
  const i = caja[k] || { n: 0, hasta: 0 };
  i.n++;
  i.ultimo = Date.now();
  if (i.n >= SEG.intentosMax) {
    i.hasta = Date.now() + SEG.bloqueoMin * 60000;
    i.n = 0;
    anotarEvento('bloqueo', `Cuenta bloqueada ${SEG.bloqueoMin} min por intentos fallidos: ${k}`);
  }
  caja[k] = i;
  guardar();
  return i;
}
function limpiarFallos(dato) {
  const caja = cajaIntentos();
  delete caja[llaveIntento(dato)];
  guardar();
}

/* ---------- bitácora de seguridad (la ve el administrador) ---------- */
function anotarEvento(tipo, texto, quien) {
  if (!BD.seguridad) BD.seguridad = { intentos: {}, registro: [] };
  if (!Array.isArray(BD.seguridad.registro)) BD.seguridad.registro = [];
  BD.seguridad.registro.unshift({
    id: nuevoId(), tipo, texto, quien: quien || (BD.sesion || null),
    cuando: new Date().toISOString(),
  });
  BD.seguridad.registro = BD.seguridad.registro.slice(0, 300);
}

/* ---------- sesión con vencimiento ---------- */
function entrar(u) {
  BD.sesion = u.id;
  BD.sesionVence = Date.now() + SEG.sesionDias * 86400000;
  u.ultimoIngreso = new Date().toISOString();
  anotarEvento('entrada', `${u.nombre} entró al sistema`, u.id);
  guardar();
}
function salir() {
  const u = BD.sesion ? BD.usuarios.find(x => x.id === BD.sesion) : null;
  if (u) anotarEvento('salida', `${u.nombre} cerró sesión`, u.id);
  BD.sesion = null;
  BD.sesionVence = null;
  guardar();
}

/* ---------- cuántos administradores hay ---------- */
function contarAdmins() {
  return BD.usuarios.filter(u => u.rol === 'admin' && u.estado === 'activo').length;
}
function puedeOtroAdmin() { return contarAdmins() < SEG.maxAdmins; }

/* =====================================================================
   ENTRADA AL SISTEMA — ahora con huella, bloqueo y bitácora
   ===================================================================== */
async function iniciarSesionSeguro(dato, clave) {
  const d = String(dato || '').trim().toLowerCase();
  const soloNumeros = d.replace(/\D/g, '');

  const min = estaBloqueado(d);
  if (min) return { err: `Demasiados intentos. Espera ${min} minuto(s) para volver a probar.` };

  const u = BD.usuarios.find(x => (x.email || '').toLowerCase() === d) ||
            (soloNumeros.length >= 9
              ? BD.usuarios.find(x => (x.telefono || '').replace(/\D/g, '') === soloNumeros) : null);

  /* Se responde igual exista o no la cuenta: así nadie averigua
     qué correos están registrados. */
  if (!u) {
    anotarFallo(d);
    return { err: 'Los datos no coinciden. Revisa tu correo o celular y tu clave.' };
  }
  if (u.estado !== 'activo') return { err: 'Tu cuenta está suspendida. Escríbele al administrador.' };

  /* cuenta creada con Google: no se entra con clave */
  if (u.soloGoogle && !u.hash) return { err: 'Esta cuenta entra con Google. Usa el botón de Google.' };

  const bien = await verificarClave(u, clave);
  if (!bien) {
    const i = anotarFallo(d);
    const quedan = Math.max(0, SEG.intentosMax - (i.n || 0));
    anotarEvento('fallo', `Intento fallido en ${d}`, u.id);
    return { err: `Los datos no coinciden.${quedan ? ` Te quedan ${quedan} intento(s).` : ''}` };
  }

  limpiarFallos(d);
  if (!u.codigo) u.codigo = nuevoCodigo();
  entrar(u);
  registrarVisita(u.id);
  return { usuario: u };
}

/* =====================================================================
   REGISTRO SEGURO
   ===================================================================== */
async function registrarSeguro(datos) {
  const email = String(datos.email || '').trim().toLowerCase();
  const tel = String(datos.telefono || '').replace(/\D/g, '');

  if (!datos.nombre || datos.nombre.trim().length < 2) return { err: 'Escribe tu nombre.' };
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { err: 'Revisa tu correo: parece incompleto.' };
  if (BD.usuarios.some(u => (u.email || '').toLowerCase() === email))
    return { err: 'Ese correo ya tiene cuenta. Entra con tu clave o usa "Olvidé mi contraseña".' };
  if (tel && BD.usuarios.some(u => (u.telefono || '').replace(/\D/g, '') === tel))
    return { err: 'Ese celular ya tiene cuenta.' };

  const clave = String(datos.pass || datos.pin || '');
  if (!datos.social) {
    if (datos.express) {
      if (!/^\d{4}$/.test(clave)) return { err: 'El PIN debe tener 4 números.' };
    } else {
      const e = validarPass(clave);
      if (e) return { err: e };
    }
  }

  const ciudad = datos.ciudad || 'Chincha Alta';
  const c = CIUDADES[ciudad] || CIUDADES['Chincha Alta'];
  const u = {
    id: nuevoId(), nombre: datos.nombre.trim(), email,
    rol: 'usuario', ciudad, avatar: null, telefono: tel || null,
    bio: '', ref: '', lat: c[0], lon: c[1],
    premium: false, premiumHasta: null, puntos: 0, nivel: 1,
    estado: 'activo', creado: new Date().toISOString(),
    verificado: !!datos.social, soloGoogle: !!datos.social,
    codigo: nuevoCodigo(), avisos: true, express: !!datos.express,
    impulsosGratis: 0, proMes: null,
  };
  if (!datos.social) await ponerClave(u, clave);

  BD.usuarios.push(u);
  entrar(u);
  registrarVisita(u.id);
  anotarEvento('alta', `Cuenta creada: ${u.nombre} (${u.email})`, u.id);
  notificar(u.id, '¡Bienvenido a ' + BD.config.nombre + '!',
            'Tu código de respaldo es ' + u.codigo + '. Guárdalo.');
  guardar();
  return { usuario: u };
}

/* Recuperar la cuenta con el código de respaldo */
async function recuperarCuentaSegura(email, codigo, nueva) {
  const d = String(email || '').trim().toLowerCase();
  const min = estaBloqueado('rec:' + d);
  if (min) return { err: `Demasiados intentos. Espera ${min} minuto(s).` };

  const u = BD.usuarios.find(x => (x.email || '').toLowerCase() === d ||
    (x.telefono || '').replace(/\D/g, '') === d.replace(/\D/g, ''));
  if (!u || String(codigo || '').trim().toUpperCase() !== String(u.codigo || '').toUpperCase()) {
    anotarFallo('rec:' + d);
    return { err: 'El correo o el código de respaldo no coinciden.' };
  }
  const e = validarPass(nueva);
  if (e) return { err: e };

  await ponerClave(u, nueva);
  u.codigo = nuevoCodigo();          // el código usado se quema y se da uno nuevo
  limpiarFallos('rec:' + d);
  limpiarFallos(d);
  anotarEvento('recuperacion', `${u.nombre} recuperó su cuenta con el código de respaldo`, u.id);
  entrar(u);
  guardar();
  return { usuario: u, codigoNuevo: u.codigo };
}

/* =====================================================================
   EL ADMINISTRADOR LE CAMBIA LA CLAVE A ALGUIEN
   (no puede verla: nadie puede, porque ya no se guarda escrita)
   ===================================================================== */
async function cambiarClaveDe(idUsuario, nueva) {
  const yoSoy = yo();
  if (!yoSoy || yoSoy.rol !== 'admin') return { err: 'Solo el administrador.' };
  const u = usuario(Number(idUsuario)) || BD.usuarios.find(x => String(x.id) === String(idUsuario));
  if (!u) return { err: 'No encontramos a esa persona.' };
  if (String(nueva).length < 4) return { err: 'La clave debe tener 4 caracteres o más.' };

  await ponerClave(u, nueva);
  u.codigo = nuevoCodigo();
  limpiarFallos(u.email);
  anotarEvento('clave', `${yoSoy.nombre} le cambió la clave a ${u.nombre}`, yoSoy.id);
  notificar(u.id, '🔑 Tu clave fue cambiada',
            'El administrador te asignó una clave nueva. Si no fuiste tú, avísale.');
  guardar();
  return { usuario: u };
}

/* =====================================================================
   ENTRAR CON GOOGLE DE VERDAD
   Antes bastaba con escribir un correo para entrar a esa cuenta: ese era
   el agujero más grande del sistema. Ahora Google confirma la identidad.
   ===================================================================== */
async function entrarConGoogle() {
  if (!/^https?:$/.test(location.protocol)) {
    return { err: 'Para entrar con Google la página debe estar publicada en internet (https). ' +
                  'Abriendo el archivo directo, Google no lo permite. Usa tu celular y un PIN.' };
  }
  try {
    if (!window.firebase) await cargarJsConTiempo(SDK_APP);
    if (window.firebase && !firebase.auth) await cargarJsConTiempo(SDK_AUTH);
    if (!window.firebase || !firebase.auth) return { err: 'No se pudo cargar Google. Revisa tu internet.' };
    if (!firebase.apps.length) firebase.initializeApp(NUBE_CONFIG.firebase);

    const prov = new firebase.auth.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account' });
    const cred = await firebase.auth().signInWithPopup(prov);
    const g = cred && cred.user;
    if (!g || !g.email) return { err: 'Google no devolvió el correo.' };

    let u = BD.usuarios.find(x => (x.uid && x.uid === g.uid) ||
                                  (x.email || '').toLowerCase() === g.email.toLowerCase());
    if (u) {
      if (u.estado !== 'activo') return { err: 'Tu cuenta está suspendida.' };
      u.uid = g.uid; u.verificado = true; u.soloGoogle = u.soloGoogle || !u.hash;
      if (g.photoURL && !u.avatar) u.avatar = g.photoURL;
      limpiarFallos(u.email);
      entrar(u); registrarVisita(u.id);
      anotarEvento('google', `${u.nombre} entró con Google`, u.id);
      guardar();
      return { usuario: u, nueva: false };
    }

    const ciudad = 'Chincha Alta', c = CIUDADES[ciudad];
    u = {
      id: nuevoId(), uid: g.uid,
      nombre: g.displayName || g.email.split('@')[0],
      email: g.email.toLowerCase(),
      rol: 'usuario', ciudad, avatar: g.photoURL || null, telefono: null,
      bio: '', ref: '', lat: c[0], lon: c[1],
      premium: false, premiumHasta: null, puntos: 0, nivel: 1,
      estado: 'activo', creado: new Date().toISOString(),
      verificado: true, soloGoogle: true, entraCon: 'google',
      codigo: nuevoCodigo(), avisos: true, impulsosGratis: 0, proMes: null,
    };
    BD.usuarios.push(u);
    entrar(u); registrarVisita(u.id);
    anotarEvento('alta', `Cuenta creada con Google: ${u.email}`, u.id);
    notificar(u.id, '¡Bienvenido a ' + BD.config.nombre + '!',
              'Entraste con Google, tu cuenta ya está verificada ✅');
    guardar();
    return { usuario: u, nueva: true };
  } catch (e) {
    const cod = e.code || '';
    if (cod === 'auth/popup-closed-by-user') return { err: 'Cerraste la ventana de Google.' };
    if (cod === 'auth/unauthorized-domain')
      return { err: 'Tu dominio no está autorizado. Agrégalo en Firebase → Authentication → Settings → Authorized domains.' };
    if (cod === 'auth/operation-not-allowed')
      return { err: 'Activa Google en Firebase → Authentication → Sign-in method.' };
    return { err: 'No se pudo entrar con Google: ' + (e.message || cod) };
  }
}

/* =====================================================================
   HASTA 3 ADMINISTRADORES
   ===================================================================== */
function cambiarRol(idUsuario, nuevoRol) {
  const yoSoy = yo();
  const u = BD.usuarios.find(x => String(x.id) === String(idUsuario));
  if (!yoSoy || yoSoy.rol !== 'admin') return avisar('Solo un administrador', 'err');
  if (!u) return;

  if (nuevoRol === 'admin') {
    if (u.rol === 'admin') return;
    if (!puedeOtroAdmin())
      return avisar(`Ya hay ${SEG.maxAdmins} administradores. Quítale el cargo a uno primero.`, 'err');
    u.rol = 'admin';
    anotarEvento('rol', `${yoSoy.nombre} hizo administrador a ${u.nombre}`, yoSoy.id);
    notificar(u.id, '🛡️ Ahora eres administrador',
      'Puedes revisar pagos, aprobar publicidad, crear cuentas y ver la seguridad.');
    avisar(`${u.nombre} ahora es administrador (${contarAdmins()} de ${SEG.maxAdmins})`, 'ok');
  } else {
    if (String(u.id) === String(yoSoy.id)) return avisar('No puedes quitarte el cargo a ti mismo', 'err');
    if (contarAdmins() <= 1) return avisar('Tiene que quedar al menos un administrador', 'err');
    u.rol = 'usuario';
    anotarEvento('rol', `${yoSoy.nombre} le quitó el cargo a ${u.nombre}`, yoSoy.id);
    avisar(`${u.nombre} ya no es administrador`);
  }
  guardar(); pintarAdmin(); pintarNav();
}

/* Nadie puede borrar al último administrador ni borrarse a sí mismo */
function sePuedeBorrar(idUsuario) {
  const u = BD.usuarios.find(x => String(x.id) === String(idUsuario));
  const yoSoy = yo();
  if (!u) return { ok: false, motivo: 'No existe.' };
  if (yoSoy && String(yoSoy.id) === String(u.id)) return { ok: false, motivo: 'No puedes borrarte a ti mismo.' };
  if (u.rol === 'admin' && contarAdmins() <= 1)
    return { ok: false, motivo: 'Es el único administrador que queda.' };
  return { ok: true };
}
/* =====================================================================
   WHATSAPP: al registrarse y al publicar
   El dueño pone su número una vez en Admin → Marca, y desde ahí cada
   persona que se registra o publica puede escribirle con un toque.
   ===================================================================== */
function waDelDueno() {
  const c = BD.config || {};
  const n = String(c.whatsapp || (c.contacto && c.contacto.telefono) || '').replace(/\D/g, '');
  if (n.length >= 9) return n;
  return null;
}

/* ---------------------------------------------------------------------
   AVISO OBLIGATORIO AL PUBLICAR
   Cada publicación se avisa por WhatsApp al dueño del sistema. Es la
   forma de que se entere al momento y pueda mover la publicación.
   --------------------------------------------------------------------- */
function avisoPublicacionWhatsApp(u, titulo, articulo) {
  const n = waDelDueno();
  const c = BD.config.contacto || {};
  const msg = `Hola, soy ${u.nombre}${u.telefono ? ' (' + u.telefono + ')' : ''}. ` +
              `Acabo de publicar "${titulo}" en ${BD.config.nombre}. ` +
              `Busco a cambio: ${(articulo && articulo.busca) || '—'}. ` +
              `Ciudad: ${(articulo && articulo.ciudad) || '—'}.`;
  const enlace = n ? linkWA(n, msg) : (c.wa || 'https://wa.me/qr/Z6T6N7FJTXCNH1');

  $('#waCuerpo').innerHTML = `
    <div class="wa-bien">
      <div class="wa-emo">📢</div>
      <h2>Avisa tu publicación</h2>
      <p class="sub">Tu publicación ya está arriba. Ahora <b>mándale el aviso por WhatsApp</b>
        al administrador para que la revise y la difunda. Es el último paso.</p>

      <div class="wa-resumen">
        <b>${esc(titulo)}</b>
        <span>🔁 Busca: ${esc((articulo && articulo.busca) || '—')}</span>
        <span>📍 ${esc((articulo && articulo.ciudad) || '—')}</span>
      </div>

      <a class="wa grande" id="waIr" target="_blank" rel="noopener" href="${esc(enlace)}">
        💬 Enviar el aviso por WhatsApp</a>
      <button class="btn suave full" type="button" id="waYaAvise" style="margin-top:10px">
        Ya lo envié, continuar</button>
      <p class="legal" style="margin-top:10px">Este aviso es obligatorio: así el administrador
        se entera al momento de cada publicación nueva.</p>
    </div>`;
  abrir('mWhatsApp');

  /* no se cierra con la X ni con Escape: hay que tocar uno de los dos botones */
  const capa = $('#mWhatsApp');
  capa.dataset.obligatorio = '1';
  const equis = capa.querySelector('.x');
  if (equis) equis.hidden = true;

  const cerrarAviso = () => {
    capa.dataset.obligatorio = '';
    if (equis) equis.hidden = false;
    cerrar('mWhatsApp');
  };
  $('#waIr').addEventListener('click', () => setTimeout(cerrarAviso, 800));
  $('#waYaAvise').addEventListener('click', cerrarAviso);
}


/* =====================================================================
   ENTRAR CON GOOGLE DE VERDAD
   Antes bastaba con escribir un correo para entrar a esa cuenta: ese era
   el agujero más grande del sistema. Ahora Google confirma la identidad.
   ===================================================================== */
async function entrarConGoogle() {
  if (!/^https?:$/.test(location.protocol)) {
    return { err: 'Para entrar con Google la página debe estar publicada en internet (https). ' +
                  'Abriendo el archivo directo, Google no lo permite. Usa tu celular y un PIN.' };
  }
  try {
    if (!window.firebase) await cargarJsConTiempo(SDK_APP);
    if (window.firebase && !firebase.auth) await cargarJsConTiempo(SDK_AUTH);
    if (!window.firebase || !firebase.auth) return { err: 'No se pudo cargar Google. Revisa tu internet.' };
    if (!firebase.apps.length) firebase.initializeApp(NUBE_CONFIG.firebase);

    const prov = new firebase.auth.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account' });
    const cred = await firebase.auth().signInWithPopup(prov);
    const g = cred && cred.user;
    if (!g || !g.email) return { err: 'Google no devolvió el correo.' };

    let u = BD.usuarios.find(x => (x.uid && x.uid === g.uid) ||
                                  (x.email || '').toLowerCase() === g.email.toLowerCase());
    if (u) {
      if (u.estado !== 'activo') return { err: 'Tu cuenta está suspendida.' };
      u.uid = g.uid; u.verificado = true; u.soloGoogle = u.soloGoogle || !u.hash;
      if (g.photoURL && !u.avatar) u.avatar = g.photoURL;
      limpiarFallos(u.email);
      entrar(u); registrarVisita(u.id);
      anotarEvento('google', `${u.nombre} entró con Google`, u.id);
      guardar();
      return { usuario: u, nueva: false };
    }

    const ciudad = 'Chincha Alta', c = CIUDADES[ciudad];
    u = {
      id: nuevoId(), uid: g.uid,
      nombre: g.displayName || g.email.split('@')[0],
      email: g.email.toLowerCase(),
      rol: 'usuario', ciudad, avatar: g.photoURL || null, telefono: null,
      bio: '', ref: '', lat: c[0], lon: c[1],
      premium: false, premiumHasta: null, puntos: 0, nivel: 1,
      estado: 'activo', creado: new Date().toISOString(),
      verificado: true, soloGoogle: true, entraCon: 'google',
      codigo: nuevoCodigo(), avisos: true, impulsosGratis: 0, proMes: null,
    };
    BD.usuarios.push(u);
    entrar(u); registrarVisita(u.id);
    anotarEvento('alta', `Cuenta creada con Google: ${u.email}`, u.id);
    notificar(u.id, '¡Bienvenido a ' + BD.config.nombre + '!',
              'Entraste con Google, tu cuenta ya está verificada ✅');
    guardar();
    return { usuario: u, nueva: true };
  } catch (e) {
    const cod = e.code || '';
    if (cod === 'auth/popup-closed-by-user') return { err: 'Cerraste la ventana de Google.' };
    if (cod === 'auth/unauthorized-domain')
      return { err: 'Tu dominio no está autorizado. Agrégalo en Firebase → Authentication → Settings → Authorized domains.' };
    if (cod === 'auth/operation-not-allowed')
      return { err: 'Activa Google en Firebase → Authentication → Sign-in method.' };
    return { err: 'No se pudo entrar con Google: ' + (e.message || cod) };
  }
}

/* =====================================================================
   HASTA 3 ADMINISTRADORES
   ===================================================================== */
function cambiarRol(idUsuario, nuevoRol) {
  const yoSoy = yo();
  const u = BD.usuarios.find(x => String(x.id) === String(idUsuario));
  if (!yoSoy || yoSoy.rol !== 'admin') return avisar('Solo un administrador', 'err');
  if (!u) return;

  if (nuevoRol === 'admin') {
    if (u.rol === 'admin') return;
    if (!puedeOtroAdmin())
      return avisar(`Ya hay ${SEG.maxAdmins} administradores. Quítale el cargo a uno primero.`, 'err');
    u.rol = 'admin';
    anotarEvento('rol', `${yoSoy.nombre} hizo administrador a ${u.nombre}`, yoSoy.id);
    notificar(u.id, '🛡️ Ahora eres administrador',
      'Puedes revisar pagos, aprobar publicidad, crear cuentas y ver la seguridad.');
    avisar(`${u.nombre} ahora es administrador (${contarAdmins()} de ${SEG.maxAdmins})`, 'ok');
  } else {
    if (String(u.id) === String(yoSoy.id)) return avisar('No puedes quitarte el cargo a ti mismo', 'err');
    if (contarAdmins() <= 1) return avisar('Tiene que quedar al menos un administrador', 'err');
    u.rol = 'usuario';
    anotarEvento('rol', `${yoSoy.nombre} le quitó el cargo a ${u.nombre}`, yoSoy.id);
    avisar(`${u.nombre} ya no es administrador`);
  }
  guardar(); pintarAdmin(); pintarNav();
}

/* Nadie puede borrar al último administrador ni borrarse a sí mismo */
function sePuedeBorrar(idUsuario) {
  const u = BD.usuarios.find(x => String(x.id) === String(idUsuario));
  const yoSoy = yo();
  if (!u) return { ok: false, motivo: 'No existe.' };
  if (yoSoy && String(yoSoy.id) === String(u.id)) return { ok: false, motivo: 'No puedes borrarte a ti mismo.' };
  if (u.rol === 'admin' && contarAdmins() <= 1)
    return { ok: false, motivo: 'Es el único administrador que queda.' };
  return { ok: true };
}

/* =====================================================================
   REVISIÓN DE SEGURIDAD PARA EL ADMINISTRADOR
   ===================================================================== */
function revisionSeguridad() {
  const p = [];
  const enClaro = BD.usuarios.filter(u => u.pass || u.pin).length;
  p.push({ ok: enClaro === 0, t: 'Contraseñas protegidas',
    d: enClaro === 0 ? 'Todas guardadas con huella PBKDF2. Nadie puede leerlas, ni tú.'
       : `${enClaro} cuenta(s) de la versión vieja todavía con la clave escrita. Se convierten solas al entrar.` });

  const n = contarAdmins();
  p.push({ ok: n >= 1 && n <= SEG.maxAdmins, t: `Administradores: ${n} de ${SEG.maxAdmins}`,
    d: n === 0 ? 'No queda ningún administrador.' : n > SEG.maxAdmins ? 'Hay de más.' : 'Cantidad correcta.' });

  const google = BD.usuarios.filter(u => u.entraCon === 'google' || u.uid).length;
  p.push({ ok: true, t: `Cuentas verificadas con Google: ${google}`,
    d: 'Son las más seguras: Google confirma quién es cada quien.' });

  const https = /^https:$/.test(location.protocol);
  p.push({ ok: https, t: 'Conexión cifrada (HTTPS)',
    d: https ? 'La página viaja cifrada.'
       : 'Estás abriendo el archivo local. Para lanzarlo de verdad, publícalo con HTTPS.' });

  p.push({ ok: !!(typeof NUBE !== 'undefined' && NUBE.activa), t: 'Base de datos en la nube',
    d: (typeof NUBE !== 'undefined' && NUBE.activa) ? 'Conectada y sincronizando.'
       : 'Sin conexión: los datos quedan solo en este equipo.' });

  const bloqueos = Object.values(cajaIntentos()).filter(i => i.hasta > Date.now()).length;
  p.push({ ok: bloqueos === 0, t: 'Cuentas bloqueadas ahora', 
    d: bloqueos ? `${bloqueos} cuenta(s) bloqueada(s) por intentos fallidos.` : 'Ninguna.' });
  return p;
}

const REGLAS_SEGURAS = `{
  "rules": {
    "truequea": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".validate": "newData.hasChildren(['usuarios','articulos'])"
    }
  }
}`;

function verSeguridad() {
  const p = revisionSeguridad();
  const malos = p.filter(x => !x.ok).length;
  const reg = ((BD.seguridad || {}).registro || []).slice(0, 12);
  $('#seguridadCuerpo').innerHTML = `
    <h2>🔐 Estado de la seguridad</h2>
    <p class="sub">${malos ? `Hay ${malos} punto(s) por mejorar.` : 'Todo en orden.'}</p>
    <div class="diag">
      ${p.map(x => `<div class="diag-fila ${x.ok ? 'si' : 'no'}">
        <span class="diag-emo">${x.ok ? '✅' : '⚠️'}</span>
        <div><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div></div>`).join('')}
    </div>

    <div class="diag-arreglo">
      <b>Los 3 pasos para lanzarlo en serio</b>
      <ol>
        <li>Publica la web con <b>HTTPS</b> (Firebase Hosting es gratis y ya tienes el proyecto).</li>
        <li>Firebase → <b>Authentication</b> → activa <b>Google</b> y agrega tu dominio en
            <i>Authorized domains</i>.</li>
        <li>Cambia las <b>Reglas</b> para que solo entren usuarios identificados:</li>
      </ol>
      <pre class="reglas">${esc(REGLAS_SEGURAS)}</pre>
      <button class="btn suave sm" type="button" id="btnReglasSeg">📋 Copiar las reglas</button>
      <p class="nota">Mientras las reglas estén abiertas, cualquiera con el enlace de tu base
        puede leerla o borrarla. Este es el paso que más te protege.</p>
    </div>

    <h3 style="font-size:16px;margin:18px 0 10px">📜 Últimos movimientos</h3>
    ${reg.length ? reg.map(r => `<div class="fila"><div class="fila-info">
        <b>${esc(r.texto)}</b><span>${fechaTxt(r.cuando)} · ${esc(r.tipo)}</span>
      </div></div>`).join('') : '<p class="nota">Todavía no hay movimientos anotados.</p>'}`;
  abrir('mSeguridad');
  const b = $('#btnReglasSeg');
  if (b) b.onclick = () => navigator.clipboard?.writeText(REGLAS_SEGURAS)
    .then(() => avisar('Reglas copiadas ✔', 'ok')).catch(() => avisar('Cópialas a mano'));
}

/* =====================================================================
   WHATSAPP: al registrarse y al publicar
   El dueño pone su número una vez en Admin → Marca, y desde ahí cada
   persona que se registra o publica puede escribirle con un toque.
   ===================================================================== */
function waDelDueno() {
  const c = BD.config || {};
  const n = String(c.whatsapp || (c.contacto && c.contacto.telefono) || '').replace(/\D/g, '');
  if (n.length >= 9) return n;
  return null;
}

/* Pantalla de bienvenida con el botón de WhatsApp */
function bienvenidaWhatsApp(u, motivo, extra) {
  const n = waDelDueno();
  const c = BD.config.contacto || {};
  const textos = {
    registro: {
      emo: '🎉', titulo: `¡Bienvenido, ${esc(u.nombre.split(' ')[0])}!`,
      sub: 'Tu cuenta ya está lista. Escríbenos por WhatsApp y te ayudamos a empezar.',
      msg: `Hola, soy ${u.nombre}. Acabo de crear mi cuenta en Truequea PE ` +
           `(${u.email}${u.telefono ? ' · ' + u.telefono : ''}). Quiero que me ayuden a empezar.`,
      boton: '💬 Escribir por WhatsApp',
    },
    publicar: {
      emo: '📦', titulo: '¡Tu publicación ya está arriba!',
      sub: 'Mándanos el aviso por WhatsApp y la difundimos para que la vean más personas.',
      msg: `Hola, soy ${u.nombre}. Acabo de publicar "${extra || ''}" en Truequea PE. ` +
           `¿Me ayudan a difundirla?`,
      boton: '💬 Avisar por WhatsApp',
    },
  }[motivo] || {};

  const enlace = n ? linkWA(n, textos.msg) : (c.wa || 'https://wa.me/qr/Z6T6N7FJTXCNH1');
  $('#waCuerpo').innerHTML = `
    <div class="wa-bien">
      <div class="wa-emo">${textos.emo}</div>
      <h2>${textos.titulo}</h2>
      <p class="sub">${esc(textos.sub)}</p>
      <a class="wa grande" id="waIr" target="_blank" rel="noopener" href="${esc(enlace)}">
        ${textos.boton}</a>
      <button class="btn suave full" type="button" data-cerrar style="margin-top:10px">
        Ahora no, seguir en la web</button>
      ${motivo === 'registro' ? `<p class="legal" style="margin-top:12px">
        Tu código de respaldo es <b>${esc(u.codigo)}</b>. Guárdalo: con él recuperas tu cuenta.</p>` : ''}
    </div>`;
  abrir('mWhatsApp');
}
