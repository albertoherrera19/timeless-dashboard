/* Timeless Dashboard — lee los CSV publicados del Google Sheets
   "Timeless - Ventas e Inventario" y pinta el panel del negocio.
   Sin librerías, sin OAuth: fetch de CSVs públicos + localStorage como respaldo offline. */

/* ---------- Temas (los mismos de la app de gastos) ---------- */
const THEMES = {
  negro:   {label:'Negro',   bg:'#141414', card:'#1c1c1c', line:'#2c2c2c', bone:'#f2f0ea', muted:'#8a8680', accent:'#e8442c', accentDim:'#5c2016', chip:'#111111', swatch:'#141414'},
  azul:    {label:'Azul',    bg:'#0d1420', card:'#141d2b', line:'#233047', bone:'#eef3fa', muted:'#7c93ad', accent:'#2f7dd8', accentDim:'#173a63', chip:'#0f1621', swatch:'#2f7dd8'},
  celeste: {label:'Celeste', bg:'#0c1a1f', card:'#12242b', line:'#1f3843', bone:'#eaf6f9', muted:'#7fa8b3', accent:'#22b8e8', accentDim:'#0f4a5c', chip:'#0e1c21', swatch:'#22b8e8'},
  morado:  {label:'Morado',  bg:'#160f22', card:'#201533', line:'#33234c', bone:'#f2ecfa', muted:'#9c85bd', accent:'#9b4de0', accentDim:'#3f2064', chip:'#180f24', swatch:'#9b4de0'},
  rojo:    {label:'Rojo',    bg:'#1c0f0f', card:'#2a1414', line:'#432020', bone:'#faeeee', muted:'#c08a8a', accent:'#e8302f', accentDim:'#5c1414', chip:'#1e1010', swatch:'#e8302f'},
  rosado:  {label:'Rosado',  bg:'#1f0f18', card:'#2b1421', line:'#472034', bone:'#faeef5', muted:'#c98aae', accent:'#ec4899', accentDim:'#5c1d3c', chip:'#20101a', swatch:'#ec4899'},
  verde:   {label:'Verde',   bg:'#0f1a11', card:'#16261a', line:'#26402c', bone:'#eefaf0', muted:'#8fb897', accent:'#4ade80', accentDim:'#1c4d2c', chip:'#101c13', swatch:'#4ade80'},
  turquesa:{label:'Turquesa',bg:'#08201f', card:'#0e2c2a', line:'#1d443f', bone:'#e9faf7', muted:'#7db8ae', accent:'#1de9b6', accentDim:'#0c4d43', chip:'#0a2321', swatch:'#1de9b6'},
  naranja: {label:'Naranja', bg:'#1f130a', card:'#2c1c0e', line:'#472c15', bone:'#faf0e6', muted:'#c9986b', accent:'#f5851f', accentDim:'#5c360f', chip:'#20140a', swatch:'#f5851f'},
  blanco:  {label:'Blanco',  bg:'#f7f5f1', card:'#ffffff', line:'#e3e0d8', bone:'#181614', muted:'#8a8680', accent:'#e8442c', accentDim:'#fbdad4', chip:'#efece6', swatch:'#ffffff'},
};
const THEME_KEY = 'timeless_dashboard_theme';
const CACHE_KEY = 'timeless_dashboard_data';

function applyTheme(name){
  const t = THEMES[name] || THEMES.negro;
  const root = document.documentElement.style;
  root.setProperty('--bg', t.bg);
  root.setProperty('--card', t.card);
  root.setProperty('--line', t.line);
  root.setProperty('--bone', t.bone);
  root.setProperty('--muted', t.muted);
  root.setProperty('--accent', t.accent);
  root.setProperty('--accent-dim', t.accentDim);
  root.setProperty('--chip', t.chip);
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', t.bg);
  try{ localStorage.setItem(THEME_KEY, name); }catch(e){}
  renderSwatches(name);
}

function renderSwatches(activeName){
  const box = document.getElementById('swatches');
  box.innerHTML = '';
  Object.keys(THEMES).forEach(key=>{
    const t = THEMES[key];
    const el = document.createElement('div');
    el.className = 'swatch' + (key===activeName ? ' active' : '');
    el.innerHTML = '<div class="dot" style="background:' + t.swatch + '"></div><div class="lbl">' + t.label + '</div>';
    el.onclick = ()=> applyTheme(key);
    box.appendChild(el);
  });
}

