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
    nota: (r[4]||'').trim(),
  })).filter(g => g.date && g.monto > 0 && excl.indexOf(normName(g.categoria)) === -1);
}

// Notas de canje en texto libre (ej. "canje anillos", "Par Anillos más envío
// canje") no siempre repiten el nombre exacto del producto ni el alias
// completo ("Anillos Duki"). Estas reglas cubren esos casos por palabra
// clave — hoy solo hace falta una, para el único producto de anillos del
// catálogo; si se agrega otro "anillo" distinto habría que afinar esto.
const CANJE_PALABRAS_CLAVE = [
  { rx: /anillo/, productos: ['Anillo demon wings duki', 'Anillo angel wings duki'] },
];

// Categorías de Gastos que significan "le regalé producto a alguien, sin
// venta" — mismo mecanismo de resta en Pedidos por llegar sin importar el
// motivo (marketing vs. reponer algo por calidad/garantía), solo cambia la
// etiqueta para que Alberto pueda ver cuánto se va por cada una en su app de
// gastos. Si agrega una categoría nueva con el mismo espíritu, solo hay que
// sumarla acá.
const CANJE_CATEGORIAS = ['canjes', 'reposicion', 'reposición'];

// Cuántas unidades de cada producto se regalaron por canje/reposición
// (categorías de CANJE_CATEGORIAS en Gastos). Orden de prioridad para leer
// la Nota:
//   1. Nombre exacto (o alias/combo "Anillos Duki" / "A + B") DE UN PRODUCTO
//      QUE EXISTE en Stocks ahora mismo -> se usa tal cual, pieza por pieza.
//      Esto es clave si solo regalas UNA pieza de un par (ej. nota =
//      "Anillo demon wings duki" sola, sin el angel): como el nombre exacto
//      ya calza con el catálogo, se usa solo ese, sin caer al comodín de
//      abajo (que SIEMPRE asume el par completo).
//   2. Si la nota es texto libre que no calza ningún nombre real pero sí
//      dispara un comodín (ej. "reposición anillos oxidados cliente"),
//      recién ahí cae a CANJE_PALABRAS_CLAVE (asume el par completo — útil
//      solo cuando de verdad regalas ambas piezas).
//   3. Si la nota no calza ningún nombre real NI ningún comodín (ej. "envío"
//      o "delivery" — cosas de Canjes/Reposición que sí son plata real pero
//      no tienen que ver con ningún producto), se ignora para stock: es
//      un gasto normal de esa categoría, sin efecto en inventario.
// No hace falta tocar Stock/Cantidad pedido/Vendidos en tu Excel de
// Venta_accs para nada de esto: el dashboard resta los canjes él solo en
// getPendientesDeStock, así no se distorsiona tu costo unitario.
function getCanjesPorProducto(gastos, stocks){
  const catalogo = {};
  (stocks || []).forEach(s => { catalogo[normProducto(s.producto)] = true; });

  const map = {};
  const suma = (nombres) => nombres.forEach(p => {
    const key = normProducto(p);
    if(key) map[key] = (map[key] || 0) + 1;
  });
  gastos.filter(g => CANJE_CATEGORIAS.indexOf(normName(g.categoria)) !== -1).forEach(g => {
    const piezas = splitCombo(g.nota); // ya maneja "A + B" y alias de combo/producto
    const todasConocidas = piezas.length > 0 && piezas.every(p => catalogo[normProducto(p)]);
    if(todasConocidas){ suma(piezas); return; }
    const nota = normName(g.nota);
    const regla = CANJE_PALABRAS_CLAVE.find(r => r.rx.test(nota));
    if(regla){ suma(regla.productos); return; }
    // Nota genérica que no matchea ningún producto ni comodín (ej. "envío"):
    // no se resta nada de stock, se ignora para efectos de inventario.
  });
  return map;
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
// que empiece por "materiales" (así agarra "Materiales timeless", "Materiales tmls", etc.),
// o la nota menciona "sunat" (el pago de RUS de Alberto, que categoriza como
// "Servicios" pero es 100% del negocio).
const NEGOCIO_SET = (cfg.GASTOS_NEGOCIO || []).map(c => normName(c));
function esNegocio(categoria, nota){
  const n = normName(categoria);
  if(NEGOCIO_SET.indexOf(n) !== -1 || n.indexOf('materiales') === 0) return true;
  return normName(nota||'').indexOf('sunat') !== -1;
}

// Cashback: retiros de la tarjeta de Alberto, registrados en la app "Mis
// Gastos - Personal" (?action=cashback, en vivo — igual que Compras/Seguimiento).
// Se cargan aparte del ciclo normal de datos, no vienen en el CSV de Gastos.
let cashback = [];
function loadCashback(){
  if(!cfg.WEBHOOK_URL) return;
  fetch(cfg.WEBHOOK_URL + '?action=cashback&_cb=' + Date.now(), {cache:'no-store'})
    .then(r => r.json())
    .then(resp => {
      cashback = ((resp && resp.cashback) ? resp.cashback : []).map(c => ({
        date: parseDateSmart(c.date), amount: Number(c.amount)||0, note: c.note||'',
      })).filter(c => c.date && c.amount > 0);
      if(LAST) renderHero(LAST.ventas, LAST.gastos, LAST.data, selectedMonthKey);
    })
    .catch(() => {});
}

// Cuánto cashback "recupera" cada mes, por mes calendario — mismo modelo FIFO
// que la app de gastos, para que los números calcen entre las dos apps:
// el cashback es plata recuperada que baja tus gastos PERSONALES (nunca los
// de negocio), consumida cronológicamente y SOLO HACIA ADELANTE — un retiro
// cubre los gastos personales que pasan DESPUÉS de esa fecha, hasta agotar
// el crédito (puede cruzar de un mes a otro). "Personal" = lo mismo que ya
// usa el dashboard en todos lados: !esNegocio(...) (Inversión ya está fuera
// de `gastos`, ver getGastos).
function getCashbackUsadoPorMes(gastos, cashbackList){
  const eventos = [];
  gastos.forEach(g => { if(!esNegocio(g.categoria, g.nota)) eventos.push({date:g.date, monto:g.monto, esCashback:false}); });
  cashbackList.forEach(c => eventos.push({date:c.date, monto:c.amount, esCashback:true}));
  eventos.sort((a,b) => a.date - b.date);

  let credito = 0;
  const usadoPorMes = {};
  eventos.forEach(ev => {
    if(ev.esCashback){
      credito += ev.monto;
    } else {
      const usar = Math.min(credito, ev.monto);
      credito -= usar;
      if(usar > 0){
        const k = monthKey(ev.date);
        usadoPorMes[k] = (usadoPorMes[k] || 0) + usar;
      }
    }
  });
  return usadoPorMes;
}

// Modo de la utilidad: 'negocio' (solo gastos de negocio) o 'todo' (también personales).
let utilMode = 'negocio';
try{ utilMode = localStorage.getItem('timeless_util_mode') || 'negocio'; }catch(e){}

// Desglose Ads/Materiales bajo "Gastos de negocio" — solo abre/cierra, no
// se guarda entre sesiones (se resetea cerrado cada vez que abres la app).
let gastosNegocioAbierto = false;

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
// Combos que se venden siempre juntos pero se anotan en el Excel de ventas con
// un nombre corto (no "A + B"). Se expanden aquí a los nombres exactos de Stocks
// para que "más vendidos", ventas recientes y velocidad de stock repartan la
// venta entre ambos productos reales.
const COMBO_ALIAS = {
  'anillos duki': ['Anillo demon wings duki', 'Anillo angel wings duki'],
};

// Un mismo producto, anotado en Ventas con nombres distintos al de Stocks (le
// falta el prefijo "Collar", o el orden de las palabras está invertido). Sin
// esto, esas ventas nunca se le asignan al producto real: no cuentan para
// "más vendidos", velocidad de stock ("días para agotar") ni el sello
// "Nuevo" — el producto se veía como si nunca se hubiera vendido, aunque sí.
// Detectado 2026-08-10: "Collar silver/gold rosary chain" salían "sin ventas"
// en Inventario porque casi todas sus ventas están anotadas sin "Collar".
const ALIAS_PRODUCTO = {
  'silver rosary chain': 'Collar silver rosary chain',
  'rosary silver': 'Collar silver rosary chain',
  'silver rosary': 'Collar silver rosary chain',
  'gold rosary chain': 'Collar gold rosary chain',
  'rosary gold': 'Collar gold rosary chain',
  'gold rosary': 'Collar gold rosary chain',
};

// Separa un combo ("collar A + collar B") en sus piezas, expandiendo cualquier
// alias corto (ver COMBO_ALIAS) pieza por pieza — así funciona tanto si el
// alias va solo ("Anillos Duki") como mezclado con otros productos
// ("Anillos Duki + Pant Chain Chrome Hearts + Cinturon Dark Knight"). Si una
// pieza suelta coincide con ALIAS_PRODUCTO (mismo producto, nombre distinto),
// se renombra al nombre exacto de Stocks. Si vendes/canjeas algo con el
// nombre exacto tal cual está en Stocks, ninguno de los dos aplica y sigue
// igual.
function splitCombo(nombre){
  const piezas = String(nombre||'').split('+').map(s => s.trim()).filter(Boolean);
  const out = [];
  piezas.forEach(p => {
    const combo = COMBO_ALIAS[normName(p)];
    if(combo){ out.push(...combo); return; }
    out.push(ALIAS_PRODUCTO[normName(p)] || p);
  });
  return out;
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

// Pestaña "Stocks": Producto, Precio, Vendidos, Stock, Ganancia bruta pos., Ganancia neta pos., Invertido
function getStocks(data){
  return body(data.stocks).map(r => ({
    producto: (r[0]||'').trim(),
    precio: parseMoney(r[1]),
    vendidos: parseMoney(r[2]),
    stock: parseMoney(r[3]),
    // "Ganancia bruta/neta posible" son sobre el STOCK actual (para proyectar
    // "si vendes lo que tienes ahora"). En pedidos aún sin llegar (stock=0)
    // estas dan 0 — para esos se usa cantidadPedido, ver getPendientesDeStock.
    gananciaBruta: parseMoney(r[4]),
    gananciaNeta: parseMoney(r[5]),
    invertido: parseMoney(r[6]),
    cantidadPedido: parseMoney(r[7]),
    // Día en que se hizo el pedido y tienda donde se compró: salen del bloque
    // de color de la columna A del Excel (ver sync-ventas.ps1). Se usan para
    // mostrar "pedido el 3 ago · hace 5 días" en Pedidos por llegar.
    fechaPedido: parseDateSmart(r[8]),
    plataforma: (r[9]||'').trim(),
    // Costo unitario EXACTO por bloque (no promediado) × stock que le queda a
    // cada bloque, ya sumado en sync-ventas.ps1 — ver getStockInvertido.
    stockInvertido: parseMoney(r[10]),
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
  renderProyeccion(ventas, stocks, data, selectedMonthKey, gastos);
  renderStock(stocks, data, gastos);
  renderMeses(ventas, gastos, data);
  renderTop(stocks, data);
  renderRecent(data);
  renderVentasRecientes(data);
  renderMetaMes(data);
  renderMetaPerso(data);
  renderDiaSemana(data);
  renderAds(data, selectedMonthKey);
  renderRoas(ventas, data, selectedMonthKey);
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

// 6a. VENTAS RECIENTES — ventas y ganancia líquida día a día (esta semana / 7 / 15 días),
// con el récord histórico de venta en un día destacado como referencia motivacional.
let ventasRecModo = 'semana';
try{ ventasRecModo = localStorage.getItem('timeless_ventasrec_modo') || 'semana'; }catch(e){}
if(['semana','7','15'].indexOf(ventasRecModo) === -1) ventasRecModo = 'semana';

// Fecha de inicio de un período de "Ventas recientes" ('semana' = desde el lunes, o N días).
function vrecDesde(modo, hoy){
  const d = new Date(hoy);
  if(modo === 'semana'){
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // retrocede hasta el lunes
  } else {
    d.setDate(d.getDate() - (Number(modo) - 1));
  }
  return d;
}

// Hasta qué día se muestra: en "esta semana" llega hasta el domingo (no se
// corta en hoy), así ya se ven los envíos programados para mañana o pasado
// que ya están registrados (motorizados de un día a otro). "7"/"15 días" sí
// se cortan en hoy, tal cual estaban.
function vrecHasta(modo, hoy){
  if(modo === 'semana'){
    const d = new Date(vrecDesde('semana', hoy));
    d.setDate(d.getDate() + 6); // domingo de esa semana
    return d;
  }
  return new Date(hoy);
}
const VREC_LABELS = {semana:'esta semana', '7':'estos 7 días', '15':'estos 15 días'};

function renderVentasRecientes(data){
  const box = document.getElementById('ventasRecRows');
  const recordEl = document.getElementById('ventasRecRecord');
  const totalesEl = document.getElementById('ventasRecTotales');
  if(!box) return;
  document.querySelectorAll('#ventasRecToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-modo') === ventasRecModo));
  if(!data.ventasDetalle){
    box.innerHTML = needCfg('VentasDetalle');
    if(recordEl) recordEl.textContent='';
    if(totalesEl) totalesEl.innerHTML='';
    return;
  }
  const det = getVentasDetalle(data);
  if(det.length === 0){
    box.innerHTML = '<div class="empty">Sin ventas registradas todavía.</div>';
    if(recordEl) recordEl.textContent = '';
    if(totalesEl) totalesEl.innerHTML = '';
    return;
  }

  // Total por día (todo el histórico), para saber tu récord de venta en un día.
  const porDia = {};
  det.forEach(v => {
    const key = dayKey(v.date);
    if(!porDia[key]) porDia[key] = {date:v.date, venta:0, ganancia:0};
    porDia[key].venta += v.venta;
    porDia[key].ganancia += v.utilidad;
  });
  let record = null;
  Object.values(porDia).forEach(d => { if(!record || d.venta > record.venta) record = d; });

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const desde = vrecDesde(ventasRecModo, hoy);
  const hasta = vrecHasta(ventasRecModo, hoy);

  const dias = [];
  for(let d = new Date(desde); d <= hasta; d.setDate(d.getDate()+1)){
    const found = porDia[dayKey(d)];
    // Los días futuros sin ninguna venta registrada se ocultan (no se sabe
    // aún si va a haber algo ese día); un día futuro CON venta ya anotada sí
    // se muestra, aunque haya días vacíos de por medio. Hoy y el pasado
    // siempre se muestran, tengan venta o no (es tu historial real).
    if(d > hoy && !found) continue;
    dias.push({date:new Date(d), venta: found ? found.venta : 0, ganancia: found ? found.ganancia : 0});
  }

  if(recordEl) recordEl.textContent = '🏆 Récord: S/ ' + fmt0(record.venta) + ' (' + fmtDateShort(record.date) + ')';

  const maxRef = Math.max(record.venta, ...dias.map(d => d.venta), 1);
  box.innerHTML = dias.map(d => {
    const h = d.venta > 0 ? Math.max(d.venta / maxRef * 100, 3) : 0;
    const esRecord = record.venta > 0 && dayKey(d.date) === dayKey(record.date);
    return '<div class="vrec-row' + (esRecord ? ' vrec-record' : '') + '">' +
        '<span class="vrec-day">' + DSEM_LABELS[d.date.getDay()] + ' ' + String(d.date.getDate()).padStart(2,'0') + '</span>' +
        '<span class="vrec-bar-wrap"><div class="vrec-bar" style="width:' + h + '%"></div></span>' +
        '<span class="vrec-nums"><span class="mono">S/ ' + fmt0(d.venta) + '</span><span class="mono accent">+S/ ' + fmt0(d.ganancia) + '</span></span>' +
      '</div>';
  }).join('');

  // Totales de ventas de los 3 períodos, siempre visibles sin importar cuál está seleccionado.
  if(totalesEl){
    totalesEl.innerHTML = ['semana','7','15'].map(modo => {
      const desdeM = vrecDesde(modo, hoy);
      const hastaM = vrecHasta(modo, hoy);
      let suma = 0;
      for(let d = new Date(desdeM); d <= hastaM; d.setDate(d.getDate()+1)){
        const found = porDia[dayKey(d)];
        if(found) suma += found.venta;
      }
      return '<span>Ventas ' + VREC_LABELS[modo] + ': <b>S/ ' + fmt0(suma) + '</b></span>';
    }).join('');
  }
}

// 6a2. META DEL MES — meta de ventas configurable (motivacional, no viene del Excel).
// Se guarda en localStorage y se compara contra los ingresos reales del mes en curso
// (VentasDetalle), repartida por día, por bloques de 10 días o por el mes completo.
let metaMesModo = 'dia';
try{ metaMesModo = localStorage.getItem('timeless_metames_modo') || 'dia'; }catch(e){}
if(['dia','bloque','mes'].indexOf(metaMesModo) === -1) metaMesModo = 'dia';
let metaMesValor = 0;
try{ metaMesValor = Number(localStorage.getItem('timeless_metames_valor')) || 0; }catch(e){}
// Qué métrica mostrar contra la meta: 'ventas' (lo que escribes arriba, tal cual)
// o 'ganancia' (líquida, estimada según tu margen real del mes en curso — no es
// una meta aparte, solo te dice a cuánto equivale tu meta de ventas en líquido).
let metaMesMetrica = 'ventas';
try{ metaMesMetrica = localStorage.getItem('timeless_metames_metrica') || 'ventas'; }catch(e){}
if(['ventas','ganancia'].indexOf(metaMesMetrica) === -1) metaMesMetrica = 'ventas';

function renderMetaMes(data){
  const bodyEl = document.getElementById('metaMesBody');
  const input = document.getElementById('metaMesInput');
  const monthLbl = document.getElementById('metaMesMonthLabel');
  if(!bodyEl) return;
  document.querySelectorAll('#metaMesToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-modo') === metaMesModo));
  document.querySelectorAll('#metaMesMetricaToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-metrica') === metaMesMetrica));
  if(input && document.activeElement !== input) input.value = metaMesValor || '';

  const hoy = new Date();
  const mesNombre = cap(hoy.toLocaleDateString('es-PE', {month:'long'}));
  if(monthLbl) monthLbl.textContent = mesNombre;

  if(!metaMesValor || metaMesValor <= 0){
    bodyEl.innerHTML = '<div class="metames-empty">Escribe arriba cuánto quieres vender este mes para ver tu avance.</div>';
    return;
  }

  const detMes = data.ventasDetalle ? getVentasDetalle(data).filter(v => monthKey(v.date) === monthKey(hoy)) : [];
  const vendidoMes = detMes.reduce((s,v) => s + v.venta, 0);
  const gananciaMes = detMes.reduce((s,v) => s + v.utilidad, 0);
  // Margen real de lo que llevas vendido este mes; si aún no hay ventas, se usa 0.6 como estimado.
  const margen = vendidoMes > 0 ? gananciaMes / vendidoMes : 0.6;

  const diaHoy = hoy.getDate();
  const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();
  const diasRestantes = diasDelMes - diaHoy + 1;

  let metaPeriodoVentas, etiqueta, restanPeriodo, detPeriodo;
  if(metaMesModo === 'dia'){
    metaPeriodoVentas = metaMesValor / diasDelMes;
    detPeriodo = detMes.filter(v => dayKey(v.date) === dayKey(hoy));
    etiqueta = 'hoy';
    restanPeriodo = 1;
  } else if(metaMesModo === 'bloque'){
    const bloqueIdx = Math.min(2, Math.floor((diaHoy - 1) / 10)); // 0: 1-10, 1: 11-20, 2: 21-fin
    const bloqueDesde = bloqueIdx * 10 + 1;
    const bloqueHasta = bloqueIdx === 2 ? diasDelMes : bloqueIdx * 10 + 10;
    metaPeriodoVentas = metaMesValor / 3;
    detPeriodo = detMes.filter(v => v.date.getDate() >= bloqueDesde && v.date.getDate() <= bloqueHasta);
    etiqueta = 'del ' + bloqueDesde + ' al ' + bloqueHasta;
    restanPeriodo = bloqueHasta - diaHoy + 1;
  } else {
    metaPeriodoVentas = metaMesValor;
    detPeriodo = detMes;
    etiqueta = 'del mes';
    restanPeriodo = diasRestantes;
  }

  const vendidoPeriodoVentas = detPeriodo.reduce((s,v) => s + v.venta, 0);
  const gananciaPeriodo = detPeriodo.reduce((s,v) => s + v.utilidad, 0);

  const esGanancia = metaMesMetrica === 'ganancia';
  const metaPeriodo = esGanancia ? metaPeriodoVentas * margen : metaPeriodoVentas;
  const vendidoPeriodo = esGanancia ? gananciaPeriodo : vendidoPeriodoVentas;

  const faltaPeriodo = Math.max(0, metaPeriodo - vendidoPeriodo);
  const pct = Math.min(100, metaPeriodo > 0 ? vendidoPeriodo / metaPeriodo * 100 : 0);
  const cumplido = vendidoPeriodo >= metaPeriodo;

  let html =
    '<div class="metames-big">' +
      '<span class="mono">S/ ' + fmt0(vendidoPeriodo) + '</span>' +
      '<span class="metames-goal">de S/ ' + fmt0(metaPeriodo) + ' ' + etiqueta + '</span>' +
    '</div>' +
    '<div class="proj-bar"><div class="proj-bar-fill" style="width:' + pct + '%"></div></div>';

  if(cumplido){
    html += '<div class="metames-note"><span class="ok">✓ Meta ' + etiqueta + ' cumplida.</span> Todo lo extra desde aquí es puro impulso.</div>';
  } else {
    const porDiaFalta = restanPeriodo > 0 ? faltaPeriodo / restanPeriodo : faltaPeriodo;
    html += '<div class="metames-note">Te faltan <span class="bad">S/ ' + fmt0(faltaPeriodo) + '</span> ' + etiqueta +
      (restanPeriodo > 1 ? ' — unos S/ ' + fmt0(porDiaFalta) + ' por día para llegar.' : '.') + '</div>';
  }

  if(esGanancia){
    html += '<div class="metames-note">Estimado según tu margen de ' + fmt0(margen*100) + '% este mes: tu meta de S/ ' +
      fmt0(metaMesValor) + ' en ventas equivale a unos S/ ' + fmt0(metaMesValor*margen) +
      ' en ganancia líquida. No es una meta aparte, se ajusta sola con tu margen real.</div>';
    html += '<div class="metames-note">Mes completo: llevas S/ ' + fmt0(gananciaMes) + ' en ganancia líquida (de S/ ' +
      fmt0(vendidoMes) + ' vendido), a ' + diasRestantes + ' día(s) de terminar ' + mesNombre + '.</div>';
  } else {
    html += '<div class="metames-note">Mes completo: llevas S/ ' + fmt0(vendidoMes) + ' de S/ ' + fmt0(metaMesValor) +
      ' (' + fmt0(Math.min(100, metaMesValor>0?vendidoMes/metaMesValor*100:0)) + '%), a ' + diasRestantes + ' día(s) de terminar ' +
      mesNombre + '.</div>';
  }

  bodyEl.innerHTML = html;
}

