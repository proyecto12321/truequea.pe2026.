/* ===================================================================
   TRUEQUEA PE · Mi cuenta, administración y reportes
   Archivo: js/05-paneles.js
   =================================================================== */

/* =====================================================================
   Paneles: mi cuenta, administración y arranque
   ===================================================================== */

function pintarCuenta() {
  const u = yo();
  if (!u) return;
  const rep = reputacion(u.id);
  $('#subCuenta').innerHTML = `${esc(u.nombre)} · ${esc(u.ciudad)} · ${estrellas(rep.prom)}
    ${rep.prom.toFixed(1)} · ${u.puntos || 0} puntos ${u.premium ? '<span class="pro-badge">PREMIUM</span>' : ''}`;
  $('#vistaAvatar').innerHTML = u.avatar ? `<img src="${u.avatar}" alt="">` : esc(u.nombre[0].toUpperCase());
  $('#pfNombre').value = u.nombre;
  $('#pfCiudad').value = u.ciudad;
  $('#pfTel').value = u.telefono || '';
  $('#pfRef').value = u.ref || '';
  $('#pfBio').value = u.bio || '';
  $('#pfLat').value = u.lat || '';
  $('#pfLon').value = u.lon || '';
  if (!u.codigo) { u.codigo = nuevoCodigo(); guardar(); }
  $('#miCodigo').textContent = u.codigo;

  /* mis publicaciones */
  const mios = BD.articulos.filter(a => a.usuario === u.id);
  $('#misPubs').innerHTML = mios.length ? mios.map(a => {
    const props = BD.intercambios.filter(x => x.pido === a.id && x.estado === 'pendiente').length;
    return `<div class="fila">
      <img src="${foto(a)}" alt="">
      <div class="fila-info">
        <b>${esc(a.titulo)} ${a.destacado ? '<span class="eti oro">⭐ Destacado</span>' : ''}</b>
        <span>📍 ${esc(a.ciudad)} · 👁 ${a.vistas} vistas · 🕓 ${fechaTxt(a.creado)}</span>
        <span style="margin-top:4px"><span class="eti ${a.estado === 'disponible' ? 'azul' : a.estado === 'intercambiado' ? 'verde' : 'oro'}">${a.estado}</span>
          ${props ? `<span class="eti oro">${props} propuesta(s)</span>` : ''}</span>
      </div>
      <div class="fila-acc">
        <button class="btn-t" data-art="${a.id}">Ver</button>
        <button class="btn-t" data-editar="${a.id}">Editar</button>
        <button class="btn-t rojo" data-borrar="${a.id}">Eliminar</button>
      </div></div>`;
  }).join('') : `<div class="vacio"><div class="em">📦</div><p>Todavía no publicaste nada.</p>
      <button class="btn pri sm" style="margin-top:12px" data-accion="publicar">Publicar mi primer artículo</button></div>`;

  /* propuestas */
  const pinta = (lista, destino, vacio) => {
    $(destino).innerHTML = lista.length ? lista.map(x => {
      const soyDe = x.de === u.id;
      const otro = usuario(soyDe ? x.para : x.de);
      const pido = BD.articulos.find(a => a.id === x.pido);
      const ofr = x.ofrezco ? BD.articulos.find(a => a.id === x.ofrezco) : null;
      const yaCalifique = BD.resenas.some(r => r.trueque === x.id && r.de === u.id);
      let acc = '';
      if (x.estado === 'pendiente' && !soyDe)
        acc = `<button class="btn-t verde" data-resp="${x.id}|aceptar">✓ Aceptar</button>
               <button class="btn-t rojo" data-resp="${x.id}|rechazar">✕ Rechazar</button>`;
      else if (x.estado === 'pendiente')
        acc = `<button class="btn-t rojo" data-cancelar-tq="${x.id}">Cancelar</button>`;
      else if (x.estado === 'aceptado')
        acc = `<button class="btn-t verde" data-trueque="${x.id}">Gestionar trueque</button>`;
      else if (x.estado === 'completado' && !yaCalifique)
        acc = `<button class="btn-t" data-calificar="${x.id}">⭐ Calificar</button>`;
      if (['pendiente','aceptado'].includes(x.estado))
        acc = `<button class="btn-t" data-analizar="${x.id}">📈 ¿Buen trueque?</button>` + acc;
      const col = { completado:'verde', pendiente:'azul', aceptado:'oro', rechazado:'roja', cancelado:'gris' }[x.estado] || 'gris';
      return `<div class="fila">
        <div class="par"><img src="${foto(pido)}" alt=""><span class="fl">⇄</span>
          <img src="${ofr ? foto(ofr) : SIN_FOTO}" alt=""></div>
        <div class="fila-info">
          <b>${esc(pido ? pido.titulo : '—')} ⇄ ${esc(ofr ? ofr.titulo : 'solo mensaje')}</b>
          <span>${soyDe ? 'Propuesta a' : 'Propuesta de'} <b>${esc(otro.nombre)}</b> · ${relativo(x.creado)}</span>
          ${x.mensaje ? `<span>💬 "${esc(x.mensaje)}"</span>` : ''}
          <span style="margin-top:4px"><span class="eti ${col}">${x.estado}</span></span>
        </div>
        <div class="fila-acc">${acc}</div></div>`;
    }).join('') : `<div class="vacio"><div class="em">🔁</div><p>${vacio}</p></div>`;
  };
  pinta(BD.intercambios.filter(x => x.para === u.id && x.estado === 'pendiente'), '#listaRec', 'No tienes propuestas pendientes.');
  pinta(BD.intercambios.filter(x => x.de === u.id && x.estado === 'pendiente'), '#listaEnv', 'No enviaste propuestas todavía.');
  pinta(BD.intercambios.filter(x => (x.de === u.id || x.para === u.id) && x.estado === 'aceptado'), '#listaAct', 'No tienes trueques en curso.');
  pinta(BD.intercambios.filter(x => (x.de === u.id || x.para === u.id) && ['completado','rechazado','cancelado'].includes(x.estado)), '#listaHis', 'Aquí verás tus trueques cerrados.');

  $('#gRec').textContent = BD.intercambios.filter(x => x.para === u.id && x.estado === 'pendiente').length || '';

  const favs = BD.favoritos.filter(f => f.usuario === u.id)
    .map(f => BD.articulos.find(a => a.id === f.articulo)).filter(Boolean);
  $('#listaFav').innerHTML = favs.length ? favs.map(tarjeta).join('')
    : `<div class="vacio"><div class="em">❤️</div><p>Todavía no guardaste favoritos.</p></div>`;
}

