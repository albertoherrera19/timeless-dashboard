/* Timeless Contenido — pantalla. Solo habla con window.TLC (core.js). */
(function(){
'use strict';
const T = window.TLC;

/* ---------- Tema (mismos colores del dashboard, sin selector) ---------- */
const THEMES = {
  negro:   {bg:'#141414', card:'#1c1c1c', line:'#2c2c2c', bone:'#f2f0ea', muted:'#8a8680', accent:'#e8442c', accentDim:'#5c2016', chip:'#111111'},
  azul:    {bg:'#0d1420', card:'#141d2b', line:'#233047', bone:'#eef3fa', muted:'#7c93ad', accent:'#2f7dd8', accentDim:'#173a63', chip:'#0f1621'},
  marino:  {bg:'#060147', card:'#0d0a5c', line:'#1c1875', bone:'#eef1fa', muted:'#8a86c2', accent:'#5b7fd6', accentDim:'#221c6b', chip:'#0a0650'},
  celeste: {bg:'#0c1a1f', card:'#12242b', line:'#1f3843', bone:'#eaf6f9', muted:'#7fa8b3', accent:'#22b8e8', accentDim:'#0f4a5c', chip:'#0e1c21'},
  morado:  {bg:'#160f22', card:'#201533', line:'#33234c', bone:'#f2ecfa', muted:'#9c85bd', accent:'#9b4de0', accentDim:'#3f2064', chip:'#180f24'},
  rojo:    {bg:'#1c0f0f', card:'#2a1414', line:'#432020', bone:'#faeeee', muted:'#c08a8a', accent:'#e8302f', accentDim:'#5c1414', chip:'#1e1010'},
  rosado:  {bg:'#1f0f18', card:'#2b1421', line:'#472034', bone:'#faeef5', muted:'#c98aae', accent:'#ec4899', accentDim:'#5c1d3c', chip:'#20101a'},
  verde:   {bg:'#0f1a11', card:'#16261a', line:'#26402c', bone:'#eefaf0', muted:'#8fb897', accent:'#4ade80', accentDim:'#1c4d2c', chip:'#101c13'},
  turquesa:{bg:'#08201f', card:'#0e2c2a', line:'#1d443f', bone:'#e9faf7', muted:'#7db8ae', accent:'#1de9b6', accentDim:'#0c4d43', chip:'#0a2321'},
  naranja: {bg:'#1f130a', card:'#2c1c0e', line:'#472c15', bone:'#faf0e6', muted:'#c9986b', accent:'#f5851f', accentDim:'#5c360f', chip:'#20140a'},
  blanco:  {bg:'#f7f5f1', card:'#ffffff', line:'#e3e0d8', bone:'#181614', muted:'#6f6b64', accent:'#e8442c', accentDim:'#fbdad4', chip:'#efece6'},
};
function applyTheme(name){
  const t = THEMES[name] || THEMES.negro;
  const s = document.documentElement.style;
  s.setProperty('--bg', t.bg); s.setProperty('--card', t.card); s.setProperty('--line', t.line);
  s.setProperty('--bone', t.bone); s.setProperty('--muted', t.muted); s.setProperty('--accent', t.accent);
  s.setProperty('--accent-dim', t.accentDim); s.setProperty('--chip', t.chip);
  const claro = name === 'blanco';
  if(claro){
    // En fondo claro los verdes/amarillos neón no se leen: versiones más oscuras.
    s.setProperty('--ok', '#15803d'); s.setProperty('--warn', '#a16207'); s.setProperty('--bad', '#be123c'); s.setProperty('--info', '#1d4ed8');
    s.setProperty('--on-ok', '#ffffff'); document.documentElement.setAttribute('data-claro', '');
  } else {
    ['--ok','--warn','--bad','--info','--on-ok'].forEach(k => s.removeProperty(k));
    document.documentElement.removeAttribute('data-claro');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', t.bg);
}
let temaGuardado = 'negro';
try{ temaGuardado = localStorage.getItem('timeless_dashboard_theme') || 'negro'; }catch(e){}
applyTheme(temaGuardado);

/* ---------- Utilidades ---------- */
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function $(id){ return document.getElementById(id); }
const ICONOS = {
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  sol:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  cal:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  caja:'<path d="m3.5 7.5 8.5-4 8.5 4v9l-8.5 4-8.5-4z"/><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9"/>',
  meta:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
  mas:'<path d="M12 5v14M5 12h14"/>', menos:'<path d="M5 12h14"/>',
  izq:'<path d="m15 6-6 6 6 6"/>', der:'<path d="m9 6 6 6-6 6"/>',
  camion:'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  alerta:'<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  dormido:'<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  flash:'<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  campana:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  basura:'<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
  ig:'<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.8 7.2h.01"/>',
  idea:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
};
function ic(n){ return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONOS[n] || '') + '</svg>'; }
function fc(iso){ const d = T.deIso(iso); return d ? T.fechaCorta(d) : ''; }
function rango(a, b){ if(!a || !b) return 'sin fecha estimada'; return a === b ? fc(a) : (fc(a) + ' – ' + fc(b)); }
function plural(n, uno, varios){ return n + ' ' + (n === 1 ? uno : varios); }
const DIAS_LARGO = {LUN:'Lunes', MAR:'Martes', MIE:'Miércoles', JUE:'Jueves', VIE:'Viernes', SAB:'Sábado', DOM:'Domingo'};
const TIPO_ETQ = {post:'Post', historia:'Historia', tiktok:'TikTok'};
const EST_ETQ = {pendiente:'Pendiente', borrador:'Borrador', programado:'Programado', publicado:'Publicado'};
function horaLocal(iso){ const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('es-PE', {day:'numeric', month:'short'}).replace('.', ''); }
function sinProductoTxt(s){ return esc(s); }

/* ---------- Estado de la pantalla ---------- */
const S = {
  tab: 'hoy', semana: T.semanaId(), carga: 'cargando', ultimaOk: null, guardado: 'ninguno',
  abiertos: {}, fEstado: '', fCat: '', fechaAbierta: '', fechaVal: {}, verMasComent: false,
  fase: null, avisoErr: null, notaForm: false, notaHechas: false, notaVal: {txt:'', fec:'', hor:''},
  vistaPlan: 'checklist', mdAbiertos: {}, mdIrHoy: false,
};
try{ const v = localStorage.getItem('timeless_contenido_vistaplan'); if(v === 'completo' || v === 'checklist') S.vistaPlan = v; }catch(e){}
try{ const t = localStorage.getItem('timeless_contenido_tab'); if(['hoy','semana','productos','metas'].indexOf(t) >= 0) S.tab = t; }catch(e){}
function esDesktop(){ return window.matchMedia('(min-width:1024px)').matches; }
function hhmm(d){ return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }

/* ---------- Encabezado y avisos ---------- */
function pintaEstado(){
  const el = $('syncLine'); let txt, cls = '';
  const g = S.guardado;
  if(g === 'pendiente' || g === 'guardando'){ txt = 'Guardando…'; }
  else if(g === 'error'){ txt = 'Error al guardar, se reintenta solo'; cls = 'err'; }
  else if(g === 'clave'){ txt = 'Falta la clave para guardar'; cls = 'err'; }
  else if(g === 'ok'){ txt = 'Guardado ✓'; cls = 'ok'; }
  else if(S.carga === 'cargando'){ txt = 'Cargando…'; }
  else if(S.ultimaOk){ txt = 'Actualizado ' + hhmm(S.ultimaOk); }
  else { txt = 'Mostrando lo último guardado'; }
  el.textContent = txt; el.className = 'sync-line ' + cls;
}
function pintaAvisos(){
  let h = '';
  const f = S.fase;
  if(f && f.error === 'clave'){
    h = '<div class="banner"><div><b>Falta tu clave</b><span>Sin la clave no puedo traer ni guardar nada.</span></div><button class="btn primary" data-act="clave">Escribir mi clave</button></div>';
  } else if(f && f.error === 'red'){
    h = '<div class="banner soft"><div><b>Sin conexión</b><span>Mostrando lo último guardado. Se intenta de nuevo al tocar ↻.</span></div></div>';
  } else if(f && f.error === 'reglas'){
    h = '<div class="banner"><div><b>No pude leer las reglas del dashboard</b><span>' + esc(f.detalle || '') + '</span></div></div>';
  }
  $('avisos').innerHTML = h;
  $('demo').innerHTML = T.esDemo ? '<div class="demo-ribbon">MODO DEMO — no se guarda nada</div>' : '';
}

/* ---------- Recordatorios ---------- */
function cuandoTxt(n){
  const d = n.fecha; if(!d) return 'sin fecha';
  const h0 = new Date();
  const dif = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(h0.getFullYear(), h0.getMonth(), h0.getDate())) / 864e5);
  const hora = n.conHora ? ' ' + hhmm(d) : '';
  if(dif === 0) return 'hoy' + hora;
  if(dif === 1) return 'mañana' + hora;
  if(dif === -1) return 'ayer' + hora;
  const dia = d.toLocaleDateString('es-PE', {weekday:'short'}).replace('.', '');
  const mes = d.toLocaleDateString('es-PE', {month:'short'}).replace('.', '');
  return dia + ' ' + d.getDate() + ' ' + mes + hora;
}
function manana(){ return T.iso(T.sumarDias(new Date(), 1)); }
function htmlNota(n){
  return '<div class="nota' + (n.hecho ? ' hecha' : '') + (n.vencida ? ' vencida' : '') + '"><div class="nota-fila">' +
    '<button type="button" class="check nota-chk" role="checkbox" aria-checked="' + (n.hecho ? 'true' : 'false') + '" aria-label="Marcar hecho: ' + esc(n.texto) + '" data-act="nota-hecha" data-id="' + esc(n.id) + '"><span class="cbox">' + ic('check') + '</span></button>' +
    '<div class="nota-cuerpo"><div class="nota-txt">' + esc(n.texto) + '</div><div class="nota-cuando">' + esc(cuandoTxt(n)) + (n.vencida ? ' · vencido' : '') + '</div>' +
    (n.fecha && !n.hecho ? '<a class="nota-cal" href="' + esc(n.calendario) + '" target="_blank" rel="noopener">' + ic('cal') + 'Alarma en Google Calendar</a>' : '') + '</div>' +
    '<button type="button" class="icon-btn nota-del" data-act="nota-borrar" data-id="' + esc(n.id) + '" title="Borrar" aria-label="Borrar recordatorio">' + ic('basura') + '</button></div></div>';
}
function htmlNotas(){
  const l = T.notas(), pend = l.filter(n => !n.hecho), hechas = l.filter(n => n.hecho);
  let h = '<div class="sec-head"><div><h2 class="section-label">Recordatorios</h2></div>' +
    '<button class="btn sm" data-act="nota-form">' + (S.notaForm ? 'Cerrar' : '+ Recordatorio') + '</button></div>';
  if(S.notaForm){
    h += '<form class="nota-form"><input type="text" id="nTxt" maxlength="300" placeholder="Ej.: bajar los anuncios a S/ 15" aria-label="Texto del recordatorio" value="' + esc(S.notaVal.txt) + '">' +
      '<div class="nota-form-fila"><label>Fecha<input type="date" id="nFec" value="' + esc(S.notaVal.fec || manana()) + '"></label>' +
      '<label>Hora (opcional)<input type="time" id="nHor" value="' + esc(S.notaVal.hor) + '"></label>' +
      '<button type="submit" class="btn primary sm">Guardar</button></div></form>';
  }
  if(!pend.length && !hechas.length && !S.notaForm) h += '<div class="vacio"><b>Sin recordatorios</b><p>Anota cosas como "mañana bajar los anuncios a S/ 15".</p></div>';
  h += pend.map(htmlNota).join('');
  if(pend.some(n => n.fecha)) h += '<div class="ayuda">La alarma en Google Calendar hace sonar el celular aunque el panel esté cerrado.</div>';
  if(hechas.length){
    h += '<button class="btn-link" data-act="nota-hechas" aria-expanded="' + S.notaHechas + '">' + (S.notaHechas ? 'Ocultar hechas' : 'Ver hechas (' + hechas.length + ')') + '</button>';
    if(S.notaHechas) h += hechas.map(htmlNota).join('');
  }
  if(typeof Notification !== 'undefined' && Notification.permission === 'default') h += '<button class="btn-link" data-act="avisos-permiso">Activar avisos</button>';
  return h;
}
const AVISADAS_K = 'timeless_contenido_avisadas';
function avisadas(){ try{ return JSON.parse(localStorage.getItem(AVISADAS_K) || '[]'); }catch(e){ return []; } }
function guardaAvisada(id){ try{ const l = avisadas(); l.push(id); localStorage.setItem(AVISADAS_K, JSON.stringify(l.slice(-200))); }catch(e){} }
function toast(n){
  let box = $('toasts');
  if(!box){ box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'alert'); document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast'; t.dataset.id = n.id;
  t.innerHTML = '<span class="al-ico">' + ic('campana') + '</span><div class="toast-b"><b>Recordatorio</b><span>' + esc(n.texto) + '</span></div>' +
    '<button class="btn sm" data-act="toast-hecho" data-id="' + esc(n.id) + '">Hecho</button><button class="icon-btn" data-act="toast-cerrar" aria-label="Cerrar aviso">×</button>';
  box.appendChild(t);
}
function revisaAvisos(){
  try{
    const ya = avisadas(), ahora = Date.now();
    T.notas().forEach(n => {
      if(n.hecho || !n.conHora || !n.fecha || +n.fecha > ahora || ahora - +n.fecha > 6 * 36e5 || ya.indexOf(n.id) >= 0) return;
      guardaAvisada(n.id); toast(n);
      try{ if(typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('Recordatorio', {body: n.texto, icon: 'icon-192.png', tag: n.id}); }catch(e){}
    });
  }catch(e){ console.error(e); }
}
function pidePermiso(){
  try{ if(typeof Notification !== 'undefined') Notification.requestPermission().then(() => render()); }catch(e){}
}

/* ---------- Alertas ---------- */
function grupoAl(clase, icono, titulo, n, cuerpo){
  return '<div class="al ' + clase + '"><div class="al-head"><span class="al-ico">' + ic(icono) + '</span><span class="al-t">' + titulo + '</span>' +
    (n != null ? '<span class="al-n mono">' + n + '</span>' : '') + '</div>' + cuerpo + '</div>';
}
function htmlAlertas(){
  const a = T.alertas(); let g = '';
  if(a.notas && a.notas.length){
    g += grupoAl('t-notas', 'campana', 'Recordatorios', a.notas.length, '<ul>' + a.notas.map(n =>
      '<li><span class="n">' + esc(n.texto) + '</span><span class="d' + (n.vencida ? ' warn' : '') + '">' + esc(cuandoTxt(n)) + (n.vencida ? ' · vencido' : '') + '</span></li>').join('') + '</ul>');
  }
  if(a.llegan.length){
    g += grupoAl('t-llegan', 'camion', 'Llegan esta semana: anúncialos', a.llegan.length, '<ul>' + a.llegan.map(p => {
      const d = p.atrasado
        ? '<span class="d warn">Ya debió llegar (era hasta el ' + esc(fc(p.hasta)) + ')' + (p.plataforma ? ' · ' + esc(p.plataforma) : '') + '. Revisa el tracking.</span>'
        : '<span class="d">Llega ' + esc(rango(p.desde, p.hasta)) + (p.plataforma ? ' · ' + esc(p.plataforma) : '') + '</span>';
      return '<li><span class="n">' + esc(p.producto) + '</span>' + d + '</li>';
    }).join('') + '</ul>');
  }
  if(a.urgencia.length){
    g += grupoAl('t-urgencia', 'flash', 'Quedan pocas unidades', a.urgencia.length, '<ul>' + a.urgencia.map(p =>
      '<li><span class="n">' + esc(p.producto) + '</span><span class="d">Quedan ' + esc(p.stock) + (p.diasAgotar ? ' · se agota en ~' + esc(Math.round(p.diasAgotar)) + ' días' : '') + '</span></li>').join('') + '</ul>');
  }
  if(a.estancados.length){
    g += grupoAl('t-estancados', 'dormido', 'Con stock pero sin salida', a.estancados.length, '<ul>' + a.estancados.map(p =>
      '<li><span class="n">' + esc(p.producto) + '</span><span class="d">Stock ' + esc(p.stock) + ' · ' + plural(p.v14, 'venta', 'ventas') + ' en 14 días</span></li>').join('') + '</ul>');
  }
  const c = a.comentarios;
  if(c.disponible){
    if(c.lista.length){
      const tope = S.verMasComent ? c.lista.length : 4;
      g += grupoAl('t-coment', 'chat', 'Comentarios sin responder', c.lista.length, '<ul>' + c.lista.slice(0, tope).map(x =>
        '<li><span class="n">@' + esc(x.usuario) + '</span><span>' + esc(x.texto) + '</span><span class="d">' + esc(horaLocal(x.fecha)) +
        (x.permalink ? ' · <a href="' + esc(x.permalink) + '" target="_blank" rel="noopener">Ver el post</a>' : '') + '</span></li>').join('') + '</ul>' +
        (c.lista.length > 4 ? '<button class="btn-link al-more" data-act="vermas">' + (S.verMasComent ? 'Ver menos' : 'Ver los ' + (c.lista.length - 4) + ' restantes') + '</button>' : ''));
    } else {
      g += grupoAl('t-coment', 'chat', 'Comentarios sin responder', 0, '<div class="al-vacio">Todo respondido. Bien ahí.</div>');
    }
  } else {
    g += grupoAl('t-coment', 'chat', 'Comentarios sin responder', null, '<div class="al-vacio">No disponible: ' + esc(c.motivo || 'sin datos') + '</div>');
  }
  if(a.fechas.length){
    g += '<div class="al al-fechas t-fechas"><div class="al-head"><span class="al-ico">' + ic('cal') + '</span><span class="al-t">Fechas clave de los próximos 14 días</span></div><div class="fechas-wrap">' +
      a.fechas.map(f => {
        const hechos = f.checklist.filter(x => x.hecho).length;
        const cuando = f.enCurso ? '<span class="chip accent">en curso</span>' : '<span class="chip">' + (f.faltanDias === 1 ? 'falta 1 día' : 'faltan ' + f.faltanDias + ' días') + '</span>';
        return '<div class="fecha"><div class="fecha-top"><div><div class="fecha-n">' + esc(f.nombre) + '</div><div class="fecha-r">' + esc(rango(f.desde, f.hasta)) + ' · ' + hechos + '/' + f.checklist.length + ' listos</div></div>' + cuando + '</div>' +
          (f.nota ? '<div class="fecha-nota">' + esc(f.nota) + '</div>' : '') +
          '<div class="checks">' + f.checklist.map(x =>
            '<button type="button" class="check" role="checkbox" aria-checked="' + (x.hecho ? 'true' : 'false') + '" data-act="check" data-id="' + esc(x.id) + '"><span class="cbox">' + ic('check') + '</span><span class="ct">' + esc(x.texto) + '</span></button>').join('') + '</div></div>';
      }).join('') + '</div></div>';
  }
  if(!g) return '';
  return '<div class="alertas">' + g + '</div>';
}

/* ---------- Plan ---------- */
function semanasLista(){
  const s = T.semanasConPlan().slice(); const act = T.semanaId();
  if(s.indexOf(act) < 0) s.push(act);
  if(s.indexOf(S.semana) < 0) s.push(S.semana);
  return s.sort();
}
function etiquetaSemana(id){
  const l = T.deIso(id), d = T.sumarDias(l, 6);
  const tag = id === T.semanaId() ? 'Esta semana · ' : '';
  return tag + (l.getMonth() === d.getMonth() ? l.getDate() + ' al ' + T.fechaCorta(d) : T.fechaCorta(l) + ' al ' + T.fechaCorta(d));
}
function htmlItem(sem, it){
  const info = T.estadoItemInfo(sem, it.id), e = info.e, auto = !!info.auto;
  const idx = T.ESTADOS.indexOf(e);
  const dots = T.ESTADOS.map((_, i) => '<i class="' + (i <= idx && idx > 0 ? 'on' : '') + '"></i>').join('');
  const extra = (it.tipo === 'post' && it.tiktok) ? '<span class="tag extra">+ TikTok</span>' : '';
  return '<div class="it st-' + e + '"><div class="it-time mono">' + esc(it.hora) + (it.horaFin ? '<small>' + esc(it.horaFin) + '</small>' : '') + '</div>' +
    '<div class="it-body"><div class="it-tags"><span class="tag ' + esc(it.tipo) + '">' + esc(TIPO_ETQ[it.tipo] || it.tipo) + '</span>' + extra +
    (it.producto ? '<span class="chip pchip">' + esc(it.producto) + '</span>' : '') + '</div><div class="it-text">' + esc(it.texto) + '</div></div>' +
    '<button type="button" class="pill ' + e + (auto ? ' auto' : '') + '"' + (auto ? ' title="Marcado solo según Instagram"' : '') + ' data-act="estado" data-sem="' + esc(sem) + '" data-id="' + esc(it.id) + '" aria-label="' + esc(EST_ETQ[e]) + (auto ? ' (marcado solo según Instagram)' : '') + ': toca para cambiar a ' + esc(EST_ETQ[T.siguienteEstado(e)]) + '">' +
    '<span class="dots" aria-hidden="true">' + dots + '</span>' + (e === 'publicado' ? ic('check') : '') + esc(EST_ETQ[e]) + (auto ? '<span class="auto-tag">' + ic('ig') + 'auto</span>' : '') + '</button></div>';
}
function diasDeSemana(sem, plan){
  const lun = T.deIso(sem), hoyIso = T.iso(new Date());
  return T.DIAS_CORTO.map((nom, i) => {
    const f = T.iso(T.sumarDias(lun, i));
    const pd = plan && plan.dias.find(d => d.fecha === f);
    return {dia: nom, fecha: f, items: pd ? pd.items : [], hoy: f === hoyIso};
  });
}
function cuentaDia(sem, d){
  const l = d.items.filter(it => T.estadoItem(sem, it.id) === 'publicado').length;
  return {l, n: d.items.length};
}
function abierto(d){
  if(d.fecha in S.abiertos) return S.abiertos[d.fecha];
  return esDesktop() ? true : d.hoy;
}
function htmlDia(sem, d){
  const c = cuentaDia(sem, d), ab = abierto(d);
  const cnt = c.n ? c.l + '/' + c.n + ' listos' : 'Sin nada';
  return '<div class="dia' + (d.hoy ? ' hoy' : '') + (ab ? ' abierto' : '') + '"><button type="button" class="dia-h" data-act="dia" data-f="' + esc(d.fecha) + '" aria-expanded="' + ab + '">' +
    '<span class="dia-nom">' + esc(d.dia) + '</span><span class="dia-fec">' + esc(fc(d.fecha)) + '</span>' + (d.hoy ? '<span class="dia-hoy">HOY</span>' : '') +
    '<span class="dia-cnt mono' + (c.n && c.l === c.n ? ' full' : '') + '">' + cnt + '</span><span class="dia-chev">' + ic('chev') + '</span></button>' +
    '<div class="dia-body">' + (d.items.length ? d.items.map(it => htmlItem(sem, it)).join('') : '<div class="dia-vacio">Nada planeado este día.</div>') + '</div></div>';
}
/* ---------- Plan completo (Markdown del chat de creativos) ----------
   Lector chico y seguro: primero se escapa TODO el texto y recién después se
   ponen las etiquetas (títulos, negritas, listas, citas, separadores). */
function mdInline(s){
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
}
function mdHtml(md){
  const out = [];
  let lista = null, cita = null, parr = [];
  const cerrarParr = () => { if(parr.length){ out.push('<p>' + parr.map(mdInline).join('<br>') + '</p>'); parr = []; } };
  const cerrarLista = () => { if(lista){ out.push('<ul>' + lista.map(x => '<li>' + mdInline(x) + '</li>').join('') + '</ul>'); lista = null; } };
  const cerrarCita = () => { if(cita){ out.push('<blockquote>' + cita.map(x => x ? mdInline(x) : '').join('<br>').replace(/(<br>){2,}/g, '<br><br>') + '</blockquote>'); cita = null; } };
  const cerrar = () => { cerrarParr(); cerrarLista(); cerrarCita(); };
  String(md || '').replace(/\r/g, '').split('\n').forEach(raw => {
    const l = raw.replace(/\s+$/, '');
    let m;
    if(/^>\s?/.test(l)){ cerrarParr(); cerrarLista(); (cita || (cita = [])).push(l.replace(/^>\s?/, '')); return; }
    cerrarCita();
    if(!l.trim()){ cerrarParr(); cerrarLista(); return; }
    if(/^-{3,}$/.test(l.trim())){ cerrar(); out.push('<hr>'); return; }
    if((m = /^(#{1,4})\s+(.*)$/.exec(l))){ cerrar(); const n = Math.min(4, m[1].length + 2); out.push('<h' + n + '>' + mdInline(m[2]) + '</h' + n + '>'); return; }
    if((m = /^\s*[-*]\s+(.*)$/.exec(l))){ cerrarParr(); (lista || (lista = [])).push(m[1]); return; }
    cerrarLista(); parr.push(l);
  });
  cerrar();
  return out.join('');
}
const DIA_MD = {LUNES:0, MARTES:1, MIERCOLES:2, JUEVES:3, VIERNES:4, SABADO:5, DOMINGO:6};
// Parte el Markdown en: intro (antes del primer "## ") y un bloque por día.
function mdPorDias(md, sem){
  const partes = String(md || '').replace(/\r/g, '').split(/\n(?=## )/);
  const intro = partes[0].startsWith('## ') ? '' : partes.shift();
  const lun = T.deIso(sem), hoy = T.iso(new Date());
  return {intro, dias: partes.map((p, i) => {
    const titulo = p.split('\n')[0].replace(/^##\s+/, '');
    const nombre = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z]/)[0];
    const idx = DIA_MD[nombre];
    const fecha = (idx != null && lun) ? T.iso(T.sumarDias(lun, idx)) : 'x' + i;
    return {titulo, fecha, hoy: fecha === hoy, cuerpo: p.split('\n').slice(1).join('\n')};
  })};
}
function htmlPlanCompleto(sem, pc){
  const {intro, dias} = mdPorDias(pc.md, sem);
  const hayHoy = dias.some(d => d.hoy);
  let h = '<div class="plan-meta">Plan completo del chat "Marketing y creativos"' + (pc.subido ? ' · ' + esc(horaLocal(pc.subido)) : '') + '</div>';
  if(hayHoy) h += '<button class="btn sm" data-act="md-hoy">' + ic('cal') + 'Ir a hoy</button>';
  if(intro.trim()){
    const ab = !!S.mdAbiertos['intro'];
    h += '<div class="md-dia md-intro' + (ab ? ' abierto' : '') + '"><button type="button" class="dia-h" data-act="md-dia" data-f="intro" aria-expanded="' + ab + '"><span class="dia-nom">Resumen y reglas</span><span class="dia-chev">' + ic('chev') + '</span></button>' +
      (ab ? '<div class="md">' + mdHtml(intro) + '</div>' : '') + '</div>';
  }
  return h + dias.map(d => {
    const ab = S.mdAbiertos[d.fecha] != null ? S.mdAbiertos[d.fecha] : d.hoy;
    return '<div class="md-dia' + (d.hoy ? ' hoy' : '') + (ab ? ' abierto' : '') + '" id="md-' + esc(d.fecha) + '"><button type="button" class="dia-h" data-act="md-dia" data-f="' + esc(d.fecha) + '" aria-expanded="' + ab + '">' +
      '<span class="dia-nom">' + mdInline(d.titulo) + '</span>' + (d.hoy ? '<span class="dia-hoy">HOY</span>' : '') + '<span class="dia-chev">' + ic('chev') + '</span></button>' +
      (ab ? '<div class="md">' + mdHtml(d.cuerpo) + '</div>' : '') + '</div>';
  }).join('');
}

function htmlPlan(){
  const sem = S.semana, lista = semanasLista(), i = lista.indexOf(sem);
  const plan = T.planDe(sem), pc = T.planCompletoDe(sem);
  let h = '<div class="sec-head"><div><h2 class="section-label">Plan de la semana</h2></div>' +
    '<div class="week-nav"><button class="icon-btn" data-act="semana" data-d="-1" aria-label="Semana anterior"' + (i <= 0 ? ' disabled style="opacity:.35"' : '') + '>' + ic('izq') + '</button>' +
    '<span class="lbl">' + esc(etiquetaSemana(sem)) + '</span>' +
    '<button class="icon-btn" data-act="semana" data-d="1" aria-label="Semana siguiente"' + (i >= lista.length - 1 ? ' disabled style="opacity:.35"' : '') + '>' + ic('der') + '</button></div>' +
    '<button class="btn sm" data-act="plan-abrir">Cargar plan</button></div>';
  // Si hay plan completo, se elige entre la checklist (para marcar) y el texto completo (para leer).
  const vista = pc ? (plan ? S.vistaPlan : 'completo') : 'checklist';
  if(pc){
    h += '<div class="seg" role="tablist" aria-label="Cómo ver el plan">' +
      '<button role="tab" data-act="vista-plan" data-v="checklist" aria-selected="' + (vista === 'checklist') + '"' + (plan ? '' : ' disabled') + '>Checklist</button>' +
      '<button role="tab" data-act="vista-plan" data-v="completo" aria-selected="' + (vista === 'completo') + '">Plan completo</button></div>';
  }
  if(vista === 'completo') return h + htmlPlanCompleto(sem, pc);
  if(!plan){
    return h + '<div class="vacio"><b>Aún no hay plan para esta semana</b><p>El plan llega solo cada noche desde el archivo que deja el chat "Marketing y creativos". También puedes pegarlo tú a mano.</p><p>Los posts e historias se marcan solos cuando Instagram ya los muestra; también puedes marcarlos tú.</p>' +
      '<button class="btn primary" data-act="plan-abrir">Cargar plan</button></div>';
  }
  h += '<div class="ayuda">Los posts e historias se marcan solos cuando Instagram ya los muestra; también puedes marcarlos tú.</div>';
  const origen = plan.origen === 'pegado' ? 'Pegado a mano' : 'Llegó solo del archivo del chat';
  h += '<div class="plan-meta">' + origen + (plan.subido ? ' · ' + esc(horaLocal(plan.subido)) : '') + '</div>';
  if(plan.errores.length) h += '<div class="aviso-meta">' + plural(plan.errores.length, 'línea del plan no se entendió', 'líneas del plan no se entendieron') + '. Abre "Cargar plan" para verlas.</div>';
  return h + '<div class="dias">' + diasDeSemana(sem, plan).map(d => htmlDia(sem, d)).join('') + '</div>';
}
function htmlHoy(){
  const sem = T.semanaId(), plan = T.planDe(sem), hoy = T.iso(new Date());
  let h = '<div class="sec-head"><div><h2 class="section-label">Lo de hoy</h2><div class="sec-title">' + esc(DIAS_LARGO[T.DIAS_CORTO[(new Date().getDay() + 6) % 7]]) + ' ' + esc(fc(hoy)) + '</div></div></div>';
  if(!plan) return h + '<div class="vacio"><b>No hay plan para esta semana</b><p>Llega solo cada noche desde el chat "Marketing y creativos", o pégalo tú.</p><button class="btn primary" data-act="plan-abrir">Cargar plan</button></div>';
  const d = diasDeSemana(sem, plan).find(x => x.hoy);
  if(!d || !d.items.length) return h + '<div class="vacio"><b>Hoy no hay nada planeado</b><p>Descansa o mira la pestaña Semana.</p></div>';
  const c = cuentaDia(sem, d);
  const verCompleto = T.planCompletoDe(sem) ? '<button class="btn sm" data-act="md-hoy">' + ic('cal') + 'Ver el plan completo de hoy</button>' : '';
  return h + '<div class="plan-meta">' + c.l + '/' + c.n + ' listos</div>' + verCompleto + d.items.map(it => htmlItem(sem, it)).join('');
}

/* ---------- Metas ---------- */
function htmlMetas(){
  const sem = S.semana, av = T.avanceSemana(sem);
  const esActual = sem === T.semanaId();
  const atras = av.metas.filter(m => m.atrasado);
  const clave = atras.filter(m => m.id === 'posts' || m.id === 'tiktok');
  let h = '<div class="sec-head"><div><h2 class="section-label">Metas semanales</h2><div class="sub">' + esc(etiquetaSemana(sem)) + '</div></div></div>';
  if(atras.length){
    const nom = {posts:'Instagram', tiktok:'TikTok', historias:'las historias'};
    h += '<p class="aviso-meta' + (clave.length ? ' fuerte' : '') + '">' + (clave.length
      ? 'Vas atrasado en ' + clave.map(m => nom[m.id]).join(' y ') + '. Toca ponerse al día.'
      : 'Vas atrasado en ' + atras.map(m => nom[m.id]).join(' y ') + '.') + '</p>';
  }
  h += av.metas.map(m => {
    const pct = Math.round(m.pct * 100), hecha = m.meta > 0 && m.hecho >= m.meta;
    const fuerte = m.atrasado && (m.id === 'posts' || m.id === 'tiktok');
    let acc = '';
    if(m.id === 'tiktok'){
      acc = '<span class="stepper"><button class="icon-btn" data-act="tt" data-d="-1" aria-label="Quitar un TikTok">' + ic('menos') + '</button><span class="mono">' + T.tiktokManual(sem) + '</span><button class="icon-btn" data-act="tt" data-d="1" aria-label="Sumar un TikTok">' + ic('mas') + '</button></span>';
    }
    return '<div class="meta' + (m.atrasado ? ' atras' : '') + (fuerte ? ' fuerte' : '') + (hecha ? ' done' : '') + '"><div class="meta-top"><span class="meta-n">' + esc(m.nombre) + '</span>' +
      '<span class="meta-v mono">' + m.hecho + '<small>/' + m.meta + '</small></span></div>' +
      '<div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(m.nombre) + '"><div class="bar-f" style="width:' + pct + '%"></div>' +
      (esActual ? '<div class="bar-hoy" style="left:calc(' + Math.round(av.transcurrido * 100) + '% - 1px)"></div>' : '') + '</div>' +
      '<div class="meta-foot"><span class="' + (m.atrasado ? 'meta-alerta' : 'meta-fuente') + '">' + (m.atrasado ? 'Vas atrasado en ' + esc(m.id === 'tiktok' ? 'TikTok' : m.id === 'posts' ? 'Instagram' : 'historias') + ' · ' : '') + esc(m.fuente) + '</span>' + acc + '</div></div>';
  }).join('');
  return h + '<div class="metas-foot"><button class="btn-link" data-act="metas-abrir">Editar metas</button></div>';
}

/* ---------- Productos ---------- */
const EST_ORDEN = ['urgencia', 'estancado', 'camino', 'ok', 'agotado'];
const EST_NOMBRE = {urgencia:'Urgencia', estancado:'Estancado', camino:'En camino', ok:'Va bien', agotado:'Agotado'};
function textoPost(u){
  if(!u) return '<span>Sin post todavía</span>';
  const cuando = u.dias <= 0 ? 'hoy' : u.dias === 1 ? 'ayer' : 'hace ' + u.dias + ' días';
  const viejo = u.dias > 14 ? ' viejo' : '';
  if(u.origen === 'manual') return '<span>Último post: <span class="' + viejo.trim() + '">' + cuando + '</span> · marcado a mano</span>';
  const t = '<span class="' + viejo.trim() + '">' + cuando + '</span>';
  return '<span>Último post: ' + (u.permalink ? '<a href="' + esc(u.permalink) + '" target="_blank" rel="noopener">' + cuando + '</a>' : t) + '</span>';
}
function htmlProd(p){
  const u = p.ultimoPost;
  let h = '<article class="prod"><div class="prod-top"><div class="prod-n">' + esc(p.producto) + '</div><span class="badge ' + esc(p.estado) + '">' + esc(EST_NOMBRE[p.estado]) + '</span></div>';
  if(p.estado !== 'camino'){
    h += '<div class="stats"><div class="stat"><b class="mono">' + esc(p.stock) + '</b><span>En stock</span></div><div class="stat"><b class="mono">' + esc(p.v7) + '</b><span>Vendidos 7 d</span></div><div class="stat"><b class="mono">' + esc(p.v14) + '</b><span>Vendidos 14 d</span></div></div>';
    if(p.diasAgotar && p.stock > 0) h += '<div class="agota">Se agota en ~' + Math.round(p.diasAgotar) + ' días</div>';
  } else if(p.llegada){
    const l = p.llegada;
    h += '<div class="camino-i">' + (l.desde ? (l.atrasado ? '<b>Ya debió llegar</b> (era hasta el ' + esc(fc(l.hasta)) + ')' : 'Llega <b>' + esc(rango(l.desde, l.hasta)) + '</b>') : 'Sin fecha estimada') +
      (l.plataforma ? ' · ' + esc(l.plataforma) : '') + (p.pendiente ? ' · ' + esc(p.pendiente) + ' u' : '') + '</div>';
  }
  h += '<div class="foco">' + ic('idea') + '<span>' + esc(p.foco) + '</span></div>';
  h += '<div class="post-i">' + textoPost(u) + '</div>';
  const abierta = S.fechaAbierta === p.key;
  h += '<div class="post-acc"><button class="btn sm" data-act="posteo" data-k="' + esc(p.key) + '">Posteé hoy</button>' +
    '<button class="btn-link" data-act="otra-fecha" data-k="' + esc(p.key) + '">' + (abierta ? 'Cancelar' : 'Elegir otra fecha') + '</button></div>';
  if(abierta){
    const hoy = T.iso(new Date());
    h += '<div class="fecha-form"><input type="date" id="fd-' + esc(p.key.replace(/[^a-z0-9]/gi, '_')) + '" value="' + esc(S.fechaVal[p.key] || hoy) + '" max="' + hoy + '" data-k="' + esc(p.key) + '" aria-label="Fecha del post"><button class="btn sm primary" data-act="guardar-fecha" data-k="' + esc(p.key) + '">Guardar</button></div>';
  }
  return h + '</article>';
}
function htmlProductos(){
  const todos = T.productos();
  const cuenta = {}; todos.forEach(p => { cuenta[p.estado] = (cuenta[p.estado] || 0) + 1; });
  const ccat = {}; todos.forEach(p => { ccat[p.categoria] = (ccat[p.categoria] || 0) + 1; });
  const cats = T.CATEGORIAS.map(c => ({id:c.id, nombre:c.nombre})).concat([{id:'otros', nombre:'Otros'}]).filter(c => ccat[c.id]);
  let h = '<div class="sec-head"><div><h2 class="section-label">Productos</h2><div class="sub">' + todos.length + ' en la lista</div></div></div>';
  if(!todos.length) return h + '<div class="vacio"><b>Sin productos todavía</b><p>Se llenan cuando el panel trae los datos del dashboard.</p></div>';
  h += '<div class="fgrupo-l">Estado</div><div class="filtros">' +
    '<button class="fchip" data-act="fest" data-v="" aria-pressed="' + (!S.fEstado) + '">Todos <b>' + todos.length + '</b></button>' +
    EST_ORDEN.filter(e => cuenta[e]).map(e => '<button class="fchip" data-act="fest" data-v="' + e + '" aria-pressed="' + (S.fEstado === e) + '">' + EST_NOMBRE[e] + ' <b>' + cuenta[e] + '</b></button>').join('') + '</div>';
  if(cats.length > 1) h += '<div class="fgrupo-l">Tipo</div><div class="filtros">' +
    '<button class="fchip" data-act="fcat" data-v="" aria-pressed="' + (!S.fCat) + '">Todos</button>' +
    cats.map(c => '<button class="fchip" data-act="fcat" data-v="' + c.id + '" aria-pressed="' + (S.fCat === c.id) + '">' + esc(c.nombre) + ' <b>' + ccat[c.id] + '</b></button>').join('') + '</div>';
  const vis = todos.filter(p => (!S.fEstado || p.estado === S.fEstado) && (!S.fCat || p.categoria === S.fCat))
    .sort((a, b) => EST_ORDEN.indexOf(a.estado) - EST_ORDEN.indexOf(b.estado) || a.producto.localeCompare(b.producto, 'es'));
  if(!vis.length) return h + '<div class="vacio"><p>Ningún producto con esos filtros.</p><button class="btn sm" data-act="fest" data-v="">Quitar filtros</button></div>';
  return h + '<div class="prods">' + vis.map(htmlProd).join('') + '</div>';
}

/* ---------- Pestañas ---------- */
function pintaTabs(){
  const tabs = [['hoy','Hoy','sol'], ['semana','Semana','cal'], ['productos','Productos','caja'], ['metas','Metas','meta']];
  let pend = 0;
  try{
    const sem = T.semanaId(), plan = T.planDe(sem), hoy = T.iso(new Date());
    const d = plan && plan.dias.find(x => x.fecha === hoy);
    if(d) pend = d.items.filter(it => T.estadoItem(sem, it.id) !== 'publicado').length;
  }catch(e){}
  try{ pend += T.alertas().notas.length; }catch(e){}
  $('tabbar').innerHTML = tabs.map(t => '<button role="tab" aria-selected="' + (S.tab === t[0]) + '" data-act="tab" data-t="' + t[0] + '">' + ic(t[2]) +
    (t[0] === 'hoy' && pend ? '<span class="nbadge mono">' + pend + '</span>' : '') + t[1] + '</button>').join('');
  document.body.setAttribute('data-tab', S.tab);
}

/* ---------- Pintar todo ---------- */
function render(){
  if(S.carga === 'cargando' && !T.hayDatos()){
    $('sec-alertas').innerHTML = ''; $('sec-plan').innerHTML = '<div class="vacio"><b>Cargando…</b></div>';
    $('sec-hoy').innerHTML = ''; $('sec-metas').innerHTML = ''; $('sec-prod').innerHTML = ''; $('sec-notas').innerHTML = '';
    pintaTabs(); pintaEstado(); pintaAvisos(); return;
  }
  try{
    $('sec-alertas').innerHTML = htmlAlertas();
    $('sec-plan').innerHTML = htmlPlan();
    $('sec-hoy').innerHTML = htmlHoy();
    $('sec-notas').innerHTML = htmlNotas();
    $('sec-metas').innerHTML = htmlMetas();
    $('sec-prod').innerHTML = htmlProductos();
  }catch(e){ console.error(e); }
  pintaTabs(); pintaEstado(); pintaAvisos();
}

/* ---------- Ventanas ---------- */
function abrirOv(html){ const o = $('ov'); o.innerHTML = html; o.hidden = false; document.body.style.overflow = 'hidden'; const f = o.querySelector('textarea,input'); if(f) setTimeout(() => f.focus(), 50); }
function cerrarOv(){ const o = $('ov'); o.hidden = true; o.innerHTML = ''; document.body.style.overflow = ''; }
function abrirPlan(){
  abrirOv('<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mpt"><h2 id="mpt">Cargar plan</h2>' +
    '<p class="sub">Pega aquí el texto del plan. Empieza con <span class="mono">SEMANA AAAA-MM-DD</span> (el lunes). El plan también llega solo cada noche desde el archivo que deja el chat "Marketing y creativos".</p>' +
    '<textarea id="planTxt" placeholder="SEMANA 2026-11-16&#10;LUN 16/11&#10;POST 18:00 | Carrusel ... | Cinturon dark knight&#10;HIST 12:00 | Texto de la historia" spellcheck="false"></textarea>' +
    '<div class="prev" id="planPrev">Pega el texto para ver cómo quedaría.</div><div class="err-t" id="planErr"></div>' +
    '<div class="modal-acc"><button class="btn ghost" data-act="cerrar">Cancelar</button><button class="btn primary" id="planOk" data-act="plan-guardar" disabled>Guardar plan</button></div></div>');
}
function previewPlan(){
  const txt = $('planTxt').value, prev = $('planPrev'), ok = $('planOk');
  if(!txt.trim()){ prev.innerHTML = 'Pega el texto para ver cómo quedaría.'; ok.disabled = true; return; }
  const p = T.parsePlan(txt), n = p.dias.reduce((a, d) => a + d.items.length, 0);
  let h = p.semana ? '<div class="ok">Semana del ' + esc(fc(p.semana)) + ' · ' + plural(p.dias.length, 'día', 'días') + ' · ' + plural(n, 'publicación', 'publicaciones') + '</div>'
    : '<div class="err-t" style="margin:0">Falta la línea SEMANA AAAA-MM-DD al inicio.</div>';
  if(p.errores.length) h += '<ul>' + p.errores.slice(0, 8).map(e => '<li>' + esc(e) + '</li>').join('') + (p.errores.length > 8 ? '<li>…y ' + (p.errores.length - 8) + ' más</li>' : '') + '</ul>';
  prev.innerHTML = h; ok.disabled = !(p.semana && n > 0);
  $('planErr').textContent = '';
}
function abrirMetas(){
  const m = T.avanceSemana(S.semana).metas; const v = id => m.find(x => x.id === id).meta;
  abrirOv('<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mmt"><h2 id="mmt">Editar metas</h2><p class="sub">Cuántas publicaciones quieres por semana.</p>' +
    '<div class="form-g"><label>Posts<input type="number" inputmode="numeric" min="0" id="mp" value="' + v('posts') + '"></label>' +
    '<label>Historias<input type="number" inputmode="numeric" min="0" id="mh" value="' + v('historias') + '"></label>' +
    '<label>TikToks<input type="number" inputmode="numeric" min="0" id="mt" value="' + v('tiktok') + '"></label></div>' +
    '<div class="modal-acc"><button class="btn ghost" data-act="cerrar">Cancelar</button><button class="btn primary" data-act="metas-guardar">Guardar</button></div></div>');
}

/* ---------- Eventos ---------- */
document.addEventListener('click', async ev => {
  if(ev.target.id === 'ov'){ cerrarOv(); return; }
  const b = ev.target.closest('[data-act]'); if(!b) return;
  const a = b.dataset.act;
  switch(a){
    case 'estado': {
      const sem = b.dataset.sem, id = b.dataset.id;
      T.marcarItem(sem, id, T.siguienteEstado(T.estadoItem(sem, id)));
      render(); break;
    }
    case 'dia': { const f = b.dataset.f; const dia = {fecha:f, hoy:f === T.iso(new Date())}; S.abiertos[f] = !abierto(dia); render(); break; }
    case 'semana': { const l = semanasLista(); const i = l.indexOf(S.semana) + (+b.dataset.d); if(l[i]){ S.semana = l[i]; S.abiertos = {}; render(); } break; }
    case 'tab': S.tab = b.dataset.t; try{ localStorage.setItem('timeless_contenido_tab', S.tab); }catch(e){} pintaTabs(); window.scrollTo(0, 0); break;
    case 'check': { const id = b.dataset.id; T.setCheckFecha(id, b.getAttribute('aria-checked') !== 'true'); render(); break; }
    case 'vermas': S.verMasComent = !S.verMasComent; render(); break;
    case 'tt': { const n = T.tiktokManual(S.semana) + (+b.dataset.d); T.setTiktokManual(S.semana, Math.max(0, n)); render(); break; }
    case 'fest': S.fEstado = b.dataset.v; render(); break;
    case 'fcat': S.fCat = b.dataset.v; render(); break;
    case 'posteo': T.marcarUltimoPost(b.dataset.k, T.iso(new Date())); S.fechaAbierta = ''; render(); break;
    case 'otra-fecha': S.fechaAbierta = S.fechaAbierta === b.dataset.k ? '' : b.dataset.k; render(); break;
    case 'guardar-fecha': {
      const k = b.dataset.k, inp = document.querySelector('input[type=date][data-k="' + CSS.escape(k) + '"]');
      if(inp && inp.value){ T.marcarUltimoPost(k, inp.value); delete S.fechaVal[k]; S.fechaAbierta = ''; render(); }
      break;
    }
    case 'plan-abrir': abrirPlan(); break;
    case 'vista-plan': S.vistaPlan = b.dataset.v; try{ localStorage.setItem('timeless_contenido_vistaplan', S.vistaPlan); }catch(e){} render(); break;
    case 'md-dia': { const f = b.dataset.f; const hoyF = T.iso(new Date()); const cur = S.mdAbiertos[f] != null ? S.mdAbiertos[f] : f === hoyF; S.mdAbiertos[f] = !cur; render(); break; }
    case 'md-hoy': {
      const hoyF = T.iso(new Date());
      S.semana = T.semanaId(); S.vistaPlan = 'completo'; S.mdAbiertos[hoyF] = true;
      if(!esDesktop()){ S.tab = 'semana'; try{ localStorage.setItem('timeless_contenido_tab', 'semana'); }catch(e){} pintaTabs(); }
      render();
      const el = document.getElementById('md-' + hoyF); if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
      break;
    }
    case 'plan-guardar': {
      try{ const p = T.guardarPlanTexto($('planTxt').value); S.semana = p.semana; S.abiertos = {}; cerrarOv(); render(); }
      catch(e){ $('planErr').textContent = e.message || 'No se pudo guardar el plan.'; }
      break;
    }
    case 'metas-abrir': abrirMetas(); break;
    case 'metas-guardar': {
      const n = id => Math.max(0, parseInt($(id).value, 10) || 0);
      T.setMetasSemanales({posts:n('mp'), historias:n('mh'), tiktok:n('mt')}); cerrarOv(); render(); break;
    }
    case 'nota-form': S.notaForm = !S.notaForm; render(); break;
    case 'nota-hechas': S.notaHechas = !S.notaHechas; render(); break;
    case 'nota-hecha': T.marcarNota(b.dataset.id, b.getAttribute('aria-checked') !== 'true'); render(); break;
    case 'nota-borrar': if(confirm('¿Borrar este recordatorio?')){ T.borrarNota(b.dataset.id); render(); } break;
    case 'avisos-permiso': pidePermiso(); break;
    case 'toast-hecho': T.marcarNota(b.dataset.id, true); b.closest('.toast').remove(); render(); break;
    case 'toast-cerrar': b.closest('.toast').remove(); break;
    case 'cerrar': cerrarOv(); break;
    case 'clave': { const v = prompt('Escribe tu clave del dashboard'); if(v && v.trim()){ T.guardarClave(v); location.reload(); } break; }
  }
});
document.addEventListener('input', ev => {
  if(ev.target.id === 'planTxt') previewPlan();
  if(ev.target.matches && ev.target.matches('input[type=date][data-k]')) S.fechaVal[ev.target.dataset.k] = ev.target.value;
});
document.addEventListener('input', ev => {
  const id = ev.target.id;
  if(id === 'nTxt') S.notaVal.txt = ev.target.value;
  if(id === 'nFec') S.notaVal.fec = ev.target.value;
  if(id === 'nHor') S.notaVal.hor = ev.target.value;
});
document.addEventListener('submit', ev => {
  if(!ev.target.matches('.nota-form')) return;
  ev.preventDefault();
  const txt = ($('nTxt').value || '').trim(), fec = $('nFec').value, hor = $('nHor').value;
  if(!txt){ $('nTxt').focus(); return; }
  T.agregarNota(txt, fec ? (hor ? fec + 'T' + hor : fec) : '');
  S.notaVal = {txt:'', fec:'', hor:''}; S.notaForm = false; render(); revisaAvisos();
});
document.addEventListener('keydown', ev => { if(ev.key === 'Escape' && !$('ov').hidden) cerrarOv(); });

let timerOk = null;
T.onEstadoGuardado(e => {
  S.guardado = e;
  pintaEstado();
  clearTimeout(timerOk);
  if(e === 'ok'){ timerOk = setTimeout(() => { S.guardado = 'ninguno'; S.ultimaOk = new Date(); pintaEstado(); }, 2500); }
});

function iniciar(){
  S.carga = 'cargando'; S.fase = null; pintaEstado();
  const btn = $('refreshBtn'); btn.classList.add('spin');
  return T.iniciar(fase => {
    if(typeof fase === 'string'){
      if(fase === 'vivo'){ S.carga = 'listo'; S.ultimaOk = new Date(); S.fase = null; btn.classList.remove('spin'); }
      else if(fase === 'cache' || fase === 'metas'){ S.carga = 'listo'; }
      render();
    } else {
      S.fase = fase; S.carga = 'listo'; btn.classList.remove('spin'); render();
    }
  }).then(() => { btn.classList.remove('spin'); });
}
$('refreshBtn').innerHTML = ic('refresh');
$('refreshBtn').addEventListener('click', iniciar);

async function refrescarSuave(){
  if(document.visibilityState !== 'visible' || !$('ov').hidden) return;
  const ae = document.activeElement;
  if(await T.refrescar()){
    if(ae && ae.tagName === 'INPUT' && ae.closest('#sec-prod, #sec-notas')) return;
    S.ultimaOk = new Date(); render();
  }
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') refrescarSuave(); });
setInterval(refrescarSuave, 60000);
window.matchMedia('(min-width:1024px)').addEventListener('change', render);

if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(() => {}); }
render();
iniciar();
setInterval(revisaAvisos, 30000);
setTimeout(revisaAvisos, 1500);
})();
