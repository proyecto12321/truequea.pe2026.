/* ===================================================================
   TRUEQUEA PE · Publicar, trueques, chat y premium
   Archivo: js/04-acciones.js
   =================================================================== */

/* =====================================================================
   Acciones: cuenta, publicaciones, trueques, chat, premium, admin
   ===================================================================== */

/* ---------------- autenticación ---------------- */
function abrirAuth(modo = 'login') {
  App.modoAuth = modo; refrescarAuth();
  $('#errAuth').hidden = true;
  abrir('mAuth');
}
/* El botón de Google solo sirve con la página publicada en internet.
   Abriendo el archivo directo, Google lo rechaza siempre: por eso, en ese
   caso, ni se muestra y no confunde a nadie. */
function googleSirve() { return /^https:$/.test(location.protocol); }

function refrescarAuth() {
  const gs = googleSirve();
  if ($('#btnGoogle'))   $('#btnGoogle').hidden = !gs;
  if ($('#btnFacebook')) $('#btnFacebook').hidden = true;
  if ($('#divisorSocial')) $('#divisorSocial').hidden = !gs;
  const reg = App.modoAuth === 'registro';
  $('#authTitulo').textContent = reg ? 'Crear mi cuenta en 20 segundos' : 'Entrar a ' + BD.config.nombre;
  $('#authSub').textContent = reg
    ? 'Solo tu nombre, tu correo y una contraseña que recuerdes'
    : 'Usa tu correo o tu cuenta de Google';
  $('#soloReg').hidden = !reg;
  $('#aNombre').required = reg;
  $('#btnAuth').textContent = reg ? 'Crear mi cuenta' : 'Entrar';
  $('#pistaPass').hidden = !reg;
  $('#medAuth').hidden = !reg;
  $('#aPass').autocomplete = reg ? 'new-password' : 'current-password';
  $('#cambioAuth').innerHTML = reg
    ? '¿Ya tienes cuenta? <button type="button">Entrar</button>'
    : '¿No tienes cuenta? <button type="button">Crear una cuenta</button>';
}
function errorAuth(msg) { const e = $('#errAuth'); e.textContent = msg; e.hidden = false; }

