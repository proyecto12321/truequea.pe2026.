/* ===================================================================
   TRUEQUEA PE · Quiero esto, VIP, ranking, análisis y confianza
   Archivo: js/06-funciones.js
   =================================================================== */

/* =====================================================================
   MÓDULOS NUEVOS
   · "Quiero esto"  · Trueques VIP  · Top truequeadores
   · Análisis del trueque  · Impulsar publicación  · Trueque Seguro
   · Confianza y revisión de fotos  · Ver interesados
   ===================================================================== */

/* ---------------------------------------------------------------------
   1) VALOR DE REFERENCIA Y ANÁLISIS DEL TRUEQUE
   Ojo: esto NO es un precio de venta. Es una referencia interna que
   sirve solo para avisarte si el cambio se ve parejo o no.
   --------------------------------------------------------------------- */
function valorRef(a) {
  if (!a) return 0;
  const rango = a.vip && REF_VIP[a.vip] ? REF_VIP[a.vip] : (REFERENCIA[a.categoria] || [30, 200]);
  const medio = (rango[0] + rango[1]) / 2;
  const cond = PESO_CONDICION[a.condicion] ?? .6;
  /* lo que mucha gente mira sube un poco la referencia */
  const tiron = Math.min((a.vistas || 0) / 400 + (a.favs || 0) / 30, .25);
  return Math.round(medio * cond * (1 + tiron));
}
function demandaDe(a) {
  if (!a) return 0;
  const buscanCat = BD.articulos.filter(x => x.id !== a.id &&
    (x.busca || '').toLowerCase().includes(CATEGORIAS[a.categoria - 1][0].toLowerCase().slice(0, 5))).length;
  const deseos = BD.deseos.filter(d => d.activo && coincideDeseo(d, a)).length;
  const favs = a.favs || 0;
  return buscanCat * 2 + deseos * 4 + favs;
}
function nivelTexto(n) {
  return n >= 70 ? 'Alta' : n >= 40 ? 'Media' : n >= 15 ? 'Baja' : 'Muy baja';
}
function popularidadDe(a) {
  const todos = BD.articulos.map(x => (x.vistas || 0) + (x.favs || 0) * 5);
  const prom = todos.reduce((s, v) => s + v, 0) / Math.max(todos.length, 1) || 1;
  const mio = (a.vistas || 0) + (a.favs || 0) * 5;
  return Math.min(Math.round(mio / prom * 50), 100);
}
function facilidadDe(a) {
  /* qué tan fácil es volver a cambiarlo: cuánta gente busca esa categoría */
  const cat = CATEGORIAS[a.categoria - 1][0].toLowerCase();
  const buscan = BD.articulos.filter(x => (x.busca || '').toLowerCase().includes(cat.slice(0, 5))).length;
  const deseos = BD.deseos.filter(d => d.activo && d.categoria === a.categoria).length;
  return Math.min(Math.round((buscan * 12 + deseos * 20 + (a.vip ? 25 : 0)) ), 100);
}

/* Compara lo que entregas contra lo que recibes */
function analizarTrueque(doy, recibo) {
  const vDoy = valorRef(doy), vRec = valorRef(recibo);
  const ratio = vDoy > 0 ? vRec / vDoy : 1;
  let nivel, titulo, consejo;
  if (!doy) {
    nivel = 'amarillo'; titulo = 'Sin artículo de por medio';
    consejo = 'Estás enviando solo un mensaje. Si quieres que te tomen en serio, ofrece algo tuyo.';
  } else if (ratio >= 1.15) {
    nivel = 'verde'; titulo = 'Buen intercambio para ti';
    consejo = 'Recibes algo con más referencia que lo que entregas. Revisa bien el estado real antes de cerrar.';
  } else if (ratio >= .85) {
    nivel = 'amarillo'; titulo = 'Intercambio equilibrado';
    consejo = 'Los dos lados se parecen. Es un cambio justo si el artículo está como lo describen.';
  } else {
    nivel = 'rojo'; titulo = 'Te conviene negociar';
    consejo = 'Estás entregando algo con más referencia. Pide que agreguen algo o busca otra opción.';
  }
  return {
    nivel, titulo, consejo, ratio,
    vDoy, vRec,
    demanda: demandaDe(recibo), popularidad: popularidadDe(recibo), facilidad: facilidadDe(recibo),
    demandaMia: doy ? demandaDe(doy) : 0,
  };
}