/* ---------------- administración ---------------- */
function pintarAdmin() {
  const u = yo();
  if (!u || u.rol !== 'admin') { avisar('Solo el administrador', 'err'); return irA('inicio'); }
  $('#subAdmin').textContent = `Conectado como ${u.nombre}`;

  const pend = BD.pagos.filter(p => p.estado === 'pendiente').length;
  const pendPub = BD.anuncios.filter(a => a.estado === 'pendiente').length;
  $('#gPagos').textContent = pend || '';
  $('#gPub').textContent = pendPub || '';
  const ingresos = BD.pagos.filter(p => p.estado === 'aprobado').reduce((s, p) => s + Number(p.monto), 0);
  const visitas = (BD.visitas || []).reduce((s, v) => s + v.total, 0);
  $('#cifrasAdmin').innerHTML = `
    <div class="cifra"><b>${BD.usuarios.length}</b><span>Usuarios registrados</span></div>
    <div class="cifra"><b>${visitas}</b><span>Ingresos al sistema</span></div>
    <div class="cifra"><b>${BD.articulos.filter(a => a.estado === 'disponible').length}</b><span>Publicaciones activas</span></div>
    <div class="cifra"><b>${BD.intercambios.filter(x => x.estado === 'completado').length}</b><span>Trueques completados</span></div>
    <div class="cifra ${pend ? 'alerta' : ''}"><b>${pend}</b><span>Comprobantes por revisar</span></div>
    <div class="cifra ${pendPub ? 'alerta' : ''}"><b>${pendPub}</b><span>Publicidad por aprobar</span></div>
    <div class="cifra"><b>${BD.usuarios.filter(x => x.premium).length}</b><span>Usuarios Premium</span></div>
    <div class="cifra"><b>S/ ${ingresos.toFixed(2)}</b><span>Ingresos Premium</span></div>`;

  tablaUsuarios();
  tablaArticulos();
  tablaAnuncios();
  listaSolicitudes();
  listaPagos();
  listaSeguros();
  listaRiesgo();
  pintarReportes();

  const c = BD.config;
  const co = c.contacto || {};
  $('#coNombre').value = co.nombre || ''; $('#coCargo').value = co.cargo || '';
  $('#coTel').value = co.telefono || ''; $('#coEmail').value = co.email || '';
  $('#coWa').value = co.wa || ''; $('#coHorario').value = co.horario || '';
  $('#coTexto').value = co.texto || '';
  $('#coAviso').checked = c.avisoWhatsApp !== false;
  $('#coWhatsapp').value = c.whatsapp || '';
  pintarEstadoNube();
  $('#marcaNombre').value = c.nombre; $('#marcaLema').value = c.lema; $('#marcaColor').value = c.color;
  $('#vistaLogo').innerHTML = c.logo ? `<img src="${c.logo}" style="width:100%;height:100%;object-fit:cover" alt="">` : 'Sin logo';
  $('#yapeNom').value = c.yapeNombre || ''; $('#yapeNum').value = c.yapeNumero || '';
  $('#yapePrecio').value = c.precioPremium;
  $('#yapeImpulso').value = c.precioImpulso ?? 1;
  $('#yapeSeguro').value = c.precioSeguro ?? 1;
  $('#yapeAuto').checked = c.autoYape !== false;
  $('#vistaYape').innerHTML = c.yapeQr ? `<img class="yape-qr" src="${c.yapeQr}" alt="QR">`
    : `<div class="yape-vacio">Sin QR<br>subido</div>`;
}