// 6a3. META PERSONALIZADA — monto + fecha límite libres (no atada al mes
// calendario ni a bloques de 10 días), ej. "S/ 970 para el 20 de agosto".
// A diferencia de "Meta del mes", el modo "Efectivo" no es la ganancia neta
// estimada por margen: es Ventas − Gastos tal cual, contando TODOS los gastos
// registrados (incluida "Inversión", que Utilidad excluye porque ya está en
// el costo — pero acá es plata real que sale de tu bolsillo). Ventas y gastos
// se cuentan solo desde que guardaste la meta (no desde antes).
function leerMetaPerso(){
  try{ const raw = localStorage.getItem('timeless_metaperso'); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function guardarMetaPerso(m){ try{ localStorage.setItem('timeless_metaperso', JSON.stringify(m)); }catch(e){} }
function borrarMetaPerso(){ try{ localStorage.removeItem('timeless_metaperso'); }catch(e){} }
function todayISO(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

let metaPersoMetrica = 'ventas';
try{ metaPersoMetrica = localStorage.getItem('timeless_metaperso_metrica') || 'ventas'; }catch(e){}
if(['ventas','efectivo'].indexOf(metaPersoMetrica) === -1) metaPersoMetrica = 'ventas';

// 'total' = acumulado desde que creaste la meta vs el monto completo.
// 'dia' = SOLO lo de hoy vs el ritmo diario que necesitas para tu próxima
// parada. 'hito:<fechaISO>' = una meta intermedia "hasta tal día" (ver hitos).
let metaPersoModo = 'total';
try{ metaPersoModo = localStorage.getItem('timeless_metaperso_modo') || 'total'; }catch(e){}

function renderMetaPerso(data){
  const box = document.getElementById('metaPersoBody');
  if(!box) return;
  const modoToggle = document.getElementById('metaPersoModoToggle');
  document.querySelectorAll('#metaPersoMetricaToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-metrica') === metaPersoMetrica));

  const m = leerMetaPerso();
  if(!m || !m.monto || !m.fechaLimite){
    if(modoToggle) modoToggle.innerHTML = '';
    box.innerHTML = '<div class="metames-empty">Aún no tienes una meta personalizada. Toca "✎ Editar meta" para crear una (ej. "S/ 970 para el 20 de agosto").</div>';
    return;
  }

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fLimite = parseDateSmart(m.fechaLimite);
  const fCreacion = parseDateSmart(m.fechaCreacion) || hoy;
  const excluidos = m.excluidos || [];
  const esEfectivo = metaPersoMetrica === 'efectivo';
  const fCorto = d => d.toLocaleDateString('es-PE', {day:'2-digit', month:'short'}).replace(/\.$/, '');

  // Metas intermedias "hasta tal día": válidas, ordenadas por fecha, y solo
  // las que caen ANTES de la fecha límite total (una después no tendría sentido).
  const hitos = (m.hitos || [])
    .filter(h => h && h.fecha && Number(h.monto) > 0)
    .map(h => ({fecha: parseDateSmart(h.fecha), fechaISO: h.fecha, monto: Number(h.monto)}))
    .filter(h => h.fecha && h.fecha < fLimite)
    .sort((a,b) => a.fecha - b.fecha);

  // Toggle dinámico: [Por día] [→ cada hito] [Meta total].
  let togHtml = '<button type="button" data-modo="dia">Por día</button>';
  hitos.forEach(h => { togHtml += '<button type="button" data-modo="hito:' + esc(h.fechaISO) + '">→ ' + esc(fCorto(h.fecha)) + '</button>'; });
  togHtml += '<button type="button" data-modo="total">Meta total</button>';
  if(modoToggle) modoToggle.innerHTML = togHtml;

  // Si el modo apunta a un hito que ya no existe (lo borraste), cae a total.
  let modo = metaPersoModo;
  const esHito = modo.indexOf('hito:') === 0;
  if(esHito && !hitos.some(h => 'hito:' + h.fechaISO === modo)) modo = 'total';
  else if(!esHito && ['dia','total'].indexOf(modo) === -1) modo = 'total';
  document.querySelectorAll('#metaPersoModoToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-modo') === modo));

  // Ventas: creación → fecha límite (incluye ventas ya programadas a futuro,
  // que son ventas reales comprometidas). Gastos: creación → hoy (para poder
  // destildar los de antes de crear la meta). "Efectivo" = ventas − gastos,
  // contando TODOS los gastos (incluida "Inversión"/mercadería): es la plata
  // real que te queda en mano.
  const detVentas = data.ventasDetalle
    ? getVentasDetalle(data).filter(v => v.date >= fCreacion && v.date <= fLimite)
    : [];
  // Canjes/Reposición no son plata nueva que sale de tu bolsillo (el producto
  // ya estaba pagado como "Materiales" cuando lo compraste) — contarlos aquí
  // sería restar el mismo gasto dos veces, así que no entran al efectivo.
  const gastosPeriodo = body(data.gastos)
    .map(r => ({id: String(r[0]||''), date: parseDateSmart(r[1]), categoria: (r[2]||'').trim(), monto: parseMoney(r[3]), nota: (r[4]||'').trim()}))
    .filter(g => g.id && g.date && g.monto > 0 && g.date >= fCreacion && g.date <= hoy && CANJE_CATEGORIAS.indexOf(normName(g.categoria)) === -1)
    .sort((a,b) => b.date - a.date);
  const gastosIncluidos = gastosPeriodo.filter(g => excluidos.indexOf(g.id) === -1);

  // Acumulado (ventas, o efectivo) hasta una fecha D inclusive.
  const acumHasta = (D) => {
    const v = detVentas.filter(x => x.date <= D).reduce((s,x) => s + x.venta, 0);
    if(!esEfectivo) return v;
    const g = gastosIncluidos.filter(x => x.date <= D).reduce((s,x) => s + x.monto, 0);
    return v - g;
  };
  const soloHoy = () => {
    const v = detVentas.filter(x => dayKey(x.date) === dayKey(hoy)).reduce((s,x) => s + x.venta, 0);
    if(!esEfectivo) return v;
    const g = gastosIncluidos.filter(x => dayKey(x.date) === dayKey(hoy)).reduce((s,x) => s + x.monto, 0);
    return v - g;
  };
  const diasHasta = (D) => Math.max(0, Math.round((D - hoy) / 86400000) + 1);

  // Todas las "paradas" (hitos + meta total) ordenadas por fecha.
  const paradas = hitos.map(h => ({fecha: h.fecha, monto: h.monto}))
    .concat([{fecha: fLimite, monto: m.monto}]);

  let html = '';

  if(modo === 'dia'){
    // El ritmo diario se calcula contra la PRÓXIMA parada pendiente (la fecha
    // más cercana que aún no venció) — así "por día" te dice cuánto necesitas
    // hoy para no quedarte corto en tu meta más próxima, no en la final.
    const prox = paradas.find(p => p.fecha >= hoy) || paradas[paradas.length - 1];
    const acumProx = acumHasta(prox.fecha);
    const dias = diasHasta(prox.fecha);
    const faltaProx = Math.max(0, prox.monto - acumProx);
    const metaDiaria = dias > 0 ? faltaProx / dias : faltaProx;
    const hoyVal = soloHoy();

    if(faltaProx <= 0){
      // Tu próxima parada ya está cubierta (incluidas ventas ya comprometidas
      // a futuro) — mostrar "S/0 hoy" no dice nada útil. En vez de eso, se
      // muestra el ritmo diario que hace falta para la meta TOTAL final.
      const acumFinal = acumHasta(fLimite);
      const diasFinal = diasHasta(fLimite);
      const faltaFinal = Math.max(0, m.monto - acumFinal);
      const porDiaFinal = diasFinal > 0 ? faltaFinal / diasFinal : faltaFinal;
      const esProxFinal = prox.fecha.getTime() === fLimite.getTime();
      html += '<div class="metames-note"><span class="ok">✓ Ya cubriste tu meta' + (esProxFinal ? '' : ' del ' + fCorto(prox.fecha)) + ' con lo vendido (incluidas ventas ya comprometidas).</span></div>';
      if(faltaFinal <= 0){
        html += '<div class="metames-big"><span class="mono">✓</span><span class="metames-goal">meta total S/ ' + fmt0(m.monto) + ' cubierta</span></div>';
      } else {
        html += '<div class="metames-big"><span class="mono">S/ ' + fmt0(porDiaFinal) + '</span><span class="metames-goal">por día para la meta total (' + fCorto(fLimite) + ')</span></div>';
        html += '<div class="metames-note">Te faltan S/ ' + fmt0(faltaFinal) + ' para el ' + fCorto(fLimite) + '.</div>';
      }
    } else {
      const cumplida = hoyVal >= metaDiaria;
      const pct = Math.min(100, metaDiaria > 0 ? Math.max(0, hoyVal / metaDiaria * 100) : 100);
      html += '<div class="metames-big"><span class="mono">S/ ' + fmt0(hoyVal) + '</span><span class="metames-goal">de S/ ' + fmt0(metaDiaria) + ' hoy</span></div>' +
        '<div class="proj-bar"><div class="proj-bar-fill" style="width:' + pct + '%"></div></div>';
      if(cumplida){
        html += '<div class="metames-note"><span class="ok">✓ Meta de hoy cumplida.</span> Lo de más adelanta el día siguiente.</div>';
      } else {
        html += '<div class="metames-note">Te faltan <span class="bad">S/ ' + fmt0(metaDiaria - hoyVal) + '</span> hoy para ir al ritmo que necesitas.</div>';
      }
      html += '<div class="metames-note">Ritmo para tu próxima meta: S/ ' + fmt0(prox.monto) + ' al ' + fCorto(prox.fecha) +
        ' — llevas S/ ' + fmt0(acumProx) + ' (' + dias + ' día(s)).</div>';
    }
  } else {
    // Un objetivo con fecha: un hito ("hasta tal día") o la meta total.
    let target;
    if(modo.indexOf('hito:') === 0){
      const h = hitos.find(x => 'hito:' + x.fechaISO === modo);
      target = {fecha: h.fecha, monto: h.monto, esTotal: false};
    } else {
      target = {fecha: fLimite, monto: m.monto, esTotal: true};
    }
    const acum = acumHasta(target.fecha);
    const dias = diasHasta(target.fecha);
    const vencida = target.fecha < hoy;
    const falta = Math.max(0, target.monto - acum);
    const cumplida = acum >= target.monto;
    const porDia = dias > 0 ? falta / dias : falta;
    const pct = Math.min(100, target.monto > 0 ? acum / target.monto * 100 : 0);
    const fTxt = fCorto(target.fecha);

    html += '<div class="metames-big"><span class="mono">S/ ' + fmt0(acum) + '</span><span class="metames-goal">de S/ ' + fmt0(target.monto) + (target.esTotal ? '' : ' al ' + fTxt) + '</span></div>' +
      '<div class="proj-bar"><div class="proj-bar-fill" style="width:' + pct + '%"></div></div>';
    if(cumplida){
      html += '<div class="metames-note"><span class="ok">✓ ' + (target.esTotal ? 'Meta cumplida' : 'Meta del ' + fTxt + ' cumplida') +
        (vencida ? '' : ' — te quedan ' + dias + ' día(s)') + '.</span></div>';
    } else if(vencida){
      html += '<div class="metames-note"><span class="bad">Venció el ' + fTxt + '.</span> Te faltaron S/ ' + fmt0(falta) + '.</div>';
    } else {
      html += '<div class="metames-note">Te faltan <span class="bad">S/ ' + fmt0(falta) + '</span> para el ' + fTxt +
        (dias > 1 ? ' — unos S/ ' + fmt0(porDia) + ' por día (' + dias + ' días).' : ' — hoy es el último día.') + '</div>';
    }
  }

  // Solo los gastos del MISMO día que creaste la meta son ambiguos (pudiste
  // crearla a media tarde, y algo de esa mañana no debería contar) — esos son
  // los únicos que se muestran para revisar por defecto. Los días siguientes
  // ya cuentan solos, sin pedirte que los repases cada vez.
  const gastosCreacionDia = gastosPeriodo.filter(g => dayKey(g.date) === dayKey(fCreacion));

  if(esEfectivo){
    const ventasTot = detVentas.reduce((s,v) => s + v.venta, 0);
    const gastosTot = gastosIncluidos.reduce((s,g) => s + g.monto, 0);
    html += '<div class="metames-note">Desde que creaste la meta (' + fCorto(fCreacion) + '): vendiste S/ ' + fmt0(ventasTot) +
      ' y gastaste S/ ' + fmt0(gastosTot) + ' (todo lo de tu app de gastos, incluida mercadería) → efectivo S/ ' + fmt0(ventasTot - gastosTot) + '.</div>';
    if(gastosCreacionDia.length > 0){
      html += '<div class="mpg-head">Gastos del ' + fCorto(fCreacion) + ' (día que creaste la meta) — destilda los que hiciste ANTES de crearla:</div>' +
        '<div class="mpg-list" id="metaPersoGastosList">' + gastosCreacionDia.map(g => mpgRowHtml(g, excluidos)).join('') + '</div>';
    }
    if(gastosPeriodo.length > 0){
      html += '<button type="button" class="cf-add-btn" id="metaPersoVerGastosBtn">Ver todos los gastos del período (' + gastosPeriodo.length + ')</button>';
    }
  }

  box.innerHTML = html;

  const wireGastosCheckboxes = (root) => {
    root.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-id');
        const mNow = leerMetaPerso();
        if(!mNow) return;
        let excl = mNow.excluidos || [];
        excl = cb.checked ? excl.filter(x => x !== id) : (excl.indexOf(id) === -1 ? excl.concat([id]) : excl);
        guardarMetaPerso(Object.assign({}, mNow, {excluidos: excl}));
        cb.closest('.mpg-row').classList.toggle('excluido', !cb.checked);
        if(LAST) renderMetaPerso(LAST.data);
      });
    });
  };

  const gastosList = document.getElementById('metaPersoGastosList');
  if(gastosList) wireGastosCheckboxes(gastosList);

  const verGastosBtn = document.getElementById('metaPersoVerGastosBtn');
  if(verGastosBtn){
    verGastosBtn.addEventListener('click', () => {
      const mNow = leerMetaPerso();
      const excl = (mNow && mNow.excluidos) || [];
      openFullscreen('Gastos del período', '<div class="mpg-list" id="metaPersoGastosFsList">' +
        gastosPeriodo.map(g => mpgRowHtml(g, excl)).join('') + '</div>');
      wireGastosCheckboxes(document.getElementById('metaPersoGastosFsList'));
    });
  }
}

