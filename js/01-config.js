/* ===================================================================
   TRUEQUEA PE · Configuración, categorías, ciudades y el modelo de datos
   Archivo: js/01-config.js
   =================================================================== */

/* =====================================================================
   TRUEQUEA PE — Motor completo (sin servidor)
   Todo se guarda en el navegador con localStorage.
   ===================================================================== */
'use strict';

const LLAVE = 'truequea_pe_v10';

/* Reservas Premium: máximo UNA HORA. Mientras dura, solo el Premium que
   reservó puede interactuar; los demás ven la publicación pero bloqueada. */
const RESERVA_MAX_MIN  = 60;
const RESERVA_OPCIONES = [15, 30, 45, 60];

/* Categoría exclusiva: solo los Premium publican y proponen aquí */
const CATEGORIAS_VIP = [
  ['Laptops', '💻'], ['iPhones', '📱'], ['PlayStation / Xbox', '🎮'],
  ['Cámaras', '📷'], ['Accesorios de auto', '🚗'], ['Celulares gama alta', '📲'],
];

/* Referencias del sistema para el análisis del trueque.
   NO son precios de venta: solo sirven para comparar si el cambio es parejo. */
const REFERENCIA = {
  1:[80, 1200], 2:[20, 120], 3:[30, 300], 4:[40, 500], 5:[10, 60], 6:[300, 6000],
  7:[30, 400], 8:[20, 200], 9:[25, 350], 10:[30, 300], 11:[20, 200], 12:[20, 150],
};
const REF_VIP = { 'Laptops':[900, 3500], 'iPhones':[800, 4000], 'PlayStation / Xbox':[700, 2600],
  'Cámaras':[500, 3000], 'Accesorios de auto':[100, 900], 'Celulares gama alta':[600, 2800] };
const PESO_CONDICION = { nuevo:1, como_nuevo:.82, usado:.6, para_reparar:.32 };

/* Impulso: la publicación sube al primer lugar por horas */
const IMPULSO_OPCIONES = [24, 48];

/* Frases rápidas del chat Premium */
const FRASES_PRO = [
  'Hola, me interesa tu artículo. ¿Sigue disponible?',
  '¿Podemos vernos en una zona segura?',
  'Te propongo cambiarlo por lo que tengo publicado.',
  '¿A qué hora te queda bien hoy?',
  'Perfecto, cerramos el trueque 👍',
];

const CATEGORIAS = [
  ['Electrónica','💻'], ['Ropa y Accesorios','👕'], ['Hogar','🏠'], ['Deportes','⚽'],
  ['Libros','📖'], ['Vehículos','🚗'], ['Arte','🎨'], ['Juguetes','🎮'],
  ['Herramientas','🔧'], ['Servicios','💼'], ['Mascotas','🐾'], ['Otros','📦'],
];

/* Ciudades con coordenadas reales para pintar el mapa */
const CIUDADES = {
  'Chincha Alta':  [-13.4098, -76.1322],
  'Chincha Baja':  [-13.4497, -76.1706],
  'Sunampe':       [-13.4310, -76.1550],
  'Pueblo Nuevo':  [-13.4020, -76.1180],
  'Grocio Prado':  [-13.4180, -76.1620],
  'Tambo de Mora': [-13.4650, -76.1880],
  'El Carmen':     [-13.4980, -76.0790],
  'San Ignacio':   [-13.4700, -76.0500],
  'Alto Larán':    [-13.4550, -76.0900],
  'Ica':           [-14.0678, -75.7286],
  'Pisco':         [-13.7100, -76.2036],
  'Nasca':         [-14.8290, -74.9370],
  'Lima':          [-12.0464, -77.0428],
  'Callao':        [-12.0566, -77.1181],
};
const LISTA_CIUDADES = Object.keys(CIUDADES);

const ZONAS_SEGURAS = [
  { nombre:'Comisaría PNP Chincha Alta', ciudad:'Chincha Alta', lat:-13.4105, lon:-76.1340, tipo:'Comisaría' },
  { nombre:'Plaza de Armas de Chincha',  ciudad:'Chincha Alta', lat:-13.4090, lon:-76.1300, tipo:'Plaza' },
  { nombre:'Municipalidad de Chincha',   ciudad:'Chincha Alta', lat:-13.4120, lon:-76.1280, tipo:'Municipalidad' },
  { nombre:'Comisaría de Sunampe',       ciudad:'Sunampe',      lat:-13.4320, lon:-76.1560, tipo:'Comisaría' },
  { nombre:'Plaza Vea Ica',              ciudad:'Ica',          lat:-14.0700, lon:-75.7300, tipo:'Centro comercial' },
  { nombre:'Comisaría de Pisco',         ciudad:'Pisco',        lat:-13.7110, lon:-76.2040, tipo:'Comisaría' },
];