function tablaUsuarios(filtro = '') {
  const q = filtro.toLowerCase();
  const lista = BD.usuarios.filter(u => !q || (u.nombre + u.email).toLowerCase().includes(q));
  const cab = $('#contadorAdmins');
  if (cab) cab.innerHTML = `🛡️ Administradores: <b>${contarAdmins()} de ${SEG.maxAdmins}</b>`;
  $('#tUsuarios').innerHTML = lista.map(u => {
    const r = reputacion(u.id);
    return `<tr>
      <td><div class="celda2">${avatarHTML(u, 'av-g')}
        <div>${esc(u.nombre)} ${u.rol === 'admin' ? '<span class="eti oro">ADMIN</span>' : ''}
          ${u.premium ? '<span class="eti mora">PREMIUM</span>' : ''}
          <small>${esc(u.email)}</small></div></div></td>
      <td>${esc(u.ciudad)}</td>
      <td>${u.premium ? '<span class="eti mora">👑 Premium</span>'
            : '<span class="eti gris">Gratis</span>'}</td>
      <td>${BD.articulos.filter(a => a.usuario === u.id).length} pub · ${truequesDe(u.id)} trueques<br>
        <span class="estrellas">${estrellas(r.prom)}<span class="n">${r.prom.toFixed(1)}</span></span></td>
      <td><span class="eti ${u.estado === 'activo' ? 'verde' : 'roja'}">${u.estado}</span></td>
      <td style="white-space:nowrap">
        <button class="btn-t" data-perfil="${u.id}">Perfil</button>
        <button class="btn-t" data-clave="${u.id}">🔑 Clave</button>
        ${u.rol === 'admin'
          ? `<button class="btn-t" data-rol="${u.id}|usuario">Quitar admin</button>`
          : `<button class="btn-t oro" data-rol="${u.id}|admin">Hacer admin</button>`}
        <button class="btn-t mora" data-premium="${u.id}">${u.premium ? 'Quitar premium' : 'Dar premium'}</button>
        <button class="btn-t" data-suspender="${u.id}">${u.estado === 'activo' ? 'Suspender' : 'Reactivar'}</button>
        <button class="btn-t rojo" data-borraruser="${u.id}">Eliminar</button>
      </td></tr>`;
  }).join('');
}