function mpgRowHtml(g, excluidos){
  const checked = excluidos.indexOf(g.id) === -1;
  return '<label class="mpg-row' + (checked?'':' excluido') + '">' +
    '<input type="checkbox" data-id="' + esc(g.id) + '" ' + (checked?'checked':'') + '>' +
    '<span class="mpg-info">' +
      '<span class="mpg-cat">' + esc(g.categoria) + (g.nota?' · '+esc(g.nota):'') + '</span>' +
      '<span class="mpg-fecha">' + fmtDateShort(g.date) + '</span>' +
    '</span>' +
    '<span class="mpg-monto mono">S/ ' + fmt(g.monto) + '</span>' +
  '</label>';
}

const MP_HITOS_MAX = 5;

function renderMetaPersoForm(m){
  return '<div class="compra-form">' +
    '<label class="cf-label">Monto objetivo (S/)</label>' +
    '<input type="text" inputmode="decimal" class="cf-input" id="mpMonto" placeholder="Ej. 970" value="' + esc((m&&m.monto)||'') + '">' +
    '<label class="cf-label">Fecha límite</label>' +
    '<input type="date" class="cf-input" id="mpFecha" value="' + esc((m&&m.fechaLimite)||'') + '">' +
    '<div class="cf-estado-hint">Las ventas y gastos se cuentan desde que guardes esta meta (hoy), no desde antes.</div>' +

    '<label class="cf-label">Metas intermedias (opcional)</label>' +
    '<div class="cf-estado-hint">Ej. "S/ 400 para el 15" y "S/ 600 para el 18", camino a tu meta final. Se ven como pestañitas extra (→ 15-ago, → 18-ago) junto a "Por día" y "Meta total".</div>' +
    '<div id="mpHitosList"></div>' +
    '<button type="button" class="cf-add-btn" id="mpHitoAdd">+ Agregar meta intermedia</button>' +

    '<div class="cf-actions">' +
      (m ? '<button type="button" class="cf-btn cf-btn-danger" id="mpBorrar">Borrar meta</button>' : '') +
      '<button type="button" class="cf-btn cf-btn-primary" id="mpGuardar">Guardar</button>' +
    '</div>' +
  '</div>';
}

function renderHitoRowHtml(fecha, monto){
  return '<div class="mp-hito-row">' +
    '<input type="date" class="cf-input mp-hito-fecha" value="' + esc(fecha||'') + '">' +
    '<input type="text" inputmode="decimal" class="cf-input mp-hito-monto" placeholder="S/" value="' + esc(monto||'') + '">' +
    '<button type="button" class="cf-prod-del mp-hito-del">×</button>' +
  '</div>';
}

function openMetaPersoForm(){
  const m = leerMetaPerso();
  openFullscreen(m ? 'Editar meta personalizada' : 'Nueva meta personalizada', renderMetaPersoForm(m));

  const hitosList = document.getElementById('mpHitosList');
  const addBtn = document.getElementById('mpHitoAdd');
  const actualizarBotonHito = () => {
    const n = hitosList.querySelectorAll('.mp-hito-row').length;
    addBtn.style.display = n >= MP_HITOS_MAX ? 'none' : '';
  };
  // Precarga los hitos guardados (si edita una meta existente).
  if(m && m.hitos && m.hitos.length){
    hitosList.innerHTML = m.hitos.map(h => renderHitoRowHtml(h.fecha, h.monto)).join('');
  }
  hitosList.querySelectorAll('.mp-hito-del').forEach(btn => {
    btn.onclick = () => { btn.closest('.mp-hito-row').remove(); actualizarBotonHito(); };
  });
  actualizarBotonHito();

  addBtn.addEventListener('click', () => {
    if(hitosList.querySelectorAll('.mp-hito-row').length >= MP_HITOS_MAX) return;
    const div = document.createElement('div');
    div.innerHTML = renderHitoRowHtml('', '');
    const row = div.firstElementChild;
    row.querySelector('.mp-hito-del').onclick = () => { row.remove(); actualizarBotonHito(); };
    hitosList.appendChild(row);
    actualizarBotonHito();
  });

  document.getElementById('mpGuardar').addEventListener('click', () => {
    const monto = Number(document.getElementById('mpMonto').value) || 0;
    const fechaLimite = document.getElementById('mpFecha').value;
    if(monto <= 0 || !fechaLimite){ alert('Pon un monto y una fecha límite.'); return; }
    const hitos = [...hitosList.querySelectorAll('.mp-hito-row')].map(row => ({
      fecha: row.querySelector('.mp-hito-fecha').value,
      monto: Number(row.querySelector('.mp-hito-monto').value) || 0,
    })).filter(h => h.fecha && h.monto > 0);
    guardarMetaPerso({ monto, fechaLimite, fechaCreacion: (m && m.fechaCreacion) || todayISO(), hitos, excluidos: (m && m.excluidos) || [] });
    closeFullscreen();
    if(LAST) renderMetaPerso(LAST.data);
  });
  const btnBorrar = document.getElementById('mpBorrar');
  if(btnBorrar) btnBorrar.addEventListener('click', () => {
    if(!confirm('¿Borrar esta meta personalizada?')) return;
    borrarMetaPerso();
    closeFullscreen();
    if(LAST) renderMetaPerso(LAST.data);
  });
}
// Meta del mes / Personalizada comparten la misma tarjeta (para no alargar el
// dashboard): este toggle solo muestra/oculta el panel, no vuelve a calcular
// nada (ambos ya se calculan al cargar los datos).
let metaTipo = 'mes';
try{ metaTipo = localStorage.getItem('timeless_metatipo') || 'mes'; }catch(e){}
if(['mes','perso'].indexOf(metaTipo) === -1) metaTipo = 'mes';
function aplicarMetaTipo(){
  document.querySelectorAll('#metaTipoToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-tipo') === metaTipo));
  document.getElementById('metaMesPanel').hidden = metaTipo !== 'mes';
  document.getElementById('metaPersoPanel').hidden = metaTipo !== 'perso';
}
aplicarMetaTipo();
document.getElementById('metaTipoToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tipo]');
  if(!btn) return;
  metaTipo = btn.getAttribute('data-tipo');
  try{ localStorage.setItem('timeless_metatipo', metaTipo); }catch(err){}
  aplicarMetaTipo();
});

document.getElementById('metaPersoEditarBtn').addEventListener('click', openMetaPersoForm);
document.getElementById('metaPersoMetricaToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-metrica]');
  if(!btn) return;
  metaPersoMetrica = btn.getAttribute('data-metrica');
  try{ localStorage.setItem('timeless_metaperso_metrica', metaPersoMetrica); }catch(err){}
  if(LAST) renderMetaPerso(LAST.data);
});
document.getElementById('metaPersoModoToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-modo]');
  if(!btn) return;
  metaPersoModo = btn.getAttribute('data-modo');
  try{ localStorage.setItem('timeless_metaperso_modo', metaPersoModo); }catch(err){}
  if(LAST) renderMetaPerso(LAST.data);
});

// 6b. MEJOR DÍA DE LA SEMANA — agrupa las ventas de los últimos 90 días por día
// de la semana (nº de ventas + ingresos), para ver cuándo hay más movimiento.
let dsemDias = 90;
try{ dsemDias = Number(localStorage.getItem('timeless_dsem_dias')) || 90; }catch(e){}
if([90,60,30].indexOf(dsemDias) === -1) dsemDias = 90;
const DSEM_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DSEM_FULL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
function renderDiaSemana(data){
  const box = document.getElementById('dsemBars');
  const lead = document.getElementById('dsemLead');
  if(!box) return;
  document.querySelectorAll('#dsemToggle button').forEach(b =>
    b.classList.toggle('active', Number(b.getAttribute('data-dias')) === dsemDias));
  const hintEl = document.getElementById('dsemHint');
  if(hintEl) hintEl.textContent = 'Suma de tus ventas por día de la semana en los últimos ' + dsemDias + ' días. Te dice qué días vendes más, para postear o lanzar cuando hay más movimiento.';
  if(!data.ventasDetalle){ box.innerHTML = needCfg('VentasDetalle'); if(lead) lead.textContent=''; return; }
  const cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate() - dsemDias);
  const acc = DSEM_LABELS.map(() => ({ventas:0, ingresos:0}));
  getVentasDetalle(data).filter(v => v.date >= cutoff).forEach(v => {
    const d = v.date.getDay();
    acc[d].ventas += 1;
    acc[d].ingresos += v.venta;
  });
  const totalVentas = acc.reduce((s,a) => s + a.ventas, 0);
  if(totalVentas === 0){
    box.innerHTML = '<div class="empty">Sin ventas en los últimos ' + dsemDias + ' días.</div>';
    if(lead) lead.textContent = '';
    return;
  }
  const maxV = Math.max(...acc.map(a => a.ventas), 1);
  // El mejor día lo lidera el nº de ventas (el ingreso es solo detalle).
  let bestIdx = 0;
  acc.forEach((a, i) => { if(a.ventas > acc[bestIdx].ventas) bestIdx = i; });
  if(lead) lead.textContent = '🔥 ' + cap(DSEM_FULL[bestIdx]);

  // Se muestra Lun→Dom (más natural que Dom→Sáb del getDay()).
  const orden = [1,2,3,4,5,6,0];
  box.innerHTML = orden.map(i => {
    const a = acc[i];
    const h = Math.max(a.ventas / maxV * 100, 4);
    return '<div class="dsem-bar' + (i === bestIdx ? ' best' : '') + '">' +
        '<div class="dsem-col-wrap"><div class="dsem-col" style="height:' + h + '%">' +
          '<span class="dsem-val">' + fmt0(a.ventas) + '</span>' +
        '</div></div>' +
        '<div class="dsem-lbl">' + DSEM_LABELS[i] + '</div>' +
      '</div>';
  }).join('');
}

// 2b. ROAS REAL — ingresos del mes vs gasto REAL en ads (de tu app de gastos,
// que ya incluye el IGV). Si un mes viejo no tiene ads registrados pero Meta sí
// reporta gasto, se estima el costo real como Meta × 1.18.
const IGV_FACTOR = 1.18;
function getGastosAdsMes(data, k){
  return body(data.gastos).map(r => ({
    date: parseDateSmart(r[1]),
    categoria: (r[2]||'').trim(),
    monto: parseMoney(r[3]),
  })).filter(g => g.date && g.monto > 0 && normName(g.categoria) === 'ads' &&
    (!k || monthKey(g.date) === k)).reduce((s,g) => s + g.monto, 0);
}