function medir(input, medidor) {
  const v = input.value; let p = 0;
  if (v.length >= 8) p++;
  if (v.length >= 12) p++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) p++;
  if (/\d/.test(v)) p++;
  if (/[^\w\s]/.test(v)) p++;
  medidor.className = 'medidor n' + p;
  medidor.querySelector('i').style.width = (p / 5 * 100) + '%';
}
/* Registro fácil: con 6 caracteres basta. Lo importante es que la recuerdes. */
function validarPass(p) {
  if (!p || p.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  return null;
}

/* Código de respaldo para recuperar la cuenta sin correo ni servidor */
function nuevoCodigo() {
  let c;
  do { c = 'TRUEQUEA-' + Math.floor(1000 + Math.random() * 9000); }
  while (BD.usuarios.some(u => u.codigo === c));
  return c;
}
function mostrarCodigo(u) {
  $('#codigoTxt').textContent = u.codigo;
  abrir('mCodigo');
}
function textoAcceso(u) {
  return `TRUEQUEA PE — Mis datos de acceso\r\n\r\n` +
    `Nombre: ${u.nombre}\r\nCorreo: ${u.email}\r\n` +
    `Contraseña: ${u.pass || '(entras con Google)'}\r\n` +
    `Código de respaldo: ${u.codigo}\r\n\r\n` +
    `Con el código de respaldo puedes cambiar tu contraseña en\r\n` +
    `"Entrar" → "Olvidé mi contraseña". Guarda este archivo.\r\n`;
}

function registrar(datos) {
  const email = String(datos.email || '').trim().toLowerCase();
  if (!datos.nombre || datos.nombre.trim().length < 2) return { err: 'Escribe tu nombre.' };
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { err: 'Revisa tu correo: parece incompleto.' };
  if (BD.usuarios.some(u => u.email.toLowerCase() === email))
    return { err: 'Ese correo ya tiene cuenta. Entra con tu contraseña o usa "Olvidé mi contraseña".' };
  if (!datos.social && !datos.express) { const e = validarPass(datos.pass || ''); if (e) return { err: e }; }
  if (datos.express && String(datos.pin || '').length !== 4) return { err: 'El PIN debe tener 4 números.' };

  const ciudad = datos.ciudad || 'Chincha Alta';
  const c = CIUDADES[ciudad] || CIUDADES['Chincha Alta'];
  const u = {
    id: nuevoId(), nombre: datos.nombre.trim(), email, pass: datos.pass || null,
    pin: datos.pin || null,
    rol: 'usuario', ciudad, avatar: null, telefono: datos.telefono || null, bio: '', ref: '',
    lat: c[0], lon: c[1], premium: false, premiumHasta: null, puntos: 0, nivel: 1,
    estado: 'activo', creado: new Date().toISOString(), verificado: !!datos.social,
    codigo: nuevoCodigo(), avisos: true, express: !!datos.express,
    impulsosGratis: 0, impulsosMes: new Date().toISOString().slice(0, 7),
  };
  BD.usuarios.push(u);
  entrar(u);                                   // ← la sesión queda guardada de inmediato
  registrarVisita(u.id);
  notificar(u.id, '¡Bienvenido a ' + BD.config.nombre + '!',
            'Publica tu primer artículo y empieza a intercambiar. Tu código de respaldo es ' + u.codigo + '.');
  guardar();
  return { usuario: u };
}

/* Recuperar la cuenta con el código de respaldo */
function recuperarCuenta(email, codigo, nueva) {
  email = String(email || '').trim().toLowerCase();
  const u = BD.usuarios.find(x => x.email.toLowerCase() === email);
  if (!u) return { err: 'No encontramos una cuenta con ese correo.' };
  if (String(codigo || '').trim().toUpperCase() !== String(u.codigo || '').toUpperCase())
    return { err: 'El código de respaldo no coincide con esa cuenta.' };
  const e = validarPass(nueva); if (e) return { err: e };
  u.pass = nueva;
  entrar(u); guardar();
  return { usuario: u };
}

/* Entra con el correo O con el número de celular, y con la contraseña O el PIN */
function iniciarSesion(email, pass) {
  const dato = String(email || '').trim().toLowerCase();
  const soloNumeros = dato.replace(/\D/g, '');
  const u = BD.usuarios.find(x => x.email.toLowerCase() === dato) ||
            (soloNumeros.length >= 9
              ? BD.usuarios.find(x => (x.telefono || '').replace(/\D/g, '') === soloNumeros) : null);
  if (!u) return { err: 'No encontramos esa cuenta. Revisa tu correo o celular, o crea una nueva.' };
  const clave = String(pass || '');
  const coincide = (u.pass && u.pass === clave) || (u.pin && u.pin === clave);
  if ((u.pass || u.pin) && !coincide) return { err: 'La contraseña o el PIN no coinciden.' };
  if (!u.pass && !u.pin && clave) return { err: 'Esta cuenta entra con Google. Usa el botón de Google.' };
  if (u.estado !== 'activo') return { err: 'Tu cuenta está suspendida.' };
  if (!u.codigo) { u.codigo = nuevoCodigo(); }
  entrar(u);
  registrarVisita(u.id);
  return { usuario: u };
}

function trasEntrar(u, msg) {
  cerrarTodo();
  pintarNav(); pintarLista(); pintarMapa(); pintarCategorias();
  avisar(msg || `¡Hola, ${u.nombre}!`, 'ok');
  if (u.rol === 'admin') irA('admin');
}

/* ---------------- publicar ---------------- */
function abrirPublicar(art = null) {
  const u = yo();
  if (!u) { abrirAuth('login'); return avisar('Entra a tu cuenta para publicar'); }

  App.fotos = [];
  $('#formPublicar').reset();
  $('#minisPub').innerHTML = '';
  $('#zonaFotos').textContent = '📷 Clic para subir hasta 6 fotos';

  if (art) {
    $('#pubTitulo').textContent = 'Editar publicación';
    $('#btnPublicar').textContent = 'Guardar cambios';
    $('#pubId').value = art.id;
    $('#pubNombre').value = art.titulo;
    $('#pubCat').value = art.categoria;
    $('#pubCond').value = art.condicion;
    $('#pubCiudad').value = art.ciudad;
    $('#pubBusca').value = art.busca;
    $('#pubDesc').value = art.desc || '';
    App.fotos = [...(art.fotos || [])];
    pintarMinis();
  } else {
    $('#pubTitulo').textContent = App.publicandoVip ? 'Publicar en 💎 Trueques VIP' : 'Publicar artículo';
    $('#btnPublicar').textContent = 'Publicar';
    $('#pubId').value = '';
    $('#pubCiudad').value = u.ciudad;
  }
  /* la vitrina VIP solo se ofrece a los Premium */
  const puedeVip = !!(u.premium || u.rol === 'admin');
  $('#filaVip').hidden = !puedeVip;
  $('#pubVip').innerHTML = '<option value="">No, publicación normal</option>' +
    CATEGORIAS_VIP.map(c => `<option value="${c[0]}">${c[1]} ${c[0]}</option>`).join('');
  $('#pubVip').value = art ? (art.vip || '') : (App.publicandoVip ? CATEGORIAS_VIP[0][0] : '');
  App.publicandoVip = false;
  abrir('mPublicar');
}
function pintarMinis() {
  $('#minisPub').innerHTML = App.fotos.map((f, i) =>
    `<figure><img src="${f}" alt=""><button type="button" data-quitarfoto="${i}">✕</button></figure>`).join('');
  $('#zonaFotos').textContent = App.fotos.length
    ? `📷 ${App.fotos.length} foto(s) — clic para agregar más`
    : '📷 Clic para subir hasta 6 fotos';
}
function guardarPublicacion() {
  const u = yo();
  if (!u) { abrirAuth('login'); return avisar('Tu sesión se cerró. Vuelve a entrar.', 'err'); }

  const id = $('#pubId').value;
  const titulo = $('#pubNombre').value.trim();
  const cat = Number($('#pubCat').value);
  const busca = $('#pubBusca').value.trim();
  const ciudad = $('#pubCiudad').value;

  if (titulo.length < 4) return avisar('El título debe tener al menos 4 caracteres', 'err');
  if (!cat)              return avisar('Elige una categoría', 'err');
  if (!busca)            return avisar('Escribe qué buscas a cambio', 'err');

  if (!id && !u.premium) {
    const activas = BD.articulos.filter(a => a.usuario === u.id && a.estado === 'disponible').length;
    if (activas >= LIMITE_GRATIS) {
      cerrar('mPublicar');
      return confirmar('Llegaste al límite gratuito',
        `Tienes ${LIMITE_GRATIS} publicaciones activas. Con Premium son ilimitadas por S/ ${precioPro()}.`,
        () => irA('premium'), 'Ver Premium');
    }
  }

  const c = CIUDADES[ciudad] || CIUDADES['Chincha Alta'];
  const datos = {
    titulo, categoria: cat, busca, ciudad,
    condicion: $('#pubCond').value,
    desc: $('#pubDesc').value.trim(),
    fotos: [...App.fotos],
    vip: (u.premium || u.rol === 'admin') ? ($('#pubVip').value || null) : null,
  };

  if (id) {
    const a = BD.articulos.find(x => x.id == id);
    Object.assign(a, datos);
    avisar('Publicación actualizada', 'ok');
  } else {
    const nuevo = {
      id: nuevoId(), usuario: u.id, ...datos, estado: 'disponible', reserva: null,
      destacado: !!u.premium, vistas: 0, favs: 0,
      lat: (u.lat || c[0]) + (Math.random() - .5) * .01,
      lon: (u.lon || c[1]) + (Math.random() - .5) * .01,
      creado: new Date().toISOString(),
    };
    nuevo.impulso = null;
    BD.articulos.unshift(nuevo);
    avisarNuevaPublicacion(nuevo, u);
    const pedidos = avisarDeseos(nuevo);         // ← "Quiero esto": aviso automático
    avisar(u.premium ? '¡Publicado y destacado por ser Premium!' : '¡Tu artículo fue publicado!', 'ok');
    /* aviso obligatorio al dueño del sistema */
    setTimeout(() => avisoPublicacionWhatsApp(u, nuevo.titulo, nuevo), 700);
    if (pedidos) setTimeout(() => avisar(
      `🎯 ${pedidos} persona(s) estaban pidiendo justo esto. Ya les avisamos.`, 'ok'), 2600);
  }
  guardar();
  cerrar('mPublicar');
  App.fotos = [];
  pintarLista(); pintarCategorias(); pintarMapa(); pintarCuenta(); pintarPremium();
}

/* =====================================================================
   AVISOS DE INTERÉS (notificación + WhatsApp)
   ===================================================================== */

/* Guarda una notificación y, si corresponde, deja lista la alerta de WhatsApp */
function avisarConWA(uid, titulo, cuerpo, numero, mensajeWA) {
  const dest = usuario(uid);
  const wa = (numero && String(numero).replace(/\D/g, '').length >= 9)
    ? linkWA(numero, mensajeWA) : null;
  BD.notis.unshift({
    id: nuevoId(), usuario: uid, titulo, cuerpo, wa,
    leida: false, creado: new Date().toISOString(),
  });
  guardar();
  return wa;
}

/* Al subir una publicación se avisa al administrador y a quien la esté esperando */
function avisarNuevaPublicacion(art, dueno) {
  const cat = CATEGORIAS[art.categoria - 1][0];
  /* 1) el administrador se entera de todo lo que se publica */
  BD.usuarios.filter(x => x.rol === 'admin').forEach(a =>
    avisarConWA(a.id, '📦 Nueva publicación', `${dueno.nombre} publicó "${art.titulo}" en ${art.ciudad}.`,
      dueno.telefono, `Hola ${dueno.nombre}, vi tu publicación "${art.titulo}" en Truequea PE.`));

  /* 2) los Premium que siguen esa categoría o ciudad reciben aviso al instante */
  BD.usuarios.filter(x => x.premium && x.id !== dueno.id && x.avisos !== false).forEach(p => {
    const interesa = BD.favoritos.some(f => f.usuario === p.id &&
        (BD.articulos.find(a => a.id === f.articulo) || {}).categoria === art.categoria)
      || p.ciudad === art.ciudad;
    if (!interesa) return;
    avisarConWA(p.id, '⭐ Algo que te puede interesar',
      `${dueno.nombre} acaba de publicar "${art.titulo}" (${cat}) en ${art.ciudad}.`,
      dueno.telefono, `Hola ${dueno.nombre}, me interesa tu "${art.titulo}" que publicaste en Truequea PE.`);
  });
  guardar();
}

/* Alguien mostró interés en una publicación: avisa al dueño y al administrador */
function avisarInteres(art, interesado, detalle) {
  const dueno = usuario(art.usuario);
  if (!dueno) return null;
  const msg = `Hola ${dueno.nombre}, soy ${interesado.nombre} de Truequea PE. ` +
              `Me interesa tu publicación "${art.titulo}". ${detalle || ''}`.trim();
  const wa = avisarConWA(dueno.id, '🔥 Alguien está interesado',
    `${interesado.nombre} está interesado en "${art.titulo}". ${detalle || ''}`.trim(),
    interesado.telefono,
    `Hola ${interesado.nombre}, vi que te interesa mi "${art.titulo}" en Truequea PE.`);

  /* el administrador recibe copia si dejó activado el aviso */
  if (BD.config.avisoWhatsApp) {
    BD.usuarios.filter(x => x.rol === 'admin' && x.id !== dueno.id).forEach(a =>
      avisarConWA(a.id, '🔔 Interesado en una publicación',
        `${interesado.nombre} está interesado en "${art.titulo}" de ${dueno.nombre}.`,
        dueno.telefono, msg));
  }
  guardar();
  return dueno.telefono ? linkWA(dueno.telefono, msg) : null;
}

/* =====================================================================
   RESERVAS PREMIUM (hasta 24 horas)
   ===================================================================== */
function abrirReserva(artId) {
  const u = yo();
  if (!u) { cerrarTodo(); abrirAuth('login'); return avisar('Entra a tu cuenta'); }
  if (!u.premium) {
    cerrarTodo();
    return confirmar('Reservar es una función Premium',
      `Con Premium (S/ ${precioPro()} al mes) apartas una publicación hasta ${RESERVA_MAX_MIN} minutos: mientras dure, nadie más puede proponer ni escribirle al dueño.`,
      () => irA('premium'), 'Ver Premium');
  }
  const a = BD.articulos.find(x => x.id == artId);
  if (!a) return;
  if (a.usuario === u.id) return avisar('Esa publicación es tuya');
  const res = reservaActiva(a);
  if (res && res.por !== u.id) return avisar('Otra persona ya la tiene apartada', 'err');

  $('#resArt').value = a.id;
  $('#resSub').textContent = `Vas a apartar "${a.titulo}". Mientras dure, los demás lo ven pero no pueden proponer, escribir ni marcar interés.`;
  $('#resHoras').innerHTML = RESERVA_OPCIONES.map(m =>
    `<option value="${m}" ${m === 60 ? 'selected' : ''}>${m === 60 ? '1 hora (máximo)' : m + ' minutos'}</option>`).join('');
  cerrar('mFicha'); abrir('mReserva');
}
function guardarReserva() {
  const u = yo(); if (!u || !u.premium) return;
  const a = BD.articulos.find(x => x.id == $('#resArt').value);
  if (!a) return;
  const min = Math.min(Number($('#resHoras').value) || 30, RESERVA_MAX_MIN);
  const hasta = new Date(Date.now() + min * 60000).toISOString();
  a.reserva = { por: u.id, desde: new Date().toISOString(), hasta, nota: $('#resNota').value.trim() };
  a.estado = 'reservado';
  guardar();

  const wa = avisarInteres(a, u, `La aparté por ${min} minutos. ${a.reserva.nota}`.trim());
  cerrar('mReserva'); $('#formReserva').reset();
  avisar(`Apartado ${min} minutos — solo tú puedes negociarlo ✔`, 'ok');
  if (wa) confirmar('Aviso al dueño', 'Ya le llegó la notificación. ¿Quieres escribirle por WhatsApp ahora?',
    () => window.open(wa, '_blank', 'noopener'), '💬 Abrir WhatsApp');
  pintarLista(); pintarMapa(); pintarPremium(); pintarNav();
}
function soltarReserva(artId) {
  const u = yo();
  const a = BD.articulos.find(x => x.id == artId);
  if (!a || !a.reserva) return;
  if (u.rol !== 'admin' && a.reserva.por !== u.id && a.usuario !== u.id)
    return avisar('Solo quien reservó puede soltarla', 'err');
  a.reserva = null;
  if (a.estado === 'reservado') a.estado = 'disponible';
  guardar(); avisar('Reserva liberada', 'ok');
  pintarLista(); pintarMapa(); pintarPremium(); cerrarTodo();
}

/* ---------------- ficha ---------------- */
function verArticulo(id) {
  const a = BD.articulos.find(x => x.id == id);
  if (!a) return;
  a.vistas = (a.vistas || 0) + 1; guardar();

  const d = usuario(a.usuario), r = reputacion(a.usuario), u = yo();
  const mio = u && u.id === a.usuario;
  const fotos = a.fotos && a.fotos.length ? a.fotos : [SIN_FOTO];

  const res = reservaActiva(a);
  const quienReserva = res ? usuario(res.por) : null;
  const miaLaReserva = res && u && res.por === u.id;
  const bloqueada = res && u && res.por !== u.id && a.usuario !== u.id;

  const cintaReserva = res ? `
    <div class="reserva-cinta">
      🔒 ${miaLaReserva ? 'La apartaste tú' : `Apartada por ${esc(quienReserva ? quienReserva.nombre : 'un Premium')}`}
      · quedan ${restanteTxt(res.hasta)}
      ${res.nota ? `<span style="font-weight:600">— “${esc(res.nota)}”</span>` : ''}
      ${(miaLaReserva || mio || (u && u.rol === 'admin'))
        ? `<button class="btn-t" style="margin-left:auto" data-soltar="${a.id}">Liberar</button>` : ''}
    </div>` : '';

  const bloqVip = bloqueadoPorVip(a, u);
  const interesados = interesadosDe(a).length;
  const imp = impulsoActivo(a);

  const acciones = mio ? `
    <div class="ficha-acc">
      <button class="btn suave sm" data-editar="${a.id}">✏️ Editar</button>
      <button class="btn pri sm" data-interesados="${a.id}">❤️ Ver interesados (${interesados})</button>
      ${imp ? `<span class="eti azul">🚀 Impulsado · ${restanteTxt(imp.hasta)}</span>`
            : `<button class="btn oro sm" data-impulsar="${a.id}">🚀 Impulsar por S/ ${Number(BD.config.precioImpulso).toFixed(2)}</button>`}
      ${a.estado !== 'intercambiado'
        ? `<button class="btn verde sm" data-estado="${a.id}|intercambiado">✓ Ya lo intercambié</button>`
        : `<button class="btn suave sm" data-estado="${a.id}|disponible">↩ Volver a publicar</button>`}
      <button class="btn rojo sm" data-borrar="${a.id}">🗑 Eliminar</button>
    </div>` : `
    <div class="ficha-acc">
      ${bloqVip
        ? `<div class="aviso mora" style="width:100%">💎 Vitrina VIP: puedes mirarla, pero solo los
             Premium proponen aquí. <button class="btn mora sm" data-accion="premium">Hazte Premium</button></div>`
        : bloqueada
        ? `<div class="aviso mora" style="width:100%">🔒 Un Premium la tiene apartada por
             ${restanteTxt(res.hasta)}. Puedes verla, pero no proponer ni escribir hasta que se libere.
             <button class="btn mora sm" data-accion="premium">Yo también quiero apartar</button></div>`
        : `${a.estado === 'disponible' || miaLaReserva
              ? `<button class="btn pri" data-proponer="${a.id}">🔁 Proponer trueque</button>` : ''}
           <button class="btn sec" data-interes="${a.id}">🔥 Me interesa</button>
           <button class="btn sec" data-chat="${a.id}">💬 Enviar mensaje</button>
           ${!res && a.estado === 'disponible'
             ? `<button class="btn mora sm" data-reservar="${a.id}">🔒 Apartar 1 h${u && u.premium ? '' : ' (Premium)'}</button>` : ''}`}
      ${a.lat ? `<a class="btn suave sm" target="_blank" rel="noopener"
         href="https://www.google.com/maps?q=${a.lat},${a.lon}">🗺️ Ver en Google Maps</a>` : ''}
    </div>`;

  $('#ficha').innerHTML = `
    <img class="ficha-img" id="fichaFoto" src="${fotos[0]}" alt="${esc(a.titulo)}">
    ${fotos.length > 1 ? `<div class="ficha-gal">${fotos.map((f, i) =>
      `<img src="${f}" class="${i === 0 ? 'on' : ''}" data-foto="${i}" alt="Foto ${i + 1}">`).join('')}</div>` : ''}
    <div class="ficha-cuerpo">
      <h2>${esc(a.titulo)}</h2>
      <div class="ficha-meta">
        <span>${CATEGORIAS[a.categoria - 1][1]} ${CATEGORIAS[a.categoria - 1][0]}</span>
        <span class="eti gris">${CONDICIONES[a.condicion]}</span>
        <span>📍 ${esc(a.ciudad)}</span><span>👁 ${a.vistas}</span>
        <span>🕓 ${fechaTxt(a.creado)}</span>
        <span class="eti ${a.estado === 'disponible' ? 'azul' : a.estado === 'reservado' ? 'oro' : 'verde'}">${a.estado}</span>
        ${a.destacado ? '<span class="eti oro">⭐ Destacado</span>' : ''}
        ${a.vip ? `<span class="eti mora">💎 VIP · ${esc(a.vip)}</span>` : ''}
        ${impulsoActivo(a) ? '<span class="eti azul">🚀 Impulsado</span>' : ''}
        <span class="eti roja" style="background:var(--rojo2)">❤️ ${interesadosDe(a).length} interesados</span>
        ${u && u.premium && u.lat && a.lat
          ? `<span class="eti mora">📍 ${distanciaTxt(distanciaKm(u.lat, u.lon, a.lat, a.lon))} de ti</span>` : ''}
      </div>
      ${cintaReserva}
      <div class="ficha-b"><h5>Descripción</h5><p>${esc(a.desc) || 'Sin descripción.'}</p></div>
      <div class="ficha-b"><h5>Busca a cambio</h5><p>🔁 ${esc(a.busca)}</p></div>
      <div class="ficha-dueno">
        ${avatarHTML(d, 'av-g')}
        <div style="flex:1;min-width:170px">
          <b style="font-size:15px">${esc(d.nombre)} ${d.premium ? '<span class="pro-badge">PREMIUM</span>' : ''}</b>
          <div class="estrellas">${estrellas(r.prom)}<span class="n">${r.prom.toFixed(1)} · ${r.total} reseñas · ${truequesDe(d.id)} trueques</span></div>
          <div style="font-size:13px;color:var(--sub);margin-top:3px">📍 ${esc(d.ciudad)}${d.telefono ? ' · 📞 ' + esc(d.telefono) : ''}</div>
        </div>
        <button class="btn suave sm" data-perfil="${d.id}">Ver perfil</button>
      </div>
      ${cajaConfianza(d, a)}
      ${acciones}
    </div>`;
  abrir('mFicha');
}

/* ---------------- trueques ---------------- */
function abrirPropuesta(artId) {
  const u = yo();
  if (!u) { cerrarTodo(); abrirAuth('login'); return avisar('Entra para proponer un trueque'); }
  const a = BD.articulos.find(x => x.id == artId);
  if (!puedeInteractuar(a)) return;
  const mios = BD.articulos.filter(x => x.usuario === u.id && x.estado === 'disponible');
  $('#propArt').value = artId;
  $('#propOfrezco').innerHTML = '<option value="">— Solo mensaje, sin ofrecer artículo —</option>' +
    mios.map(m => `<option value="${m.id}">${esc(m.titulo)}</option>`).join('');
  $('#propSub').textContent = `Quieres "${a.titulo}". ${mios.length ? 'Elige qué ofreces a cambio y te decimos si el cambio se ve parejo.' : 'Aún no tienes artículos publicados: puedes enviar solo un mensaje.'}`;
  pintarAnalisisPropuesta();
  cerrar('mFicha'); abrir('mPropuesta');
}

/* Semáforo "¿estoy haciendo un buen trueque?" dentro de la propuesta */
function pintarAnalisisPropuesta() {
  const u = yo();
  const recibo = BD.articulos.find(x => x.id == $('#propArt').value);
  const ofrezcoId = Number($('#propOfrezco').value) || null;
  const doy = ofrezcoId ? BD.articulos.find(x => x.id === ofrezcoId) : null;
  $('#analisisProp').innerHTML = tarjetaAnalisis(analizarTrueque(doy, recibo), doy, recibo, !!(u && u.premium));
}

/* Tarjeta del análisis: básica para todos, completa para Premium */
function tarjetaAnalisis(an, doy, recibo, pro) {
  const emo = { verde:'🟢', amarillo:'🟡', rojo:'🔴' }[an.nivel];
  const barra = (t, v, sufijo = '') => `
    <div class="med-fila"><span>${t}</span>
      <div class="med-pista"><i style="width:${Math.max(3, Math.min(v, 100))}%"></i></div>
      <b>${nivelTexto(v)}${sufijo}</b></div>`;
  return `<div class="analisis ${an.nivel}">
    <div class="an-cab"><b>${emo} ${esc(an.titulo)}</b></div>
    <div class="an-par">
      <div><small>Tú entregas</small><b>${esc(doy ? doy.titulo : 'Solo un mensaje')}</b></div>
      <span class="fl">⇄</span>
      <div><small>Recibes</small><b>${esc(recibo ? recibo.titulo : '—')}</b></div>
    </div>
    <p class="an-consejo">${esc(an.consejo)}</p>
    ${pro ? `
      <div class="an-pro">
        <span class="eti mora">💜 Análisis Premium</span>
        <div class="med-fila"><span>💰 Referencia del sistema</span>
          <div class="med-pista"><i style="width:${Math.min(an.ratio * 50, 100)}%"></i></div>
          <b>${doy ? 'S/ ' + an.vDoy + ' ⇄ S/ ' + an.vRec : 'S/ ' + an.vRec}</b></div>
        ${barra('📊 Demanda de lo que recibes', an.demanda * 4)}
        ${barra('🔥 Popularidad', an.popularidad)}
        ${barra('📈 Facilidad para volver a cambiarlo', an.facilidad)}
        <p class="nota">La referencia es interna y aproximada: sirve para comparar, no es un precio
          de venta. En Truequea PE no se vende nada.</p>
      </div>`
    : `<div class="an-candado">
        <b>💜 Con Premium ves el análisis completo</b>
        <span>Valor de referencia, demanda, popularidad y qué tan fácil es volver a cambiarlo.</span>
        <button class="btn mora sm" type="button" data-accion="premium">Ver Premium</button>
      </div>`}
  </div>`;
}
function enviarPropuesta() {
  const u = yo(); if (!u) return;
  const artId = Number($('#propArt').value);
  const a = BD.articulos.find(x => x.id === artId);
  const x = {
    id: nuevoId(), de: u.id, para: a.usuario, pido: artId,
    ofrezco: Number($('#propOfrezco').value) || null,
    mensaje: $('#propMsg').value.trim(), estado: 'pendiente',
    checkA: false, checkB: false, lugar: '', fecha: '',
    creado: new Date().toISOString(),
  };
  BD.intercambios.unshift(x); guardar();
  const wa = avisarInteres(a, u, x.mensaje ? `Mensaje: "${x.mensaje}"` : 'Te envié una propuesta de trueque.');
  cerrar('mPropuesta'); $('#formPropuesta').reset();
  avisar('Propuesta enviada', 'ok');
  if (wa) confirmar('Propuesta enviada', 'Ya le llegó la notificación dentro de la app. ¿Le escribes también por WhatsApp?',
    () => window.open(wa, '_blank', 'noopener'), '💬 Abrir WhatsApp');
  pintarNav(); pintarCuenta();
}

/* =====================================================================
   ¿Puedo interactuar con esta publicación?
   · Si un Premium la tiene reservada, los demás solo la ven.
   · Si es de la vitrina VIP, solo participan los Premium.
   ===================================================================== */
function puedeInteractuar(a, avisando = true) {
  const u = yo();
  if (!u) { cerrarTodo(); abrirAuth('login'); if (avisando) avisar('Entra a tu cuenta'); return false; }
  if (bloqueadoPorReserva(a, u)) {
    const r = reservaActiva(a);
    const quien = usuario(r.por);
    cerrarTodo();
    confirmar('Publicación apartada',
      `${quien ? quien.nombre : 'Un usuario'} Premium la tiene reservada y quedan ${restanteTxt(r.hasta)}. ` +
      `Puedes verla, pero no proponer ni escribirle al dueño hasta que se libere. ` +
      `Con Premium tú también puedes apartar lo que te interesa.`,
      () => irA('premium'), 'Ver Premium');
    return false;
  }
  if (bloqueadoPorVip(a, u)) {
    cerrarTodo();
    confirmar('💎 Trueques VIP',
      `Esta vitrina es exclusiva: solo los Premium publican y proponen aquí. ` +
      `Puedes mirar todo, pero para negociar necesitas Premium (S/ ${precioPro()} al mes).`,
      () => irA('premium'), 'Hazte Premium');
    return false;
  }
  return true;
}

/* Botón "Me interesa": avisa al dueño al instante */
function marcarInteres(artId) {
  const u = yo();
  if (!u) { cerrarTodo(); abrirAuth('login'); return avisar('Entra para avisar tu interés'); }
  const a = BD.articulos.find(x => x.id == artId);
  if (!a) return;
  if (a.usuario === u.id) return avisar('Esa publicación es tuya');
  if (!puedeInteractuar(a)) return;

  /* queda guardado en favoritos para poder seguirlo */
  if (!BD.favoritos.some(f => f.usuario === u.id && f.articulo === a.id))
    BD.favoritos.push({ usuario: u.id, articulo: a.id });
  a.favs = (a.favs || 0) + 1;
  guardar();

  const wa = avisarInteres(a, u, 'Marqué "me interesa" en tu publicación.');
  avisar('Le avisamos al dueño que te interesa 🔥', 'ok');
  if (wa) confirmar('Aviso enviado', `${usuario(a.usuario).nombre} ya recibió la notificación. ¿Le escribes por WhatsApp?`,
    () => window.open(wa, '_blank', 'noopener'), '💬 Abrir WhatsApp');
  pintarLista(); pintarNav(); pintarPremium();
}
function responderPropuesta(id, respuesta) {
  const x = BD.intercambios.find(i => i.id == id);
  const a = BD.articulos.find(t => t.id === x.pido);
  const de = usuario(x.de);
  if (respuesta === 'aceptar') {
    x.estado = 'aceptado';
    a.estado = 'reservado';
    if (x.ofrezco) { const o = BD.articulos.find(t => t.id === x.ofrezco); if (o) o.estado = 'reservado'; }
    BD.intercambios.filter(i => i.pido === x.pido && i.id !== x.id && i.estado === 'pendiente')
      .forEach(i => i.estado = 'rechazado');
    notificar(x.de, '¡Tu propuesta fue aceptada!', `Coordina la entrega de "${a.titulo}" por el chat.`);
    avisar('Propuesta aceptada — ahora coordinen el encuentro', 'ok');
    abrirChatCon(x.de, x.pido);
  } else {
    x.estado = 'rechazado';
    notificar(x.de, 'Propuesta rechazada', `Tu propuesta por "${a.titulo}" fue rechazada.`);
    avisar('Propuesta rechazada');
  }
  guardar(); pintarCuenta(); pintarLista(); pintarNav();
}
function verTrueque(id) {
  const x = BD.intercambios.find(i => i.id == id), u = yo();
  const pido = BD.articulos.find(a => a.id === x.pido);
  const ofrezco = x.ofrezco ? BD.articulos.find(a => a.id === x.ofrezco) : null;
  const soyDe = x.de === u.id;
  const otro = usuario(soyDe ? x.para : x.de);
  const miCheck = soyDe ? x.checkA : x.checkB;
  const suCheck = soyDe ? x.checkB : x.checkA;

  $('#detTrueque').innerHTML = `
    <h2>Trueque con ${esc(otro.nombre)}</h2>
    <p class="sub">Estado: <span class="eti oro">${x.estado}</span></p>
    <div class="fila">
      <div class="par">
        <img src="${foto(pido)}" alt=""><span class="fl">⇄</span>
        <img src="${ofrezco ? foto(ofrezco) : SIN_FOTO}" alt="">
      </div>
      <div class="fila-info">
        <b>${esc(pido.titulo)} ⇄ ${esc(ofrezco ? ofrezco.titulo : 'solo mensaje')}</b>
        ${x.mensaje ? `<span>💬 "${esc(x.mensaje)}"</span>` : ''}
      </div>
    </div>
    <div class="tarjeta">
      <h3>📍 Punto de encuentro</h3>
      <p class="nota">Elige un lugar público. Estas son las zonas seguras sugeridas.</p>
      <div class="dos">
        <div><label class="et" for="tqLugar">Lugar</label>
          <select class="campo" id="tqLugar">
            <option value="">Otro lugar</option>
            ${ZONAS_SEGURAS.map(z => `<option ${x.lugar === z.nombre ? 'selected' : ''}>${esc(z.nombre)}</option>`).join('')}
          </select></div>
        <div><label class="et" for="tqFecha">Fecha y hora</label>
          <input class="campo" type="datetime-local" id="tqFecha" value="${x.fecha || ''}"></div>
      </div>
      <button class="btn pri sm" data-encuentro="${x.id}">Guardar encuentro</button>
    </div>
    <div class="tarjeta">
      <h3>✅ Confirmación de entrega</h3>
      <p class="nota">El trueque se cierra cuando los dos confirman.</p>
      <div class="checklist">
        <label><input type="checkbox" id="tqCheck" ${miCheck ? 'checked' : ''}> Ya entregué y recibí mi parte</label>
      </div>
      <p class="nota">${esc(otro.nombre)}: ${suCheck ? '✅ ya confirmó' : '⏳ todavía no confirma'}</p>
      <button class="btn pri sm" data-confirmar-tq="${x.id}">Guardar mi confirmación</button>
    </div>
    <div class="tarjeta">
      <h3>🛡️ Trueque Seguro ${x.seguro ? '<span class="eti verde">activo</span>' : ''}</h3>
      ${x.seguro
        ? `<p class="nota">El administrador está acompañando este trueque. Háganlo en una zona
             segura y confirmen los dos para que quede verificado.</p>`
        : `<p class="nota">Por S/ ${Number(BD.config.precioSeguro).toFixed(2)} revisamos a la otra
             persona y sus fotos, exigimos zona segura y damos el visto bueno al final.</p>
           <button class="btn mora sm" data-seguro="${x.id}">🛡️ Contratar Trueque Seguro</button>`}
      ${cajaConfianza(otro, pido)}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn sec sm" data-analizar="${x.id}">📈 ¿Es un buen trueque?</button>
      <button class="btn sec sm" data-chat-usuario="${otro.id}|${x.pido}">💬 Abrir chat</button>
      <button class="btn rojo sm" data-cancelar-tq="${x.id}">Cancelar trueque</button>
    </div>`;
  abrir('mTrueque');
}
function confirmarTrueque(id) {
  const x = BD.intercambios.find(i => i.id == id), u = yo();
  const soyDe = x.de === u.id;
  const val = $('#tqCheck').checked;
  if (soyDe) x.checkA = val; else x.checkB = val;

  if (x.checkA && x.checkB) {
    x.estado = 'completado'; x.completado = new Date().toISOString();
    [x.pido, x.ofrezco].filter(Boolean).forEach(id2 => {
      const a = BD.articulos.find(t => t.id === id2); if (a) a.estado = 'intercambiado';
    });
    [x.de, x.para].forEach(uid => {
      const us = usuario(uid); if (us) { us.puntos = (us.puntos || 0) + 20; }
      notificar(uid, '¡Trueque completado!', 'Ya puedes calificar a la otra persona.');
    });
    guardar();
    cerrar('mTrueque');
    $('#calId').value = x.id;
    $('#calSub').textContent = `¿Cómo te fue con ${usuario(soyDe ? x.para : x.de).nombre}?`;
    App.puntaje = 0; pintarEstrellas(0);
    abrir('mCalificar');
    avisar('¡Trueque completado!', 'ok');
  } else {
    guardar();
    notificar(soyDe ? x.para : x.de, 'Avance en el trueque', `${u.nombre} confirmó su parte.`);
    avisar('Confirmación guardada. Falta la otra parte.', 'ok');
    verTrueque(id);
  }
  pintarCuenta(); pintarLista(); pintarNav();
}
function pintarEstrellas(v) {
  $$('#estEleg button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) <= v));
}

/* ---------------- chat ---------------- */
/* Análisis de una propuesta que me llegó, antes de aceptarla */
function analizarPropuesta(trqId) {
  const u = yo(), x = BD.intercambios.find(i => i.id == trqId);
  if (!x || !u) return;
  const soyDe = x.de === u.id;
  const pido = BD.articulos.find(a => a.id === x.pido);
  const ofr = x.ofrezco ? BD.articulos.find(a => a.id === x.ofrezco) : null;
  /* si soy el dueño, yo entrego lo que me piden y recibo lo que ofrecen */
  const doy = soyDe ? ofr : pido;
  const recibo = soyDe ? pido : ofr;
  const otro = usuario(soyDe ? x.para : x.de);
  $('#analisisCuerpo').innerHTML = `
    <h2>📈 ¿Estoy haciendo un buen trueque?</h2>
    <p class="sub">Con ${esc(otro ? otro.nombre : '—')}</p>
    ${tarjetaAnalisis(analizarTrueque(doy, recibo), doy, recibo, !!u.premium)}
    ${cajaConfianza(otro, soyDe ? pido : ofr)}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
      ${x.estado === 'pendiente' && !soyDe ? `
        <button class="btn verde" data-resp="${x.id}|aceptar">✓ Aceptar igual</button>
        <button class="btn rojo" data-resp="${x.id}|rechazar">✕ Rechazar</button>` : ''}
      <button class="btn sec" data-chat-usuario="${otro ? otro.id : 0}|${x.pido}">💬 Negociar por chat</button>
    </div>`;
  cerrarTodo(); abrir('mAnalisis');
}

function abrirChatCon(otroId, artId) {
  const u = yo();
  if (!u) { abrirAuth('login'); return; }
  if (otroId === u.id) return avisar('Ese artículo es tuyo');
  const art = BD.articulos.find(a => a.id == artId);
  if (art && art.usuario !== u.id && !puedeInteractuar(art)) return;
  let c = BD.chats.find(x => x.usuarios.includes(u.id) && x.usuarios.includes(otroId) && x.articulo === artId);
  if (!c) {
    c = { id: nuevoId(), usuarios: [u.id, otroId], articulo: artId, creado: new Date().toISOString() };
    BD.chats.push(c); guardar();
  }
  App.chat = c.id;
  pintarChat();
  cerrarTodo();
  abrir('mChat');
}
function pintarChat() {
  const u = yo(), c = BD.chats.find(x => x.id === App.chat);
  if (!c) return;
  const otro = usuario(c.usuarios.find(i => i !== u.id));
  const art = BD.articulos.find(a => a.id === c.articulo);
  const pro = !!(u && u.premium);

  BD.mensajes.filter(m => m.chat === c.id && m.de !== u.id).forEach(m => m.leido = true);
  guardar();

  const km = pro && u.lat && otro.lat ? distanciaTxt(distanciaKm(u.lat, u.lon, otro.lat, otro.lon)) : '';
  $('#chatCab').innerHTML = `${avatarHTML(otro, 'av-g')}
    <div style="flex:1"><b>${esc(otro.nombre)} ${otro.premium ? '💜' : ''}
      ${pro ? '<span class="eti mora">CHAT PREMIUM</span>' : ''}</b>
      <small style="color:var(--sub)">${art ? esc(art.titulo) : 'Conversación'} · 📍 ${esc(otro.ciudad)}${km ? ' · ' + km : ''}</small></div>
    ${otro.telefono ? `<a class="wa" target="_blank" rel="noopener"
      href="${esc(linkWA(otro.telefono, `Hola ${otro.nombre}, te escribo por Truequea PE${art ? ' sobre "' + art.titulo + '"' : ''}.`))}">💬</a>` : ''}`;

  /* barra Premium: frases rápidas y buscador dentro de la conversación */
  $('#chatPro').hidden = !pro;
  $('#chatClip').hidden = !pro;
  if (pro && !$('#chatFrases').dataset.listo) {
    $('#chatFrases').innerHTML = FRASES_PRO.map(f =>
      `<button type="button" data-frase="${esc(f)}">${esc(f)}</button>`).join('');
    $('#chatFrases').dataset.listo = '1';
  }

  const q = pro ? ($('#chatBuscar').value || '').trim().toLowerCase() : '';
  let msgs = BD.mensajes.filter(m => m.chat === c.id);
  if (q) msgs = msgs.filter(m => (m.texto || '').toLowerCase().includes(q));

  const resaltar = t => {
    const s = esc(t);
    if (!q) return s;
    return s.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
  };

  const cuerpo = $('#chatCuerpo');
  cuerpo.innerHTML = msgs.length
    ? msgs.map(m => `<div class="burb ${m.de === u.id ? 'mia' : 'suya'}">
        ${m.texto ? resaltar(m.texto) : ''}
        ${m.foto ? `<img src="${m.foto}" alt="Foto enviada" data-verfoto="${m.id}">` : ''}
        <time>${fechaTxt(m.creado)}${m.de === u.id ? (m.leido ? ' ✓✓' : ' ✓') : ''}</time></div>`).join('')
    : `<p style="margin:auto;text-align:center;color:var(--sub);font-size:14px">
        ${q ? 'No hay mensajes con esa palabra.' : 'Todavía no hay mensajes.<br>Escribe para empezar el trueque 👇'}</p>`;
  if (!q) cuerpo.scrollTop = cuerpo.scrollHeight;
  pintarNav();
}

/* Enviar mensaje (texto o foto en el chat Premium) */
function enviarMensaje(texto, foto) {
  const u = yo();
  if (!u || !App.chat) return;
  if (!texto && !foto) return;
  BD.mensajes.push({ id: nuevoId(), chat: App.chat, de: u.id, texto: texto || '',
                     foto: foto || null, leido: false, creado: new Date().toISOString() });
  const c = BD.chats.find(x => x.id === App.chat);
  const otroId = c.usuarios.find(i => i !== u.id);
  const otro = usuario(otroId);
  const art = BD.articulos.find(a => a.id === c.articulo);
  /* si el otro es Premium, el aviso incluye el enlace de WhatsApp listo */
  if (otro && otro.premium && otro.avisos !== false)
    avisarConWA(otroId, '💬 Nuevo mensaje de ' + u.nombre, (texto || '📷 Te envió una foto').slice(0, 90),
      u.telefono, `Hola ${u.nombre}, te respondo por lo de Truequea PE${art ? ' ("' + art.titulo + '")' : ''}.`);
  else
    notificar(otroId, 'Nuevo mensaje de ' + u.nombre, (texto || '📷 Te envió una foto').slice(0, 90));
  guardar();
  pintarChat();
}
function listaChats() {
  const u = yo();
  if (!u) { abrirAuth('login'); return; }
  const mios = BD.chats.filter(c => c.usuarios.includes(u.id));
  $('#listaChats').innerHTML = mios.length ? mios.map(c => {
    const otro = usuario(c.usuarios.find(i => i !== u.id));
    const art = BD.articulos.find(a => a.id === c.articulo);
    const ms = BD.mensajes.filter(m => m.chat === c.id);
    const ultimo = ms[ms.length - 1];
    const sinLeer = ms.filter(m => m.de !== u.id && !m.leido).length;
    return `<div class="fila" data-abrirchat="${c.id}">
      <img src="${art ? foto(art) : SIN_FOTO}" alt="">
      <div class="fila-info"><b>${esc(otro.nombre)}</b>
        <span>${esc(art ? art.titulo : 'Artículo eliminado')}</span>
        <span>${ultimo ? esc(ultimo.texto) : 'Sin mensajes'}</span></div>
      <div style="text-align:right">${sinLeer ? `<span class="mini-glob">${sinLeer}</span>` : ''}
        <div style="font-size:12px;color:var(--sub);margin-top:4px">${ultimo ? relativo(ultimo.creado) : ''}</div></div>
    </div>`;
  }).join('') : `<div class="vacio"><div class="em">💬</div><p>No tienes conversaciones.<br>Abre un artículo y pulsa "Enviar mensaje".</p></div>`;
  abrir('mMensajes');
}

/* ---------------- premium ---------------- */
function pintarPremium() {
  const c = BD.config, u = yo();
  $('#yapeQr').innerHTML = c.yapeQr
    ? `<img class="yape-qr" src="${c.yapeQr}" alt="QR de Yape">`
    : `<div class="yape-vacio">El administrador todavía no subió el QR de Yape.<br><br>
        Puedes yapear al número indicado.</div>`;
  $('#yapeNombre').textContent = c.yapeNombre || 'Angel Levano';
  $('#yapeTel').textContent = c.yapeNumero ? '· ' + c.yapeNumero : '';
  $$('.pro-precio').forEach(e => e.innerHTML = `S/ ${precioProF()} <small>/ mes</small>`);
  if (typeof pintarTendencias === 'function') pintarTendencias();
  $('#pagoMonto').textContent = precioProF();
  if ($('#precioYape')) $('#precioYape').textContent = precioProF();
  $$('[data-precio-pro]').forEach(e => e.textContent = precioPro());

  const caja = $('#estadoPago');
  $('#panelPro').hidden = !(u && u.premium);
  if (u && u.premium) pintarPanelPro();

  if (!u) { caja.innerHTML = '<div class="aviso">Entra a tu cuenta para comprar Premium.</div>'; return; }
  if (u.premium) {
    caja.innerHTML = `<div class="exito-c">💜 <b>Ya eres Premium.</b>
      ${u.premiumHasta ? 'Vence el ' + fechaTxt(u.premiumHasta) : ''}</div>`;
    return;
  }
  const pago = BD.pagos.find(p => p.usuario === u.id && p.estado === 'pendiente');
  caja.innerHTML = pago
    ? `<div class="aviso mora">⏳ Tu comprobante está en revisión. Te avisamos apenas se apruebe.</div>`
    : '';
}
/* Panel exclusivo del usuario Premium: mapa, cercanía, reservas y avisos */
function pintarPanelPro() {
  const u = yo();
  if (!u || !u.premium) return;
  liberarReservas();
  pintarMapaPro();

  /* lo más cerca de ti */
  const cerca = articulosPro().slice(0, 8);
  $('#cercaPro').innerHTML = cerca.length ? cerca.map(a => {
    const d = usuario(a.usuario);
    return `<div class="pro-fila">
      <img src="${foto(a)}" alt="" data-art="${a.id}" style="cursor:pointer">
      <div class="info"><b>${esc(a.titulo)}</b>
        <span>📍 ${esc(a.ciudad)} · ${esc(d ? d.nombre : '—')} · 🕓 ${relativo(a.creado)}</span></div>
      <span class="dist">${a.km !== null ? distanciaTxt(a.km) : 'sin ubicación'}</span>
      <button class="btn-t" data-art="${a.id}">Ver</button>
    </div>`;
  }).join('') : `<p class="nota">${u.lat ? 'No hay publicaciones dentro de ese radio.'
      : 'Marca tu ubicación en Mi cuenta → Perfil para ordenar por cercanía.'}</p>`;

  /* mis reservas */
  const mias = BD.articulos.filter(a => reservaActiva(a) && a.reserva.por === u.id);
  $('#reservasPro').innerHTML = mias.length ? mias.map(a => `
    <div class="pro-fila">
      <img src="${foto(a)}" alt="">
      <div class="info"><b>${esc(a.titulo)}</b>
        <span>🔒 Vence en ${restanteTxt(a.reserva.hasta)} · ${fechaTxt(a.reserva.hasta)}</span></div>
      <button class="btn-t" data-art="${a.id}">Ver</button>
      <button class="btn-t rojo" data-soltar="${a.id}">Liberar</button>
    </div>`).join('') : `<p class="nota">No tienes nada apartado. Entra a una publicación y toca
      “🔒 Reservar”.</p>`;

  /* lo que sigo */
  const sigo = BD.favoritos.filter(f => f.usuario === u.id)
    .map(f => BD.articulos.find(a => a.id === f.articulo)).filter(Boolean);
  $('#seguidosPro').innerHTML = sigo.length ? `
    <p class="nota">Te avisamos apenas cambie algo en lo que sigues:</p>
    ${sigo.map(a => `<div class="pro-fila">
      <img src="${foto(a)}" alt="">
      <div class="info"><b>${esc(a.titulo)}</b>
        <span>${reservaActiva(a) ? '🔒 apartado' : a.estado === 'intercambiado' ? '✓ ya se intercambió' : '✔ disponible'}
          · 📍 ${esc(a.ciudad)}</span></div>
      <button class="btn-t" data-art="${a.id}">Ver</button>
    </div>`).join('')}` : `<p class="nota">Toca “🔥 Me interesa” o el corazón de una publicación
      y aquí verás su estado.</p>`;

  pintarDeseos();
  if (typeof mapaRealPro === 'function') mapaRealPro();
  if (typeof pintarPlusPro === 'function') pintarPlusPro();

  const chk = $('#proAvisos');
  if (chk) chk.checked = u.avisos !== false;
}

async function enviarPago() {
  const u = yo();
  if (!u) { abrirAuth('login'); return; }
  if (!App.fotoPago) return avisar('Sube la captura del Yape', 'err');

  const tipo = App.pagoTipo || 'premium';
  const datos = App.pagoDatos || {};
  const monto = tipo === 'premium' ? Number(BD.config.precioPremium) : Number(datos.monto || 1);
  const nombre = { premium:'Premium', impulso:'Impulso de publicación',
                   seguro:'Trueque Seguro' }[tipo] || tipo;

  const pago = {
    id: nuevoId(), usuario: u.id, monto, tipo,
    articulo: datos.articulo || null, horas: datos.horas || null,
    intercambio: datos.intercambio || null,
    captura: App.fotoPago, nota: $('#pagoNota').value.trim(),
    estado: 'pendiente', creado: new Date().toISOString(), auto: false,
  };
  BD.pagos.unshift(pago);
  guardar();

  /* ---- lectura automática de la captura de Yape ---- */
  let aprobadoSolo = false;
  if (BD.config.autoYape !== false) {
    const btn = $('#formPago button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = '🔎 Leyendo tu comprobante...'; }
    estadoLectura('<b>🔎 Leyendo la captura...</b><span>Esto demora unos segundos la primera vez.</span>', 'cargando');

    const r = await revisarComprobante(pago.captura, monto);

    if (r && r.disponible) {
      pago.ocr = { monto: r.monto, codigo: r.codigo, motivos: r.motivos, texto: r.texto };
      if (r.ok) {
        BD.config.yapeCodigos = [...(BD.config.yapeCodigos || []), r.codigo].slice(-500);
        guardar();
        estadoLectura(`<b>✅ Pago verificado automáticamente</b>
          <span>Leímos S/ ${Number(r.monto).toFixed(2)} a ${esc(BD.config.yapeNombre)} ·
          operación ${esc(r.codigo)}</span>`, 'ok');
        pago.auto = true;
        resolverPago(pago.id, true);
        aprobadoSolo = true;
      } else {
        estadoLectura(`<b>🟡 No pudimos confirmarlo solos</b>
          <span>${r.motivos.map(esc).join(' ')} El administrador lo revisará a mano.</span>`, 'medio');
      }
    } else {
      estadoLectura('<b>📨 Comprobante enviado</b><span>El administrador lo revisará a mano.</span>', 'medio');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar comprobante'; }
  }

  if (!aprobadoSolo) {
    BD.usuarios.filter(x => x.rol === 'admin').forEach(a =>
      notificar(a.id, `Nuevo comprobante · ${nombre}`,
        `${u.nombre} envió un pago de S/ ${monto.toFixed(2)}.`));
    guardar();
    avisar('Comprobante enviado. El administrador lo revisará.', 'ok');
  }

  App.fotoPago = null; App.pagoDatos = null; App.pagoTipo = 'premium';
  $('#formPago').reset();
  $('#zonaPago').textContent = '📸 Clic para subir la captura del Yape';
  setTimeout(() => { cerrar('mPago'); const c = $('#lecturaYape'); if (c) c.hidden = true; },
             aprobadoSolo ? 2400 : 3600);
  pintarPremium(); pintarCuenta();
}

function resolverPago(id, aprobar) {
  const p = BD.pagos.find(x => x.id == id);
  if (!p) return;
  const u = usuario(p.usuario);
  const tipo = p.tipo || 'premium';
  p.estado = aprobar ? 'aprobado' : 'rechazado';
  p.resuelto = new Date().toISOString();

  if (aprobar && u && tipo === 'premium') {
    const hasta = new Date(); hasta.setMonth(hasta.getMonth() + 1);
    u.premium = true; u.premiumHasta = hasta.toISOString();
    BD.articulos.filter(a => a.usuario === u.id).forEach(a => a.destacado = true);
    u.impulsosGratis = 3; u.proMes = new Date().toISOString().slice(0, 7);
    u.verificado = true;
    notificar(u.id, '👑 ¡Premium activado!',
      (p.auto ? 'Tu Yape se verificó solo. ' : '') +
      'Ya puedes apartar publicaciones, entrar a la vitrina VIP, pedir con “Quiero esto”, ver quién está interesado y tienes 3 impulsos gratis este mes.');
  } else if (aprobar && tipo === 'impulso') {
    const a = BD.articulos.find(x => x.id === p.articulo);
    if (a) {
      a.impulso = { desde: new Date().toISOString(),
                    hasta: new Date(Date.now() + (p.horas || 24) * 3600000).toISOString(),
                    pago: p.id };
      notificar(p.usuario, '🚀 ¡Publicación impulsada!',
        `"${a.titulo}" aparece entre los primeros por ${p.horas || 24} horas.`);
    }
  } else if (aprobar && tipo === 'seguro') {
    const x = BD.intercambios.find(i => i.id === p.intercambio);
    if (x) {
      x.seguro = { pago: p.id, estado: 'activo', desde: new Date().toISOString() };
      BD.seguros.unshift({ id: nuevoId(), intercambio: x.id, pago: p.id,
        solicitante: p.usuario, estado: 'activo', creado: new Date().toISOString() });
      [x.de, x.para].forEach(uid => notificar(uid, '🛡️ Trueque Seguro activado',
        'El administrador acompaña este trueque. Encuéntrense en una zona segura y confirmen los dos.'));
    }
  } else if (u) {
    notificar(u.id, 'Comprobante rechazado', 'No pudimos validar tu pago. Súbelo otra vez o escríbenos.');
  }
  guardar();
  avisar(aprobar ? (p.auto ? '👑 ¡Premium activado automáticamente!' : 'Pago aprobado ✔')
                 : 'Comprobante rechazado', aprobar ? 'ok' : '');
  aplicarPlan();
  pintarAdmin(); pintarLista(); pintarCuenta();
}

/* =====================================================================
   PUBLICIDAD: solicitud del negocio y aprobación del administrador
   ===================================================================== */
function enviarSolicitud() {
  const negocio = $('#solNegocio').value.trim();
  const quien   = $('#solNombre').value.trim();
  const tel     = $('#solTel').value.trim();
  const desc    = $('#solDesc').value.trim();
  if (!negocio || !quien || !tel || !desc) return avisar('Completa los datos del anuncio', 'err');

  BD.anuncios.unshift({
    id: nuevoId(), titulo: negocio, desc, empresa: 'Solicitud de ' + quien,
    img: App.fotoSolicitud || null, tel, wa: linkWA(tel, `Hola, te escribo desde Truequea PE.`),
    web: $('#solWeb').value.trim(), destacado: false, activo: true,
    estado: 'pendiente', solicitante: quien, vistas: 0, clics: 0,
    creado: new Date().toISOString(),
  });
  guardar();

  BD.usuarios.filter(x => x.rol === 'admin').forEach(a =>
    avisarConWA(a.id, '📣 Nueva solicitud de publicidad',
      `${quien} quiere publicar el anuncio de "${negocio}".`, tel,
      `Hola ${quien}, recibí tu solicitud de anuncio para "${negocio}" en Truequea PE.`));

  App.fotoSolicitud = null;
  $('#formSolicitud').reset();
  $('#zonaSol').textContent = '🖼️ Sube la imagen o el logo de tu negocio';
  cerrar('mAnunciate');
  avisar('¡Solicitud enviada! El administrador la revisará.', 'ok');
  pintarAdmin();
}

/* El administrador aprueba o rechaza una publicidad */
function resolverAnuncio(id, aprobar) {
  const a = BD.anuncios.find(x => x.id == id);
  if (!a) return;
  a.estado = aprobar ? 'aprobado' : 'rechazado';
  a.activo = !!aprobar;
  a.resuelto = new Date().toISOString();
  guardar();
  avisar(aprobar ? 'Publicidad aprobada y publicada ✔' : 'Publicidad rechazada', aprobar ? 'ok' : '');
  pintarAdmin(); pintarLista();
}
