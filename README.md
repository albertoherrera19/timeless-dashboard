# Timeless — Dashboard

Panel del negocio de Timeless Store: **ventas, inventario, gastos y publicidad**
en una sola pantalla. PWA instalable, misma estética que la app de gastos.

## Qué muestra

1. **Utilidad del mes** — Ventas − Gastos (app de gastos) − Costo de lo vendido.
2. **ROAS** — gasto en ads vs ingreso estimado, global y por semana.
3. **Proyección** — cuánto llevas ganado este mes vs el techo si vendes todo el stock.
4. **Mes a mes** — utilidad neta por mes en barras.
5. **Top productos** — ordenados por ganancia potencial en stock.

## De dónde salen los datos

Del Google Sheets **"Timeless - Ventas e Inventario"**, leyendo los CSV publicados
de las pestañas `Ventas`, `Gastos`, `Publicidad` y `Stocks`. Sin OAuth ni backend:
solo URLs de "Publicar en la web". Se configuran en [`config.js`](config.js) —
las instrucciones están en ese mismo archivo.

- El botón **↻** recarga los datos (Google cachea el CSV publicado ~5 min, así que
  un cambio recién hecho en el Sheets puede tardar unos minutos en verse).
- Sin internet, muestra el último snapshot guardado en el teléfono.
- Con `config.js` vacío muestra datos de ejemplo apuntando a `sample-data/`.

## Publicación

GitHub Pages con el workflow de `.github/workflows/deploy.yml` (igual que
`mis-gastos-timeless`): cada push a `main` publica automáticamente.