function renderRoas(ventas, data, k){
  const monthEl = document.getElementById('roasMonth');
  const valEl = document.getElementById('roasValue');
  const subEl = document.getElementById('roasSub');
  const rowsEl = document.getElementById('roasRows');
  const noteEl = document.getElementById('roasNote');
  if(!valEl) return;
  if(monthEl) monthEl.textContent = k ? monthLabel(k) : '—';

  if(!data.gastos && !data.ventasDetalle && !data.ventas){
    valEl.textContent = '—'; subEl.textContent = ''; rowsEl.innerHTML = '';
    if(noteEl) noteEl.textContent = ''; return;
  }

  const vMes = ventas.filter(v => monthKey(v.date) === k);
  const ingresos = vMes.reduce((s,v) => s + v.ingresos, 0);
  const gananciaNeta = vMes.reduce((s,v) => s + v.gananciaNeta, 0);
  const adsReal = getGastosAdsMes(data, k);
  const metaSpend = getCampanas(data).filter(c => monthKey(c.date) === k).reduce((s,c) => s + c.gasto, 0);

  // Dos costos: SIN IGV (lo que Meta reporta como gasto de anuncio) y CON IGV
  // (lo que realmente te cae a la tarjeta). Si falta uno, se deriva del otro:
  // el gasto real de tu app de gastos ya trae IGV; Meta lo reporta sin IGV.
  const gastoConIGV = adsReal > 0 ? adsReal : (metaSpend > 0 ? metaSpend * IGV_FACTOR : 0);
  const gastoSinIGV = metaSpend > 0 ? metaSpend : (adsReal > 0 ? adsReal / IGV_FACTOR : 0);
  const estimado = !(adsReal > 0); // el costo real con IGV fue estimado (no registrado)

  if(gastoConIGV <= 0){
    valEl.textContent = '—'; subEl.textContent = ''; rowsEl.innerHTML = '';
    if(noteEl) noteEl.textContent = 'No hay gasto de ads registrado en ' + (k ? monthLabel(k) : 'este mes') + '.';
    return;
  }

  const roasReal = gastoConIGV > 0 ? ingresos / gastoConIGV : 0;
  const roasSinIGV = gastoSinIGV > 0 ? ingresos / gastoSinIGV : 0;

  valEl.textContent = roasReal.toFixed(2) + 'x';
  subEl.textContent = 'ROAS real · S/ ' + fmt(roasReal) + ' vendidos por cada S/ 1 (con IGV)';

  rowsEl.innerHTML =
    '<div class="roas-row"><span>ROAS sin IGV (gasto que reporta Meta)</span><span class="mono">' + roasSinIGV.toFixed(2) + 'x</span></div>' +
    '<div class="roas-row"><span>ROAS real (con IGV, lo que te cobran)</span><span class="mono accent">' + roasReal.toFixed(2) + 'x</span></div>' +
    '<div class="roas-row total"><span>Ingresos de ventas del mes</span><span class="mono">S/ ' + fmt(ingresos) + '</span></div>' +
    '<div class="roas-row"><span>De eso, ganancia neta (líquida)</span><span class="mono ok">S/ ' + fmt(gananciaNeta) + '</span></div>' +
    '<div class="roas-row"><span>Gasto real en ads' + (estimado ? ' (estimado ×1.18)' : ' (tu tarjeta, con IGV)') + '</span><span class="mono">S/ ' + fmt(gastoConIGV) + '</span></div>' +
    (metaSpend > 0 ? '<div class="roas-row faint"><span>↳ Meta reporta sin IGV</span><span class="mono">S/ ' + fmt(metaSpend) + '</span></div>' : '');

  if(noteEl){
    noteEl.textContent = estimado
      ? 'Este mes no tiene ads en tu app de gastos; el costo con IGV se estimó como el gasto de Meta + 18%. El "ROAS real" es retorno total (no todo viene de los ads).'
      : 'El "ROAS real" es retorno total del mes (no todas las ventas vienen de los ads), tómalo como eficiencia general.';
  }
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
  renderAdsPorAnuncio(k);
}

// ---------- Meta Ads "Por anuncio": gasto + costo por conversación ----------
// Se cargan aparte (?action=anunciosMeta, en vivo desde la pestaña "AnunciosMeta"
// que llena syncMetaAdsAutomatico() cada 4h), igual que Compras/Seguimiento —
// no hace falta publicar esa pestaña a la web.
let anunciosMeta = [];
function loadAnunciosMeta(){
  if(!cfg.WEBHOOK_URL) return;
  fetch(cfg.WEBHOOK_URL + '?action=anunciosMeta&_cb=' + Date.now(), {cache:'no-store'})
    .then(r => r.json())
    .then(resp => {
      anunciosMeta = ((resp && resp.anunciosMeta) ? resp.anunciosMeta : []).map(a => ({
        date: parseDateSmart(a.fecha), anuncio: a.anuncio, campana: a.campana,
        gasto: Number(a.gasto)||0, conversaciones: Number(a.conversaciones)||0,
      })).filter(a => a.date);
      renderAdsPorAnuncio(selectedMonthKey || monthKey(new Date()));
    })
    .catch(() => {});
}

// "Normal" para vos: promedio de costo/conversación de tus últimos 30 días con
// datos (todas las campañas juntas). Sin esto, un número suelto como "S/ 3.50
// por conversación" no dice si está bien o mal — cada negocio/rubro es distinto,
// así que se compara contra TU propio historial, no contra un umbral inventado.
function costoConversacionBaseline(){
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const desde = new Date(hoy); desde.setDate(desde.getDate() - 30);
  let gasto = 0, conv = 0;
  anunciosMeta.forEach(a => { if(a.date >= desde && a.date <= hoy){ gasto += a.gasto; conv += a.conversaciones; } });
  return conv > 0 ? gasto / conv : null;
}

// Semáforo: verde si estás 15%+ mejor que tu propio promedio, rojo si estás
// 15%+ peor, amarillo en el medio. Gris si no hay suficiente historial o el
// anuncio no tuvo conversaciones (no se puede calcular su costo).
function semaforoCosto(costo, baseline){
  if(costo == null || baseline == null) return {cls:'gris', txt:'—'};
  if(costo <= baseline * 0.85) return {cls:'verde', txt:'Bien'};
  if(costo <= baseline * 1.15) return {cls:'amarillo', txt:'Normal'};
  return {cls:'rojo', txt:'Alto'};
}

function renderAdsPorAnuncio(k){
  const box = document.getElementById('adsPorAnuncioBody');
  if(!box) return;
  const mes = anunciosMeta.filter(a => monthKey(a.date) === k);
  if(mes.length === 0){
    box.innerHTML = '<div class="empty">Sin datos por anuncio en ' + monthLabel(k) + ' todavía (o falta configurar el sync — ver nota abajo).</div>';
    return;
  }
  const porAnuncio = {};
  mes.forEach(a => {
    const e = porAnuncio[a.anuncio] || (porAnuncio[a.anuncio] = {nombre:a.anuncio, campana:a.campana, gasto:0, conversaciones:0});
    e.gasto += a.gasto; e.conversaciones += a.conversaciones;
  });
  const filas = Object.values(porAnuncio).sort((a,b) => b.gasto - a.gasto);
  const baseline = costoConversacionBaseline();

  const totGasto = filas.reduce((s,f) => s + f.gasto, 0);
  const totConv = filas.reduce((s,f) => s + f.conversaciones, 0);
  const totCosto = totConv > 0 ? totGasto / totConv : null;

  const filaHtml = (f, esTotal) => {
    const costo = f.conversaciones > 0 ? f.gasto / f.conversaciones : null;
    const sem = semaforoCosto(costo, baseline);
    return '<div class="ads-pa-row' + (esTotal?' total':'') + '">' +
        '<div class="ads-pa-info">' +
          '<span class="ads-pa-nombre">' + esc(f.nombre) + '</span>' +
          (esTotal || !f.campana ? '' : '<span class="ads-pa-camp">' + esc(f.campana) + '</span>') +
        '</div>' +
        '<span class="ads-pa-dot ' + sem.cls + '" title="' + sem.txt + '"></span>' +
        '<span class="mono ads-pa-gasto">S/ ' + fmt(f.gasto) + '</span>' +
        '<span class="mono ads-pa-conv">' + fmt0(f.conversaciones) + ' conv.</span>' +
        '<span class="mono ads-pa-costo">' + (costo!=null ? 'S/ '+fmt(costo) : '—') + '</span>' +
      '</div>';
  };

  let html = '<div class="ads-pa-head">' +
      '<span></span><span></span><span>Gasto</span><span>Convers.</span><span>Costo/conv.</span>' +
    '</div>' +
    filas.map(f => filaHtml(f, false)).join('');
  if(filas.length > 1){
    html += filaHtml({nombre:'Total (' + filas.length + ' anuncios juntos)', gasto:totGasto, conversaciones:totConv}, true);
  }
  if(baseline != null){
    html += '<div class="ads-daily-note">🟢 Bien / 🟡 Normal / 🔴 Alto — comparado con tu propio promedio de los últimos 30 días (S/ ' + fmt(baseline) + ' por conversación). ⚪ = sin conversaciones o sin historial suficiente.</div>';
  } else {
    html += '<div class="ads-daily-note">Necesitas más historial (30 días con conversaciones) para que el semáforo compare contra tu propio promedio.</div>';
  }
  box.innerHTML = html;
}

// Toggle "Gasto diario" (tabla de siempre) / "Por anuncio" (gasto + costo por
// conversación + semáforo).
let adsVista = 'dia';
try{ adsVista = localStorage.getItem('timeless_ads_vista') || 'dia'; }catch(e){}
if(['dia','anuncio'].indexOf(adsVista) === -1) adsVista = 'dia';
function aplicarAdsVista(){
  document.querySelectorAll('#adsVistaToggle button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-v') === adsVista));
  const esDia = adsVista === 'dia';
  document.querySelector('#adsDailyCard .ads-daily-wrap').hidden = !esDia;
  document.getElementById('adsPorAnuncioBody').hidden = esDia;
  document.getElementById('adsVistaTitle').textContent = esDia ? 'Por día · gasto real vs ventas' : 'Por anuncio · gasto y costo por conversación';
  document.getElementById('adsDailyNote').hidden = !esDia;
}
aplicarAdsVista();
document.getElementById('adsVistaToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-v]');
  if(!btn) return;
  adsVista = btn.getAttribute('data-v');
  try{ localStorage.setItem('timeless_ads_vista', adsVista); }catch(err){}
  aplicarAdsVista();
});

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
  const gastosNegocio  = gMes.filter(g=>esNegocio(g.categoria, g.nota)).reduce((s,g)=>s+g.monto, 0);
  const gastosPersonal = gMes.filter(g=>!esNegocio(g.categoria, g.nota)).reduce((s,g)=>s+g.monto, 0);
  // Desglose de "Gastos de negocio": Ads, Materiales, y "Otros" (por ahora
  // solo Sunat/RUS, categorizado como "Servicios" pero es del negocio).
  // "Otros" se calcula como el resto para que siempre sume exacto al total.
  const gastosAds = gMes.filter(g => normName(g.categoria) === 'ads').reduce((s,g)=>s+g.monto, 0);
  const gastosMateriales = gMes.filter(g => normName(g.categoria).indexOf('materiales') === 0).reduce((s,g)=>s+g.monto, 0);
  const gastosOtrosNegocio = gastosNegocio - gastosAds - gastosMateriales;
  const inversion = sumInversion(data, k);

  // Cashback recuperado este mes contra los gastos personales (FIFO cronológico
  // sobre TODO el historial, no solo este mes — un retiro de mayo puede seguir
  // cubriendo gastos de junio). Nunca toca el lado de negocio.
  const cashbackRecuperado = getCashbackUsadoPorMes(gastos, cashback)[k] || 0;
  const gastosPersonalNeto = Math.max(0, gastosPersonal - cashbackRecuperado);

  // Modo "negocio": solo gastos de negocio. Modo "todo": también los personales
  // (netos de cashback recuperado).
  const utilidad = (utilMode === 'todo')
    ? gananciaNeta - gastosNegocio - gastosPersonalNeto
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
    {name:'Gastos de negocio (Ads, materiales)', amt:-gastosNegocio, sign:'-', negocioRow:true},
  ];
  if(utilMode === 'todo'){
    rows.push({name:'Gastos personales', amt:-gastosPersonal, sign:'-'});
    if(cashbackRecuperado > 0){
      rows.push({name:'↳ Recuperado de cashback', amt:cashbackRecuperado, sign:'+', faint:true});
    }
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
      const caret = r.negocioRow ?
        ' <button type="button" class="r-caret" id="gastosNegocioCaret">' + (gastosNegocioAbierto ? '▾' : '▸') + '</button>' : '';
      let html = '<div class="r-row' + (r.total ? ' total' : '') + (r.faint ? ' faint' : '') + (r.negocioRow ? ' clickable' : '') + '"' + (r.negocioRow ? ' id="gastosNegocioRow"' : '') + '>' +
        '<span class="r-name">' + r.name + caret + '</span>' +
        '<span class="r-amt ' + cls + '">' + prefix + 'S/ ' + fmt(Math.abs(r.amt)) + '</span>' +
      '</div>';
      if(r.negocioRow && gastosNegocioAbierto){
        html +=
          '<div class="r-row faint sub"><span class="r-name">↳ Ads</span><span class="r-amt">S/ ' + fmt(gastosAds) + '</span></div>' +
          '<div class="r-row faint sub"><span class="r-name">↳ Materiales</span><span class="r-amt">S/ ' + fmt(gastosMateriales) + '</span></div>';
        if(gastosOtrosNegocio > 0){
          html += '<div class="r-row faint sub"><span class="r-name">↳ Otros (Sunat, canjes, reposición)</span><span class="r-amt">S/ ' + fmt(gastosOtrosNegocio) + '</span></div>';
        }
      }
      return html;
    }).join('');
}

// 3. PROYECCIÓN
// "Stock invertido": la plata que tienes metida en la mercadería que YA está
// físicamente en tu mano ahora mismo. Por producto = costo unitario × unidades
// en stock = invertido del pedido × (stock ÷ cantidad pedida). Sumado, da lo
// mismo que la columna "Stock invertido" (H) de tu pestaña Stocks — pero se
// calcula solo de los productos, sin depender de una celda fija (H40 se mueve
// al agregar productos nuevos).
function getStockInvertido(stocks){
  return stocks.reduce((s, x) => {
    if(x.stock <= 0) return s;
    // stockInvertido ya viene calculado EXACTO por bloque desde sync-ventas.ps1
    // (costo unitario real de cada pedido × lo que le queda a ESE pedido, no
    // un promedio) — igual al criterio de la columna "Stock invertido" de tu
    // Excel. Si todavía no subiste el sync nuevo (campo en 0/vacío), cae al
    // promedio de antes para no mostrar S/0 de golpe.
    if(x.stockInvertido > 0) return s + x.stockInvertido;
    if(x.cantidadPedido > 0 && x.invertido > 0) return s + x.invertido * (x.stock / x.cantidadPedido);
    return s;
  }, 0);
}

function renderProyeccion(ventas, stocks, data, mk, gastos){
  const canjes = getCanjesPorProducto(gastos || [], stocks);
  const vendidosHist = getVendidosHistoricoSet(data);
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

  const stockInvertido = getStockInvertido(stocks);

  let extraHtml =
    '<div class="r-row destacada"><span class="r-name">📦 Stock invertido (lo que tienes en mano ahora)</span><span class="r-amt">S/ ' + fmt(stockInvertido) + '</span></div>' +
    '<div class="r-row"><span class="r-name">↳ Recuperas lo invertido</span><span class="r-amt">S/ ' + fmt(invertido) + '</span></div>' +
    '<div class="r-row"><span class="r-name">↳ De eso, tu ganancia neta</span><span class="r-amt plus">S/ ' + fmt(posible) + '</span></div>' +
    '<div class="r-row"><span class="r-name">Unidades en stock</span><span class="r-amt">' + fmt0(unidades) + '</span></div>';

  // Si además te llega TODO lo pendiente (pedidos ya invertidos con stock aún
  // en 0, así que todavía no llegan), suma su potencial de ingresos/ganancia
  // neta al techo de stock actual.
  const pendRows = getPendientesDeStock(stocks, canjes, vendidosHist);
  if(pendRows.length > 0){
    const pendIngresos = pendRows.reduce((s,r) => s + r.ingresos, 0);
    const pendGN = pendRows.reduce((s,r) => s + r.gananciaNeta, 0);
    extraHtml +=
      '<div class="r-row total"><span class="r-name">Si además te llega TODO lo pendiente, en efectivo</span><span class="r-amt">S/ ' + fmt(valorVenta + pendIngresos) + '</span></div>' +
      '<div class="r-row"><span class="r-name">↳ De eso, tu ganancia neta</span><span class="r-amt plus">S/ ' + fmt(posible + pendGN) + '</span></div>';
  }

  extra.innerHTML = extraHtml;
  renderPendientes(stocks, canjes, vendidosHist);
}

