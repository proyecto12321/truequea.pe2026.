/* ===================================================================
   TRUEQUEA PE · Tendencias y puesto número uno
   Archivo: js/08-tendencias.js
   =================================================================== */

/* =====================================================================
   TENDENCIAS Y PUESTO NÚMERO UNO — incluido en el Premium
   ---------------------------------------------------------------------
   Antes esto era un plan aparte. Ahora viene dentro del Premium de S/ 5:
   · Puede poner una publicación en el PUESTO NÚMERO UNO por tendencia
   · Analiza todo: qué se busca, qué se mueve, a qué hora, en qué zona
   · Ve qué categorías están calientes antes que nadie
   · Publicaciones mejoradas: etiqueta 💎, más fotos, siempre arriba
   ===================================================================== */

/* Ya no hay dos planes: el Premium de S/ 5 trae TODO esto incluido. */
function esSuperVip(u) { return !!(u && (u.premium || u.rol === 'admin')); }

/* ---------------------------------------------------------------------
   TENDENCIAS — qué se está moviendo de verdad
   --------------------------------------------------------------------- */
function tendencias() {
  const ahora = Date.now();
  const dias = d => (ahora - new Date(d)) / 86400000;

  /* qué categorías se están buscando y publicando */
  const cats = CATEGORIAS.map((c, i) => {
    const n = i + 1;
    const arts = BD.articulos.filter(a => a.categoria === n);
    const recientes = arts.filter(a => dias(a.creado) <= 7).length;
    const vistas = arts.reduce((s, a) => s + (a.vistas || 0), 0);
    const favs = arts.reduce((s, a) => s + (a.favs || 0), 0);
    const buscados = BD.deseos.filter(d => d.activo && d.categoria === n).length;
    const cerrados = BD.intercambios.filter(x => {
      if (x.estado !== 'completado') return false;
      const p = BD.articulos.find(a => a.id === x.pido);
      return p && p.categoria === n;
    }).length;
    /* el calor mezcla lo que se busca, lo que se mira y lo que se cierra */
    const calor = buscados * 14 + favs * 6 + recientes * 5 + cerrados * 10 + Math.round(vistas / 4);
    return { n, nombre: c[0], emo: c[1], arts: arts.length, recientes,
             vistas, favs, buscados, cerrados, calor };
  }).sort((a, b) => b.calor - a.calor);

  /* palabras que la gente escribe al buscar y al pedir */
  const palabras = {};
  BD.deseos.filter(d => d.activo).forEach(d => {
    `${d.titulo} ${d.palabras || ''}`.toLowerCase().split(/[\s,;]+/)
      .filter(p => p.length > 3).forEach(p => palabras[p] = (palabras[p] || 0) + 3);
  });
  BD.articulos.forEach(a => {
    String(a.busca || '').toLowerCase().split(/[\s,;]+/)
      .filter(p => p.length > 3).forEach(p => palabras[p] = (palabras[p] || 0) + 1);
  });
  const buscado = Object.entries(palabras).sort((a, b) => b[1] - a[1]).slice(0, 12);

  /* a qué hora se mueve la gente */
  const horas = new Array(24).fill(0);
  BD.articulos.forEach(a => horas[new Date(a.creado).getHours()]++);
  BD.mensajes.forEach(m => horas[new Date(m.creado).getHours()]++);
  const mejorHora = horas.indexOf(Math.max(...horas));

  /* zonas con más movimiento */
  const zonas = {};
  BD.articulos.forEach(a => {
    zonas[a.ciudad] = zonas[a.ciudad] || { n: 0, vistas: 0 };
    zonas[a.ciudad].n++; zonas[a.ciudad].vistas += a.vistas || 0;
  });
  const ciudades = Object.entries(zonas)
    .map(([c, d]) => ({ ciudad: c, ...d }))
    .sort((a, b) => (b.n * 5 + b.vistas) - (a.n * 5 + a.vistas)).slice(0, 6);

  /* las publicaciones que más se mueven ahora */
  const calientes = BD.articulos
    .filter(a => a.estado === 'disponible')
    .map(a => ({ a, calor: (a.vistas || 0) + (a.favs || 0) * 8 +
                            interesadosDe(a).length * 12 +
                            Math.max(0, 14 - dias(a.creado)) * 3 }))
    .sort((x, y) => y.calor - x.calor).slice(0, 8);

  return { cats, buscado, horas, mejorHora, ciudades, calientes };
}

/* ---------------------------------------------------------------------
   PUESTO NÚMERO UNO POR TENDENCIA
   El Super VIP elige una publicación suya y la pone primera de todo.
   Solo una a la vez, para que siga siendo justo.
   --------------------------------------------------------------------- */
function numeroUnoActivo() {
  const a = BD.articulos.find(x => x.numeroUno && new Date(x.numeroUno.hasta) > new Date());
  return a || null;
}
function ponerNumeroUno(artId) {
  const u = yo();
  if (!esSuperVip(u)) {
    cerrarTodo();
    return confirmar('👑 Eso es del Premium',
      `Por S/ ${precioPro()} al mes puedes poner una publicación tuya en el puesto número uno ` +
      `de todo el sistema, y ver las tendencias antes que nadie.`,
      () => irA('premium'), 'Ver Premium');
  }
  const a = BD.articulos.find(x => String(x.id) === String(artId));
  if (!a) return;
  if (a.usuario !== u.id && u.rol !== 'admin') return avisar('Solo tus publicaciones', 'err');

  const ocupado = numeroUnoActivo();
  if (ocupado && String(ocupado.id) !== String(a.id) && ocupado.numeroUno.por !== u.id)
    return avisar('El puesto número uno está tomado. Vuelve a intentar en un rato.', 'err');

  BD.articulos.forEach(x => { if (x.numeroUno && x.numeroUno.por === u.id) x.numeroUno = null; });
  a.numeroUno = { por: u.id, desde: new Date().toISOString(),
                  hasta: new Date(Date.now() + 24 * 3600000).toISOString() };
  guardar();
  avisar(`🥇 "${a.titulo}" está en el puesto número uno por 24 horas`, 'ok');
  pintarLista(); cerrarTodo();
}
function quitarNumeroUno(artId) {
  const a = BD.articulos.find(x => String(x.id) === String(artId));
  if (a) { a.numeroUno = null; guardar(); avisar('Ya no está en el número uno'); pintarLista(); }
}