/* ---------------------------------------------------------------------
   2) CONFIANZA Y REVISIÓN DE FOTOS
   --------------------------------------------------------------------- */
function huella(txt) {
  let h = 0;
  const s = String(txt || '');
  for (let i = 0; i < s.length; i += 7) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h + '_' + s.length;
}
/* Revisión automática básica de las fotos de una publicación */
function revisarFotos(a) {
  const alertas = [];
  if (!a.fotos || !a.fotos.length) {
    alertas.push('La publicación no tiene fotos propias.');
    return { ok: false, alertas, repetida: false };
  }
  let repetida = false;
  a.fotos.forEach(f => {
    const h = huella(f);
    /* la misma imagen usada por OTRA cuenta = sospechoso (foto sacada de internet) */
    const otra = BD.articulos.find(x => x.id !== a.id && x.usuario !== a.usuario &&
      (x.fotos || []).some(g => huella(g) === h));
    if (otra) repetida = true;
    if (String(f).length < 2600) alertas.push('Una foto es demasiado pequeña o borrosa.');
  });
  if (repetida) alertas.push('Una foto ya está publicada por otra cuenta: puede no ser real.');
  return { ok: !alertas.length, alertas, repetida };
}

/* Nivel de confianza de una persona (0 a 100) */
function confianza(u) {
  if (!u) return { puntos: 0, nivel: 'rojo', etiqueta: 'Desconocido', senales: [] };
  const r = reputacion(u.id), tq = truequesDe(u.id);
  const dias = Math.floor((Date.now() - new Date(u.creado)) / 86400000);
  const misArts = BD.articulos.filter(a => a.usuario === u.id);
  const sinFoto = misArts.filter(a => !a.fotos || !a.fotos.length).length;
  const fotosMalas = misArts.some(a => revisarFotos(a).repetida);

  let p = 30;
  const buenas = [], malas = [];
  if (u.verificado) { p += 12; buenas.push('Cuenta verificada con Google'); }
  if (u.telefono)   { p += 10; buenas.push('Tiene teléfono registrado'); }
  else malas.push('No registró teléfono');
  if (tq >= 10) { p += 20; buenas.push(`${tq} trueques completados`); }
  else if (tq >= 3) { p += 12; buenas.push(`${tq} trueques completados`); }
  else if (tq === 0) malas.push('Todavía no completó ningún trueque');
  if (r.total >= 3 && r.prom >= 4.5) { p += 18; buenas.push(`${r.prom.toFixed(1)} estrellas en ${r.total} reseñas`); }
  else if (r.total && r.prom <= 3)   { p -= 25; malas.push(`Solo ${r.prom.toFixed(1)} estrellas: ten cuidado`); }
  else if (!r.total) malas.push('Nadie lo ha calificado todavía');
  if (dias >= 60) { p += 10; buenas.push('Cuenta con más de 2 meses'); }
  else if (dias <= 3) { p -= 10; malas.push('Cuenta creada hace muy poco'); }
  if (u.premium) { p += 6; buenas.push('Cuenta Premium (pagó y fue verificada)'); }
  if (sinFoto)   { p -= 6; malas.push(`${sinFoto} publicación(es) sin fotos propias`); }
  if (fotosMalas){ p -= 22; malas.push('Usa fotos que ya están en otra cuenta'); }

  p = Math.max(0, Math.min(100, p));
  const nivel = p >= 70 ? 'verde' : p >= 45 ? 'amarillo' : 'rojo';
  const etiqueta = p >= 70 ? 'Confiable' : p >= 45 ? 'Normal — revisa bien' : 'Ten cuidado';
  return { puntos: p, nivel, etiqueta, buenas, malas, senales: [...buenas, ...malas] };
}