// Pedidos comprados que aún no llegan (o no llegan del todo): lo pendiente de
// un producto es "cantidad pedida − lo que ya está en stock − lo que ya se
// vendió − lo que se regaló por canje (ver getCanjesPorProducto)". Cubre
// tanto un pedido que no ha llegado nada de él (stock=0, vendidos=0 →
// pendiente = cantidad pedida completa) como una LLEGADA PARCIAL de dos
// proveedores distintos (ej. pediste 30, te llegaron 20 de un proveedor y 10
// siguen en camino de otro: pones stock=20, vendidos=0, y acá solo quedan
// pendientes esas 10 — eso NO es un error, es lo que falta por llegar). Si
// además regalaste 1 unidad por canje, esa resta también aquí — así en tu
// Excel de Venta_accs solo bajas el Stock, sin tocar Cantidad pedido ni
// Vendidos (eso distorsionaría tu costo unitario). Apenas la cuenta alcance
// lo pedido, la fila deja de aparecer sola — no hace falta tocar nada más.
// Todo producto (o pieza de combo) que alguna vez aparece en tu Excel de
// Ventas, sin importar qué diga "Vendidos" en Stocks — ese se resetea a 0
// cada vez que abres un bloque/pedido nuevo para algo que ya vendías antes
// (ver el fix de sumar bloques). Esto es lo que de verdad indica si un
// producto es nuevo para el sello "Nuevo" en Pedidos por llegar.
function getVendidosHistoricoSet(data){
  const set = {};
  if(!data || !data.ventasDetalle) return set;
  getVentasDetalle(data).forEach(v => {
    splitCombo(v.producto).forEach(p => {
      const key = normProducto(p);
      if(key) set[key] = true;
    });
  });
  return set;
}

function getPendientesDeStock(stocks, canjes, vendidosHist){
  canjes = canjes || {};
  vendidosHist = vendidosHist || {};
  return stocks.map(s => {
    const canjeado = canjes[normProducto(s.producto)] || 0;
    return { s, pendiente: s.cantidadPedido - s.stock - s.vendidos - canjeado };
  })
    // Requiere precio > 0: así se excluyen materiales/insumos (bolsas, empaques,
    // etc.) que se compran sin llegar todavía pero nunca se venden — esos van
    // como gasto de "Materiales Timeless" en la app de gastos, no como pedido.
    //
    // stock=0 por sí solo NO basta como señal (ni antes ni ahora): también
    // puede significar que YA llegó todo y se agotó de tanto venderlo. La
    // resta de arriba ya lo cubre: si todo lo pedido está en stock+vendidos,
    // pendiente da 0 y no aparece aquí.
    .filter(({s, pendiente}) => pendiente > 0 && s.invertido > 0 && s.precio > 0)
    .map(({s, pendiente}) => {
      // Invertido/Ingresos/Ganancia neta se prorratean a la porción pendiente
      // (si ya llegó una parte, esa parte ya cuenta en "Stock actual", no acá).
      const proporcion = s.cantidadPedido > 0 ? pendiente / s.cantidadPedido : 1;
      const invertido = s.invertido * proporcion;
      const ingresos = s.precio * pendiente;
      return {
        producto: s.producto,
        cantidad: pendiente,
        invertido,
        ingresos,
        gananciaNeta: ingresos - invertido,
        // Nunca aparece en tu historial de Ventas -> es un producto nuevo (no
        // un restock de algo que ya vendías), para mostrar el sello "Nuevo".
        nuevo: !vendidosHist[normProducto(s.producto)],
        fechaPedido: s.fechaPedido || null,
        plataforma: s.plataforma || '',
      };
    });
}

// "Shein · 03/08 · hace 5 días" — el día en que se pidió y cuánto lleva sin
// llegar, para tantear si ya toca preocuparse (los de Alibaba suelen demorar
// mucho más que los de Shein/Temu). Si el Excel no trae fecha para ese bloque,
// devuelve solo la tienda (o nada).
function fmtPedidoMeta(fecha, plataforma){
  const partes = [];
  if(plataforma) partes.push(plataforma);
  if(fecha){
    partes.push(fmtDateShort(fecha));
    const dias = Math.round((dayKey(new Date()) - dayKey(fecha)) / 86400000);
    if(dias === 0) partes.push('hoy');
    else if(dias === 1) partes.push('ayer');
    else if(dias > 1) partes.push('hace ' + dias + ' días');
  }
  return partes.join(' · ');
}

// Pedidos comprados que aún no llegan (derivados directo de Stocks, ver
// getPendientesDeStock arriba). Apenas subas el stock de un producto de 0 a
// más, esa fila deja de aparecer aquí sola — no hace falta ningún otro paso.
//
// Cuando un producto que ESTABA pendiente deja de estarlo (ya tiene stock),
// se guarda en localStorage y se muestra una nota "✓ ya llegó" por unas 24h
// (para avisar sin ocupar espacio para siempre); después desaparece solo.
const PENDIENTES_VISTOS_KEY = 'timeless_pendientes_vistos';
const PENDIENTES_LLEGADOS_KEY = 'timeless_pendientes_llegados';
const PENDIENTE_LLEGADO_MS = 24 * 60 * 60 * 1000;

// A veces Alberto corrige el Stock a mano por un error de conteo (no un pedido
// real que llegue) - eso hace que "pendiente" suba solo (cantidadPedido−stock
// −vendidos), aunque nada esté realmente en camino. No hay forma de distinguir
// eso de un pedido real solo con los datos, así que se puede IGNORAR con un
// toque: se guarda la cantidad pendiente en ese momento, y solo vuelve a
// aparecer si esa cantidad CAMBIA (ej. hiciste un pedido nuevo de verdad).
const PENDIENTES_IGNORADOS_KEY = 'timeless_pendientes_ignorados';
function leerPendientesIgnorados(){
  try{ return JSON.parse(localStorage.getItem(PENDIENTES_IGNORADOS_KEY) || '{}'); }catch(e){ return {}; }
}
function ignorarPendiente(key, cantidad){
  const ign = leerPendientesIgnorados(); ign[key] = cantidad;
  try{ localStorage.setItem(PENDIENTES_IGNORADOS_KEY, JSON.stringify(ign)); }catch(e){}
}

function renderPendientes(stocks, canjes, vendidosHist){
  const box = document.getElementById('pendingBlock');
  if(!box) return;
  box.classList.remove('clickable');
  box.onclick = null;

  // rowsAll (sin filtrar) es lo que decide si algo "ya llegó" — un pendiente
  // ignorado no debe disparar esa nota (no llegó nada, solo lo escondiste).
  // "rows" (filtrado) es lo que se MUESTRA y se suma en la tarjeta.
  const ignorados = leerPendientesIgnorados();
  const rowsAll = getPendientesDeStock(stocks, canjes, vendidosHist);
  const rows = rowsAll.filter(r => ignorados[normProducto(r.producto)] !== Math.round(r.cantidad));
  const nowKeys = {};
  rowsAll.forEach(r => { nowKeys[normName(r.producto)] = true; });

  let vistosAntes = {};
  try{ vistosAntes = JSON.parse(localStorage.getItem(PENDIENTES_VISTOS_KEY) || '{}'); }catch(e){}
  let llegados = [];
  try{ llegados = JSON.parse(localStorage.getItem(PENDIENTES_LLEGADOS_KEY) || '[]'); }catch(e){}

  const nombreOriginal = {};
  stocks.forEach(s => { nombreOriginal[normName(s.producto)] = s.producto; });

  // Estaba en la lista pendiente anterior y ya no está en la actual = acaba de llegar.
  Object.keys(vistosAntes).forEach(k => {
    if(!nowKeys[k] && !llegados.some(l => l.key === k)){
      llegados.push({key: k, producto: nombreOriginal[k] || vistosAntes[k], ts: Date.now()});
    }
  });
  const ahora = Date.now();
  llegados = llegados.filter(l => (ahora - l.ts) < PENDIENTE_LLEGADO_MS && !nowKeys[l.key]);

  const vistosGuardar = {};
  rowsAll.forEach(r => { vistosGuardar[normName(r.producto)] = r.producto; });
  try{
    localStorage.setItem(PENDIENTES_VISTOS_KEY, JSON.stringify(vistosGuardar));
    localStorage.setItem(PENDIENTES_LLEGADOS_KEY, JSON.stringify(llegados));
  }catch(e){}

  if(rows.length === 0 && llegados.length === 0){ box.innerHTML = ''; return; }

  let html = '';
  if(rows.length > 0){
    const totalPorLlegar = rows.reduce((s,r) => s + r.invertido, 0);
    html +=
      '<div class="pend-head">' +
        '<span>📦 Dinero en pedidos por llegar · Invertido</span>' +
        '<span class="mono accent">S/ ' + fmt(totalPorLlegar) + '</span>' +
      '</div>' +
      rows.map(r => {
        const meta = fmtPedidoMeta(r.fechaPedido, r.plataforma);
        const key = normProducto(r.producto);
        return '<div class="pend-row">' +
          '<span class="pend-info">' +
            '<span class="pend-name">' + esc(r.producto) + (r.nuevo ? ' <span class="pend-nuevo">Nuevo</span>' : '') + '</span>' +
            (meta ? '<span class="pend-meta">' + esc(meta) + '</span>' : '') +
          '</span>' +
          '<span class="pend-amt mono">S/ ' + fmt(r.invertido) + '</span>' +
          '<button type="button" class="pend-ignorar" data-key="' + esc(key) + '" data-cantidad="' + Math.round(r.cantidad) + '" data-producto="' + esc(r.producto) + '" title="No es un pedido real (fue un ajuste de stock)">✕</button>' +
        '</div>';
      }).join('');
  }
  if(llegados.length > 0){
    html += '<div class="pend-arrived-note">✓ ' + esc(llegados.map(l => l.producto).join(', ')) +
      (llegados.length === 1 ? ' ya llegó' : ' ya llegaron') + '</div>';
  }
  if(rows.length > 0){
    html += '<div class="pend-hint">Toca para ver Invertido, Ingresos y Ganancia neta por separado ▸</div>';
  }

  box.innerHTML = html;
  box.querySelectorAll('.pend-ignorar').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const producto = btn.getAttribute('data-producto');
      if(!confirm('"' + producto + '" — ¿esto NO es un pedido real? (fue un ajuste de stock por error de conteo, no algo que va a llegar)\n\nSe deja de mostrar aquí. Si más adelante haces un pedido de verdad, vuelve a aparecer solo.')) return;
      ignorarPendiente(btn.getAttribute('data-key'), Number(btn.getAttribute('data-cantidad')));
      if(LAST) renderPendientes(LAST.stocks, getCanjesPorProducto(LAST.gastos || []), getVendidosHistoricoSet(LAST.data));
    });
  });
  if(rows.length > 0){
    box.classList.add('clickable');
    box.onclick = () => openFullscreen('Pedidos por llegar · detalle', renderPendientesFsBody(rows));
  }
}