function tablaArticulos() {
  $('#tArticulos').innerHTML = BD.articulos.map(a => {
    const d = usuario(a.usuario);
    return `<tr>
      <td><div class="celda2"><img src="${foto(a)}" alt="">
        <div>${esc(a.titulo)}<small>🕓 ${fechaTxt(a.creado)} · 👁 ${a.vistas}</small></div></div></td>
      <td>${CATEGORIAS[a.categoria - 1][0]}</td><td>${esc(a.ciudad)}</td>
      <td>${esc(d ? d.nombre : '—')}</td>
      <td><span class="eti ${a.estado === 'disponible' ? 'azul' : 'gris'}">${a.estado}</span></td>
      <td style="white-space:nowrap">
        <button class="btn-t" data-art="${a.id}">Ver</button>
        <button class="btn-t oro" data-destacar="${a.id}">${a.destacado ? 'Quitar ⭐' : 'Destacar'}</button>
        <button class="btn-t rojo" data-borrar="${a.id}">Eliminar</button></td></tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:26px;color:var(--sub)">Sin publicaciones</td></tr>';
}

function tablaAnuncios() {
  const eti = a => a.estado === 'pendiente' ? '<span class="eti oro">Por aprobar</span>'
    : a.estado === 'rechazado' ? '<span class="eti roja">Rechazado</span>'
    : a.activo ? '<span class="eti verde">Publicado</span>' : '<span class="eti gris">Pausado</span>';
  $('#tAnuncios').innerHTML = BD.anuncios.map(a => `
    <tr><td><div class="celda2"><img src="${a.img || SIN_FOTO}" alt="">
      <div>${esc(a.titulo)} ${a.destacado ? '<span class="eti oro">BANNER</span>' : ''}
        <small>${esc(a.desc).slice(0, 60)}</small></div></div></td>
      <td>${a.tel ? '📞 ' + esc(a.tel) + '<br>' : ''}${a.wa ? '<span class="eti verde">WhatsApp</span>' : ''}</td>
      <td>${a.vistas || 0}</td><td>${a.clics || 0}</td>
      <td>${eti(a)}</td>
      <td style="white-space:nowrap">
        ${a.estado === 'aprobado'
          ? `<button class="btn-t" data-anpausa="${a.id}">${a.activo ? 'Pausar' : 'Activar'}</button>
             <button class="btn-t rojo" data-anaprobar="${a.id}|no">Quitar</button>`
          : `<button class="btn-t verde" data-anaprobar="${a.id}|si">✓ Aprobar</button>
             <button class="btn-t rojo" data-anaprobar="${a.id}|no">✕ Rechazar</button>`}
        <button class="btn-t" data-anuncio="${a.id}">Ver</button>
        <button class="btn-t rojo" data-anborrar="${a.id}">Eliminar</button></td></tr>`).join('')
    || '<tr><td colspan="6" style="text-align:center;padding:26px;color:var(--sub)">Sin anuncios</td></tr>';
}

/* Solicitudes de publicidad esperando aprobación */
function listaSolicitudes() {
  const p = BD.anuncios.filter(a => a.estado === 'pendiente');
  $('#cajaSolicitudes').style.display = '';
  $('#listaSolicitudes').innerHTML = p.length ? p.map(a => `
    <div class="fila">
      <img src="${a.img || SIN_FOTO}" alt="">
      <div class="fila-info">
        <b>${esc(a.titulo)}</b>
        <span>${esc(a.desc)}</span>
        <span>👤 ${esc(a.solicitante || '—')} · 📞 ${esc(a.tel || 'sin teléfono')} · 🕓 ${fechaTxt(a.creado)}</span>
      </div>
      <div class="fila-acc">
        <button class="btn-t verde" data-anaprobar="${a.id}|si">✓ Aprobar y publicar</button>
        <button class="btn-t rojo" data-anaprobar="${a.id}|no">✕ Rechazar</button>
        ${a.tel ? `<a class="btn-t" target="_blank" rel="noopener"
           href="${esc(linkWA(a.tel, `Hola ${a.solicitante || ''}, sobre tu anuncio de "${a.titulo}" en Truequea PE.`))}">💬 WhatsApp</a>` : ''}
      </div></div>`).join('')
    : `<p class="nota">No hay solicitudes pendientes.</p>`;
}

/* =====================================================================
   GRÁFICOS DEL PANEL DE ADMINISTRACIÓN (SVG hecho a mano, sin librerías)
   ===================================================================== */
function diasAtras(n) {
  const l = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    l.push(d.toISOString().slice(0, 10));
  }
  return l;
}
function etiquetaDia(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function ejes(w, h, mx, my, titulo) {
  const c = document.documentElement.dataset.tema === 'oscuro' ? '#3a465c' : '#dde3ec';
  let g = `<line x1="${mx}" y1="${h - my}" x2="${w - 10}" y2="${h - my}" stroke="${c}" stroke-width="1.5"/>`;
  g += `<line x1="${mx}" y1="14" x2="${mx}" y2="${h - my}" stroke="${c}" stroke-width="1.5"/>`;
  return g;
}
function graficoBarras(svgId, datos, opciones = {}) {
  const svg = $('#' + svgId);
  if (!svg) return;
  const w = opciones.w || 720, h = opciones.h || 260, mx = 42, my = 34;
  const oscuro = document.documentElement.dataset.tema === 'oscuro';
  const sub = oscuro ? '#93a0b5' : '#6f7b8c';
  const rejilla = oscuro ? '#2a3546' : '#eef2f8';
  const max = Math.max(1, ...datos.map(d => d.valor), ...(opciones.linea || []).map(v => v));
  const paso = Math.ceil(max / 4) || 1, tope = paso * 4;
  const ancho = (w - mx - 16) / Math.max(datos.length, 1);
  const alto = v => (v / tope) * (h - my - 22);
  const yDe = v => h - my - alto(v);

  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = h - my - (i / 4) * (h - my - 22);
    g += `<line x1="${mx}" y1="${y}" x2="${w - 10}" y2="${y}" stroke="${rejilla}" stroke-width="1"/>
      <text x="${mx - 8}" y="${y + 4}" font-size="11" fill="${sub}" text-anchor="end">${paso * i}</text>`;
  }
  g += ejes(w, h, mx, my);
  datos.forEach((d, i) => {
    const x = mx + i * ancho + ancho * .18, an = ancho * .64;
    const y = yDe(d.valor), al = Math.max(alto(d.valor), d.valor ? 2 : 0);
    g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${an.toFixed(1)}" height="${al.toFixed(1)}"
        rx="4" fill="${opciones.color || '#0a5fc4'}" opacity=".92"><title>${esc(d.etiqueta)}: ${d.valor}</title></rect>`;
    if (d.valor) g += `<text x="${(x + an / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="10.5"
        font-weight="700" fill="${sub}" text-anchor="middle">${d.valor}</text>`;
    if (datos.length <= 16 || i % 2 === 0)
      g += `<text x="${(x + an / 2).toFixed(1)}" y="${h - my + 16}" font-size="10.5" fill="${sub}"
        text-anchor="middle">${esc(d.etiqueta)}</text>`;
  });
  /* línea encima (por ejemplo: personas distintas) */
  if (opciones.linea && opciones.linea.length === datos.length) {
    const pts = opciones.linea.map((v, i) =>
      `${(mx + i * ancho + ancho / 2).toFixed(1)},${yDe(v).toFixed(1)}`).join(' ');
    g += `<polyline points="${pts}" fill="none" stroke="#7b3fe4" stroke-width="2.6"
      stroke-linejoin="round" stroke-linecap="round"/>`;
    opciones.linea.forEach((v, i) =>
      g += `<circle cx="${(mx + i * ancho + ancho / 2).toFixed(1)}" cy="${yDe(v).toFixed(1)}" r="3.4"
        fill="#7b3fe4" stroke="#fff" stroke-width="1.4"><title>${v} persona(s)</title></circle>`);
  }
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = g;
}
function graficoArea(svgId, datos, color = '#12703c', prefijo = '') {
  const svg = $('#' + svgId);
  if (!svg) return;
  const w = 720, h = 240, mx = 46, my = 32;
  const oscuro = document.documentElement.dataset.tema === 'oscuro';
  const sub = oscuro ? '#93a0b5' : '#6f7b8c';
  const rejilla = oscuro ? '#2a3546' : '#eef2f8';
  const max = Math.max(1, ...datos.map(d => d.valor));
  const paso = Math.ceil(max / 4) || 1, tope = paso * 4;
  const px = i => mx + (i / Math.max(datos.length - 1, 1)) * (w - mx - 16);
  const py = v => h - my - (v / tope) * (h - my - 22);

  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = h - my - (i / 4) * (h - my - 22);
    g += `<line x1="${mx}" y1="${y}" x2="${w - 10}" y2="${y}" stroke="${rejilla}" stroke-width="1"/>
      <text x="${mx - 8}" y="${y + 4}" font-size="11" fill="${sub}" text-anchor="end">${prefijo}${paso * i}</text>`;
  }
  g += ejes(w, h, mx, my);
  const linea = datos.map((d, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(d.valor).toFixed(1)}`).join(' ');
  g += `<path d="${linea} L${px(datos.length - 1).toFixed(1)},${h - my} L${px(0).toFixed(1)},${h - my} Z"
      fill="${color}" opacity=".16"/>`;
  g += `<path d="${linea}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linejoin="round"/>`;
  datos.forEach((d, i) => {
    g += `<circle cx="${px(i).toFixed(1)}" cy="${py(d.valor).toFixed(1)}" r="3.6" fill="${color}"
      stroke="#fff" stroke-width="1.4"><title>${esc(d.etiqueta)}: ${prefijo}${d.valor}</title></circle>`;
    if (datos.length <= 14 || i % 2 === 0)
      g += `<text x="${px(i).toFixed(1)}" y="${h - my + 16}" font-size="10.5" fill="${sub}"
        text-anchor="middle">${esc(d.etiqueta)}</text>`;
  });
  svg.innerHTML = g;
}

