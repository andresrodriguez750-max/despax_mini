import os
import io
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory, redirect, url_for
from database import init_db, listar_productos, agregar_producto, listar_envios, registrar_envio
from pdf_processor import asegurar_muestras_pdf, anotar_pdf, extraer_texto_pdf, MUESTRAS_DIR
import pypdf

app = Flask(__name__)
app.config['SECRET_KEY'] = 'despax-mini-secret-key-2026'

# Asegurar que la BD y los PDFs de prueba existan al arrancar
init_db()
asegurar_muestras_pdf()

@app.route("/")
def index():
    productos = listar_productos()
    envios = listar_envios()
    
    # Listar PDFs de prueba disponibles
    muestras = []
    if MUESTRAS_DIR.exists():
        for f in MUESTRAS_DIR.glob("*.pdf"):
            muestras.append({
                "nombre": f.name,
                "tamanio_kb": round(f.stat().st_size / 1024, 1),
                "url": f"/muestras/{f.name}"
            })
            
    return render_template("index.html", productos=productos, envios=envios, muestras=muestras)

@app.route("/muestras/<path:filename>")
def descargar_muestra(filename):
    """Permite ver o descargar cualquiera de los PDFs de prueba generados."""
    return send_from_directory(MUESTRAS_DIR, filename, as_attachment=False)

@app.route("/api/productos", methods=["POST"])
def crear_producto():
    """Agrega un nuevo producto al catálogo en SQLite."""
    data = request.form
    sku = data.get("sku", "").strip().upper()
    nombre = data.get("nombre", "").strip()
    categoria = data.get("categoria", "General").strip()
    talle = data.get("talle", "U").strip()
    color = data.get("color", "Único").strip()
    stock = int(data.get("stock", 0) or 0)
    precio = float(data.get("precio", 0.0) or 0.0)

    if not sku or not nombre:
        return jsonify({"error": "SKU y Nombre son obligatorios"}), 400

    try:
        agregar_producto(sku, nombre, categoria, talle, color, stock, precio)
        return redirect(url_for('index'))
    except Exception as e:
        return jsonify({"error": f"No se pudo guardar el producto: {e}"}), 500

@app.route("/api/envios", methods=["POST"])
def crear_envio():
    """Registra un nuevo envío en la base de datos."""
    data = request.form
    nro_seguimiento = data.get("nro_seguimiento", "").strip()
    destinatario = data.get("destinatario", "").strip()
    direccion = data.get("direccion", "").strip()
    items = data.get("items", "").strip()

    if not nro_seguimiento or not destinatario:
        return jsonify({"error": "N° Seguimiento y Destinatario son obligatorios"}), 400

    registrar_envio(nro_seguimiento, destinatario, direccion, items)
    return redirect(url_for('index'))

@app.route("/procesar_pdf", methods=["POST"])
def procesar_pdf():
    """
    Recibe un PDF subido o el nombre de una muestra existente,
    extrae el texto y genera una versión sellada/anotada lista para imprimir.
    """
    archivo = request.files.get("archivo_pdf")
    muestra_nombre = request.form.get("muestra_seleccionada")

    pdf_bytes = None
    nombre_salida = "etiquetas_anotadas.pdf"

    if archivo and archivo.filename != "":
        pdf_bytes = archivo.read()
        nombre_salida = f"anotado_{archivo.filename}"
    elif muestra_nombre:
        ruta_muestra = MUESTRAS_DIR / muestra_nombre
        if ruta_muestra.exists():
            pdf_bytes = ruta_muestra.read_bytes()
            nombre_salida = f"anotado_{muestra_nombre}"

    if not pdf_bytes:
        return "Por favor subí un archivo PDF o seleccioná una muestra.", 400

    # Anotar / estampar con sello Despax
    pdf_resultado = anotar_pdf(pdf_bytes, texto_estampa="DESPAX VERIFICADO")

    return send_file(
        io.BytesIO(pdf_resultado),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=nombre_salida
    )

@app.route("/api/diagnostico", methods=["POST"])
def api_diagnostico():
    """Inspecciona un PDF y devuelve métricas: páginas, transportistas detectados y texto."""
    archivo = request.files.get("archivo_pdf")
    muestra_nombre = request.form.get("muestra_seleccionada")

    pdf_bytes = None
    nombre = "archivo.pdf"

    if archivo and archivo.filename != "":
        pdf_bytes = archivo.read()
        nombre = archivo.filename
    elif muestra_nombre:
        ruta_muestra = MUESTRAS_DIR / muestra_nombre
        if ruta_muestra.exists():
            pdf_bytes = ruta_muestra.read_bytes()
            nombre = muestra_nombre

    if not pdf_bytes:
        return jsonify({"error": "No se recibió archivo PDF"}), 400

    try:
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        num_paginas = len(reader.pages)
        texto_completo = ""
        for p in reader.pages:
            texto_completo += (p.extract_text() or "") + " "

        transportistas = []
        texto_lower = texto_completo.lower()
        if "tiendanube" in texto_lower or "tn-" in texto_lower:
            transportistas.append("Tiendanube Envíos")
        if "oca" in texto_lower:
            transportistas.append("OCA Express Pak")
        if "andreani" in texto_lower or "and-" in texto_lower:
            transportistas.append("Andreani")
        if not transportistas:
            transportistas.append("Estándar / Genérico")

        # Detectar órdenes o SKUs
        import re
        ordenes_match = re.findall(r'(TN-\d+|OCA-\d+|AND-\d+|#\d+)', texto_completo)
        ordenes = list(set(ordenes_match))

        return jsonify({
            "ok": True,
            "nombre": nombre,
            "paginas": num_paginas,
            "transportistas": ", ".join(transportistas),
            "ordenes": ordenes,
            "ordenes_count": len(ordenes),
            "tamano_hoja": f"{int(float(reader.pages[0].mediabox.width))} x {int(float(reader.pages[0].mediabox.height))} pt"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/extraer_texto", methods=["POST"])
def api_extraer_texto():
    """Endpoint API para inspeccionar el texto extraído de un PDF."""
    muestra_nombre = request.json.get("muestra") if request.is_json else None
    if not muestra_nombre:
        return jsonify({"error": "Falta parámetro 'muestra'"}), 400
        
    ruta = MUESTRAS_DIR / muestra_nombre
    if not ruta.exists():
        return jsonify({"error": "Archivo no encontrado"}), 404
        
    texto = extraer_texto_pdf(ruta)
    return jsonify({"nombre": muestra_nombre, "texto": texto})

if __name__ == "__main__":
    print("\n-----------------------------------------------------------")
    print(" SERVIDOR DESPAX MINI INICIADO")
    print(" Accedé en tu navegador a: http://127.0.0.1:5000")
    print(" Presioná Ctrl + C para detener el servidor.")
    print("-----------------------------------------------------------\n")
    app.run(host="127.0.0.1", port=5000, debug=True)