const CONDICIONES = { nuevo:'Nuevo', como_nuevo:'Como nuevo', usado:'Usado', para_reparar:'Para reparar' };
const LIMITE_GRATIS = 20;

/* Imagen de reemplazo cuando un artículo no tiene foto */
const SIN_FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
  '<rect width="100%" height="100%" fill="#e9edf5"/>' +
  '<text x="50%" y="46%" font-family="sans-serif" font-size="46" fill="#b3bccd" text-anchor="middle">📦</text>' +
  '<text x="50%" y="60%" font-family="sans-serif" font-size="16" fill="#9aa4b8" text-anchor="middle">Sin foto</text></svg>');

/* Logo por defecto de Truequea PE */
const LOGO_DEFECTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0%" stop-color="#ffc24d"/><stop offset="100%" stop-color="#c9922a"/></linearGradient></defs>' +
  '<rect width="120" height="120" rx="30" fill="url(#g)"/>' +
  '<g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M30 46h44"/><path d="M62 34l12 12-12 12"/>' +
  '<path d="M90 74H46"/><path d="M58 86 46 74l12-12"/></g></svg>');

/* Patrón e ilustración de la portada */
const PATRON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="270" height="270">' +
  '<g fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".55">' +
  '<g transform="translate(30,34)"><path d="M2 12a16 16 0 0 1 27-11"/><path d="M29 -5v6h-6"/>' +
  '<path d="M32 20a16 16 0 0 1-27 11"/><path d="M5 37v-6h6"/></g>' +
  '<g transform="translate(170,190)"><path d="M2 12a16 16 0 0 1 27-11"/><path d="M29 -5v6h-6"/>' +
  '<path d="M32 20a16 16 0 0 1-27 11"/><path d="M5 37v-6h6"/></g>' +
  '<g transform="translate(120,24)"><path d="M0 8 14 0l14 8v16l-14 8-14-8z"/><path d="M0 8l14 8 14-8M14 16v16"/></g>' +
  '<g transform="translate(40,180)"><path d="M0 8 14 0l14 8v16l-14 8-14-8z"/><path d="M0 8l14 8 14-8M14 16v16"/></g>' +
  '<g transform="translate(210,60)"><path d="M14 0H4a4 4 0 0 0-4 4v10l16 16 12-12z"/><circle cx="7" cy="7" r="2.2"/></g>' +
  '<g transform="translate(96,120)"><path d="M14 0H4a4 4 0 0 0-4 4v10l16 16 12-12z"/><circle cx="7" cy="7" r="2.2"/></g>' +
  '<g transform="translate(150,230)"><path d="M10 26S0 16 0 9a10 10 0 0 1 20 0c0 7-10 17-10 17z"/><circle cx="10" cy="9" r="3.4"/></g>' +
  '</g></svg>');

const ILUSTRACION = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" fill="none">' +
  '<g stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".62">' +
  '<circle cx="450" cy="300" r="240" opacity=".4"/><circle cx="450" cy="300" r="186" stroke-dasharray="9 13" opacity=".5"/>' +
  '<g transform="translate(240,215)"><circle cx="46" cy="30" r="30"/><path d="M6 156c0-30 18-52 40-52s40 22 40 52"/>' +
  '<path d="M86 120l52-16"/><g transform="translate(130,70)"><path d="M0 22 38 0l38 22v44L38 88 0 66z"/>' +
  '<path d="M0 22l38 22 38-22M38 44v44"/></g></g>' +
  '<g transform="translate(570,215) scale(-1,1)"><circle cx="46" cy="30" r="30"/>' +
  '<path d="M6 156c0-30 18-52 40-52s40 22 40 52"/><path d="M86 120l52-16"/>' +
  '<g transform="translate(130,70)"><path d="M0 22 38 0l38 22v44L38 88 0 66z"/><path d="M0 22l38 22 38-22M38 44v44"/></g></g>' +
  '</g><g stroke="#f5c451" stroke-width="3.4" stroke-linecap="round" opacity=".8" transform="translate(405,286)">' +
  '<path d="M0 12h70"/><path d="M56 0l14 12-14 12"/><path d="M84 44h-70"/><path d="M28 56 14 44l14-12"/></g></svg>');

