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

  // Pestaña "Ventas" (Fecha, Producto, Cantidad, Precio unit., Total, Costo unit., Ganancia)
  CSV_VENTAS: '',

  // Pestaña "Gastos" (la que llena tu app de gastos vía Apps Script)
  CSV_GASTOS: '',

  // Pestaña "Publicidad" (Semana, Plataforma, Gasto, Alcance, Ventas atrib., Ingreso est., ROAS)
  CSV_PUBLICIDAD: '',

  // Pestaña "Stocks" (la automática con fórmulas)
  CSV_STOCKS: '',

  // ¿Quieres ver el dashboard con datos de ejemplo antes de conectar tu Sheets?
  // Pon 'sample-data/ventas.csv', 'sample-data/gastos.csv',
  // 'sample-data/publicidad.csv' y 'sample-data/stocks.csv' en los campos de arriba.

  // Categorías de tu app de gastos que NO se restan en la "utilidad del mes".
  // 'Inversión' va excluida por defecto: la compra de mercadería ya se descuenta
  // como "costo de productos vendidos" al momento de vender — si también se
  // restara como gasto, se contaría DOS veces. Ajusta la lista si quieres.
  EXCLUIR_CATEGORIAS: ['Inversión'],
};