function pintarReportes() {
  const rango = Number(($('#repRango') || {}).value || 14);

  /* 1) ingresos al sistema por día */
  const dias = diasAtras(rango);
  const visitas = BD.visitas || [];
  const barras = dias.map(d => {
    const v = visitas.find(x => x.dia === d);
    return { etiqueta: etiquetaDia(d), valor: v ? v.total : 0 };
  });
  const personas = dias.map(d => {
    const v = visitas.find(x => x.dia === d);
    return v ? v.usuarios.length : 0;
  });
  graficoBarras('gIngresos', barras, { linea: personas, h: 260 });

  /* 2) trueques realizados por semana */
  const comps = BD.intercambios.filter(x => x.estado === 'completado');
  const semanas = [];
  for (let i = 5; i >= 0; i--) {
    const fin = new Date(); fin.setHours(23, 59, 59, 0); fin.setDate(fin.getDate() - i * 7);
    const ini = new Date(fin); ini.setDate(ini.getDate() - 6); ini.setHours(0, 0, 0, 0);
    semanas.push({
      etiqueta: `${String(ini.getDate()).padStart(2,'0')}/${String(ini.getMonth()+1).padStart(2,'0')}`,
      valor: comps.filter(x => { const f = new Date(x.completado || x.creado); return f >= ini && f <= fin; }).length,
    });
  }
  graficoBarras('gTrueques', semanas, { color:'#12703c', h:240 });
  const enCurso = BD.intercambios.filter(x => x.estado === 'aceptado').length;
  $('#resumenTrueques').innerHTML = `
    <div><b>${comps.length}</b>Trueques cerrados</div>
    <div><b>${enCurso}</b>En curso ahora</div>
    <div><b>${BD.intercambios.filter(x => x.estado === 'pendiente').length}</b>Propuestas esperando</div>`;

  /* 3) ingresos de dinero acumulados */
  const aprob = BD.pagos.filter(p => p.estado === 'aprobado');
  let acum = 0;
  const dinero = dias.map(d => {
    acum += aprob.filter(p => (p.resuelto || p.creado).slice(0, 10) === d)
                 .reduce((s, p) => s + Number(p.monto), 0);
    return { etiqueta: etiquetaDia(d), valor: Number(acum.toFixed(2)) };
  });
  graficoArea('gDinero', dinero, '#7b3fe4', 'S/ ');
  const total = aprob.reduce((s, p) => s + Number(p.monto), 0);
  $('#resumenDinero').innerHTML = `
    <div><b>S/ ${total.toFixed(2)}</b>Total cobrado</div>
    <div><b>${aprob.length}</b>Pagos aprobados</div>
    <div><b>${BD.usuarios.filter(u => u.premium).length}</b>Cuentas Premium</div>`;

  /* 4) actividad por ciudad */
  const conteo = {};
  BD.articulos.forEach(a => conteo[a.ciudad] = (conteo[a.ciudad] || 0) + 1);
  const orden = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const tope = Math.max(1, ...orden.map(o => o[1]));
  $('#gCiudades').innerHTML = orden.length ? orden.map(([c, n]) => `
    <div class="barra-ciudad"><span>${esc(c)}</span>
      <div class="pista"><i style="width:${(n / tope * 100).toFixed(1)}%"></i></div>
      <span style="width:34px;text-align:right;font-weight:700">${n}</span></div>`).join('')
    : '<p class="nota">Todavía no hay publicaciones.</p>';
}