function cajaConfianza(u, art) {
  const c = confianza(u);
  const f = art ? revisarFotos(art) : null;
  const emo = { verde:'🟢', amarillo:'🟡', rojo:'🔴' }[c.nivel];
  return `<div class="confianza ${c.nivel}">
    <div class="conf-cab">
      <b>${emo} Nivel de confianza: ${esc(c.etiqueta)}</b>
      <span class="conf-num">${c.puntos}/100</span>
    </div>
    <div class="conf-barra"><i style="width:${c.puntos}%"></i></div>
    <ul class="conf-lista">
      ${(c.buenas || []).map(s => `<li class="si">✔ ${esc(s)}</li>`).join('')}
      ${(c.malas || []).map(s => `<li class="no">⚠ ${esc(s)}</li>`).join('')}
      ${f ? (f.ok ? '<li class="si">✔ Fotos revisadas: se ven propias</li>'
                  : f.alertas.map(t => `<li class="no">⚠ ${esc(t)}</li>`).join('')) : ''}
    </ul>
    <p class="conf-pie">Revisión automática. Encuéntrense siempre en una zona segura y revisen
      el artículo antes de entregar.</p>
  </div>`;
}

/* ---------------------------------------------------------------------
   3) "QUIERO ESTO" — pedidos de los Premium con aviso automático
   --------------------------------------------------------------------- */
function coincideDeseo(d, art) {
  if (!d.activo) return false;
  if (d.vip && art.vip === d.vip) return true;
  const texto = `${art.titulo} ${art.desc || ''} ${art.busca || ''}`.toLowerCase();
  const claves = `${d.titulo} ${d.palabras || ''}`.toLowerCase()
    .split(/[\s,;]+/).filter(p => p.length >= 3);
  const acierto = claves.some(p => texto.includes(p));
  if (!acierto) return false;
  if (d.categoria && art.categoria !== d.categoria) return claves.some(p => art.titulo.toLowerCase().includes(p));
  return true;
}

/* Cuando alguien publica algo, avisa a los Premium que lo estaban pidiendo */
function avisarDeseos(art) {
  const dueno = usuario(art.usuario);
  let avisados = 0;
  BD.deseos.filter(d => d.activo && d.usuario !== art.usuario && coincideDeseo(d, art)).forEach(d => {
    const p = usuario(d.usuario);
    if (!p || !p.premium) return;
    if ((d.avisados || []).includes(art.id)) return;
    d.avisados = [...(d.avisados || []), art.id];
    avisarConWA(p.id, '🎯 ¡Apareció lo que querías!',
      `Alguien publicó "${art.titulo}" y coincide con tu pedido “${d.titulo}”. Tú ofreces: ${d.ofrezco}` +
      `${d.adicional ? ' + S/ ' + d.adicional : ''}.`,
      dueno ? dueno.telefono : null,
      `Hola ${dueno ? dueno.nombre : ''}, vi tu "${art.titulo}" en Truequea PE. ` +
      `Te ofrezco ${d.ofrezco}${d.adicional ? ' + S/ ' + d.adicional : ''}.`);
    avisados++;
  });
  if (avisados) guardar();
  return avisados;
}

