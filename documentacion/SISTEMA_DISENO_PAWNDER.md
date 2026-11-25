# SISTEMA DE DISEÑO PAWNDER — GUÍA VISUAL Y TOKENS

Este documento define la especificación completa del sistema de diseño para **PAWNDER**, alineado con los requerimientos visuales:
- **Verde Menta Principal:** `#75D6B3` (fresco, empático, juvenil)
- **Verde Oscuro Textos/Contrastes:** `#134e3f` / `#1b4332`
- **Fondos cálidos y limpios:** `#faf8f5` (Warm Cream), `#ffffff` (Pure Surface)
- **Acentos y Alertas:**
  - Ámbar Cálido: `#f59e0b`
  - Emergencia/Alerta Rescate: `#ef4444` (con contención de uso exclusivo para urgencias)
  - Acento Mascota/Comunidad: `#10b981` / `#75D6B3`
- **Eliminación total de conceptos Pokémon/Pokédex:** Sistema propio de identificación "Ficha Pawnder" con código de registro, microchips de salud y estado en vivo.

---

## 1. Design Tokens (CSS Variables)

```scss
:root:root {
  color-scheme: light;
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  /* Fondos y superficies */
  --pw-bg-page: #faf8f5;
  --pw-bg-surface: #ffffff;
  --pw-bg-subtle: #f2ede4;
  --pw-bg-mint-soft: #eafaf4;
  
  /* Textos */
  --pw-text-primary: #172a24;
  --pw-text-secondary: #4b6358;
  --pw-text-muted: #7d968b;
  --pw-text-contrast: #ffffff;

  /* Colores de Marca */
  --pw-primary: #75D6B3;
  --pw-primary-dark: #134e3f;
  --pw-primary-shade: #5bbd9b;
  --pw-primary-tint: #9ee6cd;
  
  /* Estados de Emergencia y Comunidad */
  --pw-pet-color: #2ec4b6;
  --pw-warning-color: #f59e0b;
  --pw-danger-color: #ef4444;

  /* Elevaciones & Radios */
  --pw-radius-sm: 10px;
  --pw-radius-md: 16px;
  --pw-radius-lg: 24px;
  --pw-radius-pill: 9999px;

  --pw-shadow-card: 0 4px 18px -2px rgba(19, 78, 63, 0.07), 0 2px 6px -1px rgba(0, 0, 0, 0.03);
  --pw-shadow-hover: 0 10px 25px -4px rgba(19, 78, 63, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.04);
  --pw-shadow-pill: 0 2px 8px rgba(19, 78, 63, 0.08);

  /* Form controls */
  --pw-field-border: #d4e5de;
  --pw-field-border-focus: #75D6B3;
}
```

---

## 2. Componentes Clave Rediseñados

1. **Tarjetas de Perros (ReportCard & Detail):**
   - Fotografía con bordes suaves, relación de aspecto optimizada y badges flotantes estilizados en cápsula.
   - Tag de identificación único `PAW-XXXX`.
   - Chip de sector y tiempo con iconografía amigable.
   - Micro-indicador de clima y avatar del creador en círculo pulido con feedback háptico visual al pulsar.

2. **Menú Principal (Main Menu):**
   - Hero dinámico con saludo al usuario y avatar con anillo menta.
   - Tarjetas bento redondeadas con gradientes suaves en tonos crema y menta, micro-etiquetas "En vivo", "+ Registro" y "Directorio".

3. **Feed y Filtros (Home):**
   - Segmentos limpios con indicador menta para "Todos", "Mascotas" y píldora roja suave para "Urgencias".
   - Buscador integrado con sombra sutil y modal de filtros con selectores visuales.

4. **Autenticación (Login & Register):**
   - Hero cálido y acogedor con logo de Pawnder.
   - Formulario limpio, campos contorneados con foco menta, botón principal sólido y botón de registro secundario claro.

5. **Mapa de Perros (MapView & CityMap):**
   - Barra superior estilizada con filtro de segmentos.
   - Pines personalizados con animación suave de pulso para emergencias.
   - FAB flotantes ergonómicos para recentrado y reporte rápido.