function listaPagos(filtro = '') {
  const f = filtro || ($('#filtroPagos') ? $('#filtroPagos').value : '');
  const nombres = { premium:'💜 Premium', impulso:'🚀 Impulso', seguro:'🛡️ Trueque Seguro' };
  let lista = BD.pagos;
  if (f === 'pendiente') lista = lista.filter(p => p.estado === 'pendiente');
  else if (f) lista = lista.filter(p => (p.tipo || 'premium') === f);

  $('#listaPagos').innerHTML = lista.length ? lista.map(p => {
    const u = usuario(p.usuario);
    const tipo = p.tipo || 'premium';
    const art = p.articulo ? BD.articulos.find(a => a.id === p.articulo) : null;
    return `<div class="fila">
      <img src="${p.captura}" alt="Comprobante" style="cursor:zoom-in" data-vercaptura="${p.id}">
      <div class="fila-info">
        <b>${esc(u ? u.nombre : 'Usuario eliminado')} — S/ ${Number(p.monto).toFixed(2)}
          <span class="eti ${tipo === 'premium' ? 'mora' : tipo === 'impulso' ? 'oro' : 'azul'}">${nombres[tipo]}</span></b>
        <span>${esc(u ? u.email : '')} · ${fechaTxt(p.creado)}</span>
        ${art ? `<span>📦 "${esc(art.titulo)}" por ${p.horas || 24} horas</span>` : ''}
        ${p.nota ? `<span>📝 ${esc(p.nota)}</span>` : ''}
        ${p.auto ? '<span class="eti verde">🤖 Verificado automáticamente</span>' : ''}
        ${p.ocr ? `<span>🔎 Leído: S/ ${p.ocr.monto ?? '—'} · operación ${esc(p.ocr.codigo || '—')}
          ${p.ocr.motivos && p.ocr.motivos.length ? '· ⚠ ' + esc(p.ocr.motivos.join(' ')) : ''}</span>` : ''}
        <span style="margin-top:4px"><span class="eti ${p.estado === 'aprobado' ? 'verde' : p.estado === 'pendiente' ? 'oro' : 'roja'}">${p.estado}</span></span>
      </div>
      <div class="fila-acc">${p.estado === 'pendiente' ? `
        <button class="btn-t verde" data-pago="${p.id}|si">✓ Aprobar</button>
        <button class="btn-t rojo" data-pago="${p.id}|no">✕ Rechazar</button>` : ''}</div></div>`;
  }).join('') : `<div class="vacio"><div class="em">💰</div><p>No hay comprobantes con ese filtro.</p></div>`;
}

/* Cómo está la conexión con la nube */
function pintarEstadoNube() {
  const c = $('#estadoNube');
  if (!c) return;
  const activa = typeof NUBE !== 'undefined' && NUBE.activa;
  const modo = activa ? (NUBE.modo === 'sdk' ? 'en vivo (SDK)' : 'por consultas (REST)') : '—';
  const cuando = (typeof NUBE !== 'undefined' && NUBE.ultima) ? NUBE.ultima.toLocaleString() : '—';
  c.className = 'estado-nube ' + (activa ? 'ok' : 'no');
  c.innerHTML = activa
    ? `<b>🟢 Conectada a Firebase — ${esc(modo)}</b>
       <span>Proyecto: <b>${esc(NUBE_CONFIG.firebase.projectId || '—')}</b></span>
       <span>Base: ${esc(NUBE_CONFIG.firebase.databaseURL)}/${esc(NUBE_CONFIG.raiz)}</span>
       <span>Última sincronización: ${esc(cuando)}</span>
       <span>${BD.usuarios.length} usuarios · ${BD.articulos.length} publicaciones · ${BD.intercambios.length} trueques</span>
       ${NUBE.detalle ? `<span>${esc(NUBE.detalle)}</span>` : ''}`
    : `<b>⚪ Sin nube por ahora — se guarda en este navegador</b>
       <span>Proyecto configurado: ${esc(NUBE_CONFIG.firebase.projectId || '—')}</span>
       ${NUBE.error ? `<span><b>Motivo:</b> ${esc(NUBE.error)}</span>` : ''}
       ${NUBE.detalle ? `<span>${esc(NUBE.detalle)}</span>` : ''}
       <span><b>Revisa esto en Firebase:</b></span>
       <span>1. Que exista la Realtime Database (no Firestore) en ese proyecto.</span>
       <span>2. Que las Reglas dejen leer y escribir.</span>
       <span>3. Que tengas internet y no estés abriendo la página sin conexión.</span>
       <span>Luego toca “🔌 Probar conexión”.</span>`;
}

