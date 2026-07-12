// ==================== CONFIGURACIÓN DEL DASHBOARD ====================
//
// Pega aquí las URLs CSV publicadas de cada pestaña de tu Google Sheets
// "Timeless - Ventas e Inventario".
//
// Cómo obtener cada URL (una vez por pestaña):
//   1. Abre el Sheets → Archivo → Compartir → Publicar en la web
//   2. En el primer desplegable elige LA PESTAÑA (no "Todo el documento")
//   3. En el segundo elige "Valores separados por comas (.csv)"
//   4. Publicar → copia el enlace y pégalo abajo entre las comillas
//
// El enlace se ve así:
// https://docs.google.com/spreadsheets/d/e/2PACX-XXXX/pub?gid=123456&single=true&output=csv

const TIMELESS_CONFIG = {

  // Pestaña "Ventas" — una fila por MES: Mes, Ingresos, Ganancia neta
  CSV_VENTAS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTBRgF8Fuo4jQD-iur4ziP656jtllYGtp6aSN2Uv0Cn3bGZAs1qgq9VInR9w-8dv_ESSvG37G5euD5T/pub?gid=1119449104&single=true&output=csv',

  // Pestaña "Gastos" (la que llena tu app de gastos vía Apps Script)
  CSV_GASTOS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTBRgF8Fuo4jQD-iur4ziP656jtllYGtp6aSN2Uv0Cn3bGZAs1qgq9VInR9w-8dv_ESSvG37G5euD5T/pub?gid=484743647&single=true&output=csv',

  // Pestaña "Publicidad" (Semana, Plataforma, Gasto, Alcance, Ventas atrib., Ingreso est., ROAS)
  CSV_PUBLICIDAD: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTBRgF8Fuo4jQD-iur4ziP656jtllYGtp6aSN2Uv0Cn3bGZAs1qgq9VInR9w-8dv_ESSvG37G5euD5T/pub?gid=2102855848&single=true&output=csv',

  // Pestaña "Stocks" (Producto, Precio, Vendidos, Stock, Gan. bruta pos., Gan. neta pos., Invertido)
  CSV_STOCKS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTBRgF8Fuo4jQD-iur4ziP656jtllYGtp6aSN2Uv0Cn3bGZAs1qgq9VInR9w-8dv_ESSvG37G5euD5T/pub?gid=1602555219&single=true&output=csv',

  // Pestaña "Pendientes" (Producto, Cantidad, Invertido) — pedidos comprados que aún no llegan.
  // El dashboard "apaga" solo un pendiente cuando ese producto ya tiene stock > 0 en Stocks.
  CSV_PENDIENTES: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTBRgF8Fuo4jQD-iur4ziP656jtllYGtp6aSN2Uv0Cn3bGZAs1qgq9VInR9w-8dv_ESSvG37G5euD5T/pub?gid=1727096989&single=true&output=csv',

  // Pestaña "VentasDetalle" (Fecha, Producto, Venta, Utilidad) — cada venta con su fecha.
  // Alimenta "Más vendidos (últimos 30 días)" y la tabla de rentabilidad diaria de ads.
  CSV_VENTASDETALLE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTBRgF8Fuo4jQD-iur4ziP656jtllYGtp6aSN2Uv0Cn3bGZAs1qgq9VInR9w-8dv_ESSvG37G5euD5T/pub?gid=452915688&single=true&output=csv',

  // ¿Quieres ver el dashboard con datos de ejemplo antes de conectar tu Sheets?
  // Pon 'sample-data/ventas.csv', 'sample-data/gastos.csv',
  // 'sample-data/publicidad.csv' y 'sample-data/stocks.csv' en los campos de arriba.

  // Categorías que NUNCA se restan de la utilidad. 'Inversión' = compra de
  // mercadería: ya está descontada como "costo de productos" al vender, restarla
  // otra vez sería contar doble. Se muestra aparte como info (reinvertido).
  EXCLUIR_CATEGORIAS: ['Inversión'],

  // Categorías que cuentan como GASTO DE NEGOCIO (se restan en el modo "Negocio"
  // y también en "Todo"). El resto de categorías se consideran personales y solo
  // se restan en el modo "Todo". Comparación sin acentos/mayúsculas.
  // Nota: crea una categoría "Materiales timeless" en tu app para que tus
  // materiales cuenten como negocio (hoy los anotas dentro de "Otros").
  GASTOS_NEGOCIO: ['Ads', 'Materiales timeless', 'Materiales', 'Envios', 'Envíos'],
};
