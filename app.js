/* Timeless Dashboard — lee los CSV publicados del Google Sheets
   "Timeless - Ventas e Inventario" y pinta el panel del negocio.
   Sin librerías, sin OAuth: fetch de CSVs públicos + localStorage como respaldo offline. */

/* ---------- Temas (los mismos de la app de gastos) ---------- */
const THEMES = {
  negro:   {label:'Negro',   bg:'#141414', card:'#1c1c1c', line:'#2c2c2c', bone:'#f2f0ea', muted:'#8a8680', accent:'#e8442c', accentDim:'#5c2016', chip:'#111111', swatch:'#141414'},
  azul:    {label:'Azul',    bg:'#0d1420', card:'#141d2b', line:'#233047', bone:'#eef3fa', muted:'#7c93ad', accent:'#2f7dd8', accentDim:'#173a63', chip:'#0f1621', swatch:'#2f7dd8'},
  marino:  {label:'Azul marino', bg:'#060147', card:'#0d0a5c', line:'#1c1875', bone:'#eef1fa', muted:'#8a86c2', accent:'#5b7fd6', accentDim:'#221c6b', chip:'#0a0650', swatch:'#060147'},
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
  {key:'campanas', cfgKey:'CSV_CAMPANAS', tab:'Campañas', optional:true},
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
//
// Si VentasDetalle tiene filas de un mes (se sincroniza solo desde su Excel vía
// sync-ventas.ps1), esas se usan de preferencia para ESE mes — así el dashboard
// queda al día automáticamente sin que Alberto tenga que reescribir el resumen
// mensual a mano. Los meses sin filas en VentasDetalle siguen usando el resumen
// manual de la pestaña "Ventas" (útil para meses viejos importados una sola vez).
function getVentas(data){
  const manual = body(data.ventas).map(r => ({
    date: parseDateSmart(r[0]),
    ingresos: parseMoney(r[1]),
    gananciaNeta: parseMoney(r[2]),
  })).filter(v => v.date && (v.ingresos > 0 || v.gananciaNeta !== 0));

  if(!data.ventasDetalle) return manual;

  const det = getVentasDetalle(data);
  if(det.length === 0) return manual;

  const porMes = {};
  det.forEach(v => {
    const k = monthKey(v.date);
    const s = porMes[k] || (porMes[k] = {ingresos:0, gananciaNeta:0});
    s.ingresos += v.venta;
    s.gananciaNeta += v.utilidad;
  });
  const mesesConDetalle = new Set(Object.keys(porMes));

  const resultado = manual.filter(v => !mesesConDetalle.has(monthKey(v.date)));
  Object.keys(porMes).forEach(k => {
    resultado.push({
      date: new Date(+k.slice(0,4), +k.slice(5)-1, 1),
      ingresos: porMes[k].ingresos,
      gananciaNeta: porMes[k].gananciaNeta,
    });
  });
  return resultado;
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

// ¿Es un gasto de negocio? Según config.GASTOS_NEGOCIO, o cualquier categoría
// que empiece por "materiales" (así agarra "Materiales timeless", "Materiales tmls", etc.).
const NEGOCIO_SET = (cfg.GASTOS_NEGOCIO || []).map(c => normName(c));
function esNegocio(categoria){
  const n = normName(categoria);
  return NEGOCIO_SET.indexOf(n) !== -1 || n.indexOf('materiales') === 0;
}

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

// Pestaña "Campañas": Fecha, Campaña, Gasto (gasto real por día y campaña desde Meta Ads)
function getCampanas(data){
  return body(data.campanas).map(r => ({
    date: parseDateSmart(r[0]),
    campana: (r[1]||'').trim(),
    gasto: parseMoney(r[2]),
  })).filter(c => c.date && c.gasto > 0);
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
  renderProyeccion(ventas, stocks, data, selectedMonthKey);
  renderStock(stocks, data);
  renderMeses(ventas, gastos, data);
  renderTop(stocks, data);
  renderRecent(data);
  renderAds(data, selectedMonthKey);
  document.getElementById('footTime').textContent = new Date().getFullYear();
}

// 6. MÁS VENDIDOS (30 días / 15 días / 1 semana, elegible) — parsea combos separando por "+".
let recentDias = 30;
try{ recentDias = Number(localStorage.getItem('timeless_recent_dias')) || 30; }catch(e){}
if([30,15,7].indexOf(recentDias) === -1) recentDias = 30;

function renderRecent(data){
  const box = document.getElementById('recentRows');
  if(!box) return;
  document.querySelectorAll('#recentToggle button').forEach(b =>
    b.classList.toggle('active', Number(b.getAttribute('data-dias')) === recentDias));
  if(!data.ventasDetalle){ box.innerHTML = needCfg('VentasDetalle'); return; }
  const det = getVentasDetalle(data);
  const cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate() - recentDias);
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
  if(rows.length === 0){ box.innerHTML = '<div class="empty">Sin ventas en los últimos ' + recentDias + ' días.</div>'; return; }
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

// 7. META ADS — campañas (gasto real por día) + rentabilidad diaria vs ventas.
function renderAds(data, mk){
  const table = document.getElementById('adsDailyTable');
  const listBox = document.getElementById('campanasList');
  if(!table) return;
  const k = mk || monthKey(new Date());
  document.getElementById('adsDailyMonth').textContent = monthLabel(k);

  if(!data.campanas){
    if(listBox) listBox.innerHTML = '';
    table.innerHTML = '<tr><td class="ads-empty">Conecta la pestaña "Campañas" (Meta Ads) para ver tus campañas y el gasto real por día.</td></tr>';
    return;
  }
  const campanas = getCampanas(data);

  // --- Lista por campaña (del mes seleccionado), clickeable para ver su detalle diario ---
  const cMes = campanas.filter(c => monthKey(c.date) === k);
  const porCampana = {};
  cMes.forEach(c => {
    if(!porCampana[c.campana]) porCampana[c.campana] = {total:0, dias:[]};
    porCampana[c.campana].total += c.gasto;
    porCampana[c.campana].dias.push(c);
  });
  const camps = Object.keys(porCampana).map(n => ({nombre:n, ...porCampana[n]}))
    .sort((a,b)=>b.total-a.total);
  if(listBox){
    if(camps.length === 0){
      listBox.innerHTML = '<div class="empty">Sin campañas con gasto en ' + monthLabel(k) + '.</div>';
    } else {
      const maxC = camps[0].total;
      listBox.innerHTML = camps.map((c, i) => {
        const dias = c.dias.slice().sort((a,b)=>a.date-b.date).map(d =>
          '<div class="camp-day"><span>' + d.date.getDate() + '</span><span class="mono">S/ ' + fmt(d.gasto) + '</span></div>'
        ).join('');
        return '<div class="camp-item" data-i="' + i + '">' +
            '<div class="camp-row">' +
              '<span class="camp-caret">▸</span>' +
              '<span class="camp-name">' + esc(c.nombre) + '</span>' +
              '<span class="camp-total mono">S/ ' + fmt(c.total) + '</span>' +
            '</div>' +
            '<div class="camp-bar"><div class="camp-bar-fill" style="width:' + (c.total/maxC*100) + '%"></div></div>' +
            '<div class="camp-days">' + dias + '</div>' +
          '</div>';
      }).join('');
      // Click para expandir/colapsar el detalle diario de cada campaña
      listBox.querySelectorAll('.camp-item').forEach(el => {
        el.querySelector('.camp-row').addEventListener('click', () => el.classList.toggle('open'));
      });
    }
  }

  // --- Tabla por día: gasto REAL de Meta vs ventas y utilidad del día ---
  const det = data.ventasDetalle ? getVentasDetalle(data).filter(v => monthKey(v.date) === k) : [];
  const byDay = {};
  const slot = (d) => byDay[d] || (byDay[d] = {ads:0, ventas:0, util:0});
  cMes.forEach(c => { slot(c.date.getDate()).ads += c.gasto; });
  det.forEach(v => { const s = slot(v.date.getDate()); s.ventas += v.venta; s.util += v.utilidad; });

  const days = Object.keys(byDay).map(Number).filter(d => byDay[d].ads > 0).sort((a,b)=>a-b);
  if(days.length === 0){
    table.innerHTML = '<tr><td class="ads-empty">Sin gasto de ads en ' + monthLabel(k) + '.</td></tr>';
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

/* ---------- Meta Ads: vista de pantalla completa (15 días / por campaña / semanal) ---------- */
function getWeekStart(d){
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (dt.getDay() + 6) % 7; // 0 = lunes
  dt.setDate(dt.getDate() - day);
  return dt;
}
function fmtDateShort(d){
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
}
function dayKey(d){ return +new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

// Tabla reutilizable de rentabilidad (gasto ads vs ventas) para cualquier agrupación de filas.
function buildRentTable(rows){
  if(rows.length === 0) return '<div class="empty">Sin datos para mostrar en este rango.</div>';
  const tot = {ads:0, ventas:0, util:0};
  const head = '<tr><th>Fecha</th><th>Gasto ads</th><th>Ventas</th><th>Utilidad</th><th>Neto −ads</th><th>Ratio</th></tr>';
  const body = rows.map(r => {
    tot.ads += r.ads; tot.ventas += r.ventas; tot.util += r.util;
    const neto = r.util - r.ads, ratio = r.ads > 0 ? r.util/r.ads : 0;
    return '<tr>' +
      '<td>' + esc(r.label) + '</td>' +
      '<td class="mono">S/ ' + fmt(r.ads) + '</td>' +
      '<td class="mono">S/ ' + fmt(r.ventas) + '</td>' +
      '<td class="mono">S/ ' + fmt(r.util) + '</td>' +
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
  return '<div class="ads-daily-wrap"><table class="ads-daily">' + head + body + foot + '</table></div>';
}

let adsFsView = 'ult15';
let adsFsCampaign = null;

document.getElementById('adsDetailBtn').addEventListener('click', () => {
  if(!LAST || !LAST.data.campanas){
    openFullscreen('Meta Ads · detalle', needCfg('la pestaña Campañas'));
    return;
  }
  const campanasAll = getCampanas(LAST.data);
  if(campanasAll.length === 0){
    openFullscreen('Meta Ads · detalle', '<div class="empty">Aún no hay gasto registrado en la pestaña Campañas.</div>');
    return;
  }
  const nombres = [...new Set(campanasAll.map(c => c.campana))];
  const masReciente = campanasAll.slice().sort((a,b) => b.date - a.date)[0].campana;
  if(nombres.indexOf(adsFsCampaign) === -1) adsFsCampaign = masReciente;
  adsFsView = 'ult15';
  openFullscreen('Meta Ads · detalle', renderAdsFsBody());
  wireAdsFsTabs();
});

function renderAdsFsBody(){
  const campanasAll = getCampanas(LAST.data);
  const ventasAll = LAST.data.ventasDetalle ? getVentasDetalle(LAST.data) : [];
  const nombres = [...new Set(campanasAll.map(c => c.campana))].sort();

  const tabs = '<div class="fs-tabs" id="adsFsTabs">' +
      '<button type="button" data-v="ult15">Últimos 15 días</button>' +
      '<button type="button" data-v="campana">Por campaña</button>' +
      '<button type="button" data-v="semanal">Semanal</button>' +
    '</div>';

  let inner = '';
  if(adsFsView === 'ult15'){
    const cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate() - 14);
    const hoy = new Date(); hoy.setHours(23,59,59,999);
    const enRango = (d) => d >= cutoff && d <= hoy;
    const byDay = {};
    const slot = (d) => { const k = dayKey(d); return byDay[k] || (byDay[k] = {date:d, ads:0, ventas:0, util:0}); };
    campanasAll.filter(c => enRango(c.date)).forEach(c => { slot(c.date).ads += c.gasto; });
    ventasAll.filter(v => enRango(v.date)).forEach(v => { const s = slot(v.date); s.ventas += v.venta; s.util += v.utilidad; });
    const rows = Object.values(byDay).sort((a,b) => a.date - b.date)
      .map(s => ({label: fmtDateShort(s.date), ads:s.ads, ventas:s.ventas, util:s.util}));
    inner = '<div class="table-title">Gasto real (todas las campañas) vs ventas · últimos 15 días</div>' + buildRentTable(rows);
  } else if(adsFsView === 'campana'){
    const sel = '<select class="fs-select" id="adsFsCampSelect">' +
        nombres.map(n => '<option value="' + esc(n) + '"' + (n===adsFsCampaign?' selected':'') + '>' + esc(n) + '</option>').join('') +
      '</select>';
    const dias = campanasAll.filter(c => c.campana === adsFsCampaign).sort((a,b) => a.date - b.date);
    const ventasByDay = {};
    ventasAll.forEach(v => { const k = dayKey(v.date); const s = ventasByDay[k] || (ventasByDay[k] = {ventas:0, util:0}); s.ventas += v.venta; s.util += v.utilidad; });
    const rows = dias.map(c => {
      const v = ventasByDay[dayKey(c.date)] || {ventas:0, util:0};
      return {label: fmtDateShort(c.date), ads:c.gasto, ventas:v.ventas, util:v.util};
    });
    inner = sel + '<div class="table-title">Gasto de "' + esc(adsFsCampaign||'') + '" por día (aparece aunque solo tenga 1 día de datos)</div>' + buildRentTable(rows);
  } else { // semanal
    const byWeek = {};
    campanasAll.forEach(c => {
      const k = +getWeekStart(c.date);
      const s = byWeek[k] || (byWeek[k] = {start:getWeekStart(c.date), ads:0, ventas:0, util:0});
      s.ads += c.gasto;
    });
    ventasAll.forEach(v => {
      const k = +getWeekStart(v.date);
      const s = byWeek[k];
      if(s){ s.ventas += v.venta; s.util += v.utilidad; }
    });
    const rows = Object.values(byWeek).sort((a,b) => a.start - b.start).map(w => {
      const end = new Date(w.start); end.setDate(end.getDate()+6);
      return {label: fmtDateShort(w.start) + '–' + fmtDateShort(end), ads:w.ads, ventas:w.ventas, util:w.util};
    });
    inner = '<div class="table-title">Gasto real (todas las campañas) vs ventas · por semana</div>' + buildRentTable(rows);
  }
  return tabs + inner;
}

function wireAdsFsTabs(){
  const tabs = document.getElementById('adsFsTabs');
  if(!tabs) return;
  tabs.querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-v') === adsFsView);
    b.addEventListener('click', () => {
      adsFsView = b.getAttribute('data-v');
      setFsBody(renderAdsFsBody());
      wireAdsFsTabs();
    });
  });
  const sel = document.getElementById('adsFsCampSelect');
  if(sel){
    sel.addEventListener('change', () => {
      adsFsCampaign = sel.value;
      setFsBody(renderAdsFsBody());
      wireAdsFsTabs();
    });
  }
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

/* ---------- Vista de pantalla completa (reutilizable) ---------- */
function openFullscreen(title, bodyHtml){
  document.getElementById('fsTitle').textContent = title;
  document.getElementById('fsBody').innerHTML = bodyHtml;
  const fsView = document.getElementById('fsView');
  fsView.hidden = false;
  // Solo resetea el scroll INTERNO del overlay (empieza arriba), sin tocar el
  // scroll de la página de atrás — así al volver quedas donde hiciste click,
  // no arriba de todo.
  fsView.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeFullscreen(){
  document.getElementById('fsView').hidden = true;
  document.body.style.overflow = '';
}
function setFsBody(bodyHtml){
  document.getElementById('fsBody').innerHTML = bodyHtml;
}
document.getElementById('fsBack').addEventListener('click', closeFullscreen);

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
  // El número grande de "vender todo" ahora es el EFECTIVO (precio de venta × stock),
  // que es de donde Alberto reinvierte — no la ganancia neta.
  document.getElementById('projPosible').textContent = 'S/ ' + fmt(valorVenta);
  document.getElementById('projBarFill').style.width =
    (valorVenta > 0 ? Math.min(100, invertido/valorVenta*100) : 0) + '%';

  let extraHtml =
    '<div class="r-row"><span class="r-name">↳ Recuperas lo invertido</span><span class="r-amt">S/ ' + fmt(invertido) + '</span></div>' +
    '<div class="r-row"><span class="r-name">↳ De eso, tu ganancia neta</span><span class="r-amt plus">S/ ' + fmt(posible) + '</span></div>' +
    '<div class="r-row"><span class="r-name">Unidades en stock</span><span class="r-amt">' + fmt0(unidades) + '</span></div>';

  // Si además te llega TODO lo pendiente (pedidos comprados que aún no llegan),
  // suma su potencial de ingresos/ganancia neta al techo de stock actual.
  if(data.pendientes){
    const pendRows = getPendientesConValor(stocks, data).filter(r => !r.llego);
    if(pendRows.length > 0){
      const pendIngresos = pendRows.reduce((s,r) => s + r.ingresos, 0);
      const pendGN = pendRows.reduce((s,r) => s + r.gananciaNeta, 0);
      const sinPrecio = pendRows.filter(r => !r.tienePrecio).length;
      extraHtml +=
        '<div class="r-row total"><span class="r-name">Si además te llega TODO lo pendiente, en efectivo</span><span class="r-amt">S/ ' + fmt(valorVenta + pendIngresos) + '</span></div>' +
        '<div class="r-row"><span class="r-name">↳ De eso, tu ganancia neta</span><span class="r-amt plus">S/ ' + fmt(posible + pendGN) + '</span></div>';
      if(sinPrecio > 0){
        extraHtml += '<div class="r-row faint"><span class="r-name">↳ ' + sinPrecio + ' producto(s) pendiente(s) sin precio aún en Stocks (no cuentan arriba, solo en Invertido)</span></div>';
      }
    }
  }

  extra.innerHTML = extraHtml;
  renderPendientes(stocks, data);
}

// Pendientes con su valor proyectado: Ingresos = precio (Stocks) × cantidad pendiente.
// Ganancia neta = Ingresos − Invertido (el invertido ya es el costo real de ese pedido).
// Si el producto aún no tiene fila en Stocks (o sin precio), no se puede proyectar y queda en 0.
function getPendientesConValor(stocks, data){
  const stockByName = {};
  stocks.forEach(s => { stockByName[normName(s.producto)] = s; });
  return getPendientes(data).map(p => {
    const s = stockByName[normName(p.producto)];
    const llego = (s ? s.stock : 0) > 0;
    const tienePrecio = !!(s && s.precio > 0);
    const ingresos = tienePrecio ? p.cantidad * s.precio : 0;
    const gananciaNeta = tienePrecio ? ingresos - p.invertido : 0;
    return Object.assign({}, p, {llego, tienePrecio, ingresos, gananciaNeta});
  });
}

// Pedidos comprados que aún no llegan. Un pendiente se "apaga" solo (no se borra)
// cuando ese producto ya tiene stock > 0 en la pestaña Stocks — así, si pones stock
// solo para probar la proyección y luego lo bajas a 0, el pendiente reaparece.
function renderPendientes(stocks, data){
  const box = document.getElementById('pendingBlock');
  if(!box) return;
  box.classList.remove('clickable');
  box.onclick = null;
  if(!data.pendientes){ box.innerHTML = ''; return; }

  const rows = getPendientesConValor(stocks, data);
  if(rows.length === 0){ box.innerHTML = ''; return; }

  // Solo los que AÚN no llegan salen como "por llegar". Los que ya llegaron
  // (tienen stock > 0 en Stocks) desaparecen de la lista; solo queda una nota.
  const activos = rows.filter(r => !r.llego);
  const llegados = rows.filter(r => r.llego);
  const totalPorLlegar = activos.reduce((s,r) => s + r.invertido, 0);

  let html;
  if(activos.length === 0){
    html =
      '<div class="pend-head"><span>📦 Pedidos por llegar</span><span class="mono accent">todo llegó ✓</span></div>' +
      '<div class="pend-allarrived">Los ' + llegados.length + ' pedidos que tenías pendientes ya llegaron y están en tu stock.</div>';
  } else {
    html =
      '<div class="pend-head">' +
        '<span>📦 Dinero en pedidos por llegar · Invertido</span>' +
        '<span class="mono accent">S/ ' + fmt(totalPorLlegar) + '</span>' +
      '</div>' +
      activos.map(r =>
        '<div class="pend-row">' +
          '<span class="pend-name">' + esc(r.producto) + '</span>' +
          '<span class="pend-amt mono">S/ ' + fmt(r.invertido) + '</span>' +
        '</div>'
      ).join('');
    if(llegados.length > 0){
      html += '<div class="pend-arrived-note">✓ ' + llegados.length + ' ' +
        (llegados.length === 1 ? 'pedido ya llegó' : 'pedidos ya llegaron') + ' (ya no cuentan en el total)</div>';
    }
  }
  html += '<div class="pend-hint">Toca para ver Invertido, Ingresos y Ganancia neta por separado ▸</div>';

  box.innerHTML = html;
  box.classList.add('clickable');
  box.onclick = () => openFullscreen('Pedidos por llegar · detalle', renderPendientesFsBody(rows));
}

// Vista de pantalla completa de Pendientes: las 3 métricas por separado (totales)
// más el detalle por producto.
function renderPendientesFsBody(rows){
  const activos = rows.filter(r => !r.llego);
  const totInv = activos.reduce((s,r) => s + r.invertido, 0);
  const totIng = activos.reduce((s,r) => s + r.ingresos, 0);
  const totGN  = activos.reduce((s,r) => s + r.gananciaNeta, 0);

  const stats =
    '<div class="fs-metric-row"><span class="fs-mname">Invertido (lo que ya pagaste)</span><span class="fs-mamt">S/ ' + fmt(totInv) + '</span></div>' +
    '<div class="fs-metric-row"><span class="fs-mname">Ingresos si vendes todo (venta bruta)</span><span class="fs-mamt">S/ ' + fmt(totIng) + '</span></div>' +
    '<div class="fs-metric-row"><span class="fs-mname">Ganancia neta si vendes todo</span><span class="fs-mamt">S/ ' + fmt(totGN) + '</span></div>';

  const sinPrecio = activos.filter(r => !r.tienePrecio).length;
  const nota = sinPrecio > 0
    ? '<div class="ads-daily-note">⚠ ' + sinPrecio + ' producto(s) pendiente(s) no tienen precio en la pestaña Stocks todavía, así que no se puede calcular su Ingresos/Ganancia neta (por eso solo cuentan en Invertido).</div>'
    : '';

  const head = '<tr><th>Producto</th><th>Cant.</th><th>Invertido</th><th>Ingresos</th><th>Gan. neta</th><th>Estado</th></tr>';
  const body = rows.map(r =>
    '<tr>' +
      '<td>' + esc(r.producto) + '</td>' +
      '<td class="mono">' + fmt0(r.cantidad) + '</td>' +
      '<td class="mono">S/ ' + fmt(r.invertido) + '</td>' +
      '<td class="mono">' + (r.tienePrecio ? 'S/ ' + fmt(r.ingresos) : '—') + '</td>' +
      '<td class="mono">' + (r.tienePrecio ? 'S/ ' + fmt(r.gananciaNeta) : '—') + '</td>' +
      '<td>' + (r.llego ? '✓ llegó' : 'pendiente') + '</td>' +
    '</tr>'
  ).join('');
  const table = '<div class="table-title">Detalle por producto</div>' + '<div class="ads-daily-wrap"><table class="ads-daily">' + head + body + '</table></div>';

  return stats + nota + table;
}

// 4. MES A MES — 3 métricas seleccionables: Utilidad neta / Ingresos / Ganancia neta de ventas.
let mesesMetric = 'util';
try{ mesesMetric = localStorage.getItem('timeless_meses_metric') || 'util'; }catch(e){}
if(mesesMetric !== 'util' && mesesMetric !== 'ing') mesesMetric = 'util';

function renderMeses(ventas, gastos, data){
  const barsBox = document.getElementById('monthsBars');
  const listBox = document.getElementById('monthsList');
  if(!data.ventas && !data.gastos){
    barsBox.innerHTML = needCfg('Ventas y Gastos');
    listBox.innerHTML = '';
    return;
  }

  document.querySelectorAll('#mesesToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-metric') === mesesMetric));

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

  const maxAbs = Math.max(...series.map(s => Math.abs(s[mesesMetric])), 1);
  barsBox.innerHTML = series.map(s => {
    const val = s[mesesMetric];
    const h = Math.max(Math.abs(val)/maxAbs*100, 4);
    return '<div class="mbar' + (s.current?' current':'') + (val<0?' neg':'') + '">' +
             '<div class="col" style="height:' + h + '%"><span class="val">' + fmt0(val) + '</span></div>' +
             '<div class="mlbl">' + s.label + '</div>' +
           '</div>';
  }).join('');

  listBox.innerHTML = [...series].reverse().map(s => {
    const val = s[mesesMetric];
    return '<div class="ml-row' + (s.current?' current':'') + '">' +
      '<span class="ml-name">' + s.full +
        ' <span class="ml-detail">Ing ' + fmt0(s.ing) + ' · GN ' + fmt0(s.gn) + ' · Gastos ' + fmt0(s.g) + ' · Util ' + fmt0(s.util) + '</span></span>' +
      '<span class="ml-amt' + (val<0?' neg':'') + '">S/ ' + fmt(val) + '</span>' +
    '</div>';
  }).join('');
}

// 3b. INVENTARIO — stock de todos los productos, con alerta de poco stock (<5 en rojo).
const STOCK_UMBRAL = 5;
function renderStock(stocks, data){
  const box = document.getElementById('stockList');
  const badge = document.getElementById('stockAlertBadge');
  if(!box) return;
  if(!data.stocks){ box.innerHTML = needCfg('Stocks'); if(badge) badge.textContent = ''; return; }

  // Productos con stock, del que menos queda al que más (los urgentes arriba).
  const conStock = stocks.filter(s => s.stock > 0).sort((a,b) => a.stock - b.stock);
  const low = conStock.filter(s => s.stock < STOCK_UMBRAL);

  if(badge){
    badge.textContent = low.length > 0
      ? '⚠ ' + low.length + ' con poco stock'
      : '✓ stock sano';
    badge.className = 'stock-alert-badge' + (low.length > 0 ? ' alert' : '');
  }

  if(conStock.length === 0){
    box.innerHTML = '<div class="empty">No hay productos con stock ahora mismo. Cuando llegue mercadería y la registres en tu Excel, aparecerá aquí.</div>';
    return;
  }

  box.innerHTML = conStock.map(s => {
    const isLow = s.stock < STOCK_UMBRAL;
    return '<div class="stock-row' + (isLow ? ' low-row' : '') + '">' +
        '<span class="stock-name">' + esc(s.producto) + '</span>' +
        '<span class="stock-qty' + (isLow ? ' low' : '') + '">' + fmt0(s.stock) + ' und' + (isLow ? ' · poco' : '') + '</span>' +
      '</div>';
  }).join('');
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

/* ---------- 7. Accesorios para traer (planificación de compras) ----------
   A diferencia de las demás secciones (que leen CSVs publicados, con retraso
   de minutos), esta lee y escribe directo contra el Apps Script vía
   cfg.WEBHOOK_URL: así Alberto ve sus propios cambios al instante desde el
   celular o la PC, sin esperar el ciclo de "Publicar en la web". */
let compras = [];

function loadCompras(){
  const box = document.getElementById('comprasList');
  if(!cfg.WEBHOOK_URL){ if(box) box.innerHTML = needCfg('WEBHOOK_URL'); return; }
  fetch(cfg.WEBHOOK_URL + '?action=compras&_cb=' + Date.now(), {cache:'no-store'})
    .then(r => r.json())
    .then(resp => {
      compras = (resp && resp.compras) ? resp.compras : [];
      renderCompras();
    })
    .catch(() => { if(box) box.innerHTML = '<div class="empty">No se pudo cargar. Revisa tu conexión y vuelve a intentar.</div>'; });
}

// Borra un bloque de compra completo (usado tanto por "Eliminar" como por
// "Ya lo pedí" — ambos quitan el bloque de la lista, solo cambia el mensaje
// de confirmación según la intención).
function eliminarCompraBlock(id, onDone, onError){
  return fetch(cfg.WEBHOOK_URL, {
    // text/plain evita el preflight CORS (que Apps Script no responde);
    // el body sigue siendo JSON, Apps Script lo lee igual con JSON.parse.
    method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({type:'compraEliminar', id})
  }).then(r => r.json()).then(resp => {
    if(resp.ok){ onDone(); }
    else { onError(resp.error || 'Error al eliminar'); }
  }).catch(() => onError('Error de conexión.'));
}

function fmtRangoFechas(c){
  const f = (iso) => iso ? new Date(iso).toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit'}) : null;
  const ini = f(c.fechaInicio), fin = f(c.fechaFin);
  if(ini && fin) return ini + ' – ' + fin;
  if(ini) return 'Desde ' + ini;
  if(fin) return 'Hasta ' + fin;
  return 'Sin fecha planeada';
}

function renderCompras(){
  const box = document.getElementById('comprasList');
  if(!box) return;
  if(compras.length === 0){
    box.innerHTML = '<div class="empty">Aún no tienes bloques de compra planeados. Toca "+ Nuevo bloque" para agregar el primero.</div>';
    return;
  }
  const ordenados = compras.slice().sort((a,b) => new Date(b.creadoEn||0) - new Date(a.creadoEn||0));
  box.innerHTML = ordenados.map(c => {
    const productos = c.productos || [];
    const unidades = productos.reduce((s,p) => s + (Number(p.cantidad)||0), 0);
    const nProd = productos.length;
    const primeraFoto = (c.fotos && c.fotos[0]) || '';
    const thumb = primeraFoto
      ? '<img src="' + esc(primeraFoto) + '" alt="">' + (c.fotos.length > 1 ? '<span class="compra-thumb-count">+' + (c.fotos.length-1) + '</span>' : '')
      : '<div class="compra-thumb-empty">📦</div>';
    // Ganancia aproximada si vende TODO el bloque: ingreso total (venta ×
    // cantidad de cada producto) menos el precio total del bloque, una sola
    // vez (no se reparte por producto — no hay costo individual real).
    const ingresoPotencial = productos.reduce((s,p) => s + (Number(p.precioVenta)||0) * (Number(p.cantidad)||0), 0);
    const gananciaLinea = (c.precioTotal > 0 && ingresoPotencial > 0)
      ? '<div class="compra-ganancia">Ganancia aprox. si vendes todo: <span class="mono ' + ((ingresoPotencial - c.precioTotal) < 0 ? 'neg':'ok') + '">S/ ' + fmt(ingresoPotencial - c.precioTotal) + '</span></div>'
      : '';
    const estadoCls = c.estado==='Restock' ? 'restock' : c.estado==='Ambos' ? 'ambos' : 'nuevo';
    const nNuevo = productos.filter(p => p.tipo !== 'Restock').length;
    const nRestock = productos.filter(p => p.tipo === 'Restock').length;
    const desgloseTxt = (c.estado === 'Ambos' && nProd > 0) ? ' · ' + nNuevo + ' nuevo · ' + nRestock + ' restock' : '';
    return '<div class="compra-row" data-id="' + esc(c.id) + '">' +
        '<div class="compra-thumb">' + thumb + '</div>' +
        '<div class="compra-info">' +
          '<div class="compra-top-line">' +
            '<span class="compra-nombre">' + esc(c.nombre || '(sin nombre)') + '</span>' +
            '<span class="compra-badge ' + estadoCls + '">' + esc(c.estado||'Ambos') + '</span>' +
          '</div>' +
          '<div class="compra-meta">' + esc(fmtRangoFechas(c)) + ' · ' + nProd + ' producto(s)' + (unidades?' · ~' + fmt0(unidades) + ' u':'') + desgloseTxt + '</div>' +
          gananciaLinea +
        '</div>' +
        '<div class="compra-precio mono">S/ ' + fmt(c.precioTotal||0) + '</div>' +
        '<button type="button" class="compra-quick-ok" title="Ya lo pedí — quitar de la lista">✓</button>' +
      '</div>';
  }).join('');
  box.querySelectorAll('.compra-row').forEach(el => {
    const id = el.getAttribute('data-id');
    el.addEventListener('click', () => {
      const c = compras.find(x => x.id === id);
      if(c) openCompraForm(c);
    });
    el.querySelector('.compra-quick-ok').addEventListener('click', (ev) => {
      ev.stopPropagation();
      if(!confirm('¿Ya pediste/compraste todo este bloque? Se va a quitar de la lista de Accesorios.')) return;
      eliminarCompraBlock(id, loadCompras, err => alert('⚠ ' + err));
    });
  });
}

document.getElementById('compraNuevoBtn').addEventListener('click', () => openCompraForm(null));

/* ---------- Accesorios: vista de pantalla completa por categoría ---------- */
let comprasFsTab = 'Todos';

document.getElementById('comprasHeaderBtn').addEventListener('click', () => {
  comprasFsTab = 'Todos';
  openFullscreen('Accesorios para traer', renderComprasFsBody());
  wireComprasFsTabs();
});

// Tabla de productos de un bloque: nombre, tipo (nuevo/restock), cantidad,
// precio de venta por unidad e ingreso de esa línea (precio × cantidad).
function buildComprasProductosTable(productos){
  if(!productos || productos.length === 0) return '<div class="empty">Sin productos en este bloque.</div>';
  const head = '<tr><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Venta c/u</th><th>Ingreso</th></tr>';
  const rows = productos.map(p => {
    const ingreso = (Number(p.precioVenta)||0) * (Number(p.cantidad)||0);
    return '<tr>' +
      '<td>' + esc(p.producto||'') + '</td>' +
      '<td>' + esc(p.tipo||'Nuevo') + '</td>' +
      '<td class="mono">' + fmt0(p.cantidad||0) + '</td>' +
      '<td class="mono">' + (p.precioVenta ? 'S/ ' + fmt(p.precioVenta) : '—') + '</td>' +
      '<td class="mono">' + (ingreso ? 'S/ ' + fmt(ingreso) : '—') + '</td>' +
    '</tr>';
  }).join('');
  return '<div class="ads-daily-wrap"><table class="ads-daily">' + head + rows + '</table></div>';
}

function renderComprasFsBody(){
  const tabs = '<div class="fs-tabs" id="comprasFsTabs">' +
      '<button type="button" data-v="Todos">Todos</button>' +
      '<button type="button" data-v="Ambos">Ambos</button>' +
      '<button type="button" data-v="Nuevo">Nuevo</button>' +
      '<button type="button" data-v="Restock">Restock</button>' +
    '</div>';

  const filtrados = comprasFsTab === 'Todos' ? compras : compras.filter(c => c.estado === comprasFsTab);
  if(filtrados.length === 0){
    return tabs + '<div class="empty">No hay bloques en esta categoría todavía.</div>';
  }

  const ordenados = filtrados.slice().sort((a,b) => new Date(b.creadoEn||0) - new Date(a.creadoEn||0));
  const items = ordenados.map((c, i) => {
    const productos = c.productos || [];
    const ingresoTotal = productos.reduce((s,p) => s + (Number(p.precioVenta)||0) * (Number(p.cantidad)||0), 0);
    const gananciaAprox = (c.precioTotal > 0 && ingresoTotal > 0) ? ingresoTotal - c.precioTotal : null;
    const estadoCls = c.estado==='Restock' ? 'restock' : c.estado==='Ambos' ? 'ambos' : 'nuevo';
    const gananciaLinea = gananciaAprox != null
      ? '<div class="compra-ganancia">Ganancia aprox. si vendes todo: <span class="mono ' + (gananciaAprox<0?'neg':'ok') + '">S/ ' + fmt(gananciaAprox) + '</span></div>'
      : '';
    return '<div class="compra-fs-item" data-i="' + i + '">' +
        '<div class="compra-fs-row">' +
          '<span class="camp-caret">▸</span>' +
          '<span class="compra-fs-nombre">' + esc(c.nombre || '(sin nombre)') + '</span>' +
          '<span class="compra-badge ' + estadoCls + '">' + esc(c.estado||'Ambos') + '</span>' +
          '<span class="compra-fs-precio mono">S/ ' + fmt(c.precioTotal||0) + '</span>' +
        '</div>' +
        '<div class="compra-fs-detail">' +
          buildComprasProductosTable(productos) +
          gananciaLinea +
        '</div>' +
      '</div>';
  }).join('');

  return tabs + '<div class="compras-fs-list">' + items + '</div>';
}

function wireComprasFsTabs(){
  const tabsBox = document.getElementById('comprasFsTabs');
  if(!tabsBox) return;
  tabsBox.querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-v') === comprasFsTab);
    b.addEventListener('click', () => {
      comprasFsTab = b.getAttribute('data-v');
      setFsBody(renderComprasFsBody());
      wireComprasFsTabs();
    });
  });
  document.querySelectorAll('.compra-fs-item .compra-fs-row').forEach(row => {
    row.addEventListener('click', () => row.parentElement.classList.toggle('open'));
  });
}

// Reduce la foto a un tamaño razonable ANTES de subirla (fotos de celular
// pueden pesar 10+ MB; esto evita llenar tu Drive y que la subida sea lenta).
function resizeImageToBase64(file, maxDim, quality){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('Archivo no es una imagen válida'));
      img.onload = () => {
        let w = img.width, h = img.height;
        if(w > maxDim || h > maxDim){
          const ratio = Math.min(maxDim/w, maxDim/h);
          w = Math.round(w*ratio); h = Math.round(h*ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function uploadCompraFoto(file, onStatus){
  onStatus('Subiendo foto…');
  return resizeImageToBase64(file, 1400, 0.82).then(base64 => {
    return fetch(cfg.WEBHOOK_URL, {
      // text/plain evita el preflight CORS (que Apps Script no responde);
      // el body sigue siendo JSON, Apps Script lo lee igual con JSON.parse.
      method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({type:'compraFoto', base64, mimeType:'image/jpeg', filename:'compra-' + Date.now() + '.jpg'})
    }).then(r => r.json());
  }).then(resp => {
    if(!resp.ok) throw new Error(resp.error || 'Error al subir la foto');
    onStatus('');
    return resp.url;
  }).catch(err => { onStatus('⚠ ' + err.message); throw err; });
}

function renderCompraForm(c){
  const editando = !!c;
  const productos = (c && c.productos && c.productos.length) ? c.productos : [{producto:'', cantidad:'', precioVenta:'', tipo:'Nuevo', fotos:[]}];
  const fRows = productos.map(p => compraProductoRowHtml(p.producto, p.cantidad, p.precioVenta, p.tipo)).join('');
  const fIni = c && c.fechaInicio ? new Date(c.fechaInicio).toISOString().slice(0,10) : '';
  const fFin = c && c.fechaFin ? new Date(c.fechaFin).toISOString().slice(0,10) : '';
  const estado = (c && c.estado) || 'Ambos';

  return '<div class="compra-form">' +
    '<label class="cf-label">Nombre del bloque</label>' +
    '<input type="text" class="cf-input" id="cfNombre" placeholder="Ej. Combo cinturones + collares" value="' + esc((c&&c.nombre)||'') + '">' +

    '<label class="cf-label">Estado</label>' +
    '<div class="util-toggle" id="cfEstadoToggle">' +
      '<button type="button" data-v="Ambos" class="' + (estado==='Ambos'?'active':'') + '">Ambos</button>' +
      '<button type="button" data-v="Nuevo" class="' + (estado==='Nuevo'?'active':'') + '">Nuevo</button>' +
      '<button type="button" data-v="Restock" class="' + (estado==='Restock'?'active':'') + '">Restock</button>' +
    '</div>' +
    '<div class="cf-estado-hint" id="cfEstadoHint">' + (estado==='Ambos' ? 'Marca producto por producto si es nuevo o restock ▾' : 'Todos los productos de este bloque son ' + esc(estado.toLowerCase())) + '</div>' +

    '<div class="cf-row2">' +
      '<div><label class="cf-label">Fecha inicio (opcional)</label><input type="date" class="cf-input" id="cfFechaIni" value="' + fIni + '"></div>' +
      '<div><label class="cf-label">Fecha fin (opcional)</label><input type="date" class="cf-input" id="cfFechaFin" value="' + fFin + '"></div>' +
    '</div>' +

    '<label class="cf-label">Precio total del bloque (lo que pagas en conjunto, no por producto)</label>' +
    '<input type="number" step="0.01" class="cf-input" id="cfPrecio" placeholder="0.00" value="' + ((c&&c.precioTotal)||'') + '">' +

    '<div class="cf-prod-header">' +
      '<label class="cf-label" style="margin:0;">Productos y cantidades aprox.</label>' +
      (editando ? '<button type="button" class="cf-mark-all-btn" id="cfMarcarTodo">✓ Ya lo pedí — quitar de la lista</button>' : '') +
    '</div>' +
    '<div id="cfProductos">' + fRows + '</div>' +
    '<button type="button" class="cf-add-btn" id="cfAddProducto">+ Agregar producto</button>' +

    '<div class="cf-proyeccion" id="cfProyeccion"></div>' +

    '<label class="cf-label">Fotos del bloque (puedes subir varias)</label>' +
    '<div class="cf-fotos-strip" id="cfFotosStrip"></div>' +
    '<label class="cf-file-btn">+ Agregar foto(s)<input type="file" accept="image/*" multiple id="cfFotoInput" hidden></label>' +
    '<div class="cf-foto-status" id="cfFotoStatus"></div>' +

    '<label class="cf-label">Notas (opcional)</label>' +
    '<textarea class="cf-input cf-textarea" id="cfNotas" placeholder="Cualquier detalle extra...">' + esc((c&&c.notas)||'') + '</textarea>' +

    '<div class="cf-actions">' +
      (editando ? '<button type="button" class="cf-btn cf-btn-danger" id="cfEliminar">Eliminar</button>' : '') +
      '<button type="button" class="cf-btn cf-btn-primary" id="cfGuardar">' + (editando?'Guardar cambios':'Guardar') + '</button>' +
    '</div>' +
    '<div class="cf-save-status" id="cfSaveStatus"></div>' +
  '</div>';
}

function compraProductoRowHtml(producto, cantidad, precioVenta, tipo){
  tipo = tipo || 'Nuevo';
  return '<div class="cf-prod-row">' +
      '<div class="cf-prod-line1">' +
        '<input type="text" class="cf-input cf-prod-nombre" placeholder="Producto" value="' + esc(producto||'') + '">' +
        '<button type="button" class="cf-prod-del">×</button>' +
      '</div>' +
      '<div class="cf-prod-tipo-row">' +
        '<div class="cf-prod-tipo-toggle">' +
          '<button type="button" data-v="Nuevo" class="' + (tipo==='Nuevo'?'active':'') + '">Nuevo</button>' +
          '<button type="button" data-v="Restock" class="' + (tipo==='Restock'?'active':'') + '">Restock</button>' +
        '</div>' +
      '</div>' +
      '<div class="cf-prod-line2">' +
        '<input type="number" class="cf-input cf-prod-cant" placeholder="Cantidad" value="' + esc(cantidad||'') + '">' +
        '<input type="number" step="0.01" class="cf-input cf-prod-pventa" placeholder="Precio venta c/u" value="' + esc(precioVenta||'') + '">' +
      '</div>' +
      '<div class="cf-prod-ganancia muted">Ponle un precio de venta para ver el ingreso</div>' +
      '<details class="cf-prod-fotos-details">' +
        '<summary>+ Fotos de este producto (opcional)</summary>' +
        '<div class="cf-fotos-strip cf-prod-fotos-strip"></div>' +
        '<label class="cf-file-btn cf-prod-foto-add">+ Agregar foto(s)<input type="file" accept="image/*" multiple hidden class="cf-prod-foto-input"></label>' +
        '<div class="cf-foto-status cf-prod-foto-status"></div>' +
      '</details>' +
    '</div>';
}

// Ingreso simple, SIN restar inversión por producto (no tenemos el costo de
// cada producto individual, solo el precio total del bloque completo — restar
// aquí daría un número inventado). Por producto: ingreso por unidad y si
// vendes todas las que pediste. A nivel de bloque, si quieres una idea
// aproximada, se resta el precio total del bloque UNA sola vez del ingreso
// total (eso sí es un número real, no repartido por producto).
function recalcCompraProyeccion(){
  const rows = [...document.querySelectorAll('#cfProductos .cf-prod-row')];
  const precioTotal = Number(document.getElementById('cfPrecio').value) || 0;
  let ingresoTotal = 0;

  rows.forEach(row => {
    const cantidad = Number(row.querySelector('.cf-prod-cant').value) || 0;
    const precioVenta = Number(row.querySelector('.cf-prod-pventa').value) || 0;
    const ingresoLinea = precioVenta * cantidad;
    ingresoTotal += ingresoLinea;
    const g = row.querySelector('.cf-prod-ganancia');
    if(precioVenta === 0){
      g.textContent = 'Ponle un precio de venta para ver el ingreso';
      g.className = 'cf-prod-ganancia muted';
    } else {
      g.textContent = 'Ingreso por unidad: S/ ' + fmt(precioVenta) +
        (cantidad > 0 ? ' · si vendes las ' + fmt0(cantidad) + ': S/ ' + fmt(ingresoLinea) : '');
      g.className = 'cf-prod-ganancia ok';
    }
  });

  const proy = document.getElementById('cfProyeccion');
  if(!proy) return;
  if(ingresoTotal === 0){
    proy.innerHTML = '<div class="cf-proy-empty">Pon el precio de venta de cada producto para ver cuánto ingresarías vendiendo todo.</div>';
    return;
  }
  let html = '<div class="cf-proy-row"><span>Si vendes TODO lo de este bloque, ingresos</span><span class="mono">S/ ' + fmt(ingresoTotal) + '</span></div>';
  if(precioTotal > 0){
    const gananciaAprox = ingresoTotal - precioTotal;
    html += '<div class="cf-proy-row total"><span>Ganancia aprox. si vendes todo (idea general, no por producto)</span><span class="mono ' + (gananciaAprox<0?'neg':'ok') + '">S/ ' + fmt(gananciaAprox) + '</span></div>';
  }
  proy.innerHTML = html;
}

function openCompraForm(c){
  openFullscreen(c ? 'Editar bloque de compra' : 'Nuevo bloque de compra', renderCompraForm(c));
  wireCompraForm(c);
}

// Pinta una tira de miniaturas con botón × para borrar cada una.
function renderFotosStripInto(container, fotos, onRemove){
  container.innerHTML = fotos.map((url, idx) =>
    '<div class="cf-foto-thumb"><img src="' + esc(url) + '"><button type="button" class="cf-foto-thumb-del" data-idx="' + idx + '">×</button></div>'
  ).join('');
  container.querySelectorAll('.cf-foto-thumb-del').forEach(btn => {
    btn.addEventListener('click', () => onRemove(Number(btn.getAttribute('data-idx'))));
  });
}

// Sube varias fotos UNA POR UNA (evita saturar Apps Script) y avisa el
// progreso ("Subiendo foto 2 de 3..."). Si una falla, sigue con las demás.
function uploadCompraFotosSecuencial(files, onStatus, onEachUrl){
  let i = 0;
  function siguiente(){
    if(i >= files.length){ onStatus(''); return Promise.resolve(); }
    const file = files[i];
    onStatus('Subiendo foto ' + (i+1) + ' de ' + files.length + '…');
    return uploadCompraFoto(file, () => {}).then(url => {
      onEachUrl(url);
      i++;
      return siguiente();
    }).catch(() => { i++; return siguiente(); });
  }
  return siguiente();
}

function wireCompraForm(c){
  let fotos = (c && c.fotos) ? c.fotos.slice() : [];
  const productFotos = new WeakMap(); // row -> array de URLs (fotos por producto, opcional)
  const estadoBox = document.getElementById('cfEstadoToggle');
  const productosWrap = document.getElementById('cfProductos');
  const estadoHint = document.getElementById('cfEstadoHint');
  let estado = (c && c.estado) || 'Ambos';

  function setAmbosMode(){
    productosWrap.classList.toggle('ambos-mode', estado === 'Ambos');
    estadoHint.textContent = estado === 'Ambos'
      ? 'Marca producto por producto si es nuevo o restock ▾'
      : 'Todos los productos de este bloque son ' + estado.toLowerCase();
  }
  setAmbosMode();

  estadoBox.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      estado = b.getAttribute('data-v');
      estadoBox.querySelectorAll('button').forEach(x => x.classList.toggle('active', x===b));
      setAmbosMode();
    });
  });

  function wireProdTipo(row){
    row.querySelectorAll('.cf-prod-tipo-toggle button').forEach(b => {
      b.addEventListener('click', () => {
        row.querySelectorAll('.cf-prod-tipo-toggle button').forEach(x => x.classList.toggle('active', x===b));
      });
    });
  }
  document.querySelectorAll('#cfProductos .cf-prod-row').forEach(wireProdTipo);

  function renderProductFotos(row){
    const arr = productFotos.get(row) || [];
    renderFotosStripInto(row.querySelector('.cf-prod-fotos-strip'), arr, (idx) => {
      arr.splice(idx, 1);
      renderProductFotos(row);
    });
  }
  function wireProdFotos(row, fotosIniciales){
    productFotos.set(row, (fotosIniciales || []).slice());
    renderProductFotos(row);
    row.querySelector('.cf-prod-foto-input').addEventListener('change', (e) => {
      const files = [...e.target.files];
      if(!files.length) return;
      const statusEl = row.querySelector('.cf-prod-foto-status');
      uploadCompraFotosSecuencial(files, msg => { statusEl.textContent = msg; }, url => {
        const arr = productFotos.get(row) || [];
        arr.push(url);
        productFotos.set(row, arr);
        renderProductFotos(row);
      });
      e.target.value = '';
    });
  }
  const initialRows = [...document.querySelectorAll('#cfProductos .cf-prod-row')];
  const initialProductos = (c && c.productos) || [];
  initialRows.forEach((row, idx) => wireProdFotos(row, initialProductos[idx] ? initialProductos[idx].fotos : []));

  function wireProdRemove(row){
    row.querySelector('.cf-prod-del').addEventListener('click', () => {
      const rows = document.querySelectorAll('#cfProductos .cf-prod-row');
      if(rows.length > 1) row.remove();
      else {
        row.querySelector('.cf-prod-nombre').value='';
        row.querySelector('.cf-prod-cant').value='';
        row.querySelector('.cf-prod-pventa').value='';
        productFotos.set(row, []);
        renderProductFotos(row);
      }
      recalcCompraProyeccion();
    });
  }
  document.querySelectorAll('#cfProductos .cf-prod-row').forEach(wireProdRemove);

  // Recalcula ganancia unitaria/total en vivo mientras Alberto escribe
  // cantidades, precios de venta, o el precio total del bloque.
  document.getElementById('cfProductos').addEventListener('input', recalcCompraProyeccion);
  document.getElementById('cfPrecio').addEventListener('input', recalcCompraProyeccion);
  recalcCompraProyeccion();

  document.getElementById('cfAddProducto').addEventListener('click', () => {
    const wrap = document.getElementById('cfProductos');
    const div = document.createElement('div');
    div.innerHTML = compraProductoRowHtml('', '', '', 'Nuevo');
    const row = div.firstElementChild;
    wrap.appendChild(row);
    wireProdRemove(row);
    wireProdTipo(row);
    wireProdFotos(row, []);
  });

  // "Ya lo pedí": Accesorios es solo un checklist visual, no lleva costo
  // unitario real (se compra en bloque), así que marcarlo como pedido
  // simplemente quita el bloque de la lista — igual que "Eliminar".
  document.getElementById('cfMarcarTodo')?.addEventListener('click', () => {
    if(!confirm('¿Ya pediste/compraste todo este bloque? Se va a quitar de la lista de Accesorios.')) return;
    eliminarCompraBlock(c.id,
      () => { closeFullscreen(); loadCompras(); },
      err => { document.getElementById('cfSaveStatus').textContent = '⚠ ' + err; });
  });

  function renderBlockFotos(){
    renderFotosStripInto(document.getElementById('cfFotosStrip'), fotos, (idx) => {
      fotos.splice(idx, 1);
      renderBlockFotos();
    });
  }
  renderBlockFotos();

  document.getElementById('cfFotoInput').addEventListener('change', (e) => {
    const files = [...e.target.files];
    if(!files.length) return;
    const statusEl = document.getElementById('cfFotoStatus');
    uploadCompraFotosSecuencial(files, msg => { statusEl.textContent = msg; }, url => {
      fotos.push(url);
      renderBlockFotos();
    });
    e.target.value = '';
  });

  document.getElementById('cfEliminar')?.addEventListener('click', () => {
    if(!confirm('¿Eliminar este bloque de compra? No se puede deshacer.')) return;
    eliminarCompraBlock(c.id,
      () => { closeFullscreen(); loadCompras(); },
      err => { document.getElementById('cfSaveStatus').textContent = '⚠ ' + err; });
  });

  document.getElementById('cfGuardar').addEventListener('click', () => {
    const nombre = document.getElementById('cfNombre').value.trim();
    if(!nombre){ document.getElementById('cfSaveStatus').textContent = '⚠ Ponle un nombre al bloque.'; return; }
    const productos = [...document.querySelectorAll('#cfProductos .cf-prod-row')].map(row => {
      // Si el bloque NO es "Ambos", todos sus productos son del mismo tipo
      // (el propio estado del bloque). Si es "Ambos", cada producto lleva su
      // propio tipo marcado con el casillero Nuevo/Restock de su fila.
      const tipoBtn = row.querySelector('.cf-prod-tipo-toggle button.active');
      const tipo = estado === 'Ambos' ? (tipoBtn ? tipoBtn.getAttribute('data-v') : 'Nuevo') : estado;
      return {
        producto: row.querySelector('.cf-prod-nombre').value.trim(),
        cantidad: Number(row.querySelector('.cf-prod-cant').value) || 0,
        precioVenta: Number(row.querySelector('.cf-prod-pventa').value) || 0,
        tipo,
        fotos: productFotos.get(row) || [],
      };
    }).filter(p => p.producto);

    const payload = {
      id: c ? c.id : null,
      nombre,
      estado,
      fechaInicio: document.getElementById('cfFechaIni').value || null,
      fechaFin: document.getElementById('cfFechaFin').value || null,
      precioTotal: Number(document.getElementById('cfPrecio').value) || 0,
      productos,
      fotos,
      notas: document.getElementById('cfNotas').value.trim(),
      creadoEn: c ? c.creadoEn : null,
    };

    const statusEl = document.getElementById('cfSaveStatus');
    statusEl.textContent = 'Guardando…';
    fetch(cfg.WEBHOOK_URL, {
      // text/plain evita el preflight CORS (que Apps Script no responde);
      // el body sigue siendo JSON, Apps Script lo lee igual con JSON.parse.
      method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({type:'compraGuardar', compra:payload})
    }).then(r => r.json()).then(resp => {
      if(resp.ok){ closeFullscreen(); loadCompras(); }
      else { statusEl.textContent = '⚠ ' + (resp.error||'Error al guardar'); }
    }).catch(() => { statusEl.textContent = '⚠ Error de conexión.'; });
  });
}

/* ---------- Arranque ---------- */
// Cambiar de mes re-pinta Utilidad y Proyección con los datos ya cargados.
document.getElementById('monthSelect').addEventListener('change', (e) => {
  selectedMonthKey = e.target.value;
  if(LAST){
    renderHero(LAST.ventas, LAST.gastos, LAST.data, selectedMonthKey);
    renderProyeccion(LAST.ventas, LAST.stocks, LAST.data, selectedMonthKey);
    renderAds(LAST.data, selectedMonthKey);
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

// Mes a mes: elegir qué métrica mostrar (Utilidad neta / Ingresos / Ganancia neta de ventas).
document.getElementById('mesesToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-metric]');
  if(!btn) return;
  mesesMetric = btn.getAttribute('data-metric');
  try{ localStorage.setItem('timeless_meses_metric', mesesMetric); }catch(err){}
  if(LAST) renderMeses(LAST.ventas, LAST.gastos, LAST.data);
});

// Más vendidos: elegir el período (30 días / 15 días / 1 semana).
document.getElementById('recentToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-dias]');
  if(!btn) return;
  recentDias = Number(btn.getAttribute('data-dias'));
  try{ localStorage.setItem('timeless_recent_dias', recentDias); }catch(err){}
  if(LAST) renderRecent(LAST.data);
});

let savedTheme = 'negro';
try{ savedTheme = localStorage.getItem(THEME_KEY) || 'negro'; }catch(e){}
applyTheme(savedTheme);
loadAll();
loadCompras();