// Vista de pantalla completa de Pendientes: las 3 métricas por separado (totales)
// más el detalle por producto.
function renderPendientesFsBody(rows){
  const totInv = rows.reduce((s,r) => s + r.invertido, 0);
  const totIng = rows.reduce((s,r) => s + r.ingresos, 0);
  const totGN  = rows.reduce((s,r) => s + r.gananciaNeta, 0);

  const stats =
    '<div class="fs-metric-row"><span class="fs-mname">Invertido (lo que ya pagaste)</span><span class="fs-mamt">S/ ' + fmt(totInv) + '</span></div>' +
    '<div class="fs-metric-row"><span class="fs-mname">Ingresos si vendes todo (venta bruta)</span><span class="fs-mamt">S/ ' + fmt(totIng) + '</span></div>' +
    '<div class="fs-metric-row"><span class="fs-mname">Ganancia neta si vendes todo</span><span class="fs-mamt">S/ ' + fmt(totGN) + '</span></div>';

  const head = '<tr><th>Producto</th><th>Cant.</th><th>Invertido</th><th>Ingresos</th><th>Gan. neta</th><th>Pedido</th></tr>';
  const body = rows.map(r =>
    '<tr>' +
      '<td>' + esc(r.producto) + (r.nuevo ? ' <span class="pend-nuevo">Nuevo</span>' : '') + '</td>' +
      '<td class="mono">' + fmt0(r.cantidad) + '</td>' +
      '<td class="mono">S/ ' + fmt(r.invertido) + '</td>' +
      '<td class="mono">S/ ' + fmt(r.ingresos) + '</td>' +
      '<td class="mono">S/ ' + fmt(r.gananciaNeta) + '</td>' +
      '<td class="pend-td-fecha">' + esc(fmtPedidoMeta(r.fechaPedido, r.plataforma) || '—') + '</td>' +
    '</tr>'
  ).join('');
  const table = '<div class="table-title">Detalle por producto</div>' + '<div class="ads-daily-wrap"><table class="ads-daily">' + head + body + '</table></div>';

  return stats + table;
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
    if(utilMode === 'todo' || esNegocio(x.categoria, x.nota)) slot(monthKey(x.date)).g += x.monto;
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
// A cuántos días o menos de agotarse consideramos "hay que reponer pronto".
const REPONER_DIAS = 14;
// Ventana para medir la velocidad de venta (unidades/día).
const VELOCIDAD_DIAS = 30;

// Un hueco de esta cantidad de días seguidos SIN ninguna venta de un producto
// se interpreta como que estuvo agotado (no una racha floja): así, si se
// reabastece, "disponible desde" arranca en la venta que reanuda después del
// hueco, no en su venta más antigua de todas.
const REABASTECIDO_GAP_DIAS = 5;

// Fecha desde la que cada producto (normProducto, ya separando combos) está
// "disponible" para efectos de medir su velocidad: la de su primera venta
// registrada, o la del día que se reanudaron las ventas después del hueco más
// reciente de REABASTECIDO_GAP_DIAS+ días sin vender nada (señal de que se
// agotó y volvió a llegar stock nuevo).
//
// OJO (2026-08-12): solo cuenta ventas YA PASADAS (v.date <= hoy). Tú
// pre-registras ventas para el día siguiente (entrega al otro día) — si se
// dejan pasar esas fechas futuras aquí, "cuentan como si ya hubieran
// pasado hoy" y la ventana de cálculo se reduce a 1-2 días, dando velocidad
// artificialmente alta (2 ventas programadas / 2 días de ventana = 1
// unidad/día siempre, calzando sospechosamente con el stock). Esas ventas
// futuras SÍ importan para "Meta personalizada" (ya son ventas reales,
// comprometidas) pero NO para medir el ritmo actual de un producto, que solo
// puede medirse con lo que YA se vendió.
//
// OJO (2026-08-12): se probó detectar esto solo con "llevas N días sin vender
// + ya tienes stock", pero eso confunde un reabastecido real con un producto
// que simplemente vende lento (mismo bloque de siempre, nunca se agotó) — un
// hueco de días no distingue las dos cosas, y no hay forma de saber la fecha
// real de llegada solo con los datos de Stocks (Fecha pedido es cuándo lo
// pediste, no cuándo llegó). Por eso el reinicio es MANUAL: cuando repones
// algo que se había agotado, márcalo tú mismo tocando el producto en
// Inventario (ver marcarReinicioRitmo) — así nunca se mezcla el ritmo de un
// drop viejo con uno nuevo, pero tampoco se borra sola la data de productos
// que solo están vendiendo despacio.
function getDisponibleDesdePorProducto(detalle){
  const reinicios = leerReiniciosRitmo();
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const porProducto = {};
  detalle.forEach(v => {
    if(v.date > hoy) return; // ventas programadas a futuro no cuentan como "ya pasadas"
    splitCombo(v.producto).forEach(p => {
      const key = normProducto(p);
      if(!key) return;
      (porProducto[key] || (porProducto[key] = [])).push(v.date);
    });
  });
  const desde = {};
  Object.keys(porProducto).forEach(key => {
    const fechas = porProducto[key].slice().sort((a,b) => a - b);
    let inicio = fechas[0];
    for(let i = 1; i < fechas.length; i++){
      const gap = Math.round((fechas[i] - fechas[i-1]) / 86400000);
      if(gap >= REABASTECIDO_GAP_DIAS) inicio = fechas[i];
    }
    const reinicio = reinicios[key] ? parseDateSmart(reinicios[key]) : null;
    if(reinicio && reinicio > inicio) inicio = reinicio;
    desde[key] = inicio;
  });
  return desde;
}

// Reinicio manual del ritmo de venta: Alberto lo marca tocando un producto en
// Inventario cuando lo repone después de haberse agotado, para que "días para
// agotar" mida SOLO desde ese día en adelante y no mezcle el ritmo del drop
// anterior. Se guarda como {normProducto: fechaISO} — si luego el producto
// tiene otro hueco real de REABASTECIDO_GAP_DIAS+ días con una venta después,
// el cálculo de arriba lo actualiza solo (usa lo que sea más reciente).
const STOCK_REINICIOS_KEY = 'timeless_stock_reinicios';
function leerReiniciosRitmo(){
  try{ return JSON.parse(localStorage.getItem(STOCK_REINICIOS_KEY) || '{}'); }catch(e){ return {}; }
}
function marcarReinicioRitmo(key, fechaISO){
  const r = leerReiniciosRitmo(); r[key] = fechaISO;
  try{ localStorage.setItem(STOCK_REINICIOS_KEY, JSON.stringify(r)); }catch(e){}
}
function quitarReinicioRitmo(key){
  const r = leerReiniciosRitmo(); delete r[key];
  try{ localStorage.setItem(STOCK_REINICIOS_KEY, JSON.stringify(r)); }catch(e){}
}

// Cuántos días para adelante cuenta una venta YA REGISTRADA como "real" para
// el promedio (tu flujo normal es vender hoy y entregar mañana). Chico a
// propósito: si algún día pre-registras algo mucho más lejos, no queremos
// repetir el bug de antes (una sola venta muy a futuro colapsando la ventana
// completa) — 3 días cubre "mañana" con margen sin abrir esa puerta.
const CAP_DIAS_FUTURO = 3;

// Velocidad de venta por producto (unidades/día), separando combos ("A + B" =
// 1 unidad de A y 1 de B). Ventana de hasta `dias` días, pero si un producto
// está disponible desde hace menos que eso (recién traído, o reabastecido
// tras agotarse — ver getDisponibleDesdePorProducto arriba), mide sobre esos
// días reales en vez de dividir entre `dias` completos: si no, la velocidad
// de algo recién repuesto sale subestimada y "días para agotar" sale inflado
// (ej. si lo trajiste hace una semana, mide sobre esa semana, no sobre 30
// días de los que la mayoría no tenías nada en stock).
//
// "Hoy efectivo" por producto: si ya tienes una venta registrada para los
// próximos días (CAP_DIAS_FUTURO), esa venta SÍ cuenta — pero tanto el
// numerador (unidades) como el denominador (días de la ventana) se estiran
// juntos hasta esa fecha, así el promedio sigue siendo justo (ej. disponible
// desde hoy + 2 ventas programadas para mañana = 2 unidades ÷ 2 días, no ÷ 1).
function getVelocidadVenta(data, dias){
  const vel = {};
  if(!data.ventasDetalle) return vel;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const detalle = getVentasDetalle(data);
  const disponibleDesde = getDisponibleDesdePorProducto(detalle);

  const limiteFuturo = new Date(hoy); limiteFuturo.setDate(limiteFuturo.getDate() + CAP_DIAS_FUTURO);
  const hoyEfectivo = {};
  detalle.forEach(v => {
    if(v.date <= hoy || v.date > limiteFuturo) return;
    splitCombo(v.producto).forEach(p => {
      const key = normProducto(p);
      if(!key) return;
      if(!hoyEfectivo[key] || v.date > hoyEfectivo[key]) hoyEfectivo[key] = v.date;
    });
  });

  const ventana = {};
  Object.keys(disponibleDesde).forEach(key => {
    const tope = hoyEfectivo[key] || hoy;
    const diasDisponible = Math.floor((tope - disponibleDesde[key]) / 86400000) + 1;
    ventana[key] = Math.min(dias, Math.max(1, diasDisponible));
  });

  const units = {};
  detalle.forEach(v => {
    splitCombo(v.producto).forEach(p => {
      const key = normProducto(p);
      if(!key) return;
      const tope = hoyEfectivo[key] || hoy;
      if(v.date > tope) return; // ni pasada ni programada dentro del margen cercano
      const w = ventana[key] || dias;
      const cutoff = new Date(tope); cutoff.setDate(cutoff.getDate() - w);
      if(v.date >= cutoff) units[key] = (units[key] || 0) + 1;
    });
  });
  Object.keys(units).forEach(k => { vel[k] = units[k] / (ventana[k] || dias); });
  return vel;
}

// Días estimados hasta agotar el stock de un producto (null si no tuvo ventas
// recientes, o sea no hay ritmo con qué estimar).
function diasParaAgotar(stock, velMap, nombre){
  const v = velMap[normProducto(nombre)];
  if(!v || v <= 0) return null;
  return Math.round(stock / v);
}

function renderStock(stocks, data, gastos){
  const box = document.getElementById('stockList');
  const badge = document.getElementById('stockAlertBadge');
  if(!box) return;
  if(!data.stocks){ box.innerHTML = needCfg('Stocks'); if(badge) badge.textContent = ''; return; }

  // Si un producto ya aparece en "Pedidos por llegar" (ya invertiste en
  // reponerlo, sigue en camino), no tiene sentido decirte que "hay que
  // reponer pronto" — ya lo hiciste. En vez de la alerta, se muestra un check
  // de que ya está repuesto.
  const canjes = getCanjesPorProducto(gastos || [], stocks);
  const pendientesSet = {};
  getPendientesDeStock(stocks, canjes).forEach(p => { pendientesSet[normProducto(p.producto)] = true; });

  const vel = getVelocidadVenta(data, VELOCIDAD_DIAS);
  const conStock = stocks.filter(s => s.stock > 0).map(s => {
    const dias = diasParaAgotar(s.stock, vel, s.producto);
    const porReponer = dias != null && dias <= REPONER_DIAS;
    const yaRepuesto = porReponer && !!pendientesSet[normProducto(s.producto)];
    return Object.assign({}, s, {
      diasAgota: dias,
      isLow: s.stock < STOCK_UMBRAL,
      reponer: porReponer && !yaRepuesto,
      yaRepuesto,
    });
  });

  // Orden: primero los que se agotan más pronto (por ritmo real de venta);
  // los que no tienen ventas recientes (sin estimación) van al final, y entre
  // esos, el que menos stock tiene primero.
  conStock.sort((a,b) => {
    if(a.diasAgota == null && b.diasAgota == null) return a.stock - b.stock;
    if(a.diasAgota == null) return 1;
    if(b.diasAgota == null) return -1;
    return a.diasAgota - b.diasAgota;
  });

  const low = conStock.filter(s => s.isLow);
  const reponer = conStock.filter(s => s.reponer);

  if(badge){
    // Prioriza avisar de los que se agotan pronto por ritmo de venta (más útil
    // que solo "poco stock", porque un producto con 8 unidades que vuela puede
    // ser más urgente que uno con 3 que casi no se vende).
    if(reponer.length > 0){
      badge.textContent = '⚠ ' + reponer.length + ' se agotan pronto';
      badge.className = 'stock-alert-badge alert';
    } else if(low.length > 0){
      badge.textContent = '⚠ ' + low.length + ' con poco stock';
      badge.className = 'stock-alert-badge alert';
    } else {
      badge.textContent = '✓ stock sano';
      badge.className = 'stock-alert-badge';
    }
  }

  if(conStock.length === 0){
    box.innerHTML = '<div class="empty">No hay productos con stock ahora mismo. Cuando llegue mercadería y la registres en tu Excel, aparecerá aquí.</div>';
    renderAgotadosYPorPedir(stocks, gastos);
    return;
  }

  const reinicios = leerReiniciosRitmo();
  box.innerHTML = conStock.map(s => {
    let agotaTxt, agotaCls;
    if(s.diasAgota == null){
      agotaTxt = 'sin ventas'; agotaCls = 'none';
    } else if(s.diasAgota <= REPONER_DIAS){
      agotaTxt = '~' + s.diasAgota + 'd'; agotaCls = 'soon';
    } else {
      agotaTxt = '~' + s.diasAgota + 'd'; agotaCls = 'ok';
    }
    // "✓ repuesto" va AL COSTADO del indicador de agote (no lo reemplaza):
    // sigue siendo útil saber que se agota pronto, solo que ya no hace falta
    // pedir más porque ese pedido ya está en camino.
    const repuestoTag = s.yaRepuesto ? '<span class="stock-repuesto">✓ repuesto</span>' : '';
    const rowCls = s.reponer ? ' reponer-row' : (s.yaRepuesto ? ' repuesto-row' : (s.isLow ? ' low-row' : ''));
    const key = normProducto(s.producto);
    // 🔄 = marcaste este producto como "recién repuesto" (ver
    // marcarReinicioRitmo): toca el nombre para marcar/desmarcar.
    const reinicioFlag = reinicios[key] ? '<span class="stock-reinicio-flag" title="Ritmo reiniciado el ' + esc(fmtDateShort(parseDateSmart(reinicios[key]))) + '">🔄</span>' : '';
    return '<div class="stock-row' + rowCls + '" data-key="' + esc(key) + '" data-producto="' + esc(s.producto) + '">' +
        '<span class="stock-name">' + reinicioFlag + esc(s.producto) + '</span>' +
        '<span class="stock-agota ' + agotaCls + '">' + agotaTxt + '</span>' +
        repuestoTag +
        '<span class="stock-qty' + (s.isLow ? ' low' : '') + '">' + fmt0(s.stock) + ' und' + '</span>' +
      '</div>';
  }).join('');

  box.querySelectorAll('.stock-row').forEach(el => {
    el.addEventListener('click', () => toggleReinicioRitmo(el.getAttribute('data-key'), el.getAttribute('data-producto')));
  });

  renderAgotadosYPorPedir(stocks, gastos);
}

// Toca un producto en Inventario para marcarlo "recién repuesto" (o quitar la
// marca) — ver getDisponibleDesdePorProducto arriba para el porqué es manual.
function toggleReinicioRitmo(key, producto){
  const reinicios = leerReiniciosRitmo();
  if(reinicios[key]){
    const fecha = fmtDateShort(parseDateSmart(reinicios[key]));
    if(!confirm('"' + producto + '" está marcado como recién repuesto desde el ' + fecha + '.\n\n¿Quitar esta marca?')) return;
    quitarReinicioRitmo(key);
  } else {
    if(!confirm('¿Marcar "' + producto + '" como recién repuesto?\n\nÚsalo cuando se había agotado y le acabas de traer stock nuevo: "días para agotar" va a medir SOLO desde hoy, sin mezclarlo con el ritmo del drop anterior. Vas a ver "sin ventas" hasta tu primera venta de este stock.')) return;
    marcarReinicioRitmo(key, todayISO());
  }
  if(LAST) renderStock(LAST.stocks, LAST.data, LAST.gastos);
}

// Productos que se acaban de agotar (recién pasaron de tener stock a stock=0)
// no se quedan en Inventario para siempre — eso ensuciaría la lista con cosas
// que ya no vas a reponer nunca. En vez de eso, aparecen un rato (~48h) en
// "Recién agotado" para que decidas: si lo vas a volver a traer, lo mandas a
// "Por pedir" (una notita, no el detalle de Accesorios para traer); cuando ya
// armaste el bloque de compra de verdad, lo quitas de "Por pedir" con el otro
// botón. Todo esto es solo tuyo (localStorage), no se sincroniza a Sheets.
const STOCK_AGOTADOS_VISTOS_KEY = 'timeless_stock_agotados_vistos';
const STOCK_AGOTADOS_RECIENTES_KEY = 'timeless_stock_agotados_recientes';
const STOCK_AGOTADO_RECIENTE_MS = 48 * 60 * 60 * 1000;
const STOCK_POR_PEDIR_KEY = 'timeless_stock_por_pedir';
// Clave APARTE (nueva) solo para el arranque en frío: STOCK_AGOTADOS_VISTOS_KEY
// ya se guardaba desde la primera versión de esta función, antes de que
// existiera el arranque en frío — así que en un teléfono que ya abrió esa
// versión, ese "antes" ya no estaba vacío y el arranque en frío nunca
// disparaba. Con una clave nueva, nunca existió en ningún teléfono, así que
// el aviso de una sola vez sí se dispara la primera vez que corre esta
// versión, sin importar qué había guardado antes.
const STOCK_AGOTADOS_BOOTSTRAP_KEY = 'timeless_stock_agotados_bootstrap_v2';

function leerJSON(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }catch(e){ return fallback; }
}
function guardarJSON(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
}

function renderAgotadosYPorPedir(stocks, gastos){
  const boxRecientes = document.getElementById('stockAgotadosRecientes');
  const boxPedir = document.getElementById('stockPorPedir');
  if(!boxRecientes || !boxPedir) return;

  const porPedir = leerJSON(STOCK_POR_PEDIR_KEY, []);
  const porPedirKeys = {};
  porPedir.forEach(r => { porPedirKeys[r.key] = true; });

  // Si ya aparece en "Pedidos por llegar" (ya lo repusiste, sigue en camino),
  // no tiene sentido avisar "se agotó, ¿lo pides?" — sería redundante.
  const canjes = getCanjesPorProducto(gastos || [], stocks);
  const pendientesSet = {};
  getPendientesDeStock(stocks, canjes).forEach(p => { pendientesSet[normProducto(p.producto)] = true; });

  const vistosAntes = leerJSON(STOCK_AGOTADOS_VISTOS_KEY, {});
  // Primera vez que corre ESTA versión en este dispositivo (con la clave de
  // bootstrap aparte, no con STOCK_AGOTADOS_VISTOS_KEY — esa ya se guardaba
  // desde la versión vieja, antes de que existiera el arranque en frío, así
  // que en un teléfono que ya la había abierto una vez, "antes" nunca estaba
  // vacío y el arranque en frío no disparaba): en vez de esperar a la
  // PRÓXIMA vez que algo se agote, se toma la foto de HOY como punto de
  // partida y se avisa de una vez de lo que ya está en 0 ahora mismo.
  const esPrimeraVez = !localStorage.getItem(STOCK_AGOTADOS_BOOTSTRAP_KEY);
  let recientes = leerJSON(STOCK_AGOTADOS_RECIENTES_KEY, []);

  // "Tenía stock" = snapshot de la corrida anterior. Si un producto que SÍ
  // tenía stock ahora está en 0, se acaba de agotar -> entra a "recientes".
  const tieneStockAhora = {};
  stocks.forEach(s => { if(s.stock > 0) tieneStockAhora[normProducto(s.producto)] = s.producto; });

  stocks.forEach(s => {
    if(s.precio <= 0 || s.stock !== 0) return;
    const key = normProducto(s.producto);
    if(!key || porPedirKeys[key] || pendientesSet[key]) return;
    if((esPrimeraVez || vistosAntes[key]) && !recientes.some(r => r.key === key)){
      recientes.push({key, producto: s.producto, ts: Date.now()});
    }
  });

  // Se cae de la lista si: volvió a tener stock, ya lo mandaste a "Por pedir",
  // ya quedó pendiente por otro lado (ej. un canje), o pasó la ventana de
  // ~48h sin que hicieras nada (para no ensuciar para siempre algo que no
  // vas a reponer).
  const ahora = Date.now();
  recientes = recientes.filter(r =>
    !tieneStockAhora[r.key] && !porPedirKeys[r.key] && !pendientesSet[r.key] &&
    (ahora - r.ts) < STOCK_AGOTADO_RECIENTE_MS);

  guardarJSON(STOCK_AGOTADOS_VISTOS_KEY, tieneStockAhora);
  guardarJSON(STOCK_AGOTADOS_RECIENTES_KEY, recientes);
  try{ localStorage.setItem(STOCK_AGOTADOS_BOOTSTRAP_KEY, '1'); }catch(e){}

  boxRecientes.innerHTML = recientes.length === 0 ? '' :
    '<div class="agotados-head">🔴 Recién agotado</div>' +
    recientes.map(r =>
      '<div class="agotado-row">' +
        '<span class="agotado-name">' + esc(r.producto) + '</span>' +
        '<button type="button" class="agotado-add" data-key="' + esc(r.key) + '" data-producto="' + esc(r.producto) + '">+ Por pedir</button>' +
      '</div>'
    ).join('');

  boxPedir.innerHTML = porPedir.length === 0 ? '' :
    '<div class="agotados-head">📋 Por pedir</div>' +
    porPedir.map(r =>
      '<div class="agotado-row">' +
        '<span class="agotado-name">' + esc(r.producto) + '</span>' +
        '<button type="button" class="pedir-listo" data-key="' + esc(r.key) + '">✓ Ya lo puse en Accesorios</button>' +
      '</div>'
    ).join('');
}