/* ---------------------------------------------------------------------
   PANEL DE TENDENCIAS
   --------------------------------------------------------------------- */
function pintarTendencias() {
  const caja = $('#panelSuper');
  if (!caja) return;
  const u = yo();
  if (!esSuperVip(u)) { caja.hidden = true; return; }
  caja.hidden = false;

  const t = tendencias();
  const topCalor = Math.max(1, ...t.cats.map(c => c.calor));
  const mios = BD.articulos.filter(a => a.usuario === u.id);
  const uno = numeroUnoActivo();

  caja.innerHTML = `
    <div class="super-cab">
      <span class="chip3d">👑 PREMIUM</span>
      <h3>Lo que se está moviendo ahora mismo</h3>
      <p class="nota">Esto lo ves solo tú. Úsalo para publicar lo que la gente sí está buscando.</p>
    </div>

    <div class="pro-stats">
      <div><b>${t.cats[0] ? t.cats[0].emo : '—'}</b><span>Categoría más caliente<br>${esc(t.cats[0] ? t.cats[0].nombre : '—')}</span></div>
      <div><b>${String(t.mejorHora).padStart(2, '0')}:00</b><span>Mejor hora para publicar</span></div>
      <div><b>${esc(t.ciudades[0] ? t.ciudades[0].ciudad : '—')}</b><span>Zona con más movimiento</span></div>
      <div><b>${BD.deseos.filter(d => d.activo).length}</b><span>Pedidos activos ahora</span></div>
    </div>

    <div class="tarjeta">
      <h4>🔥 Categorías por calor</h4>
      <p class="nota">Mezcla lo que la gente pide, lo que mira y lo que termina cambiando.</p>
      ${t.cats.slice(0, 8).map(c => `
        <div class="barra-ciudad">
          <span>${c.emo} ${esc(c.nombre)}</span>
          <div class="pista"><i style="width:${(c.calor / topCalor * 100).toFixed(1)}%"></i></div>
          <span style="width:64px;text-align:right;font-weight:700">${c.calor}</span>
        </div>`).join('')}
    </div>

    <div class="dos-cols">
      <div class="tarjeta">
        <h4>🔎 Lo que más buscan</h4>
        ${t.buscado.length ? `<div class="nube">${t.buscado.map(([p, n]) => `
          <span class="palabra" style="font-size:${Math.min(11 + n * 1.6, 22)}px">${esc(p)}
            <b>${n}</b></span>`).join('')}</div>`
          : '<p class="nota">Todavía no hay búsquedas suficientes.</p>'}
      </div>
      <div class="tarjeta">
        <h4>🏙️ Zonas más activas</h4>
        ${t.ciudades.length ? t.ciudades.map(c => `
          <div class="pro-fila"><div class="info"><b>${esc(c.ciudad)}</b>
            <span>${c.n} publicación(es) · ${c.vistas} vistas</span></div></div>`).join('')
          : '<p class="nota">Sin datos todavía.</p>'}
      </div>
    </div>

    <div class="tarjeta">
      <h4>🚀 Publicaciones más calientes</h4>
      ${t.calientes.length ? t.calientes.map((x, i) => `
        <div class="pro-fila">
          <span class="puesto">${i + 1}</span>
          <img src="${foto(x.a)}" alt="" data-art="${x.a.id}" style="cursor:pointer">
          <div class="info"><b>${esc(x.a.titulo)}</b>
            <span>👁 ${x.a.vistas || 0} · ❤️ ${x.a.favs || 0} · 🔥 calor ${x.calor}</span></div>
          <button class="btn-t" data-art="${x.a.id}">Ver</button>
        </div>`).join('') : '<p class="nota">Todavía no hay movimiento que medir.</p>'}
    </div>

    <div class="tarjeta">
      <h4>🥇 Puesto número uno</h4>
      <p class="nota">Pon una publicación tuya arriba de TODO el sistema por 24 horas.
        Solo una a la vez.</p>
      ${uno && uno.numeroUno.por === u.id
        ? `<div class="reserva-cinta">🥇 <b>${esc(uno.titulo)}</b> está en el número uno ·
             quedan ${restanteTxt(uno.numeroUno.hasta)}
             <button class="btn-t" style="margin-left:auto" data-quitaruno="${uno.id}">Quitar</button>
           </div>`
        : mios.length
          ? `<div class="elegir-uno">${mios.slice(0, 8).map(a => `
              <button class="btn suave sm" type="button" data-numerouno="${a.id}">🥇 ${esc(a.titulo)}</button>`).join('')}</div>`
          : '<p class="nota">Publica algo primero y podrás ponerlo en el número uno.</p>'}
    </div>`;
}

/* Las tendencias y el número uno vencen solos cuando vence el Premium */
function vencerSuperVip() {
  let cambio = false;
  BD.articulos.forEach(a => {
    if (a.numeroUno && new Date(a.numeroUno.hasta) < new Date()) { a.numeroUno = null; cambio = true; }
  });
  if (cambio) guardar();
}