document.getElementById('gearBtn').addEventListener('click', ()=>{
  document.getElementById('themeDrawer').classList.toggle('open');
});

/* ---------- Utilidades de formato / parseo ---------- */
function fmt(n){ return Number(n).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmt0(n){ return Number(n).toLocaleString('es-PE', {maximumFractionDigits:0}); }
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }

// Parser CSV con soporte de comillas (celdas con comas o saltos de línea)
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0; i<text.length; i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if(c !== '\r') field += c;
    }
  }
  if(field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

// "S/ 1,234.56" | "1234.56" | "1.234,56" | "3.5" -> número
function parseMoney(s){
  if(typeof s === 'number') return s;
  let t = String(s == null ? '' : s).replace(/[^\d.,\-]/g, '');
  if(!t) return 0;
  const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
  if(lastComma > -1 && lastDot > -1){
    // El separador que aparece más a la derecha es el decimal
    if(lastComma > lastDot) t = t.replace(/\./g,'').replace(',', '.');
    else t = t.replace(/,/g,'');
  } else if(lastComma > -1){
    // Solo comas: decimal si parece "12,5" / "12,50"; si no, separador de miles
    const dec = t.length - lastComma - 1;
    t = (dec === 1 || dec === 2) && t.indexOf(',') === lastComma ? t.replace(',', '.') : t.replace(/,/g,'');
  }
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

// Fechas de Sheets: "06/07/2026", "6/07/2026 14:03:22", "2026-07-06", ISO...
function parseDateSmart(s){
  if(!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);        // dd/mm/yyyy (Perú)
  if(m) return new Date(+m[3], +m[2]-1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                   // yyyy-mm-dd / ISO
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function monthKey(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
function monthLabel(mk){
  const d = new Date(+mk.slice(0,4), +mk.slice(5)-1, 1);
  return cap(d.toLocaleDateString('es-PE', {month:'long', year:'numeric'}));
}

// Mes actualmente seleccionado en el dashboard y último set de datos parseado
// (para poder re-pintar Utilidad/Proyección al cambiar de mes sin volver a descargar).
let selectedMonthKey = null;
let LAST = null;

/* ---------- Carga de datos ---------- */
const cfg = (typeof TIMELESS_CONFIG !== 'undefined') ? TIMELESS_CONFIG : {};
const SOURCES = [
  {key:'ventas',     cfgKey:'CSV_VENTAS',     tab:'Ventas'},
  {key:'gastos',     cfgKey:'CSV_GASTOS',     tab:'Gastos'},
  {key:'publicidad', cfgKey:'CSV_PUBLICIDAD', tab:'Publicidad'},
  {key:'stocks',     cfgKey:'CSV_STOCKS',     tab:'Stocks'},
  {key:'pendientes', cfgKey:'CSV_PENDIENTES', tab:'Pendientes', optional:true},
  {key:'ventasDetalle', cfgKey:'CSV_VENTASDETALLE', tab:'VentasDetalle', optional:true},
];

function fetchCSV(url){
  const sep = url.indexOf('?') > -1 ? '&' : '?';
  return fetch(url + sep + '_cb=' + Date.now(), {cache:'no-store'})
    .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(parseCSV);
}

function loadCache(){
  try{ return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; }catch(e){ return null; }
}
function saveCache(data){
  try{ localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }catch(e){}
}

function loadAll(){
  const syncLine = document.getElementById('syncLine');
  syncLine.textContent = 'Cargando datos…';

  const missing = SOURCES.filter(s => !cfg[s.cfgKey] && !s.optional);
  const active  = SOURCES.filter(s => !!cfg[s.cfgKey]);
  renderSetupCard(missing);

  if(active.length === 0){
    syncLine.textContent = 'Sin conexión a Sheets — configura config.js';
    renderAll({}, missing);
    return;
  }

  Promise.all(active.map(s =>
    fetchCSV(cfg[s.cfgKey]).then(rows => [s.key, rows]).catch(() => [s.key, null])
  )).then(results => {
    const data = {};
    let failed = 0;
    results.forEach(([key, rows]) => {
      if(rows) data[key] = rows; else failed++;
    });

    if(Object.keys(data).length > 0){
      const cached = loadCache() || {data:{}};
      const merged = Object.assign({}, cached.data, data);
      saveCache({data: merged, time: Date.now()});
      renderAll(merged, missing);
      const now = new Date();
      syncLine.textContent = 'Actualizado ' + now.toLocaleDateString('es-PE') + ' ' +
        now.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'}) +
        (failed ? ' · ' + failed + ' pestaña(s) no cargaron' : '');
    } else {
      // Sin internet o URLs mal pegadas: usar el último snapshot guardado
      const cached = loadCache();
      if(cached){
        renderAll(cached.data, missing);
        syncLine.textContent = '⚠ Sin conexión — mostrando datos del ' +
          new Date(cached.time).toLocaleDateString('es-PE');
      } else {
        renderAll({}, missing);
        syncLine.textContent = '⚠ No se pudo cargar ningún dato. Revisa las URLs de config.js';
      }
    }
  });
}

document.getElementById('refreshBtn').addEventListener('click', loadAll);

function renderSetupCard(missing){
  const card = document.getElementById('setupCard');
  if(missing.length === 0){ card.hidden = true; return; }
  card.hidden = false;
  document.getElementById('setupBody').innerHTML =
    'Faltan estas URLs en <code>config.js</code>: ' +
    missing.map(s => '<code>' + s.cfgKey + '</code> (pestaña ' + s.tab + ')').join(' · ') +
    '.<br>En el Sheets: <b>Archivo → Compartir → Publicar en la web</b> → elige la pestaña → formato <b>.csv</b> → copia el enlace.';
}

/* ---------- Normalización de filas ---------- */
// Quita la fila de títulos si la primera celda no es un dato
function body(rows){ return rows && rows.length > 1 ? rows.slice(1) : []; }

// Pestaña "Ventas": una fila por MES → Mes (fecha 1er día), Ingresos, Ganancia neta
// (Ganancia neta = ingresos − costo de productos, tal como Alberto ya la calcula
//  en sus hojas mensuales; NO incluye los gastos, esos se restan aparte.)
function getVentas(data){
  return body(data.ventas).map(r => ({
    date: parseDateSmart(r[0]),
    ingresos: parseMoney(r[1]),
    gananciaNeta: parseMoney(r[2]),
  })).filter(v => v.date && (v.ingresos > 0 || v.gananciaNeta !== 0));
}

function getGastos(data){
  // Columnas reales publicadas por la app de gastos: ID, Fecha, Categoría, Monto, Nota, Registrado en
  const excl = (cfg.EXCLUIR_CATEGORIAS || []).map(c => normName(c));
  return body(data.gastos).map(r => ({
    date: parseDateSmart(r[1]),
    categoria: (r[2]||'').trim(),
    monto: parseMoney(r[3]),
  })).filter(g => g.date && g.monto > 0 && excl.indexOf(normName(g.categoria)) === -1);
}

// Suma de "Inversión" (compra de mercadería) de un mes — solo informativo,
// NO se resta de la utilidad (ya está en el costo de lo vendido).
function sumInversion(data, k){
  const inv = (cfg.EXCLUIR_CATEGORIAS || []).map(c => normName(c));
  return body(data.gastos).map(r => ({
    date: parseDateSmart(r[1]),
    categoria: (r[2]||'').trim(),
    monto: parseMoney(r[3]),
  })).filter(g => g.date && g.monto > 0 && inv.indexOf(normName(g.categoria)) !== -1 &&
    (!k || monthKey(g.date) === k)).reduce((s,g)=>s+g.monto, 0);
}

// ¿Es un gasto de negocio? (Ads, Materiales...) según config.GASTOS_NEGOCIO.
const NEGOCIO_SET = (cfg.GASTOS_NEGOCIO || []).map(c => normName(c));
function esNegocio(categoria){ return NEGOCIO_SET.indexOf(normName(categoria)) !== -1; }

// Modo de la utilidad: 'negocio' (solo gastos de negocio) o 'todo' (también personales).
let utilMode = 'negocio';
try{ utilMode = localStorage.getItem('timeless_util_mode') || 'negocio'; }catch(e){}

function getPublicidad(data){
  return body(data.publicidad).map(r => ({
    semana: (r[0]||'').trim(),
    plataforma: (r[1]||'').trim(),
    gasto: parseMoney(r[2]),
    alcance: parseMoney(r[3]),
    ventas: parseMoney(r[4]),
    ingreso: parseMoney(r[5]),
  })).filter(p => p.semana && p.gasto > 0);
}

// Normaliza un nombre de producto para comparar: minúsculas, sin acentos, espacios colapsados.
function normName(s){
  return (s == null ? '' : String(s)).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

// Normaliza nombre de producto para agrupar en "más vendidos": sin acentos, "cinto"→"cinturon".
function normProducto(s){
  return normName(s).replace(/^cinto\b/, 'cinturon');
}
// Separa un combo ("collar A + collar B") en sus piezas.
function splitCombo(nombre){
  return String(nombre||'').split('+').map(s => s.trim()).filter(Boolean);
}

// Pestaña "VentasDetalle": Fecha, Producto, Venta, Utilidad (cada venta con fecha)
function getVentasDetalle(data){
  return body(data.ventasDetalle).map(r => ({
    date: parseDateSmart(r[0]),
    producto: (r[1]||'').trim(),
    venta: parseMoney(r[2]),
    utilidad: parseMoney(r[3]),
  })).filter(v => v.date && v.venta > 0);
}

// Pestaña "Pendientes": Producto, Cantidad, Invertido (pedidos comprados que aún no llegan)
function getPendientes(data){
  return body(data.pendientes).map(r => ({
    producto: (r[0]||'').trim(),
    cantidad: parseMoney(r[1]),
    invertido: parseMoney(r[2]),
  })).filter(p => p.producto);
}

// Pestaña "Stocks": Producto, Precio, Vendidos, Stock, Ganancia bruta pos., Ganancia neta pos., Invertido
function getStocks(data){
  return body(data.stocks).map(r => ({
    producto: (r[0]||'').trim(),
    precio: parseMoney(r[1]),
    vendidos: parseMoney(r[2]),
    stock: parseMoney(r[3]),
    gananciaBruta: parseMoney(r[4]),
    gananciaNeta: parseMoney(r[5]),
    invertido: parseMoney(r[6]),
  })).filter(s => s.producto && s.producto.toLowerCase() !== 'totales');
}

/* ---------- Render ---------- */
function renderAll(data, missing){
  const ventas = getVentas(data);
  const gastos = getGastos(data);
  const pub = getPublicidad(data);
  const stocks = getStocks(data);
  LAST = {ventas, gastos, pub, stocks, data};
  buildMonthOptions(ventas, gastos);
  renderHero(ventas, gastos, data, selectedMonthKey);
  renderRoas(pub, data);
  renderProyeccion(ventas, stocks, data, selectedMonthKey);
  renderMeses(ventas, gastos, data);
  renderTop(stocks, data);
  renderRecent(data);
  renderAdsDaily(data, selectedMonthKey);
  document.getElementById('footTime').textContent = new Date().getFullYear();
}

// 6. MÁS VENDIDOS (últimos 30 días) — parsea combos separando por "+".
function renderRecent(data){
  const box = document.getElementById('recentRows');
  if(!box) return;
  if(!data.ventasDetalle){ box.innerHTML = needCfg('VentasDetalle'); return; }
  const det = getVentasDetalle(data);
  const cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate() - 30);
  const agg = {}; // key normalizado -> {name, units, revenue}
  det.filter(v => v.date >= cutoff).forEach(v => {
    const pieces = splitCombo(v.producto);
    if(pieces.length === 0) return;
    const share = v.venta / pieces.length;
    pieces.forEach(p => {
      const key = normProducto(p);
      if(!key) return;
      if(!agg[key]) agg[key] = { name:p, units:0, revenue:0 };
      agg[key].units += 1;
      agg[key].revenue += share;
    });
  });
  const rows = Object.values(agg).sort((a,b) => b.units - a.units || b.revenue - a.revenue).slice(0, 12);
  if(rows.length === 0){ box.innerHTML = '<div class="empty">Sin ventas en los últimos 30 días.</div>'; return; }
  const max = rows[0].units;
  box.innerHTML = rows.map((r, i) =>
    '<div class="top-row">' +
      '<span class="top-rank">' + String(i+1).padStart(2,'0') + '</span>' +
      '<span class="top-name">' + esc(cap(r.name)) + '</span>' +
      '<span class="top-stock">' + fmt0(r.units) + ' vend</span>' +
      '<span class="top-amt">S/ ' + fmt(r.revenue) + '</span>' +
    '</div>' +
    '<div class="top-bar"><div class="top-bar-fill" style="width:' + (r.units/max*100) + '%"></div></div>'
  ).join('');
}

// 7. RENTABILIDAD DE ADS POR DÍA — cruza gasto de ads (Gastos cat "Ads") con ventas del día.
function renderAdsDaily(data, mk){
  const table = document.getElementById('adsDailyTable');
  if(!table) return;
  const k = mk || monthKey(new Date());
  document.getElementById('adsDailyMonth').textContent = monthLabel(k);

  if(!data.ventasDetalle && !data.gastos){
    table.innerHTML = '<tr><td class="ads-empty">Conecta VentasDetalle y Gastos para ver esta tabla.</td></tr>';
    return;
  }
  const det = getVentasDetalle(data).filter(v => monthKey(v.date) === k);
  const gAds = getGastos(data).filter(g => normName(g.categoria) === 'ads' && monthKey(g.date) === k);

  const byDay = {};
  const slot = (d) => byDay[d] || (byDay[d] = {ads:0, ventas:0, util:0});
  gAds.forEach(g => { slot(g.date.getDate()).ads += g.monto; });
  det.forEach(v => { const s = slot(v.date.getDate()); s.ventas += v.venta; s.util += v.utilidad; });

  const days = Object.keys(byDay).map(Number).filter(d => byDay[d].ads > 0).sort((a,b)=>a-b);
  if(days.length === 0){
    table.innerHTML = '<tr><td class="ads-empty">No registraste gastos de "Ads" en ' + monthLabel(k) +
      '. Cuando los anotes en tu app (categoría Ads), aparecen aquí día por día.</td></tr>';
    return;
  }
  const tot = {ads:0, ventas:0, util:0};
  const head = '<tr><th>Día</th><th>Gasto ads</th><th>Ventas</th><th>Utilidad</th><th>Neto −ads</th><th>Ratio</th></tr>';
  const rows = days.map(d => {
    const s = byDay[d]; tot.ads += s.ads; tot.ventas += s.ventas; tot.util += s.util;
    const neto = s.util - s.ads, ratio = s.ads > 0 ? s.util/s.ads : 0;
    return '<tr>' +
      '<td>' + d + '</td>' +
      '<td class="mono">S/ ' + fmt(s.ads) + '</td>' +
      '<td class="mono">S/ ' + fmt(s.ventas) + '</td>' +
      '<td class="mono">S/ ' + fmt(s.util) + '</td>' +
      '<td class="mono ' + (neto<0?'r-neg':'r-pos') + '">S/ ' + fmt(neto) + '</td>' +
      '<td class="mono ' + (ratio>=1?'r-pos':'r-neg') + '">' + ratio.toFixed(2) + 'x</td>' +
    '</tr>';
  }).join('');
  const totNeto = tot.util - tot.ads, totRatio = tot.ads > 0 ? tot.util/tot.ads : 0;
  const foot = '<tr class="ads-total"><td>Total</td>' +
    '<td class="mono">S/ ' + fmt(tot.ads) + '</td>' +
    '<td class="mono">S/ ' + fmt(tot.ventas) + '</td>' +
    '<td class="mono">S/ ' + fmt(tot.util) + '</td>' +
    '<td class="mono">S/ ' + fmt(totNeto) + '</td>' +
    '<td class="mono">' + totRatio.toFixed(2) + 'x</td></tr>';
  table.innerHTML = head + rows + foot;
}

// Llena el selector de mes con los meses que existen en Ventas o Gastos.
// Por defecto muestra el mes actual si hay datos; si no, el más reciente.
function buildMonthOptions(ventas, gastos){
  const set = {};
  ventas.forEach(v => set[monthKey(v.date)] = true);
  gastos.forEach(g => set[monthKey(g.date)] = true);
  const keys = Object.keys(set).sort(); // ascendente
  const sel = document.getElementById('monthSelect');
  if(!sel) return;
  if(keys.length === 0){ sel.innerHTML = ''; return; }
  const curKey = monthKey(new Date());
  if(!selectedMonthKey || keys.indexOf(selectedMonthKey) === -1){
    selectedMonthKey = keys.indexOf(curKey) !== -1 ? curKey : keys[keys.length-1];
  }
  sel.innerHTML = keys.slice().reverse().map(k =>
    '<option value="' + k + '"' + (k===selectedMonthKey?' selected':'') + '>' + monthLabel(k) + '</option>'
  ).join('');
}

function needCfg(tabs){
  return '<div class="empty">Conecta ' + tabs + ' en config.js para ver esta sección.</div>';
}

// 1. UTILIDAD DEL MES
function renderHero(ventas, gastos, data, mk){
  const k = mk || monthKey(new Date());
  const vMes = ventas.filter(v => monthKey(v.date) === k);
  const gMes = gastos.filter(g => monthKey(g.date) === k);

  const ingresos     = vMes.reduce((s,v)=>s+v.ingresos, 0);
  const gananciaNeta = vMes.reduce((s,v)=>s+v.gananciaNeta, 0);
  const gastosNegocio  = gMes.filter(g=>esNegocio(g.categoria)).reduce((s,g)=>s+g.monto, 0);
  const gastosPersonal = gMes.filter(g=>!esNegocio(g.categoria)).reduce((s,g)=>s+g.monto, 0);
  const inversion = sumInversion(data, k);

  // Modo "negocio": solo gastos de negocio. Modo "todo": también los personales.
  const utilidad = (utilMode === 'todo')
    ? gananciaNeta - gastosNegocio - gastosPersonal
    : gananciaNeta - gastosNegocio;

  document.getElementById('heroMonthLabel').textContent =
    (utilMode === 'todo' ? 'Lo que me queda · ' : 'Utilidad del negocio · ') + monthLabel(k);

  // Marca el botón activo del interruptor
  document.querySelectorAll('#utilToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-mode') === utilMode));

  const heroValue = document.getElementById('heroValue');
  heroValue.textContent = 'S/ ' + fmt(utilidad);
  heroValue.className = 'hero-value mono ' + (utilidad < 0 ? 'neg' : 'pos');

  const rows = [
    {name:'Ingresos del mes', amt:ingresos, info:true},
    {name:'Ganancia neta de ventas', amt:gananciaNeta, sign:'+'},
    {name:'Gastos de negocio (Ads, materiales)', amt:-gastosNegocio, sign:'-'},
  ];
  if(utilMode === 'todo'){
    rows.push({name:'Gastos personales', amt:-gastosPersonal, sign:'-'});
  }
  rows.push({name: (utilMode==='todo' ? 'LO QUE ME QUEDA' : 'UTILIDAD DEL NEGOCIO'), amt:utilidad, total:true});
  if(inversion > 0){
    rows.push({name:'↳ Reinvertido en mercadería (ya está en el costo)', amt:inversion, info:true, faint:true});
  }

  document.getElementById('heroReceipt').innerHTML =
    (!data.ventas && !data.gastos) ? needCfg('Ventas y Gastos') :
    rows.map(r => {
      const cls = r.total ? (r.amt<0?'minus':'') : (r.info ? '' : (r.sign==='+'?'plus':'minus'));
      const prefix = r.amt<0 ? '− ' : (r.sign==='+'&&!r.total ? '+ ' : '');
      return '<div class="r-row' + (r.total ? ' total' : '') + (r.faint ? ' faint' : '') + '">' +
        '<span class="r-name">' + r.name + '</span>' +
        '<span class="r-amt ' + cls + '">' + prefix + 'S/ ' + fmt(Math.abs(r.amt)) + '</span>' +
      '</div>';
    }).join('');
}

// 2. ROAS
function renderRoas(pub, data){
  const rowsBox = document.getElementById('adRows');
  if(!data.publicidad){
    rowsBox.innerHTML = needCfg('Publicidad');
    return;
  }
  const totGasto = pub.reduce((s,p)=>s+p.gasto,0);
  const totIngreso = pub.reduce((s,p)=>s+p.ingreso,0);
  const totVentas = pub.reduce((s,p)=>s+p.ventas,0);
  const roas = totGasto > 0 ? totIngreso/totGasto : 0;

  const rv = document.getElementById('roasValue');
  rv.textContent = roas ? roas.toFixed(2) + 'x' : '—';
  rv.className = 'roas-value mono ' + (roas >= 1 ? 'good' : (totGasto>0 ? 'bad' : ''));

  document.getElementById('adsGasto').textContent = 'S/ ' + fmt(totGasto);
  document.getElementById('adsIngreso').textContent = 'S/ ' + fmt(totIngreso);
  document.getElementById('adsVentas').textContent = fmt0(totVentas);

  const last = pub.slice(-8).reverse();
  rowsBox.innerHTML = last.length === 0
    ? '<div class="empty">Aún no registras semanas en la pestaña Publicidad.</div>'
    : last.map(p => {
        const r = p.gasto > 0 ? p.ingreso/p.gasto : 0;
        return '<div class="ad-row">' +
          '<span class="ad-week">' + esc(p.semana) + '</span>' +
          '<span class="ad-plat">' + esc(p.plataforma) + '</span>' +
          '<span class="ad-num">S/ ' + fmt(p.gasto) + '</span>' +
          '<span class="ad-roas ' + (r>=1?'good':'bad') + '">' + r.toFixed(2) + 'x</span>' +
        '</div>';
      }).join('');
}

// 3. PROYECCIÓN
function renderProyeccion(ventas, stocks, data, mk){
  const extra = document.getElementById('projExtra');
  if(!data.stocks){
    extra.innerHTML = needCfg('Stocks');
    return;
  }
  const k = mk || monthKey(new Date());
  const ganado = ventas.filter(v=>monthKey(v.date)===k).reduce((s,v)=>s+v.gananciaNeta,0);
  const conStock = stocks.filter(s=>s.stock>0);
  const posible = conStock.reduce((s,x)=>s+x.gananciaNeta,0);
  const invertido = conStock.reduce((s,x)=>s+x.invertido,0);
  const valorVenta = conStock.reduce((s,x)=>s+x.gananciaBruta,0);
  const unidades = conStock.reduce((s,x)=>s+x.stock,0);
  const techo = ganado + posible;

  document.getElementById('projGanado').textContent = 'S/ ' + fmt(ganado);
  document.getElementById('projPosible').textContent = '+ S/ ' + fmt(posible);
  document.getElementById('projBarFill').style.width =
    (techo > 0 ? Math.min(100, ganado/techo*100) : 0) + '%';

  extra.innerHTML =
    '<div class="r-row"><span class="r-name">Techo del mes (ganado + stock)</span><span class="r-amt">S/ ' + fmt(techo) + '</span></div>' +
    '<div class="r-row"><span class="r-name">Unidades en stock</span><span class="r-amt">' + fmt0(unidades) + '</span></div>' +
    '<div class="r-row"><span class="r-name">Dinero invertido en ese stock</span><span class="r-amt">S/ ' + fmt(invertido) + '</span></div>' +
    '<div class="r-row"><span class="r-name">Valor de venta del stock</span><span class="r-amt">S/ ' + fmt(valorVenta) + '</span></div>';

  renderPendientes(stocks, data);
}

// Pedidos comprados que aún no llegan. Un pendiente se "apaga" solo (no se borra)
// cuando ese producto ya tiene stock > 0 en la pestaña Stocks — así, si pones stock
// solo para probar la proyección y luego lo bajas a 0, el pendiente reaparece.
function renderPendientes(stocks, data){
  const box = document.getElementById('pendingBlock');
  if(!box) return;
  if(!data.pendientes){ box.innerHTML = ''; return; }

  const pendientes = getPendientes(data);
  if(pendientes.length === 0){ box.innerHTML = ''; return; }

  const stockByName = {};
  stocks.forEach(s => { stockByName[normName(s.producto)] = s.stock; });

  let totalPorLlegar = 0;
  const rows = pendientes.map(p => {
    const llego = (stockByName[normName(p.producto)] || 0) > 0;
    if(!llego) totalPorLlegar += p.invertido;
    return { p, llego };
  });

  box.innerHTML =
    '<div class="pend-head">' +
      '<span>📦 Dinero en pedidos por llegar</span>' +
      '<span class="mono accent">S/ ' + fmt(totalPorLlegar) + '</span>' +
    '</div>' +
    rows.map(r =>
      '<div class="pend-row' + (r.llego ? ' llego' : '') + '">' +
        '<span class="pend-name">' + esc(r.p.producto) + '</span>' +
        '<span class="pend-amt mono">' + (r.llego ? '✓ llegó' : 'S/ ' + fmt(r.p.invertido)) + '</span>' +
      '</div>'
    ).join('');
}

// 4. MES A MES
function renderMeses(ventas, gastos, data){
  const barsBox = document.getElementById('monthsBars');
  const listBox = document.getElementById('monthsList');
  if(!data.ventas && !data.gastos){
    barsBox.innerHTML = needCfg('Ventas y Gastos');
    listBox.innerHTML = '';
    return;
  }

  // Sigue el mismo modo del hero: 'negocio' resta solo gastos de negocio;
  // 'todo' resta también los personales.
  const acc = {}; // key -> {ing, gn, g} = ingresos, ganancia neta ventas, gastos aplicables
  function slot(k){ return acc[k] || (acc[k] = {ing:0, gn:0, g:0}); }
  ventas.forEach(x => { const s = slot(monthKey(x.date)); s.ing += x.ingresos; s.gn += x.gananciaNeta; });
  gastos.forEach(x => {
    if(utilMode === 'todo' || esNegocio(x.categoria)) slot(monthKey(x.date)).g += x.monto;
  });

  const keys = Object.keys(acc).sort().slice(-12);
  if(keys.length === 0){
    barsBox.innerHTML = '<div class="empty">Sin movimientos aún. Registra ventas y gastos para ver el comparativo.</div>';
    listBox.innerHTML = '';
    return;
  }
  const curKey = monthKey(new Date());
  const series = keys.map(k => {
    const s = acc[k];
    const d = new Date(+k.slice(0,4), +k.slice(5)-1, 1);
    return {
      key: k,
      label: d.toLocaleDateString('es-PE', {month:'short'}).replace('.',''),
      full: cap(d.toLocaleDateString('es-PE', {month:'long', year:'numeric'})),
      util: s.gn - s.g,
      ing: s.ing, gn: s.gn, g: s.g,
      current: k === curKey,
    };
  });

  const maxAbs = Math.max(...series.map(s=>Math.abs(s.util)), 1);
  barsBox.innerHTML = series.map(s => {
    const h = Math.max(Math.abs(s.util)/maxAbs*100, 4);
    return '<div class="mbar' + (s.current?' current':'') + (s.util<0?' neg':'') + '">' +
             '<div class="col" style="height:' + h + '%"><span class="val">' + fmt0(s.util) + '</span></div>' +
             '<div class="mlbl">' + s.label + '</div>' +
           '</div>';
  }).join('');

  listBox.innerHTML = [...series].reverse().map(s =>
    '<div class="ml-row' + (s.current?' current':'') + '">' +
      '<span class="ml-name">' + s.full +
        ' <span class="ml-detail">Ing ' + fmt0(s.ing) + ' · GN ' + fmt0(s.gn) + ' · Gastos ' + fmt0(s.g) + '</span></span>' +
      '<span class="ml-amt' + (s.util<0?' neg':'') + '">S/ ' + fmt(s.util) + '</span>' +
    '</div>'
  ).join('');
}

// 5. TOP PRODUCTOS
function renderTop(stocks, data){
  const box = document.getElementById('topRows');
  if(!data.stocks){
    box.innerHTML = needCfg('Stocks');
    return;
  }
  const top = stocks.filter(s => s.stock > 0 && s.gananciaNeta > 0)
                    .sort((a,b) => b.gananciaNeta - a.gananciaNeta)
                    .slice(0, 12);
  if(top.length === 0){
    box.innerHTML = '<div class="empty">No hay productos con stock (o Stocks aún no carga).</div>';
    return;
  }
  const max = top[0].gananciaNeta;
  box.innerHTML = top.map((s, i) =>
    '<div class="top-row">' +
      '<span class="top-rank">' + String(i+1).padStart(2,'0') + '</span>' +
      '<span class="top-name">' + esc(s.producto) + '</span>' +
      '<span class="top-stock">' + fmt0(s.stock) + ' und</span>' +
      '<span class="top-amt">S/ ' + fmt(s.gananciaNeta) + '</span>' +
    '</div>' +
    '<div class="top-bar"><div class="top-bar-fill" style="width:' + (s.gananciaNeta/max*100) + '%"></div></div>'
  ).join('');
}

/* ---------- Arranque ---------- */
// Cambiar de mes re-pinta Utilidad y Proyección con los datos ya cargados.
document.getElementById('monthSelect').addEventListener('change', (e) => {
  selectedMonthKey = e.target.value;
  if(LAST){
    renderHero(LAST.ventas, LAST.gastos, LAST.data, selectedMonthKey);
    renderProyeccion(LAST.ventas, LAST.stocks, LAST.data, selectedMonthKey);
    renderAdsDaily(LAST.data, selectedMonthKey);
  }
});

// Interruptor Negocio / Todo: cambia cómo se restan los gastos en Utilidad y Mes a mes.
document.getElementById('utilToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if(!btn) return;
  utilMode = btn.getAttribute('data-mode');
  try{ localStorage.setItem('timeless_util_mode', utilMode); }catch(err){}
  if(LAST){
    renderHero(LAST.ventas, LAST.gastos, LAST.data, selectedMonthKey);
    renderMeses(LAST.ventas, LAST.gastos, LAST.data);
  }
});

let savedTheme = 'negro';
try{ savedTheme = localStorage.getItem(THEME_KEY) || 'negro'; }catch(e){}
applyTheme(savedTheme);
loadAll();