document.getElementById('stockAgotadosRecientes').addEventListener('click', (e) => {
  const btn = e.target.closest('.agotado-add');
  if(!btn) return;
  const key = btn.getAttribute('data-key'), producto = btn.getAttribute('data-producto');
  const recientes = leerJSON(STOCK_AGOTADOS_RECIENTES_KEY, []).filter(r => r.key !== key);
  const porPedir = leerJSON(STOCK_POR_PEDIR_KEY, []);
  if(!porPedir.some(r => r.key === key)) porPedir.push({key, producto, ts: Date.now()});
  guardarJSON(STOCK_AGOTADOS_RECIENTES_KEY, recientes);
  guardarJSON(STOCK_POR_PEDIR_KEY, porPedir);
  if(LAST) renderAgotadosYPorPedir(LAST.stocks, LAST.gastos);
});

document.getElementById('stockPorPedir').addEventListener('click', (e) => {
  const btn = e.target.closest('.pedir-listo');
  if(!btn) return;
  const key = btn.getAttribute('data-key');
  const porPedir = leerJSON(STOCK_POR_PEDIR_KEY, []).filter(r => r.key !== key);
  guardarJSON(STOCK_POR_PEDIR_KEY, porPedir);
  if(LAST) renderAgotadosYPorPedir(LAST.stocks, LAST.gastos);
});

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
/* ---------- 6c. Instagram (seguidores, alcance, mejores publicaciones) ----------
   Lee ?action=instagram del webhook (mismo patrón que Compras): datos que un
   trigger de Apps Script trae de la API de Instagram cada 8h. Si no hay datos
   todavía, la tarjeta se queda oculta (no molesta). */
function loadInstagram(){
  if(!cfg.WEBHOOK_URL) return;
  fetch(cfg.WEBHOOK_URL + '?action=instagram&_cb=' + Date.now(), {cache:'no-store'})
    .then(r => r.json())
    .then(resp => { if(resp && resp.instagram) renderInstagram(resp.instagram); })
    .catch(() => {});
}

function renderInstagram(ig){
  const card = document.getElementById('igCard');
  if(!card) return;
  const tieneData = ig && (ig.seguidores > 0 || (ig.dia && ig.dia.length) || (ig.media && ig.media.length));
  if(!tieneData){ card.hidden = true; return; }
  card.hidden = false;

  const userEl = document.getElementById('igUser');
  if(userEl) userEl.textContent = ig.username ? '· @' + ig.username : '';

  // Crecimiento de seguidores en el período (suma de nuevos por día).
  const dia = ig.dia || [];
  const nuevos30 = dia.reduce((s,d) => s + (Number(d.nuevos)||0), 0);
  const growthEl = document.getElementById('igGrowth');
  if(growthEl){
    growthEl.textContent = (nuevos30 >= 0 ? '+' : '') + fmt0(nuevos30) + ' seg. (30d)';
    growthEl.style.color = nuevos30 < 0 ? 'var(--bad)' : 'var(--accent)';
  }

  const alcance30 = dia.reduce((s,d) => s + (Number(d.alcance)||0), 0);
  const visitas30 = dia.reduce((s,d) => s + (Number(d.visitas)||0), 0);
  document.getElementById('igKpis').innerHTML =
    igKpi('Seguidores', fmt0(ig.seguidores||0)) +
    igKpi('Alcance 30d', fmt0(alcance30)) +
    // Meta no siempre devuelve "visitas al perfil"; si viene 0 no la mostramos
    // (un 0 confundiría). Si algún día la API la trae, aparece sola.
    (visitas30 > 0 ? igKpi('Visitas al perfil 30d', fmt0(visitas30)) : '') +
    igKpi('Publicaciones', fmt0(ig.publicaciones||0));

  // Barras de alcance de los últimos 14 días.
  const ult = dia.slice(-14);
  const barsBox = document.getElementById('igReachBars');
  if(ult.length === 0){
    barsBox.innerHTML = '<div class="empty">Aún sin datos diarios.</div>';
  } else {
    const maxA = Math.max(...ult.map(d => Number(d.alcance)||0), 1);
    barsBox.innerHTML = ult.map(d => {
      const a = Number(d.alcance)||0;
      const h = Math.max(a/maxA*100, 3);
      const dd = new Date(d.fecha);
      const lbl = isNaN(dd) ? '' : dd.getDate();
      return '<div class="dsem-bar">' +
          '<div class="dsem-col-wrap"><div class="dsem-col" style="height:' + h + '%">' +
            '<span class="dsem-val">' + fmt0(a) + '</span>' +
          '</div></div>' +
          '<div class="dsem-lbl">' + lbl + '</div>' +
        '</div>';
    }).join('');
  }

  // Mejores publicaciones (ya vienen ordenadas por interacción del Apps Script).
  const media = (ig.media || []).slice(0, 9);
  const mediaBox = document.getElementById('igMedia');
  if(media.length === 0){
    mediaBox.innerHTML = '<div class="empty">Aún no hay publicaciones analizadas.</div>';
  } else {
    mediaBox.innerHTML = media.map(m => {
      const thumb = m.thumbnail
        ? '<img src="' + esc(m.thumbnail) + '" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add(\'no-img\')">'
        : '';
      const cap = m.caption ? esc(m.caption.slice(0, 70)) + (m.caption.length > 70 ? '…' : '') : '(sin texto)';
      return '<a class="ig-post" href="' + esc(m.permalink) + '" target="_blank" rel="noopener">' +
          '<div class="ig-post-thumb">' + thumb + '<span class="ig-post-type">' + esc(m.tipo) + '</span></div>' +
          '<div class="ig-post-cap">' + cap + '</div>' +
          '<div class="ig-post-stats">' +
            '<span title="Me gusta">❤ ' + fmt0(m.likes) + '</span>' +
            '<span title="Comentarios">💬 ' + fmt0(m.comentarios) + '</span>' +
            (m.alcance ? '<span title="Alcance">👁 ' + fmt0(m.alcance) + '</span>' : '') +
            (m.guardados ? '<span title="Guardados">🔖 ' + fmt0(m.guardados) + '</span>' : '') +
          '</div>' +
        '</a>';
    }).join('');
  }
}

function igKpi(label, value){
  return '<div class="ig-kpi"><span class="ig-kpi-val">' + value + '</span><span class="ig-kpi-lbl">' + label + '</span></div>';
}

/* ---------- 6d. Seguimiento de pedidos (trackings + estado 17TRACK) ----------
   Alberto registra cada paquete (número de tracking + qué productos vienen +
   la tienda) directo desde el dashboard, igual que "Accesorios para traer".
   El Apps Script (sync17Track) baja el último estado cada 4 h y lo escribe en
   la pestaña "Seguimiento"; aquí solo se lee vía ?action=seguimiento. */
let seguimiento = [];

// Estados que 17TRACK devuelve (en inglés) → etiqueta corta en español + si es
// "urgente" (ya casi llega / ya llegó, se pinta distinto y sube a la alerta).
const SEG_ESTADOS = {
  NotFound:           {txt:'Sin info aún',       cls:'gris'},
  InfoReceived:       {txt:'Registrado',         cls:'gris'},
  InTransit:          {txt:'En camino',          cls:'transito'},
  Expired:            {txt:'Demorado',           cls:'alerta'},
  AvailableForPickup: {txt:'Listo p/ recoger',   cls:'llega', aviso:true},
  OutForDelivery:     {txt:'En reparto',         cls:'llega', aviso:true},
  DeliveryFailure:    {txt:'Entrega fallida',    cls:'alerta', aviso:true},
  Delivered:          {txt:'Entregado',          cls:'ok', aviso:true},
  Exception:          {txt:'Problema',           cls:'alerta', aviso:true},
};
function segEstadoInfo(estado){
  return SEG_ESTADOS[estado] || {txt: estado || 'Sin info aún', cls:'gris'};
}
// Página de rastreo a abrir con el botón ↗. Parcelsapp y 17TRACK arman la URL
// solos con el número (funcionan de un toque); MailAmericas no tiene una URL
// pública que acepte el número directo (su sitio pide iniciar sesión), así
// que solo se abre su web para que Alberto pegue el número él mismo si ya
// tiene sesión iniciada ahí. "Personalizado" usa el link que Alberto pegó.
const SEG_PROVEEDORES = {
  parcelsapp:  { label: 'Parcelsapp',   url: t => 'https://parcelsapp.com/en/tracking/' + encodeURIComponent(t) },
  '17track':   { label: '17TRACK',      url: t => 'https://t.17track.net/en#nums=' + encodeURIComponent(t) },
  mailamericas:{ label: 'MailAmericas', url: () => 'https://tracking.mailamericas.com/' },
};
function segTrackUrl(tracking, link, proveedor){
  if(proveedor === 'personalizado' && link && /^https?:\/\//i.test(link.trim())) return link.trim();
  if(proveedor && SEG_PROVEEDORES[proveedor]) return SEG_PROVEEDORES[proveedor].url(tracking);
  // Sin proveedor guardado (pedidos creados antes de este cambio): igual que
  // antes, usa el link propio si hay, si no cae a parcelsapp.
  if(link && /^https?:\/\//i.test(link.trim())) return link.trim();
  return SEG_PROVEEDORES.parcelsapp.url(tracking);
}

function loadSeguimiento(){
  const box = document.getElementById('segList');
  if(!cfg.WEBHOOK_URL){ if(box) box.innerHTML = needCfg('WEBHOOK_URL'); return; }
  fetch(cfg.WEBHOOK_URL + '?action=seguimiento&_cb=' + Date.now(), {cache:'no-store'})
    .then(r => r.json())
    .then(resp => {
      seguimiento = (resp && resp.seguimiento) ? resp.seguimiento : [];
      renderSeguimiento();
    })
    .catch(() => { if(box) box.innerHTML = '<div class="empty">No se pudo cargar el seguimiento.</div>'; });
}

// "hace X días" desde una fecha ISO (misma idea que fmtPedidoMeta pero suelto).
function segHace(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const dias = Math.round((dayKey(new Date()) - dayKey(d)) / 86400000);
  if(dias <= 0) return 'hoy';
  if(dias === 1) return 'ayer';
  return 'hace ' + dias + ' días';
}

function renderSeguimiento(){
  const box = document.getElementById('segList');
  const alertBox = document.getElementById('segAlert');
  if(!box) return;

  const activos = seguimiento.filter(s => !s.archivado);

  // Alerta arriba: cuántos paquetes están por llegar o ya llegaron.
  if(alertBox){
    const porLlegar = activos.filter(s => { const i = segEstadoInfo(s.estado); return i.aviso && s.estado !== 'Delivered'; });
    const llegados = activos.filter(s => s.estado === 'Delivered');
    let a = '';
    if(porLlegar.length) a += '<div class="seg-alert-pill llega">📦 ' + porLlegar.length + (porLlegar.length===1?' pedido por llegar':' pedidos por llegar') + '</div>';
    if(llegados.length) a += '<div class="seg-alert-pill ok">✓ ' + llegados.length + (llegados.length===1?' pedido entregado':' pedidos entregados') + '</div>';
    alertBox.innerHTML = a;
  }

  if(activos.length === 0){
    box.innerHTML = '<div class="empty">Aún no tienes pedidos en seguimiento. Toca "+ Agregar tracking" y pega el número de un paquete.</div>';
    return;
  }

  // Orden: primero los que importan (por llegar / problema), luego en camino,
  // luego el resto; dentro de cada grupo, lo más nuevo primero.
  const prioridad = {llega:0, alerta:1, transito:2, ok:3, gris:4};
  const ordenados = activos.slice().sort((a,b) => {
    const pa = prioridad[segEstadoInfo(a.estado).cls] ?? 5;
    const pb = prioridad[segEstadoInfo(b.estado).cls] ?? 5;
    if(pa !== pb) return pa - pb;
    return new Date(b.creadoEn||0) - new Date(a.creadoEn||0);
  });

  box.innerHTML = ordenados.map(s => {
    // El badge de estado solo aparece si hay estado (o sea, si algún día se
    // conecta la API). En modo manual no hay estado, así que no se muestra un
    // "Sin info" en cada fila — se ve más limpio.
    const info = s.estado ? segEstadoInfo(s.estado) : null;
    // Si ya hay estado (API), muestra cuándo se actualizó; si no (modo manual),
    // muestra cuánto lleva desde que se pidió, para tantear la demora.
    const cuando = s.actualizadoEn ? segHace(s.actualizadoEn)
                 : (s.fechaPedido ? 'pedido ' + segHace(s.fechaPedido) : '');
    const sub = [s.plataforma, s.ubicacion || s.descripcion, cuando].filter(Boolean).join(' · ');
    return '<div class="seg-row" data-id="' + esc(s.id) + '">' +
        '<div class="seg-main">' +
          '<div class="seg-top-line">' +
            '<span class="seg-prod">' + esc(s.productos || s.tracking) + '</span>' +
            (info ? '<span class="seg-badge ' + info.cls + '">' + esc(info.txt) + '</span>' : '') +
          '</div>' +
          '<div class="seg-meta">' + (sub ? esc(sub) : '<span class="muted">Toca ↗ para ver el estado del paquete</span>') + '</div>' +
          '<div class="seg-track">' + esc(s.tracking) + '</div>' +
        '</div>' +
        '<div class="seg-btns">' +
          '<button type="button" class="seg-copy" data-track="' + esc(s.tracking) + '" title="Copiar número">⧉</button>' +
          '<a class="seg-link" href="' + esc(segTrackUrl(s.tracking, s.link, s.proveedor)) + '" target="_blank" rel="noopener" title="Abrir rastreo">↗</a>' +
        '</div>' +
      '</div>';
  }).join('');

  box.querySelectorAll('.seg-row').forEach(el => {
    const id = el.getAttribute('data-id');
    el.addEventListener('click', () => {
      const s = seguimiento.find(x => x.id === id);
      if(s) openSeguimientoForm(s);
    });
    el.querySelectorAll('.seg-link, .seg-copy').forEach(b => b.addEventListener('click', ev => ev.stopPropagation()));
    const copyBtn = el.querySelector('.seg-copy');
    if(copyBtn) copyBtn.addEventListener('click', () => segCopiar(copyBtn));
  });
}

// Copia el número de tracking al portapapeles y da feedback breve en el botón.
function segCopiar(btn){
  const num = btn.getAttribute('data-track') || '';
  const ok = () => { const t = btn.textContent; btn.textContent = '✓'; btn.classList.add('copiado'); setTimeout(() => { btn.textContent = t; btn.classList.remove('copiado'); }, 1200); };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(num).then(ok).catch(() => segCopiarFallback(num, ok));
  } else {
    segCopiarFallback(num, ok);
  }
}
function segCopiarFallback(num, ok){
  try{
    const ta = document.createElement('textarea');
    ta.value = num; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); ok();
  }catch(e){ alert('Copia manual: ' + num); }
}

