// =====================================================================
// Panel de Contenido — capa de datos (sin nada de pantalla).
//
// Escrita por Opus; la pantalla (ui.js) solo llama a window.TLC.
//
// REGLAS DE STOCK: no se copian a mano. Se leen en vivo del app.js del
// dashboard (mismo truco que Desktop\Timeless Excel\catalogo-publico.js),
// así que si el dashboard cambia una regla, el panel la toma solo.
//
// PRIVACIDAD: los datos que llegan del Apps Script traen costos (Stocks,
// bloques). Este archivo NUNCA los pasa a la pantalla: TLC.productos()
// devuelve solo stock, ventas en unidades, fechas y textos.
//
// ALMACÉN: todo lo que el panel guarda va al almacén "metas" que ya existe en
// el Apps Script (acción metaGuardar, upsert por id). No hizo falta tocar el
// doGet ni redeployar. Ids que usa este panel:
//   contenido-plan-AAAA-MM-DD    plan de la semana (lunes): {texto, origen, archivo, subido}
//   contenido-marcas-AAAA-MM-DD  estados de esa semana: {items:{id:{e,t}}, tiktok:{n,t}}
//   contenido-ajustes            {metas:{posts,historias,tiktok}, ultimoPost:{key:{f,t}}, checks:{id:{v,t}}}
//   ig-contenido                 lo escribe Contenido.gs (posts recientes, historias, comentarios)
// =====================================================================
(function(){
'use strict';

const cfg = (typeof TIMELESS_CONFIG !== 'undefined') ? TIMELESS_CONFIG : {};
const CLAVE_API_KEY = 'timeless_clave_api';          // la misma del dashboard (mismo origen)
const CACHE_DASH_KEY = 'timeless_dashboard_data';    // snapshot que guarda el dashboard
const CACHE_PANEL_KEY = 'timeless_contenido_cache';  // snapshot propio (metas + ig)
const DIA_MS = 86400000;
// Modo demo (?demo en la dirección): lee contenido/demo-datos.json (copia SIN
// costos, solo existe en la laptop, está en .gitignore) y NO escribe nada en el
// Sheets: las marcas se quedan en memoria. Sirve para probar la pantalla.
const DEMO = typeof location !== 'undefined' && /[?&]demo\b/.test(location.search);

// ---------- Utilidades de fecha (hora local = Lima en sus aparatos) ----------
function dayKey(d){ return +new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function hoy0(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
function iso(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function deIso(s){ const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||'')); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; }
function sumarDias(d, n){ const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function lunesDe(d){ const x = new Date(d); x.setHours(0,0,0,0); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; }
function semanaId(d){ return iso(lunesDe(d || new Date())); }
const DIAS_CORTO = ['LUN','MAR','MIE','JUE','VIE','SAB','DOM'];
const MES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic'];
function fechaCorta(d){ return d ? (d.getDate() + ' ' + MES_CORTO[d.getMonth()]) : ''; }
function normTxt(s){
  return (s == null ? '' : String(s)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------- API (misma clave y misma URL que el dashboard) ----------
function clave(){ try{ return localStorage.getItem(CLAVE_API_KEY) || ''; }catch(e){ return ''; } }
function guardarClave(v){ try{ localStorage.setItem(CLAVE_API_KEY, String(v||'').trim()); }catch(e){} }
function urlApi(action){
  const k = clave();
  return cfg.WEBHOOK_URL + '?action=' + encodeURIComponent(action) + (k ? '&k=' + encodeURIComponent(k) : '') + '&_cb=' + Date.now();
}
class ErrorClave extends Error {}
async function apiGet(action, intentos){
  intentos = intentos == null ? 2 : intentos;
  try{
    const r = await fetch(urlApi(action), {cache:'no-store'});
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if(j && j.ok === false && j.error === 'clave') throw new ErrorClave('clave');
    if(!j || j.ok === false) throw new Error((j && j.error) || 'sin respuesta');
    return j;
  }catch(e){
    if(e instanceof ErrorClave || intentos <= 1) throw e;
    await new Promise(res => setTimeout(res, 1500));
    return apiGet(action, intentos - 1);
  }
}
async function apiPost(obj){
  if(DEMO){ await new Promise(r => setTimeout(r, 300)); return {ok:true, demo:true}; }
  const o = Object.assign({}, obj); const k = clave(); if(k) o.k = k;
  const r = await fetch(cfg.WEBHOOK_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(o)});
  const j = await r.json();
  if(j && j.ok === false && j.error === 'clave') throw new ErrorClave('clave');
  if(!j || !j.ok) throw new Error((j && j.error) || 'no se guardó');
  return j;
}

// ---------- Reglas del dashboard, leídas de su app.js ----------
// Los rangos son los mismos que usa catalogo-publico.js (probados en el sync de
// cada noche) más el bloque de velocidad de venta.
let LIB = null;
async function cargarReglas(){
  if(LIB) return LIB;
  const src = await (await fetch('../app.js', {cache:'no-store'})).text();
  const pick = (a, b) => {
    const i = src.indexOf(a), j = src.indexOf(b, i + 1);
    if(i < 0 || j < 0) throw new Error('El app.js del dashboard cambió y no encuentro: ' + a);
    return src.slice(i, j);
  };
  const code = [
    'var cfg = (typeof TIMELESS_CONFIG !== "undefined") ? TIMELESS_CONFIG : {};',
    pick('function parseMoney', 'function monthKey'),
    'function monthKey(d){ return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0"); }',
    'function body(rows){ return rows && rows.length > 1 ? rows.slice(1) : []; }',
    'function dayKey(d){ return +new Date(d.getFullYear(), d.getMonth(), d.getDate()); }',
    'function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }',
    pick('function normName', '// Pestaña "Campañas"'),
    pick('function getStocks', '\n}\n') + '\n}\n',
    pick('function getGastos', '// Notas de canje en texto libre'),
    pick('const CANJE_PALABRAS_CLAVE', '// Suma de "Inversión"'),
    pick('function getUltimaVentaPorProducto', '// "hace X días", y a partir de mes y medio'),
    pick('const CAT_ORDEN', '// Filtros y vista del catálogo'),
    pick('function catalogoSoloEnHojaStocks', 'function catalogoFilaHtml'),
    // Velocidad de venta y "días para agotar" (lee los reinicios de ritmo que
    // Alberto marca en el dashboard: mismo localStorage, mismo origen).
    pick('const STOCK_UMBRAL', 'function renderStock'),
    'var metas = {};',
    'return { setMetas: function(m){ metas = m || {}; }, getStocks: getStocks, getGastos: getGastos,',
    '  getVentasDetalle: getVentasDetalle, splitCombo: splitCombo, normProducto: normProducto,',
    '  getUltimaVentaPorProducto: getUltimaVentaPorProducto, setUltima: function(u){ ULTIMA_VENTA = u; },',
    '  getCatalogo: getCatalogo, bloquesDeProducto: bloquesDeProducto, bloqueEnCamino: bloqueEnCamino,',
    '  fechaPedidoFiable: fechaPedidoFiable, getVelocidadVenta: getVelocidadVenta, diasParaAgotar: diasParaAgotar,',
    '  parseDateSmart: parseDateSmart, VELOCIDAD_DIAS: VELOCIDAD_DIAS };',
  ].join('\n');
  LIB = new Function(code)();
  return LIB;
}

// ---------- Reglas propias del panel ----------
// Cuánto tardaron los pedidos anteriores de cada tienda (días desde el pedido).
const LLEGADA_DIAS = { temu:[11,13], shein:[9,15], alibaba:[13,21] };
const LLEGADA_DEFAULT = [9,21];
// Lotes que NO deben salir "en camino" aunque los números lo sugieran.
// Púas punk: 20 u del 13-sep, llegaron defectuosas y se dieron por perdidas.
const NUNCA_EN_CAMINO = ['collar puas punk'];
const URGENCIA_MAX = 3;      // ≤3 unidades = urgencia
const ESTANCADO_VENTAS = 2;  // <2 ventas en 14 días con stock = estancado
const AGOTADO_RECIENTE_DIAS = 30; // agotados más viejos no se muestran en la lista principal

// Cómo aparecen los productos en los captions de Instagram (además del nombre
// sin la categoría). Clave = normProducto del producto.
const ALIAS_CAPTION = {
  'cinturon black cross deluxe': ['black cross deluxe', 'bcd'],
  'cinturon dark knight': ['dark knight'],
  'cinturon white spider': ['white spider'],
  'cinturon black spider': ['black spider'],
  'cinturon chrome hearts': ['chrome hearts'],
  'pant chain chrome hearts': ['pant chain chrome hearts', 'pant chain ch'],
  'anillo demon wings duki': ['anillos duki', 'anillos', 'demon wings'],
  'anillo angel wings duki': ['anillos duki', 'anillos', 'angel wings'],
};
const CATEGORIAS = [
  {id:'cinturon', nombre:'Cinturones', rx:/^cinturon\b/},
  {id:'collar', nombre:'Collares', rx:/^collar\b/},
  {id:'pantchain', nombre:'Pant chains', rx:/^pant ?chain\b/},
  {id:'anillo', nombre:'Anillos', rx:/^anillo\b/},
];
function categoriaDe(key){ const c = CATEGORIAS.find(c => c.rx.test(key)); return c ? c.id : 'otros'; }
function plataformaKey(p){ const n = normTxt(p); return n.includes('temu') ? 'temu' : n.includes('shein') ? 'shein' : n.includes('alibaba') ? 'alibaba' : ''; }
function nombreCorto(producto){ return normTxt(producto).replace(/^(cinturon|cinto|collar|collares|pant chain|anillo)\s+/, ''); }

// ---------- Plan semanal: texto → estructura ----------
// Formato (lo genera el chat "Marketing y creativos"):
//   SEMANA 2026-11-16
//   LUN 16/11
//   POST 18:00 | Carrusel ... | Cinturon dark knight      (producto opcional)
//   HIST 12:00 | Texto de la historia
//   TIKTOK 19:00 | ...                                      (opcional)
// Líneas vacías o que empiezan con # se ignoran.
const TIPOS = {POST:'post', HIST:'historia', HISTORIA:'historia', TIKTOK:'tiktok', TT:'tiktok', REEL:'post'};
function parsePlan(texto){
  const out = {semana:null, dias:[], errores:[]};
  let dia = null;
  const lineas = String(texto || '').replace(/\r/g, '').split('\n');
  lineas.forEach((raw, n) => {
    const l = raw.trim();
    if(!l || l.startsWith('#')) return;
    let m = /^SEMANA\s+(\d{4}-\d{2}-\d{2})/i.exec(l);
    if(m){ out.semana = iso(lunesDe(deIso(m[1]))); return; }
    m = /^(LUN|MAR|MIE|MIÉ|JUE|VIE|SAB|SÁB|DOM)\w*\s+(\d{1,2})\/(\d{1,2})/i.exec(l);
    if(m){
      const nombre = normTxt(m[1]).toUpperCase().slice(0,3);
      let fecha = null;
      if(out.semana){
        const lun = deIso(out.semana);
        const idx = DIAS_CORTO.indexOf(nombre);
        fecha = idx >= 0 ? sumarDias(lun, idx) : null;
      }
      if(!fecha){ const y = new Date().getFullYear(); fecha = new Date(y, +m[3]-1, +m[2]); }
      dia = {dia:nombre, fecha:iso(fecha), items:[]};
      out.dias.push(dia);
      return;
    }
    m = /^([A-ZÁÉÍÓÚ]+(?:\s*\+\s*[A-ZÁÉÍÓÚ]+)?)\s+(\d{1,2}:\d{2})(?:\s*[-–]\s*(\d{1,2}:\d{2}))?\s*\|\s*([^|]*?)\s*(?:\|\s*(.*?)\s*)?$/i.exec(l);
    if(m && dia){
      // "POST+TIKTOK" = un post que también va a TikTok (cuenta como post, con tiktok:true).
      const partes = m[1].split('+').map(p => TIPOS[normTxt(p).toUpperCase()]);
      const tipo = partes[0];
      if(!tipo || partes.some(p => !p)){ out.errores.push('Línea ' + (n+1) + ': tipo desconocido "' + m[1] + '"'); return; }
      const extraTiktok = partes.length > 1 && partes.indexOf('tiktok') > 0;
      const hora = m[2].padStart(5, '0');
      const texto = m[4] || '';
      const mismo = dia.items.filter(it => it.tipo === tipo && it.hora === hora).length;
      dia.items.push({
        id: dia.fecha + '|' + tipo + '|' + hora + '|' + mismo,
        tipo, hora, horaFin: m[3] || '', texto, producto: (m[5] || '').trim(),
        tiktok: tipo === 'tiktok' || extraTiktok || /tik ?tok/i.test(texto),
      });
      return;
    }
    out.errores.push('Línea ' + (n+1) + ': no la entendí → "' + l.slice(0, 60) + '"');
  });
  if(!out.semana && out.dias.length) out.semana = iso(lunesDe(deIso(out.dias[0].fecha)));
  out.dias.forEach(d => d.items.sort((a, b) => a.hora.localeCompare(b.hora)));
  return out;
}

// ---------- Almacén (metas del Apps Script) ----------
let METAS = {};       // id -> data, tal como viene del Sheets
let IG_DASH = null;   // ?action=instagram (top publicaciones del dashboard)
function leerCachePanel(){ try{ return JSON.parse(localStorage.getItem(CACHE_PANEL_KEY)) || null; }catch(e){ return null; } }
function guardarCachePanel(){ if(DEMO) return; try{ localStorage.setItem(CACHE_PANEL_KEY, JSON.stringify({metas: soloMetasPanel(METAS), ig: IG_DASH, t: Date.now()})); }catch(e){} }
// Para la caché local solo se guarda lo del panel + lo que necesitan las reglas
// (catalogo, llegadas, bloques). Los costos de bloques ya están en el snapshot
// del dashboard de este mismo aparato; no se expone nada nuevo.
function soloMetasPanel(m){
  const o = {};
  Object.keys(m || {}).forEach(id => {
    if(/^(contenido-|ig-contenido$|catalogo$|llegadas$|bloques$)/.test(id)) o[id] = m[id];
  });
  return o;
}
async function recargarMetas(){
  if(DEMO) return METAS;
  const j = await apiGet('metas');
  const m = {};
  (j.metas || []).forEach(x => { m[x.id] = x.data; });
  METAS = m;
  guardarCachePanel();
  return METAS;
}

// Escritura con mezcla: antes de guardar se relee lo que hay en el Sheets y se
// mezcla ítem por ítem (gana la marca más nueva). Así el celular y la PC no se
// pisan aunque marquen cosas distintas casi a la vez.
function mezclarMapa(remoto, local){
  const out = Object.assign({}, remoto || {});
  Object.keys(local || {}).forEach(k => {
    const a = out[k], b = local[k];
    if(!a || (b && (b.t || 0) >= (a.t || 0))) out[k] = b;
  });
  return out;
}
const PENDIENTES_ESCRITURA = {}; // id -> data local por subir
let escribiendo = false;
let timerEscritura = null;
const oyentesEstado = [];
function avisar(estado){ oyentesEstado.forEach(f => { try{ f(estado); }catch(e){} }); }
function programarEscritura(){
  clearTimeout(timerEscritura);
  avisar('pendiente');
  timerEscritura = setTimeout(vaciarEscrituras, 1200);
}
async function vaciarEscrituras(){
  if(escribiendo){ programarEscritura(); return; }
  const ids = Object.keys(PENDIENTES_ESCRITURA);
  if(!ids.length){ avisar('ok'); return; }
  escribiendo = true; avisar('guardando');
  try{
    await recargarMetas().catch(() => null);
    for(const id of ids){
      const local = PENDIENTES_ESCRITURA[id];
      delete PENDIENTES_ESCRITURA[id];
      const remoto = METAS[id] || {};
      const data = mezclarDoc(id, remoto, local);
      METAS[id] = data;
      try{ await apiPost({type:'metaGuardar', id, data}); }
      catch(e){ PENDIENTES_ESCRITURA[id] = mezclarDoc(id, PENDIENTES_ESCRITURA[id] || {}, local); throw e; }
    }
    guardarCachePanel();
    avisar('ok');
  }catch(e){
    avisar(e instanceof ErrorClave ? 'clave' : 'error');
    setTimeout(programarEscritura, 15000); // reintenta solo
  }finally{ escribiendo = false; }
}
function mezclarDoc(id, remoto, local){
  if(/^contenido-marcas-/.test(id)){
    const tk = [remoto.tiktok, local.tiktok].filter(Boolean).sort((a, b) => (a.t||0) - (b.t||0)).pop();
    return { items: mezclarMapa(remoto.items, local.items), tiktok: tk || {n:0, t:0}, actualizado: new Date().toISOString() };
  }
  if(id === 'contenido-ajustes'){
    const mt = [remoto.metas, local.metas].filter(Boolean).sort((a, b) => (a.t||0) - (b.t||0)).pop();
    return { metas: mt || null, ultimoPost: mezclarMapa(remoto.ultimoPost, local.ultimoPost),
             checks: mezclarMapa(remoto.checks, local.checks) };
  }
  if(id === 'contenido-notas') return { items: mezclarMapa(remoto.items, local.items) };
  return local; // plan: reemplazo completo
}
function encolar(id, parcial){
  const actual = METAS[id] || {};
  const nuevo = mezclarDoc(id, actual, parcial);
  METAS[id] = nuevo;
  PENDIENTES_ESCRITURA[id] = mezclarDoc(id, PENDIENTES_ESCRITURA[id] || {}, parcial);
  guardarCachePanel();
  programarEscritura();
}

// ---------- Plan, marcas y ajustes (lo que usa la pantalla) ----------
const ESTADOS = ['pendiente', 'borrador', 'programado', 'publicado'];
function planDe(semana){
  const p = METAS['contenido-plan-' + semana];
  // (Si algún día llega como objeto {value: ...} — PowerShell 5.1 lo hacía — se toma el value.)
  const texto = p && (typeof p.texto === 'string' ? p.texto : (p.texto && p.texto.value));
  if(!texto) return null;
  const parsed = parsePlan(texto);
  parsed.origen = p.origen || ''; parsed.subido = p.subido || ''; parsed.archivo = p.archivo || '';
  return parsed;
}
function semanasConPlan(){
  const s = {};
  Object.keys(METAS).forEach(id => {
    const m = /^contenido-plan(?:completo)?-(\d{4}-\d{2}-\d{2})$/.exec(id);
    if(m) s[m[1]] = true;
  });
  return Object.keys(s).sort();
}
// Plan COMPLETO en Markdown (láminas, descripciones de IG/TikTok, historias con
// fondo y texto). Lo deja el chat de creativos como plan-AAAA-MM-DD-completo.md
// y lo sube el sync (o su script). Id "contenido-plancompleto-AAAA-MM-DD".
// Devuelve {md, archivo, subido} o null. La pantalla lo muestra en "Semana".
function planCompletoDe(semana){
  const p = METAS['contenido-plancompleto-' + semana];
  const md = p && (typeof p.md === 'string' ? p.md : (p.md && p.md.value));
  return md ? {md, archivo: p.archivo || '', subido: p.subido || ''} : null;
}
function guardarPlanTexto(texto){
  const p = parsePlan(texto);
  if(!p.semana) throw new Error('Falta la línea "SEMANA AAAA-MM-DD" al inicio.');
  const id = 'contenido-plan-' + p.semana;
  const data = {texto: String(texto), origen:'pegado', archivo:'', subido: new Date().toISOString()};
  METAS[id] = data;
  PENDIENTES_ESCRITURA[id] = data;
  guardarCachePanel(); programarEscritura();
  return p;
}
function marcasDe(semana){ return METAS['contenido-marcas-' + semana] || {items:{}, tiktok:{n:0, t:0}}; }
// Estado de un ítem: lo que marcó alguien (Alberto o el chat de creativos)
// gana siempre; si nadie lo marcó, se mira Instagram: si ese día salió un post,
// el post del plan cuenta como publicado; si salieron N historias, las N
// primeras historias del plan de ese día también. Así se marca solo.
function estadoItem(semana, itemId){ return estadoItemInfo(semana, itemId).e; }
function estadoItemInfo(semana, itemId){
  const it = marcasDe(semana).items[itemId];
  if(it && it.e) return {e: it.e, auto: false, t: it.t || 0};
  const a = autoEstados(semana)[itemId];
  return a ? {e: a, auto: true, t: 0} : {e: 'pendiente', auto: false, t: 0};
}
let AUTO_CACHE = {clave: '', mapa: {}};
function autoEstados(semana){
  const plan = planDe(semana);
  if(!plan) return {};
  const posts = postsInstagram(), hist = historiasInstagram();
  const clave = semana + '|' + posts.length + '|' + hist.length + '|' + (plan.subido || '');
  if(AUTO_CACHE.clave === clave) return AUTO_CACHE.mapa;
  const porDia = (fechas) => { const m = {}; fechas.forEach(d => { const k = iso(d); m[k] = (m[k] || 0) + 1; }); return m; };
  const postsDia = porDia(posts.map(p => p.date)), histDia = porDia(hist);
  const mapa = {};
  plan.dias.forEach(d => {
    let np = postsDia[d.fecha] || 0, nh = histDia[d.fecha] || 0;
    d.items.forEach(it => {   // ya vienen ordenados por hora
      if(it.tipo === 'post' && np > 0){ mapa[it.id] = 'publicado'; np--; }
      else if(it.tipo === 'historia' && nh > 0){ mapa[it.id] = 'publicado'; nh--; }
    });
  });
  AUTO_CACHE = {clave, mapa};
  return mapa;
}
function marcarItem(semana, itemId, estado){
  if(ESTADOS.indexOf(estado) < 0) estado = 'pendiente';
  encolar('contenido-marcas-' + semana, {items: {[itemId]: {e: estado, t: Date.now()}}});
}
function siguienteEstado(e){ return ESTADOS[(ESTADOS.indexOf(e) + 1) % ESTADOS.length]; }
function tiktokManual(semana){ const t = marcasDe(semana).tiktok; return (t && t.n) || 0; }
function setTiktokManual(semana, n){ encolar('contenido-marcas-' + semana, {tiktok: {n: Math.max(0, n|0), t: Date.now()}}); }
function ajustes(){ return METAS['contenido-ajustes'] || {metas:null, ultimoPost:{}, checks:{}}; }
function setMetasSemanales(m){ encolar('contenido-ajustes', {metas: Object.assign({}, m, {t: Date.now()})}); }
function marcarUltimoPost(productoKey, fechaIso){ encolar('contenido-ajustes', {ultimoPost: {[productoKey]: {f: fechaIso || null, t: Date.now()}}}); }
function checkFecha(id){ const c = ajustes().checks || {}; return !!(c[id] && c[id].v); }
function setCheckFecha(id, v){ encolar('contenido-ajustes', {checks: {[id]: {v: !!v, t: Date.now()}}}); }

// ---------- Instagram ----------
// Fuente principal: meta "ig-contenido" (Contenido.gs: posts recientes en orden
// de fecha, historias vistas, comentarios). Respaldo: las "mejores
// publicaciones" del dashboard (solo top 15 por interacción).
function igContenido(){ return METAS['ig-contenido'] || null; }
function postsInstagram(){
  const ic = igContenido();
  const lista = (ic && Array.isArray(ic.recientes) && ic.recientes.length) ? ic.recientes
    : ((IG_DASH && IG_DASH.media) || []).map(m => ({fecha: m.fecha, tipo: m.tipo, caption: m.caption, permalink: m.permalink}));
  return lista.map(p => Object.assign({}, p, {date: p.fecha ? new Date(p.fecha) : null}))
    .filter(p => p.date && !isNaN(p.date)).sort((a, b) => b.date - a.date);
}
function historiasInstagram(){
  const ic = igContenido();
  const h = (ic && ic.historias) || {};
  return Object.keys(h).map(id => new Date(h[id])).filter(d => !isNaN(d));
}
function comentariosSinResponder(){
  const ic = igContenido();
  if(!ic) return {disponible:false, motivo:'Falta activar Contenido.gs en el Apps Script.', lista:[]};
  if(ic.errorComentarios) return {disponible:false, motivo: ic.errorComentarios, lista:[]};
  return {disponible:true, lista: (ic.comentarios || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))};
}
function captionMenciona(caption, key, producto){
  const c = ' ' + normTxt(caption) + ' ';
  const claves = (ALIAS_CAPTION[key] || []).concat([nombreCorto(producto)]).filter(x => x && x.length >= 3);
  return claves.some(a => c.includes(' ' + a + ' '));
}

// ---------- Productos ----------
let DATOS = null; // payload de ?action=datos (filas de texto, como el CSV)
function productos(){
  if(!DATOS || !LIB) return [];
  LIB.setMetas(METAS);
  const stocks = LIB.getStocks(DATOS);
  const gastos = LIB.getGastos(DATOS);
  LIB.setUltima(LIB.getUltimaVentaPorProducto(DATOS));
  const catalogo = LIB.getCatalogo(stocks, DATOS, gastos);
  const vel = LIB.getVelocidadVenta(DATOS, LIB.VELOCIDAD_DIAS);
  const detalle = LIB.getVentasDetalle(DATOS);
  const hoy = hoy0();
  const desde7 = sumarDias(hoy, -6), desde14 = sumarDias(hoy, -13);
  const u7 = {}, u14 = {};
  detalle.forEach(v => {
    if(v.date > hoy || v.date < desde14) return;  // ventas pre-registradas a futuro no cuentan
    LIB.splitCombo(v.producto).forEach(p => {
      const k = LIB.normProducto(p); if(!k) return;
      u14[k] = (u14[k] || 0) + 1;
      if(v.date >= desde7) u7[k] = (u7[k] || 0) + 1;
    });
  });
  const stockPorKey = {};
  stocks.forEach(s => { stockPorKey[LIB.normProducto(s.producto)] = s; });
  const posts = postsInstagram();
  const manual = ajustes().ultimoPost || {};

  return catalogo.map(c => {
    const key = LIB.normProducto(c.producto);
    const s = stockPorKey[key] || null;
    const v7 = u7[key] || 0, v14 = u14[key] || 0;
    const ritmo = vel[key] || 0; // unidades/día (30 días o desde que hay stock)
    const dias = c.stock > 0 ? LIB.diasParaAgotar(c.stock, vel, c.producto) : null;

    // En camino: lo decide el catálogo del dashboard (bloques de compra).
    let enCamino = (c.estado === 'camino' || c.estado === 'nuevo') && NUNCA_EN_CAMINO.indexOf(key) < 0;
    let llegada = null;
    if(enCamino && s){
      let base = null;
      const bl = LIB.bloquesDeProducto(s);
      if(bl){
        bl.filter(LIB.bloqueEnCamino).forEach(b => { const f = LIB.parseDateSmart(b.f); if(f && (!base || f > base)) base = f; });
      }
      if(!base && LIB.fechaPedidoFiable(s)) base = s.fechaPedido;
      const plat = plataformaKey(s.plataforma);
      const r = LLEGADA_DIAS[plat] || LLEGADA_DEFAULT;
      if(base){
        const desde = sumarDias(base, r[0]), hasta = sumarDias(base, r[1]);
        llegada = {
          pedido: iso(base), desde: iso(desde), hasta: iso(hasta), plataforma: s.plataforma || '',
          atrasado: dayKey(hasta) < dayKey(hoy),
          estaSemana: dayKey(desde) <= dayKey(sumarDias(lunesDe(hoy), 6)) && dayKey(hasta) >= dayKey(lunesDe(hoy)),
          diasPedido: Math.round((dayKey(hoy) - dayKey(base)) / DIA_MS),
        };
      } else {
        llegada = {pedido:null, desde:null, hasta:null, plataforma: (s && s.plataforma) || '', atrasado:false, estaSemana:false, diasPedido:null};
      }
    }

    let estado;
    if(c.stock > 0 && c.stock <= URGENCIA_MAX) estado = 'urgencia';
    else if(c.stock > 0 && v14 < ESTANCADO_VENTAS) estado = 'estancado';
    else if(c.stock > 0) estado = 'ok';
    else if(enCamino) estado = 'camino';
    else estado = 'agotado';

    // Último post del producto: automático por caption, o el que marcó Alberto.
    const auto = posts.find(p => captionMenciona(p.caption, key, c.producto)) || null;
    const man = manual[key] && manual[key].f ? deIso(manual[key].f) : null;
    let ultimoPost = null;
    if(auto && (!man || auto.date >= man)) ultimoPost = {fecha: iso(auto.date), permalink: auto.permalink || '', origen:'instagram', tipo: auto.tipo || ''};
    else if(man) ultimoPost = {fecha: iso(man), permalink:'', origen:'manual'};
    if(ultimoPost) ultimoPost.dias = Math.round((dayKey(hoy) - dayKey(deIso(ultimoPost.fecha))) / DIA_MS);

    let foco;
    if(estado === 'urgencia') foco = 'Empujar urgencia: "quedan ' + c.stock + '"';
    else if(estado === 'estancado') foco = 'Subir contenido de detalle';
    else if(estado === 'camino') foco = llegada && llegada.desde
      ? (llegada.atrasado ? 'Ya debió llegar: revisar el tracking' : 'Anunciar cuando llegue (~' + fechaCorta(deIso(llegada.desde)) + '–' + fechaCorta(deIso(llegada.hasta)) + ')')
      : 'Anunciar cuando llegue';
    else if(estado === 'agotado') foco = 'Agotado: lista de espera, no empujar';
    else foco = (ultimoPost && ultimoPost.dias <= 7) ? 'En rotación: va bien' : 'Volver a mostrarlo (hace tiempo sin post)';

    return {
      producto: c.producto, key, categoria: categoriaDe(key),
      stock: c.stock, v7, v14, ritmoDia: Math.round(ritmo * 100) / 100, diasAgotar: dias,
      estado, estadoCatalogo: c.estado, pendiente: enCamino ? c.pendiente : 0,
      diasAgotado: c.diasAgotado, llegada, foco, ultimoPost,
    };
  }).filter(p => p.estado !== 'agotado' || (p.diasAgotado != null && p.diasAgotado <= AGOTADO_RECIENTE_DIAS));
}

// ---------- Fechas clave (próximos 14 días) ----------
// Recurrentes: quincena 13–16 y fin de mes 26–2. Especiales: Black Friday y
// diciembre. Cada una con su checklist (marcas sincronizadas en ajustes).
const ESPECIALES = [
  {id:'bf-2026', nombre:'Black Friday', desde:'2026-11-27', hasta:'2026-12-02',
   nota:'Acceso anticipado: 26/11 a las 00:00',
   checklist:['Catálogo con la tarjeta y los precios del Black Friday listos antes del 26/11',
              'Lista de acceso anticipado (los que respondieron BF)',
              'Mensaje del acceso anticipado listo para el 26/11 00:00',
              'Historias de hype programadas (cuenta regresiva)',
              'Stock revisado de lo que entra en promo',
              'Empaques listos: bolsas, ziploc, stickers']},
  {id:'dic-quincena-2026', nombre:'Quincena de diciembre', desde:'2026-12-13', hasta:'2026-12-16',
   checklist:['Combos de regalo definidos', 'Post de quincena programado', 'Historias de cuenta regresiva', 'Empaques listos: bolsas, ziploc, stickers']},
  {id:'navidad-2026', nombre:'Semana de Navidad', desde:'2026-12-18', hasta:'2026-12-24',
   checklist:['Fecha límite de envío avisada (historia fija)', 'Post de regalos por presupuesto', 'Stock revisado para la semana', 'Empaques de regalo listos']},
];
const CHECK_QUINCENA = ['Promo o combos de quincena definidos', 'Post de quincena programado', 'Historias de cuenta regresiva', 'Catálogo con precios al día'];
const CHECK_FINMES = ['Promo de fin de mes definida', 'Post de fin de mes programado', 'Historias con lo que queda', 'Catálogo con precios al día'];
function fechasClave(dias){
  dias = dias || 14;
  const hoy = hoy0(), tope = sumarDias(hoy, dias);
  const eventos = ESPECIALES.map(e => Object.assign({}, e, {d: deIso(e.desde), h: deIso(e.hasta)}));
  // Recurrentes de este mes, el anterior y el siguiente.
  for(let k = -1; k <= 1; k++){
    const b = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1);
    const y = b.getFullYear(), m = b.getMonth(), tag = y + '-' + String(m+1).padStart(2,'0');
    eventos.push({id:'quincena-' + tag, nombre:'Quincena', d:new Date(y, m, 13), h:new Date(y, m, 16), checklist: CHECK_QUINCENA});
    eventos.push({id:'finmes-' + tag, nombre:'Fin de mes', d:new Date(y, m, 26), h:new Date(y, m + 1, 2), checklist: CHECK_FINMES});
  }
  const choca = (a, b) => dayKey(a.d) <= dayKey(b.h) && dayKey(b.d) <= dayKey(a.h);
  const especiales = eventos.filter(e => ESPECIALES.some(x => x.id === e.id));
  return eventos
    // Un evento especial reemplaza a la quincena / fin de mes que se le cruce.
    .filter(e => ESPECIALES.some(x => x.id === e.id) || !especiales.some(s => choca(s, e)))
    .filter(e => dayKey(e.h) >= dayKey(hoy) && dayKey(e.d) <= dayKey(tope))
    .sort((a, b) => a.d - b.d)
    .map(e => ({
      id: e.id, nombre: e.nombre, nota: e.nota || '', desde: iso(e.d), hasta: iso(e.h),
      enCurso: dayKey(e.d) <= dayKey(hoy),
      faltanDias: Math.max(0, Math.round((dayKey(e.d) - dayKey(hoy)) / DIA_MS)),
      checklist: e.checklist.map((t, i) => ({id: e.id + '|' + i, texto: t, hecho: checkFecha(e.id + '|' + i)})),
    }));
}

// ---------- Metas semanales ----------
function avanceSemana(semana){
  semana = semana || semanaId();
  const lun = deIso(semana), dom = sumarDias(lun, 6), fin = sumarDias(lun, 7);
  const plan = planDe(semana);
  const items = plan ? [].concat.apply([], plan.dias.map(d => d.items)) : [];
  const publicado = it => estadoItem(semana, it.id) === 'publicado';
  const enSemana = d => d >= lun && d < fin;

  const postsIg = postsInstagram().filter(p => enSemana(p.date));
  const histIg = historiasInstagram().filter(enSemana);
  const histMarcadas = items.filter(it => it.tipo === 'historia' && publicado(it)).length;
  const postsMarcados = items.filter(it => it.tipo === 'post' && publicado(it)).length;
  const tiktokPlan = items.filter(it => it.tiktok && publicado(it)).length;

  const aj = ajustes().metas || {};
  const metaPosts = aj.posts || items.filter(it => it.tipo === 'post').length || 7;
  const metaHist = aj.historias || items.filter(it => it.tipo === 'historia').length || 35;
  const metaTt = aj.tiktok || items.filter(it => it.tiktok).length || 4;

  const hoy = hoy0();
  const transcurrido = Math.min(1, Math.max(0, (Math.round((dayKey(hoy) - dayKey(lun)) / DIA_MS) + 1) / 7));
  const fila = (id, nombre, hecho, meta, fuente) => {
    const pct = meta ? Math.min(1, hecho / meta) : 0;
    return {id, nombre, hecho, meta, pct, fuente, atrasado: hoy <= dom && (transcurrido - pct) > 0.25};
  };
  const tieneIg = !!igContenido();
  return {
    semana, transcurrido,
    metas: [
      fila('posts', 'Posts de Instagram', Math.max(postsIg.length, tieneIg ? 0 : postsMarcados), metaPosts, tieneIg || postsIg.length ? 'automático' : 'marcados'),
      fila('tiktok', 'TikToks', tiktokManual(semana) + tiktokPlan, metaTt, 'a mano'),
      fila('historias', 'Historias', Math.max(histIg.length, histMarcadas), metaHist, histIg.length ? 'automático' : 'marcadas'),
    ],
  };
}

// ---------- Recordatorios (notas con fecha y hora) ----------
// Ej.: "Bajar los anuncios a S/ 15" para mañana 9:00. Se guardan en el
// almacén (id "contenido-notas") y se sincronizan como las marcas. Los puede
// crear Alberto en el panel o el chat de creativos con su script.
// Formato: {items: {id: {texto, cuando:'AAAA-MM-DDTHH:MM' (hora Lima) o 'AAAA-MM-DD', hecho, borrado, t, autor}}}
function notasRaw(){ return (METAS['contenido-notas'] || {}).items || {}; }
function cuandoDate(c){
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(c || ''));
  return m ? new Date(+m[1], +m[2]-1, +m[3], m[4] ? +m[4] : 9, m[5] ? +m[5] : 0) : null;
}
function notas(){
  const ahora = new Date(), hoy = hoy0();
  return Object.keys(notasRaw()).map(id => Object.assign({id}, notasRaw()[id]))
    .filter(n => !n.borrado && n.texto)
    .map(n => {
      const d = cuandoDate(n.cuando);
      const conHora = /T\d{2}:\d{2}/.test(String(n.cuando || ''));
      return Object.assign(n, {
        fecha: d, conHora,
        vencida: !n.hecho && !!d && (conHora ? d <= ahora : dayKey(d) < dayKey(hoy)),
        esHoy: !!d && dayKey(d) === dayKey(hoy),
        calendario: linkCalendario(n.texto, d, conHora),
      });
    })
    .sort((a, b) => (a.hecho - b.hecho) || ((a.fecha ? +a.fecha : 9e15) - (b.fecha ? +b.fecha : 9e15)));
}
function agregarNota(texto, cuando){
  const id = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  encolar('contenido-notas', {items: {[id]: {texto: String(texto).slice(0, 300), cuando: cuando || '', hecho: false, t: Date.now(), autor: 'panel'}}});
  return id;
}
function editarNota(id, cambios){
  const n = notasRaw()[id]; if(!n) return;
  encolar('contenido-notas', {items: {[id]: Object.assign({}, n, cambios, {t: Date.now()})}});
}
function marcarNota(id, hecho){ editarNota(id, {hecho: !!hecho}); }
function borrarNota(id){ editarNota(id, {borrado: true}); }
// Enlace "Agregar a Google Calendar": así la alarma suena en el celular aunque
// el panel esté cerrado (una página web sola no puede despertar el teléfono).
function linkCalendario(texto, d, conHora){
  if(!d) return '';
  const p2 = n => String(n).padStart(2, '0');
  const f = x => x.getFullYear() + p2(x.getMonth()+1) + p2(x.getDate()) + (conHora ? 'T' + p2(x.getHours()) + p2(x.getMinutes()) + '00' : '');
  const fin = conHora ? new Date(d.getTime() + 15 * 60000) : sumarDias(d, 1);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(texto) +
    '&dates=' + f(d) + '/' + f(fin) + '&ctz=America/Lima&details=' + encodeURIComponent('Recordatorio del panel de Contenido de Timeless');
}

// ---------- Alertas de arriba ----------
function alertas(){
  const ps = productos();
  const llegan = ps.filter(p => p.estado === 'camino' && p.llegada && (p.llegada.estaSemana || p.llegada.atrasado));
  const urgencia = ps.filter(p => p.estado === 'urgencia');
  const estancados = ps.filter(p => p.estado === 'estancado');
  return {
    llegan: llegan.map(p => ({producto: p.producto, desde: p.llegada.desde, hasta: p.llegada.hasta, atrasado: p.llegada.atrasado, plataforma: p.llegada.plataforma})),
    urgencia: urgencia.map(p => ({producto: p.producto, stock: p.stock, diasAgotar: p.diasAgotar})),
    estancados: estancados.map(p => ({producto: p.producto, stock: p.stock, v14: p.v14})),
    fechas: fechasClave(14),
    comentarios: comentariosSinResponder(),
    // Recordatorios vencidos o de hoy, sin hacer.
    notas: notas().filter(n => !n.hecho && (n.vencida || n.esHoy)),
  };
}

// ---------- Carga ----------
// 1) pinta al instante con lo guardado en este aparato (snapshot del
//    dashboard + caché del panel), 2) pide lo nuevo al Apps Script.
async function iniciar(onCambio){
  const avisarUi = (fase) => { try{ onCambio && onCambio(fase); }catch(e){ console.error(e); } };
  if(DEMO){
    try{
      await cargarReglas();
      const d = await (await fetch('demo-datos.json', {cache:'no-store'})).json();
      DATOS = d.datos; METAS = d.metas || {}; IG_DASH = d.instagram || null;
      avisarUi('vivo');
    }catch(e){ avisarUi({error:'red', detalle:'Modo demo: falta demo-datos.json (' + (e.message || e) + ')'}); }
    return;
  }
  try{
    const dash = JSON.parse(localStorage.getItem(CACHE_DASH_KEY) || 'null');
    if(dash && dash.data && dash.data.stocks) DATOS = dash.data;
  }catch(e){}
  const cp = leerCachePanel();
  if(cp){ METAS = Object.assign({}, cp.metas || {}); IG_DASH = cp.ig || null; }
  try{ await cargarReglas(); }catch(e){ avisarUi({error:'reglas', detalle:String(e.message || e)}); return; }
  if(DATOS) avisarUi('cache');
  if(!clave()){ avisarUi({error:'clave'}); return; }
  try{
    await recargarMetas(); avisarUi('metas');
    try{ const ig = await apiGet('instagram'); IG_DASH = ig.instagram || null; guardarCachePanel(); }catch(e){}
    const d = await apiGet('datos', 1);
    if(d && d.datos && d.datos.stocks){
      DATOS = d.datos;
      // Se actualiza también el snapshot del dashboard (mismo formato), así el
      // dashboard abre con datos frescos la próxima vez.
      try{ localStorage.setItem(CACHE_DASH_KEY, JSON.stringify({data: DATOS, time: Date.now()})); }catch(e){}
    }
    avisarUi('vivo');
  }catch(e){
    avisarUi({error: e instanceof ErrorClave ? 'clave' : 'red', detalle: String(e.message || e)});
  }
}
// Refresco liviano (solo metas): al volver a la app y cada minuto mientras se ve.
async function refrescar(){
  if(!clave() || Object.keys(PENDIENTES_ESCRITURA).length) return false;
  try{ await recargarMetas(); return true; }catch(e){ return false; }
}

window.TLC = {
  // carga
  iniciar, refrescar, clave, guardarClave, onEstadoGuardado: f => oyentesEstado.push(f),
  hayDatos: () => !!DATOS, esDemo: DEMO,
  // productos y alertas
  productos, alertas, fechasClave, CATEGORIAS,
  // plan
  semanaId, lunesDe, iso, deIso, sumarDias, fechaCorta, DIAS_CORTO,
  planDe, semanasConPlan, parsePlan, guardarPlanTexto, planCompletoDe,
  ESTADOS, estadoItem, marcarItem, siguienteEstado,
  // metas
  avanceSemana, setMetasSemanales, ajustes, tiktokManual, setTiktokManual,
  // varios
  marcarUltimoPost, setCheckFecha, comentariosSinResponder, postsInstagram,
  estadoItemInfo, notas, agregarNota, editarNota, marcarNota, borrarNota,
  _debug: () => ({METAS, DATOS, LIB}),
};
})();
