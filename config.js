// ==================== CONFIGURACIÓN DEL DASHBOARD ====================
//
// Todos los datos del Sheets "Timeless - Ventas e Inventario" se leen por el
// Apps Script (WEBHOOK_URL, con la clave de cada aparato). Hasta el
// 17-oct-2026 también se leían de CSV publicados en la web; esos CSV dejaban
// ver costos y gastos a cualquiera con el enlace, así que se despublicaron y
// sus direcciones se borraron de aquí. NO volver a publicarlos.

const TIMELESS_CONFIG = {

  // URL /exec de tu Apps Script. La usa la sección "Accesorios para traer"
  // para guardar/borrar bloques de compra y subir fotos directo desde el
  // dashboard (a diferencia de las demás pestañas, que son solo lectura).
  WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbyrBdHPotM_u1YiXfc3glhlz3aIZM6_GYsPxl4YLFAQeUpzla17j5YGRspCkd7cRix_/exec',

  // Categorías que NUNCA se restan de la utilidad. 'Inversión' = compra de
  // mercadería: ya está descontada como "costo de productos" al vender, restarla
  // otra vez sería contar doble. Se muestra aparte como info (reinvertido).
  EXCLUIR_CATEGORIAS: ['Inversión'],

  // Categorías que cuentan como GASTO DE NEGOCIO (se restan en el modo "Negocio"
  // y también en "Todo"). El resto se consideran personales (solo se restan en
  // "Todo"). Comparación sin acentos/mayúsculas; además, cualquier categoría que
  // empiece por "materiales" cuenta como negocio (ver esNegocio en app.js).
  // Pasajes va como PERSONAL (los envíos los paga el cliente, no es costo tuyo).
  // "Canjes" = colaboraciones donde regalas producto a cambio de promoción.
  // "Reposición" = repones producto gratis por un problema de calidad/garantía
  // (distinto de Canjes para poder ver aparte cuánto se va por cada motivo,
  // pero cuenta igual como negocio y resta igual de "Pedidos por llegar" —
  // ver CANJE_CATEGORIAS en app.js).
  GASTOS_NEGOCIO: ['Ads', 'Materiales timeless', 'Canjes', 'Reposición'],
};