/* Trueques con acompañamiento contratado */
function listaSeguros() {
  const act = BD.seguros.filter(s => s.estado !== 'cerrado');
  $('#listaSeguros').innerHTML = act.length ? act.map(s => {
    const x = BD.intercambios.find(i => i.id === s.intercambio);
    if (!x) return '';
    const a = usuario(x.de), b = usuario(x.para);
    const pido = BD.articulos.find(t => t.id === x.pido);
    const ofr = x.ofrezco ? BD.articulos.find(t => t.id === x.ofrezco) : null;
    const ca = confianza(a), cb = confianza(b);
    const emo = n => ({ verde:'🟢', amarillo:'🟡', rojo:'🔴' }[n]);
    return `<div class="fila">
      <div class="par"><img src="${foto(pido)}" alt=""><span class="fl">⇄</span>
        <img src="${ofr ? foto(ofr) : SIN_FOTO}" alt=""></div>
      <div class="fila-info">
        <b>${esc(pido ? pido.titulo : '—')} ⇄ ${esc(ofr ? ofr.titulo : 'solo mensaje')}</b>
        <span>${emo(ca.nivel)} ${esc(a ? a.nombre : '—')} (${ca.puntos}/100) · ${emo(cb.nivel)} ${esc(b ? b.nombre : '—')} (${cb.puntos}/100)</span>
        <span>📍 ${esc(x.lugar || 'sin punto de encuentro todavía')} · 🕓 ${x.fecha ? x.fecha.replace('T', ' ') : 'sin fecha'}</span>
        <span style="margin-top:4px"><span class="eti ${x.estado === 'completado' ? 'verde' : 'oro'}">${x.estado}</span>
          <span class="eti ${s.estado === 'verificado' ? 'verde' : 'azul'}">${s.estado}</span></span>
      </div>
      <div class="fila-acc">
        <button class="btn-t" data-trueque="${x.id}">Ver trueque</button>
        ${s.estado !== 'verificado'
          ? `<button class="btn-t verde" data-verificarseg="${s.id}">🛡️ Dar visto bueno</button>` : ''}
      </div></div>`;
  }).join('') : `<p class="nota">Todavía nadie contrató el acompañamiento.</p>`;
}

/* Cuentas y publicaciones que conviene revisar */
function listaRiesgo() {
  const riesgo = BD.usuarios.map(u => ({ u, c: confianza(u) }))
    .filter(x => x.c.nivel !== 'verde' && x.u.rol !== 'admin')
    .sort((a, b) => a.c.puntos - b.c.puntos);
  const fotosMalas = BD.articulos.filter(a => revisarFotos(a).repetida);

  $('#listaRiesgo').innerHTML = `
    ${fotosMalas.length ? `<div class="aviso" style="border-color:var(--rojo);color:var(--rojo)">
      ⚠️ ${fotosMalas.length} publicación(es) usan una foto que ya está en otra cuenta:
      ${fotosMalas.map(a => `<button class="btn-t" data-art="${a.id}">${esc(a.titulo)}</button>`).join(' ')}
    </div>` : ''}
    ${riesgo.length ? riesgo.map(x => `
      <div class="fila">
        ${avatarHTML(x.u, 'av-g')}
        <div class="fila-info">
          <b>${esc(x.u.nombre)} <span class="eti ${x.c.nivel === 'rojo' ? 'roja' : 'oro'}">${esc(x.c.etiqueta)} · ${x.c.puntos}/100</span></b>
          <span>${esc(x.u.email)} · ${esc(x.u.ciudad)}</span>
          ${(x.c.malas || []).map(m => `<span>⚠ ${esc(m)}</span>`).join('')}
        </div>
        <div class="fila-acc">
          <button class="btn-t" data-perfil="${x.u.id}">Perfil</button>
          <button class="btn-t" data-suspender="${x.u.id}">${x.u.estado === 'activo' ? 'Suspender' : 'Reactivar'}</button>
        </div></div>`).join('')
    : '<p class="nota">Ninguna cuenta con señales de riesgo. 🎉</p>'}`;
}