function guardarDeseo() {
  const u = yo();
  if (!u) { abrirAuth('login'); return; }
  if (!u.premium) { cerrarTodo(); return irA('premium'); }
  const titulo = $('#deTitulo').value.trim();
  const ofrezco = $('#deOfrezco').value.trim();
  if (titulo.length < 3)  return avisar('Escribe qué quieres conseguir', 'err');
  if (ofrezco.length < 3) return avisar('Escribe qué entregas a cambio', 'err');

  const id = $('#deId').value;
  const datos = {
    titulo, palabras: $('#dePalabras').value.trim(),
    categoria: Number($('#deCat').value) || null,
    vip: $('#deVip').value || null,
    ofrezco, adicional: Number($('#deAdicional').value) || 0,
    activo: true,
  };
  if (id) {
    Object.assign(BD.deseos.find(d => d.id == id), datos);
    avisar('Pedido actualizado', 'ok');
  } else {
    BD.deseos.unshift({ id: nuevoId(), usuario: u.id, ...datos, avisados: [],
                        creado: new Date().toISOString() });
    avisar('Pedido guardado. Te avisamos apenas alguien lo publique 🎯', 'ok');
  }
  guardar();
  cerrar('mDeseo'); $('#formDeseo').reset(); $('#deId').value = '';

  /* si ya existe algo publicado que coincide, avisar de una vez */
  const yaHay = BD.articulos.filter(a => a.estado === 'disponible' && a.usuario !== u.id &&
    coincideDeseo(BD.deseos.find(d => d.usuario === u.id && d.titulo === titulo) || {}, a));
  if (yaHay.length) avisar(`Ya hay ${yaHay.length} publicación(es) que coinciden 👀`, 'ok');
  pintarDeseos(); pintarPanelPro();
}

function pintarDeseos() {
  const u = yo();
  const caja = $('#listaDeseos');
  if (!caja || !u) return;
  const mios = BD.deseos.filter(d => d.usuario === u.id);
  caja.innerHTML = mios.length ? mios.map(d => {
    const coinciden = BD.articulos.filter(a => a.estado === 'disponible' && a.usuario !== u.id && coincideDeseo(d, a));
    return `<div class="deseo ${d.activo ? '' : 'apagado'}">
      <div class="deseo-cab">
        <b>❤️ LO QUIERO: ${esc(d.titulo)}</b>
        ${d.vip ? `<span class="eti mora">💎 ${esc(d.vip)}</span>` : ''}
        <span class="eti ${d.activo ? 'verde' : 'gris'}">${d.activo ? 'Buscando' : 'Pausado'}</span>
      </div>
      <p class="deseo-of">Ofrezco: <b>${esc(d.ofrezco)}</b>${d.adicional ? ` <span class="eti oro">+ S/ ${d.adicional}</span>` : ''}</p>
      ${coinciden.length
        ? `<p class="deseo-hit">🔥 ${coinciden.length} publicación(es) coinciden ahora mismo:</p>
           <div class="deseo-hits">${coinciden.slice(0, 4).map(a => `
             <button class="hit" data-art="${a.id}"><img src="${foto(a)}" alt="">
               <span>${esc(a.titulo)}</span></button>`).join('')}</div>`
        : `<p class="nota">Todavía nadie publica algo así. Te avisamos apenas pase.</p>`}
      <div class="deseo-acc">
        <button class="btn-t" data-deseoedit="${d.id}">Editar</button>
        <button class="btn-t" data-deseopausa="${d.id}">${d.activo ? 'Pausar' : 'Reactivar'}</button>
        <button class="btn-t rojo" data-deseoborrar="${d.id}">Eliminar</button>
      </div></div>`;
  }).join('') : `<p class="nota">Todavía no pediste nada. Toca “❤️ Quiero esto” y dinos qué buscas
      y qué entregas a cambio: el sistema te avisa solo cuando aparezca.</p>`;
}

function abrirDeseo(id) {
  const u = yo();
  if (!u) { abrirAuth('login'); return avisar('Entra a tu cuenta'); }
  if (!u.premium) {
    cerrarTodo();
    return confirmar('“Quiero esto” es Premium',
      `Con Premium (S/ ${precioPro()} al mes) dices qué buscas y qué entregas, y el sistema te avisa solo cuando alguien lo publique.`,
      () => irA('premium'), 'Ver Premium');
  }
  $('#formDeseo').reset();
  $('#deCat').innerHTML = '<option value="">Cualquier categoría</option>' +
    CATEGORIAS.map((c, i) => `<option value="${i + 1}">${c[1]} ${c[0]}</option>`).join('');
  $('#deVip').innerHTML = '<option value="">No es VIP</option>' +
    CATEGORIAS_VIP.map(c => `<option value="${c[0]}">${c[1]} ${c[0]}</option>`).join('');
  const d = id ? BD.deseos.find(x => x.id == id) : null;
  $('#deId').value = d ? d.id : '';
  if (d) {
    $('#deTitulo').value = d.titulo; $('#dePalabras').value = d.palabras || '';
    $('#deCat').value = d.categoria || ''; $('#deVip').value = d.vip || '';
    $('#deOfrezco').value = d.ofrezco; $('#deAdicional').value = d.adicional || '';
  }
  abrir('mDeseo');
}