// Formulario de alta/edición de un paquete (mismo patrón de pantalla completa
// que "Accesorios para traer").
function openSeguimientoForm(s){
  openFullscreen(s ? 'Editar pedido' : 'Nuevo pedido en seguimiento', renderSeguimientoForm(s));
  wireSeguimientoForm(s);
}

function renderSeguimientoForm(s){
  const editando = !!s;
  const fPed = s && s.fechaPedido ? new Date(s.fechaPedido).toISOString().slice(0,10) : '';
  // Pedidos creados antes de este selector no tienen proveedor guardado: se
  // ven como "Parcelsapp" (lo que ya hacían antes) hasta que Alberto elija otro.
  const proveedor = (s && s.proveedor) || 'parcelsapp';
  return '<div class="compra-form">' +
    '<label class="cf-label">Número de tracking</label>' +
    '<input type="text" class="cf-input" id="segTracking" placeholder="Ej. RR040954195XX" value="' + esc((s&&s.tracking)||'') + '">' +

    '<label class="cf-label">¿Qué productos vienen en este paquete?</label>' +
    '<input type="text" class="cf-input" id="segProductos" placeholder="Ej. Cinturon dark knight, Collar gothic cross" value="' + esc((s&&s.productos)||'') + '">' +

    '<div class="cf-row2">' +
      '<div><label class="cf-label">Tienda</label>' +
        '<input type="text" class="cf-input" id="segPlataforma" placeholder="Alibaba / Shein / Temu" value="' + esc((s&&s.plataforma)||'') + '"></div>' +
      '<div><label class="cf-label">Fecha de pedido (opcional)</label>' +
        '<input type="date" class="cf-input" id="segFecha" value="' + fPed + '"></div>' +
    '</div>' +

    '<label class="cf-label">Página de rastreo</label>' +
    '<div class="util-toggle seg-prov-toggle" id="segProvToggle">' +
      '<button type="button" data-v="parcelsapp" class="' + ((proveedor)==='parcelsapp'?'active':'') + '">Parcelsapp</button>' +
      '<button type="button" data-v="17track" class="' + (proveedor==='17track'?'active':'') + '">17TRACK</button>' +
      '<button type="button" data-v="mailamericas" class="' + (proveedor==='mailamericas'?'active':'') + '">MailAmericas</button>' +
      '<button type="button" data-v="personalizado" class="' + (proveedor==='personalizado'?'active':'') + '">Personalizado</button>' +
    '</div>' +
    '<div class="cf-estado-hint" id="segProvHint"></div>' +
    '<input type="text" inputmode="url" class="cf-input" id="segLink" placeholder="Pega tu link aquí" value="' + esc((s&&s.link)||'') + '" style="' + (proveedor==='personalizado'?'':'display:none;') + '">' +

    (editando && s.estado ? '<div class="seg-form-estado">Último estado: <b>' + esc(segEstadoInfo(s.estado).txt) + '</b>' + (s.descripcion?' · ' + esc(s.descripcion):'') + '</div>' : '') +
    (editando ? '<a class="cf-link-track" id="segAbrirRastreo" href="' + esc(segTrackUrl(s.tracking, s.link, proveedor)) + '" target="_blank" rel="noopener">↗ Abrir rastreo en el navegador</a>' : '') +

    '<div class="cf-actions">' +
      (editando ? '<button type="button" class="cf-btn cf-btn-danger" id="segEliminar">Eliminar</button>' : '') +
      '<button type="button" class="cf-btn cf-btn-primary" id="segGuardar">Guardar</button>' +
    '</div>' +
    (editando ? '<button type="button" class="cf-btn cf-btn-arch" id="segArchivar">✓ Ya llegó — quitar de la lista</button>' : '') +
  '</div>';
}

// Explica por qué MailAmericas no abre directo con el número (a diferencia
// de las otras dos), para que Alberto no piense que está roto.
const SEG_PROV_HINT = {
  parcelsapp: 'Abre parcelsapp.com con tu número ya puesto — funciona de un toque.',
  '17track': 'Abre 17TRACK con tu número ya puesto — funciona de un toque.',
  mailamericas: 'MailAmericas no tiene link directo por número (pide iniciar sesión): se abre su web y ahí pegas el número tú mismo.',
  personalizado: 'Pega abajo el link que quieras usar para este paquete.',
};

function wireSeguimientoForm(s){
  let proveedorSel = (s && s.proveedor) || 'parcelsapp';
  const hintEl = document.getElementById('segProvHint');
  const linkInput = document.getElementById('segLink');
  const abrirA = document.getElementById('segAbrirRastreo');
  const actualizarProvUI = () => {
    document.querySelectorAll('#segProvToggle button').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-v') === proveedorSel));
    if(hintEl) hintEl.textContent = SEG_PROV_HINT[proveedorSel] || '';
    if(linkInput) linkInput.style.display = proveedorSel === 'personalizado' ? '' : 'none';
    if(abrirA){
      const tracking = document.getElementById('segTracking').value.trim();
      abrirA.href = segTrackUrl(tracking, linkInput ? linkInput.value.trim() : '', proveedorSel);
    }
  };
  actualizarProvUI();
  document.getElementById('segProvToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-v]');
    if(!btn) return;
    proveedorSel = btn.getAttribute('data-v');
    actualizarProvUI();
  });
  if(linkInput) linkInput.addEventListener('input', actualizarProvUI);

  const guardar = () => {
    const tracking = document.getElementById('segTracking').value.trim();
    if(!tracking){ alert('Pega el número de tracking.'); return; }
    const paquete = {
      id: s ? s.id : null,
      tracking,
      productos: document.getElementById('segProductos').value.trim(),
      plataforma: document.getElementById('segPlataforma').value.trim(),
      fechaPedido: document.getElementById('segFecha').value || '',
      link: document.getElementById('segLink').value.trim(),
      proveedor: proveedorSel,
      archivado: s ? s.archivado : false,
    };
    const btn = document.getElementById('segGuardar');
    if(btn){ btn.disabled = true; btn.textContent = 'Guardando…'; }
    fetch(cfg.WEBHOOK_URL, {
      method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({type:'seguimientoGuardar', paquete})
    }).then(r => r.json()).then(resp => {
      if(resp.ok){ closeFullscreen(); loadSeguimiento(); }
      else { alert('⚠ ' + (resp.error||'No se pudo guardar')); if(btn){ btn.disabled=false; btn.textContent = 'Guardar'; } }
    }).catch(() => { alert('⚠ Error de conexión.'); if(btn){ btn.disabled=false; btn.textContent = 'Guardar'; } });
  };
  const eliminar = (btnId) => {
    const btn = document.getElementById(btnId);
    if(btn){ btn.disabled = true; btn.textContent = 'Quitando…'; }
    fetch(cfg.WEBHOOK_URL, {
      method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({type:'seguimientoEliminar', id:s.id})
    }).then(r => r.json()).then(resp => {
      if(resp.ok){ closeFullscreen(); loadSeguimiento(); }
      else { alert('⚠ ' + (resp.error||'No se pudo eliminar')); if(btn){ btn.disabled=false; btn.textContent = btnId==='segArchivar'?'✓ Ya llegó — quitar de la lista':'Eliminar'; } }
    }).catch(() => { alert('⚠ Error de conexión.'); if(btn){ btn.disabled=false; btn.textContent = btnId==='segArchivar'?'✓ Ya llegó — quitar de la lista':'Eliminar'; } });
  };
  document.getElementById('segGuardar').addEventListener('click', guardar);
  // "Ya llegó" ya no archiva (eso solo hacía crecer una lista de archivados
  // que Alberto nunca usa): directamente borra el pedido del seguimiento,
  // igual que el botón Eliminar — un toque y desaparece.
  const arch = document.getElementById('segArchivar');
  if(arch) arch.addEventListener('click', () => eliminar('segArchivar'));
  const del = document.getElementById('segEliminar');
  if(del) del.addEventListener('click', () => {
    if(!confirm('¿Eliminar este pedido del seguimiento? (no se puede deshacer)')) return;
    eliminar('segEliminar');
  });
}

// Vista pantalla completa: todos los pedidos, incluidos los archivados.
document.getElementById('segHeaderBtn').addEventListener('click', () => {
  openFullscreen('Seguimiento de pedidos', renderSeguimientoFsBody());
});
function renderSeguimientoFsBody(){
  if(seguimiento.length === 0) return '<div class="empty">Aún no hay pedidos en seguimiento.</div>';
  const activos = seguimiento.filter(s => !s.archivado);
  const archivados = seguimiento.filter(s => s.archivado);
  const fila = s => {
    const info = s.estado ? segEstadoInfo(s.estado) : null;
    const sub = [s.plataforma, s.ubicacion || s.descripcion, s.actualizadoEn?segHace(s.actualizadoEn):''].filter(Boolean).join(' · ');
    return '<div class="seg-row" data-id="' + esc(s.id) + '">' +
        '<div class="seg-main">' +
          '<div class="seg-top-line"><span class="seg-prod">' + esc(s.productos||s.tracking) + '</span>' +
            (info ? '<span class="seg-badge ' + info.cls + '">' + esc(info.txt) + '</span>' : '') + '</div>' +
          '<div class="seg-meta">' + (sub?esc(sub):'<span class="muted">Toca ↗ para ver el estado</span>') + '</div>' +
          '<div class="seg-track">' + esc(s.tracking) + '</div>' +
        '</div>' +
        '<a class="seg-link" href="' + esc(segTrackUrl(s.tracking, s.link, s.proveedor)) + '" target="_blank" rel="noopener">↗</a>' +
      '</div>';
  };
  let html = '<div class="seg-fs-list">' + activos.map(fila).join('');
  if(archivados.length){
    html += '<div class="table-title" style="margin-top:14px;">Archivados</div>' + archivados.map(fila).join('');
  }
  html += '</div>';
  return html;
}

document.getElementById('segNuevoBtn').addEventListener('click', () => openSeguimientoForm(null));

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
    const thumbImg = el.querySelector('.compra-thumb img');
    if(thumbImg){
      thumbImg.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const c = compras.find(x => x.id === id);
        if(c && c.fotos && c.fotos.length) abrirLightbox(c.fotos, 0);
      });
    }
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
    '<input type="text" inputmode="decimal" class="cf-input" id="cfPrecio" placeholder="0.00" value="' + ((c&&c.precioTotal)||'') + '">' +

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
        '<input type="text" inputmode="numeric" class="cf-input cf-prod-cant" placeholder="Cantidad" value="' + esc(cantidad||'') + '">' +
        '<input type="text" inputmode="decimal" class="cf-input cf-prod-pventa" placeholder="Precio venta c/u" value="' + esc(precioVenta||'') + '">' +
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

// Visor de fotos a pantalla completa: click en una miniatura la abre grande,
// con flechas y deslizar (swipe) para pasar entre todas las fotos de ese grupo.
let lightboxFotos = [];
let lightboxIdx = 0;
function renderLightbox(){
  document.getElementById('lightboxImg').src = lightboxFotos[lightboxIdx] || '';
  document.getElementById('lightboxCount').textContent = (lightboxIdx+1) + ' / ' + lightboxFotos.length;
  const multi = lightboxFotos.length > 1;
  document.getElementById('lightboxPrev').style.display = multi ? '' : 'none';
  document.getElementById('lightboxNext').style.display = multi ? '' : 'none';
  document.getElementById('lightboxCount').style.display = multi ? '' : 'none';
}
function abrirLightbox(fotos, idx){
  if(!fotos || fotos.length === 0) return;
  lightboxFotos = fotos;
  lightboxIdx = idx || 0;
  renderLightbox();
  document.getElementById('lightboxView').hidden = false;
}
function cerrarLightbox(){ document.getElementById('lightboxView').hidden = true; }
function lightboxPrev(){ lightboxIdx = (lightboxIdx - 1 + lightboxFotos.length) % lightboxFotos.length; renderLightbox(); }
function lightboxNext(){ lightboxIdx = (lightboxIdx + 1) % lightboxFotos.length; renderLightbox(); }

document.getElementById('lightboxClose').addEventListener('click', cerrarLightbox);
document.getElementById('lightboxPrev').addEventListener('click', lightboxPrev);
document.getElementById('lightboxNext').addEventListener('click', lightboxNext);
document.getElementById('lightboxView').addEventListener('click', (e) => {
  if(e.target.id === 'lightboxView') cerrarLightbox();
});
(() => {
  let touchX = null;
  const lb = document.getElementById('lightboxView');
  lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; });
  lb.addEventListener('touchend', (e) => {
    if(touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if(Math.abs(dx) > 40){ dx < 0 ? lightboxNext() : lightboxPrev(); }
    touchX = null;
  });
})();

// Pinta una tira de miniaturas con botón × para borrar cada una; click en la
// foto (no en el ×) la abre en el visor a pantalla completa.
function renderFotosStripInto(container, fotos, onRemove){
  container.innerHTML = fotos.map((url, idx) =>
    '<div class="cf-foto-thumb"><img src="' + esc(url) + '" data-idx="' + idx + '"><button type="button" class="cf-foto-thumb-del" data-idx="' + idx + '">×</button></div>'
  ).join('');
  container.querySelectorAll('.cf-foto-thumb-del').forEach(btn => {
    btn.addEventListener('click', () => onRemove(Number(btn.getAttribute('data-idx'))));
  });
  container.querySelectorAll('.cf-foto-thumb img').forEach(img => {
    img.addEventListener('click', () => abrirLightbox(fotos, Number(img.getAttribute('data-idx'))));
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
    renderProyeccion(LAST.ventas, LAST.stocks, LAST.data, selectedMonthKey, LAST.gastos);
    renderAds(LAST.data, selectedMonthKey);
    renderRoas(LAST.ventas, LAST.data, selectedMonthKey);
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

// "Gastos de negocio": flechita para ver el desglose Ads/Materiales sin
// esconder el total (heroReceipt se re-pinta entero en cada render, por eso
// se delega el click sobre el contenedor en vez de sobre el botón).
document.getElementById('heroReceipt').addEventListener('click', (e) => {
  if(!e.target.closest('#gastosNegocioRow')) return;
  gastosNegocioAbierto = !gastosNegocioAbierto;
  if(LAST) renderHero(LAST.ventas, LAST.gastos, LAST.data, selectedMonthKey);
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

// Ventas recientes: elegir el período (esta semana / 7 días / 15 días).
document.getElementById('ventasRecToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-modo]');
  if(!btn) return;
  ventasRecModo = btn.getAttribute('data-modo');
  try{ localStorage.setItem('timeless_ventasrec_modo', ventasRecModo); }catch(err){}
  if(LAST) renderVentasRecientes(LAST.data);
});

// Meta del mes: elegir cómo repartir la meta (por día / por bloque de 10 días / por mes).
document.getElementById('metaMesToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-modo]');
  if(!btn) return;
  metaMesModo = btn.getAttribute('data-modo');
  try{ localStorage.setItem('timeless_metames_modo', metaMesModo); }catch(err){}
  if(LAST) renderMetaMes(LAST.data);
});
document.getElementById('metaMesInput').addEventListener('input', (e) => {
  metaMesValor = Number(e.target.value) || 0;
  try{ localStorage.setItem('timeless_metames_valor', metaMesValor); }catch(err){}
  if(LAST) renderMetaMes(LAST.data);
});

// Meta del mes: ver el avance en Ventas o en Ganancia líquida (estimada por margen).
document.getElementById('metaMesMetricaToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-metrica]');
  if(!btn) return;
  metaMesMetrica = btn.getAttribute('data-metrica');
  try{ localStorage.setItem('timeless_metames_metrica', metaMesMetrica); }catch(err){}
  if(LAST) renderMetaMes(LAST.data);
});

// Mejor día de la semana: elegir el período (90 / 60 / 30 días).
document.getElementById('dsemToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-dias]');
  if(!btn) return;
  dsemDias = Number(btn.getAttribute('data-dias'));
  try{ localStorage.setItem('timeless_dsem_dias', dsemDias); }catch(err){}
  if(LAST) renderDiaSemana(LAST.data);
});

let savedTheme = 'negro';
try{ savedTheme = localStorage.getItem(THEME_KEY) || 'negro'; }catch(e){}
applyTheme(savedTheme);
loadAll();
loadCompras();
loadInstagram();
loadSeguimiento();
loadAnunciosMeta();
loadCashback();