/* ---------------- exportar ---------------- */
function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function csvUsuarios() {
  const cab = ['ID','Nombre','Correo','Rol','Ciudad','Telefono','Plan','Premium hasta','Publicaciones',
               'Trueques','Reputacion','Puntos','Estado','Registrado','Codigo de respaldo','Latitud','Longitud'];
  const filas = BD.usuarios.map(u => {
    const r = reputacion(u.id);
    return [u.id, u.nombre, u.email, u.rol, u.ciudad, u.telefono || '',
      u.premium ? 'Premium' : 'Gratis', u.premiumHasta ? fechaTxt(u.premiumHasta) : '',
      BD.articulos.filter(a => a.usuario === u.id).length, truequesDe(u.id),
      r.prom.toFixed(1), u.puntos || 0, u.estado, fechaTxt(u.creado),
      u.codigo || '', u.lat || '', u.lon || ''];
  });
  const csv = '﻿' + [cab, ...filas]
    .map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  descargar(`usuarios-truequea-${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv;charset=utf-8');
  avisar(`Descargados ${BD.usuarios.length} usuarios`, 'ok');
}

/* ---------------- perfil público ---------------- */
function verPerfil(id) {
  const u = usuario(id);
  if (!u) return;
  const r = reputacion(id);
  const arts = BD.articulos.filter(a => a.usuario === id && a.estado !== 'oculto');
  const res = BD.resenas.filter(x => x.para === id);
  $('#perfilPub').innerHTML = `
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
      ${avatarHTML(u, 'av-g av-xl')}
      <div style="flex:1;min-width:200px">
        <h2>${esc(u.nombre)} ${u.premium ? '<span class="pro-badge">PREMIUM</span>' : ''}</h2>
        <div class="estrellas">${estrellas(r.prom)}<span class="n">${r.prom.toFixed(1)} · ${r.total} reseñas</span></div>
        <p style="font-size:14px;color:var(--sub);margin-top:4px">📍 ${esc(u.ciudad)} ·
          ${truequesDe(id)} trueques · ${arts.length} publicaciones · desde ${fechaTxt(u.creado).split(' ·')[0]}</p>
        ${u.bio ? `<p style="margin-top:8px">${esc(u.bio)}</p>` : ''}
        ${u.telefono ? `<a class="wa" style="margin-top:10px" target="_blank" rel="noopener"
          href="https://wa.me/51${String(u.telefono).replace(/\D/g,'')}">💬 Escribir por WhatsApp</a>` : ''}
      </div>
    </div>
    <h3 style="font-size:17px;margin-bottom:10px">Publicaciones</h3>
    <div class="grilla" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      ${arts.map(tarjeta).join('') || '<p class="nota">Sin publicaciones.</p>'}</div>
    <h3 style="font-size:17px;margin:18px 0 10px">Reseñas</h3>
    ${res.map(x => `<div class="fila"><div class="fila-info">
      <b>${esc(usuario(x.de) ? usuario(x.de).nombre : '—')} <span class="estrellas">${estrellas(x.puntaje)}</span></b>
      <span>${esc(x.comentario || 'Sin comentario.')}</span>
      <span style="font-size:12px">${fechaTxt(x.creado)}</span></div></div>`).join('')
      || '<p class="nota">Todavía no tiene reseñas.</p>'}`;
  cerrar('mFicha'); abrir('mPerfil');
}

/* ---------------- textos informativos ---------------- */
const TEXTOS = {
  /* se arma en el momento para que el precio salga siempre actualizado */
  get faq() { return `<h2>Preguntas frecuentes</h2>
    <div class="tarjeta"><h3>¿Cuánto cuesta usar Truequea PE?</h3>
      <p>Publicar, buscar e intercambiar es gratis. Premium cuesta S/ ${precioPro()} al mes y agrega
         destaque, publicaciones ilimitadas y navegación sin publicidad.</p></div>
    <div class="tarjeta"><h3>¿Dónde se guardan mis datos?</h3>
      <p>En este navegador, en tu propia computadora. Nadie más los ve. Si limpias los datos del
         navegador se borran, por eso el administrador puede descargar una copia de seguridad.</p></div>
    <div class="tarjeta"><h3>¿Cómo sé que la otra persona es confiable?</h3>
      <p>Revisa su reputación, sus reseñas y cuántos trueques completó. Acuerda siempre el
         encuentro en una de las zonas seguras sugeridas.</p></div>
    <div class="tarjeta"><h3>¿Por qué no aparecen precios?</h3>
      <p>Porque Truequea PE es <b>solo trueque</b>: aquí no se vende ni se compra nada. Publicas lo que
         tienes y escribes qué buscas a cambio. Lo que valga cada cosa lo acuerdan ustedes dos
         al conversar.</p></div>
    <div class="tarjeta"><h3>¿Qué pasa si olvido mi contraseña?</h3>
      <p>Al registrarte te damos un <b>código de respaldo</b> (por ejemplo TRUEQUEA-1234). Con ese
         código y tu correo cambias la contraseña desde "Entrar" → "Olvidé mi contraseña".
         Lo vuelves a ver en Mi cuenta → Perfil → Seguridad.</p></div>
    <div class="tarjeta"><h3>¿Qué es reservar una publicación?</h3>
      <p>Es una función Premium: apartas un artículo hasta 1 hora mientras conversan, para que
         nadie más lo proponga ni le escriba al dueño. Cuando vence el plazo se libera solo.</p></div>
    <div class="tarjeta"><h3>¿Se puede perder mi información?</h3>
      <p>No. El sistema guarda copias de seguridad automáticas y, cuando varios equipos se
         sincronizan, junta los datos en vez de pisarlos. El administrador puede restaurar
         cualquier copia desde Admin → Marca → Copias de seguridad.</p></div>`; },
  zonas: `<h2>🛡️ Zonas seguras sugeridas</h2>
    <p class="sub">Lugares públicos y vigilados para hacer tus intercambios.</p>
    ${ZONAS_SEGURAS.map(z => `<div class="fila"><div class="fila-info">
      <b>${z.nombre}</b><span>${z.tipo} · ${z.ciudad}</span></div>
      <a class="btn suave sm" target="_blank" rel="noopener"
        href="https://www.google.com/maps?q=${z.lat},${z.lon}">🗺️ Cómo llegar</a></div>`).join('')}`,
  terminos: `<h2>Términos y condiciones</h2>
    <p style="line-height:1.8">Truequea PE conecta personas interesadas en intercambiar bienes y
    servicios. La plataforma no participa en el intercambio ni garantiza el estado de los artículos:
    verificar lo que recibes es responsabilidad tuya. Está prohibido publicar artículos ilegales,
    armas, medicamentos, animales protegidos o contenido para adultos. El incumplimiento puede
    derivar en la suspensión de la cuenta.</p>`,
  privacidad: `<h2>Política de privacidad (Ley N.° 29733)</h2>
    <p style="line-height:1.8">Tratamos tus datos conforme a la Ley N.° 29733 de Protección de Datos
    Personales del Perú. En esta versión <b>todos tus datos se guardan únicamente en tu navegador</b>:
    no viajan a ningún servidor. Puedes borrarlos cuando quieras desde el pie de página
    ("Reiniciar datos de prueba") o limpiando los datos del sitio en tu navegador. El administrador
    puede descargar una copia de seguridad para respaldo.</p>`,
};