/* ---------------------------------------------------------------------
   4) TRUEQUES VIP — categoría exclusiva para Premium
   --------------------------------------------------------------------- */
function articulosVip() {
  return BD.articulos.filter(a => a.vip && a.estado !== 'oculto');
}
function pintarVip() {
  const u = yo(), pro = !!(u && (u.premium || u.rol === 'admin'));
  const lista = articulosVip();
  $('#vipChips').innerHTML = CATEGORIAS_VIP.map(c => {
    const n = lista.filter(a => a.vip === c[0] && a.estado === 'disponible').length;
    return `<button class="vip-chip ${App.filtroVip === c[0] ? 'on' : ''}" data-vipcat="${esc(c[0])}">
      <span>${c[1]}</span> ${esc(c[0])} <b>${n}</b></button>`;
  }).join('');

  const filtrada = App.filtroVip ? lista.filter(a => a.vip === App.filtroVip) : lista;
  $('#vipLista').innerHTML = filtrada.length
    ? filtrada.map(a => tarjeta(a, !pro)).join('')
    : `<div class="vacio"><div class="em">💎</div><p>Todavía no hay artículos en esa vitrina.</p></div>`;
  $('#vipAviso').innerHTML = pro
    ? `<span class="eti mora">💎 Tienes acceso completo</span>
       <button class="btn mora sm" data-accion="publicar-vip">+ Publicar en VIP</button>`
    : `<span class="eti oro">🔒 Solo los Premium publican y proponen aquí</span>
       <button class="btn mora sm" data-accion="premium">Hazte Premium por S/ ${precioPro()}</button>`;
}

/* ---------------------------------------------------------------------
   5) TOP TRUEQUEADORES
   --------------------------------------------------------------------- */
function ranking(limite = 10) {
  return BD.usuarios
    .filter(u => u.estado === 'activo')
    .map(u => ({ u, tq: truequesDe(u.id), rep: reputacion(u.id) }))
    .sort((a, b) => b.tq - a.tq || b.rep.prom - a.rep.prom || a.u.id - b.u.id)
    .slice(0, limite);
}
function pintarRanking() {
  const lista = ranking(10);
  const medalla = i => ['🥇', '🥈', '🥉'][i] || `<span class="pos">${i + 1}</span>`;
  $('#topLista').innerHTML = lista.map((x, i) => `
    <div class="top-fila ${x.u.premium ? 'pro' : ''} ${i < 3 ? 'podio' : ''}" data-perfil="${x.u.id}">
      <span class="medalla">${medalla(i)}</span>
      ${avatarHTML(x.u, 'av-g')}
      <div class="top-info">
        <b>${esc(x.u.nombre)} ${x.u.premium ? '<span class="corona">👑</span>' : ''}</b>
        <span class="estrellas">${estrellas(x.rep.prom)}<span class="n">${x.rep.prom.toFixed(1)} · 📍 ${esc(x.u.ciudad)}</span></span>
      </div>
      <span class="top-num">${x.tq}<small>trueques</small></span>
    </div>`).join('') || '<p class="nota">Todavía no hay trueques completados.</p>';
}

/* ---------------------------------------------------------------------
   6) VER INTERESADOS (los nombres son solo para Premium)
   --------------------------------------------------------------------- */