/* ---------------------------------------------------------------
   Base de datos local
   --------------------------------------------------------------- */
let BD = null;

function hace(dias = 0, hora = 10) {
  const f = new Date();
  f.setDate(f.getDate() - dias); f.setHours(hora, 0, 0, 0);
  return f.toISOString();
}

function semilla() {
  /* ---------------------------------------------------------------
     SISTEMA VACÍO, LISTO PARA LANZAR.
     Solo queda la cuenta de administrador. Ni un usuario de prueba,
     ni una publicación, ni un anuncio inventado.
     --------------------------------------------------------------- */
  const usuarios = [
    { id: 1, nombre: 'Angel Levano', email: 'admin@truequea.pe',
      pass: 'admin123',                 // se convierte en huella al primer ingreso
      rol: 'admin', ciudad: 'Chincha Alta', avatar: null, telefono: '',
      bio: '', ref: '', lat: -13.4098, lon: -76.1322,
      premium: true, premiumHasta: null,
      puntos: 0, nivel: 1, estado: 'activo', creado: new Date().toISOString(),
      verificado: true, codigo: 'TRUEQUEA-1000', avisos: true,
      impulsosGratis: 3, proMes: new Date().toISOString().slice(0, 7) },
  ];

  return {
    version: 10,
    usuarios,
    articulos: [], anuncios: [], intercambios: [], chats: [], mensajes: [],
    notis: [], favoritos: [], resenas: [], pagos: [], visitas: [],
    deseos: [], seguros: [], borrados: {},
    seguridad: { intentos: {}, registro: [] },
    config: {
      nombre: 'Truequea PE',
      lema: 'Trueque justo y cercano — aquí no se compra, se cambia',
      logo: null, color: '#0b63d6', tema: 'claro',
      yapeQr: null, yapeNombre: 'Angel Levano', yapeNumero: '',
      precioPremium: 5, precioImpulso: 1, precioSeguro: 1,
      autoYape: true, yapeMinimo: 5, yapeCodigos: [],
      /* WhatsApp del dueño: aquí llegan los avisos y a aquí se manda a la
         gente al registrarse y al publicar */
      whatsapp: '',
      waPublicar: true,   // aviso obligatorio al publicar
      contacto: {
        nombre: 'Angel Levano', cargo: 'Administrador de Truequea PE',
        telefono: '', email: '', wa: 'https://wa.me/qr/Z6T6N7FJTXCNH1',
        horario: 'Lunes a sábado · 9:00 a 20:00',
        texto: '¿Tienes un negocio en Chincha o Ica? Escríbeme y publicamos tu anuncio.',
      },
      avisoWhatsApp: true,
    },
    sesion: null, seq: 100,
  };
}

function cargarBD() {
  if (BD) return BD;
  try {
    const txt = localStorage.getItem(LLAVE);
    BD = txt ? JSON.parse(txt) : semilla();
    if (!BD.version || BD.version < 10) BD = semilla();
  } catch { BD = semilla(); }
  if (!BD.visitas) BD.visitas = [];
  if (!BD.deseos)  BD.deseos = [];
  if (!BD.seguros) BD.seguros = [];
  return BD;
}

/* Registra un ingreso al sistema (sirve para el gráfico del administrador) */
function registrarVisita(uid) {
  const b = cargarBD();
  const hoy = new Date().toISOString().slice(0, 10);
  const v = b.visitas.find(x => x.dia === hoy);
  if (v) { v.total++; if (uid && !v.usuarios.includes(uid)) v.usuarios.push(uid); }
  else b.visitas.push({ dia: hoy, total: 1, usuarios: uid ? [uid] : [] });
  if (b.visitas.length > 120) b.visitas = b.visitas.slice(-120);
  guardar();
}

/* Enlace de WhatsApp listo para abrir con el mensaje escrito */
function linkWA(numero, texto) {
  const n = String(numero || '').replace(/\D/g, '');
  const num = n.length === 9 ? '51' + n : n;
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(texto || '');
}
/* WhatsApp del administrador (para avisos de interesados) */
function waAdmin(texto) {
  const c = (cargarBD().config.contacto) || {};
  if (c.telefono && String(c.telefono).replace(/\D/g, '').length >= 9) return linkWA(c.telefono, texto);
  return c.wa || 'https://wa.me/qr/Z6T6N7FJTXCNH1';
}

