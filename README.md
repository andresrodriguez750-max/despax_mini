# Despax Mini — Gestor de Envíos y Procesador de Rótulos PDF

Una versión simplificada, limpia y autosuficiente de la plataforma de logística **Despax**. Diseñada con arquitectura en capas clara, conexión a base de datos SQLite local y generación/procesamiento de documentos PDF vectoriales.

---

## 📁 Estructura del Proyecto

```text
despax_mini/
├── app.py                  # Servidor web Flask y endpoints de la aplicación
├── database.py             # Capa de datos con SQLite (tablas productos y envios)
├── pdf_processor.py        # Generador y procesador de PDFs (reportlab + pypdf)
├── crear_muestras.py       # Script de inicialización y generación de muestras
├── despax_local.db         # Base de datos SQLite local (autogenerada)
├── requirements.txt        # Dependencias mínimas
├── muestras_pdf/           # Carpeta con PDFs de prueba listos para usar
│   ├── etiqueta_tiendanube_ejemplo.pdf
│   ├── etiqueta_oca_ejemplo.pdf
│   └── comanda_despacho_ejemplo.pdf
└── templates/
    └── index.html          # Panel web interactivo para gestión y sellado de PDFs
```

---

## 🚀 Cómo Ejecutarlo

1. Abrí una terminal PowerShell o CMD en la carpeta del proyecto:
   ```powershell
   cd C:\Users\Alumno\Downloads\despax_mini
   ```

2. Ejecutá el servidor web:
   ```powershell
   python app.py
   ```

3. Abrí en tu navegador web:
   👉 **http://127.0.0.1:5000**

---

## 🌟 Qué incluye este proyecto básico

1. **Base de Datos SQLite Local (`despax_local.db`):**
   - Tabla `productos`: código SKU, descripción, talle, color, stock y precio.
   - Tabla `envios`: número de seguimiento/tracking, destinatario, dirección y lista de items.
   - Precargada con datos de muestra realistas y formulario web para agregar nuevos registros al instante.

2. **3 PDFs de Prueba Listos para Usar (`muestras_pdf/`):**
   - `etiqueta_tiendanube_ejemplo.pdf`: Etiqueta térmica 10x15 con tracking `TN-991823`, código de barras y datos del comprador.
   - `etiqueta_oca_ejemplo.pdf`: Rótulo de logística tipo OCA Express Pak con tracking `OCA-892341`.
   - `comanda_despacho_ejemplo.pdf`: Comanda de picking A4 para preparación en depósito con checkboxes de control.

3. **Procesador de PDFs con Sellado Automático:**
   - Permite visualizar los PDFs originales en el navegador.
   - **Extraer texto:** Lee las capas internas de texto con `pypdf`.
   - **Sellar / Anotar:** Superpone un sello vectorial de control *"✓ DESPAX VERIFICADO"* mediante `reportlab` y descarga el PDF final listo para imprimir.
   - Soporte para subir cualquier archivo PDF propio desde tu computadora.