function interesadosDe(art) {
  const ids = new Set();
  BD.favoritos.filter(f => f.articulo === art.id && f.usuario !== art.usuario).forEach(f => ids.add(f.usuario));
  BD.intercambios.filter(x => x.pido === art.id && ['pendiente','aceptado'].includes(x.estado))
    .forEach(x => ids.add(x.de));
  BD.chats.filter(c => c.articulo === art.id).forEach(c =>
    c.usuarios.filter(i => i !== art.usuario).forEach(i => ids.add(i)));
  return [...ids].map(id => {
    const u = usuario(id);
    if (!u) return null;
    const prop = BD.intercambios.find(x => x.pido === art.id && x.de === id);
    const ofrece = prop && prop.ofrezco ? BD.articulos.find(a => a.id === prop.ofrezco) : null;
    return { u, prop, ofrece, rep: reputacion(id) };
  }).filter(Boolean);
}
function verInteresados(artId) {
  const u = yo(), a = BD.articulos.find(x => x.id == artId);
  if (!a || !u) return;
  const gente = interesadosDe(a);
  const pro = u.premium || u.rol === 'admin';

  $('#interCuerpo').innerHTML = `
    <h2>❤️ ${gente.length} persona${gente.length === 1 ? '' : 's'} interesada${gente.length === 1 ? '' : 's'}</h2>
    <p class="sub">En “${esc(a.titulo)}”</p>
    ${!gente.length ? '<p class="nota">Todavía nadie marcó interés en esta publicación.</p>' : pro ? `
      <div class="inter-lista">${gente.map(g => `
        <div class="pro-fila">
          ${avatarHTML(g.u, 'av-g')}
          <div class="info">
            <b>${esc(g.u.nombre)} ${g.u.premium ? '<span class="corona">👑</span>' : ''}</b>
            <span class="estrellas">${estrellas(g.rep.prom)}<span class="n">${g.rep.prom.toFixed(1)} · ${truequesDe(g.u.id)} trueques · 📍 ${esc(g.u.ciudad)}</span></span>
            <span>${g.ofrece ? '🔁 Te ofrece: <b>' + esc(g.ofrece.titulo) + '</b>'
                   : g.prop ? '💬 Envió una propuesta con mensaje' : '❤️ Lo guardó en favoritos'}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn-t" data-chat-usuario="${g.u.id}|${a.id}">💬 Escribir</button>
            ${g.u.telefono ? `<a class="btn-t" target="_blank" rel="noopener"
              href="${esc(linkWA(g.u.telefono, `Hola ${g.u.nombre}, vi que te interesa mi "${a.titulo}" en Truequea PE.`))}">WhatsApp</a>` : ''}
          </div>
        </div>`).join('')}</div>`
    : `<div class="borroso">
        ${gente.map(g => `<div class="pro-fila">
          <div class="av-g">?</div>
          <div class="info"><b>${esc(g.u.nombre.slice(0, 1))}•••••</b>
            <span>Interesado · ${truequesDe(g.u.id)} trueques</span></div></div>`).join('')}
       </div>
       <div class="candado">
         <div class="em">🔒</div>
         <b>Sabes cuántos son, pero no quiénes</b>
         <p>Con Premium ves sus nombres, sus estrellas y qué te ofrecen a cambio, y les escribes
            directo por chat o WhatsApp.</p>
         <button class="btn mora" data-accion="premium">Ver interesados con Premium — S/ ${precioPro()}</button>
       </div>`}`;
  abrir('mInteresados');
}

/* ---------------------------------------------------------------------
   7) IMPULSAR PUBLICACIÓN (S/ 1 por 24 o 48 horas)
   --------------------------------------------------------------------- */