/* Las reservas Premium se sueltan solas cuando vence el plazo */
function liberarReservas() {
  const b = cargarBD();
  let cambio = false;
  b.articulos.forEach(a => {
    if (a.reserva && new Date(a.reserva.hasta) < new Date()) {
      if (a.estado === 'reservado') a.estado = 'disponible';
      a.reserva = null; cambio = true;
    }
  });
  if (cambio) guardar();
}
function reservaActiva(a) {
  return a && a.reserva && new Date(a.reserva.hasta) > new Date() ? a.reserva : null;
}
function restanteTxt(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return 'vencida';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h) return `${h} h ${m} min`;
  return m ? `${m} min` : `${s} s`;
}

/* --- Impulso: la publicación sube al primer lugar por horas pagadas --- */
function impulsoActivo(a) {
  return a && a.impulso && new Date(a.impulso.hasta) > new Date() ? a.impulso : null;
}
function vencerImpulsos() {
  const b = cargarBD();
  let cambio = false;
  b.articulos.forEach(a => {
    if (a.impulso && new Date(a.impulso.hasta) < new Date()) { a.impulso = null; cambio = true; }
  });
  if (cambio) guardar();
}

/* --- Bloqueo por reserva ---
   Mientras un Premium tiene reservada una publicación, el resto la VE
   pero no puede proponer, escribir ni marcar interés. */
function bloqueadoPorReserva(a, u) {
  const r = reservaActiva(a);
  if (!r) return false;
  if (!u) return true;
  return u.id !== r.por && u.id !== a.usuario && u.rol !== 'admin';
}

/* --- Nivel Premium: sube según los trueques cerrados --- */
const NIVELES_PRO = [
  { min:0,  nombre:'Bronce',   emo:'\u{1F949}', color:'#c98a3d' },
  { min:5,  nombre:'Plata',    emo:'\u{1F948}', color:'#b9c2cf' },
  { min:15, nombre:'Oro',      emo:'\u{1F947}', color:'#ffd76a' },
  { min:30, nombre:'Diamante', emo:'\u{1F48E}', color:'#8fe8ff' },
];
function nivelPro(u) {
  const n = u ? truequesDe(u.id) : 0;
  let nivel = NIVELES_PRO[0];
  NIVELES_PRO.forEach(x => { if (n >= x.min) nivel = x; });
  const sig = NIVELES_PRO.find(x => x.min > n);
  return { ...nivel, trueques: n, siguiente: sig, faltan: sig ? sig.min - n : 0 };
}

/* --- Impulsos de regalo del Premium: 3 cada mes --- */
function impulsosDisponibles(u) {
  if (!u || !u.premium) return 0;
  const mes = new Date().toISOString().slice(0, 7);
  /* al hacerse Premium, y luego cada mes, se le regalan 3 impulsos */
  if (u.proMes !== mes) { u.proMes = mes; u.impulsosGratis = 3; guardar(); }
  return u.impulsosGratis || 0;
}

/* --- VIP: solo los Premium participan en esa categoría --- */
function bloqueadoPorVip(a, u) {
  return !!(a && a.vip) && !(u && (u.premium || u.rol === 'admin'));
}
function guardar() {
  try { localStorage.setItem(LLAVE, JSON.stringify(BD)); }
  catch (e) { avisar('No se pudo guardar: el almacenamiento del navegador está lleno.', 'err'); }
}
function nuevoId() { BD.seq = (BD.seq || 100) + 1; guardar(); return BD.seq; }

/* Sesión: se guarda el id del usuario y se restaura al abrir la página */
function yo() {
  const b = cargarBD();
  if (!b.sesion) return null;
  const u = b.usuarios.find(x => x.id === b.sesion);
  if (!u || u.estado !== 'activo') { b.sesion = null; guardar(); return null; }
  // el premium vence solo
  if (u.premium && u.premiumHasta && new Date(u.premiumHasta) < new Date()) {
    u.premium = false; u.premiumHasta = null; guardar();
  }
  return u;
}
function entrar(u) { BD.sesion = u.id; guardar(); }
function salir()   { BD.sesion = null; guardar(); }