function abrirImpulso(artId) {
  const u = yo();
  if (!u) { abrirAuth('login'); return; }
  const a = BD.articulos.find(x => x.id == artId);
  if (!a) return;
  if (a.usuario !== u.id && u.rol !== 'admin') return avisar('Solo puedes impulsar tus publicaciones', 'err');
  App.pagoTipo = 'impulso'; App.pagoArt = a.id;
  $('#impTitulo').textContent = a.titulo;
  $('#impHoras').innerHTML = IMPULSO_OPCIONES.map(h =>
    `<option value="${h}">${h} horas — S/ ${(BD.config.precioImpulso * (h / 24)).toFixed(2)}</option>`).join('');
  $('#impMiniFoto').src = foto(a);
  cerrar('mFicha'); abrir('mImpulsar');
}
function pedirImpulso() {
  const u = yo(); if (!u) return;
  const a = BD.articulos.find(x => x.id == App.pagoArt);
  if (!a) return;
  const horas = Number($('#impHoras').value) || 24;
  const monto = Number((BD.config.precioImpulso * (horas / 24)).toFixed(2));
  App.pagoTipo = 'impulso';
  App.pagoDatos = { articulo: a.id, horas, monto };
  cerrar('mImpulsar');
  abrirPagoYape('impulso', monto,
    `Impulsar “${a.titulo}” por ${horas} horas`,
    'Tu publicación sube al primer lugar apenas el administrador confirme el pago.');
}

/* ---------------------------------------------------------------------
   8) TRUEQUE SEGURO (S/ 1 por operación)
   --------------------------------------------------------------------- */
function abrirSeguro(trqId) {
  const u = yo(); if (!u) return;
  const x = BD.intercambios.find(i => i.id == trqId);
  if (!x) return;
  const otro = usuario(x.de === u.id ? x.para : x.de);
  const pido = BD.articulos.find(a => a.id === x.pido);
  const c = confianza(otro);
  $('#segCuerpo').innerHTML = `
    <h2>🛡️ Trueque Seguro</h2>
    <p class="sub">Por S/ ${Number(BD.config.precioSeguro).toFixed(2)} el administrador acompaña este
      trueque y lo da por válido solo cuando los dos confirman.</p>
    <div class="seg-lista">
      <div><b>1. Revisión de la otra persona</b><span>Miramos sus estrellas, sus trueques y su cuenta.</span></div>
      <div><b>2. Revisión de las fotos</b><span>Avisamos si una foto ya está publicada en otra cuenta.</span></div>
      <div><b>3. Punto de encuentro obligatorio</b><span>El trueque se hace en una zona segura de la lista.</span></div>
      <div><b>4. Confirmación de los dos lados</b><span>Recién ahí se marca como completado y verificado.</span></div>
    </div>
    ${cajaConfianza(otro, pido)}
    <button class="btn mora full" style="margin-top:14px" data-pagarseguro="${x.id}">
      🛡️ Contratar por S/ ${Number(BD.config.precioSeguro).toFixed(2)}</button>`;
  cerrar('mTrueque'); abrir('mSeguro');
}
function pedirSeguro(trqId) {
  const u = yo(); if (!u) return;
  const x = BD.intercambios.find(i => i.id == trqId);
  if (!x) return;
  App.pagoTipo = 'seguro';
  App.pagoDatos = { intercambio: x.id, monto: Number(BD.config.precioSeguro) };
  cerrar('mSeguro');
  abrirPagoYape('seguro', Number(BD.config.precioSeguro),
    'Trueque Seguro',
    'Al aprobar el pago, el administrador acompaña y verifica este trueque.');
}

/* ---------------------------------------------------------------------
   9) PAGO POR YAPE REUTILIZABLE (premium, impulso y seguro)
   --------------------------------------------------------------------- */
function abrirPagoYape(tipo, monto, titulo, detalle) {
  const u = yo();
  if (!u) { abrirAuth('login'); return avisar('Entra a tu cuenta primero'); }
  App.pagoTipo = tipo;
  App.fotoPago = null;
  $('#formPago').reset();
  $('#zonaPago').textContent = '📸 Clic para subir la captura del Yape';
  $('#pagoTitulo').textContent = titulo || 'Subir comprobante de Yape';
  $('#pagoDetalle').textContent = detalle || '';
  $('#pagoMonto').textContent = Number(monto).toFixed(2);
  $('#pagoYapeNom').textContent = BD.config.yapeNombre || 'Angel Levano';
  $('#pagoQr').innerHTML = BD.config.yapeQr
    ? `<img class="yape-qr" src="${BD.config.yapeQr}" alt="QR de Yape">` : '';
  abrir('mPago');
}
