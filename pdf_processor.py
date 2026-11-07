from pathlib import Path
from reportlab.lib.pagesizes import letter, A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
import pypdf
import io

BASE_DIR = Path(__file__).resolve().parent
MUESTRAS_DIR = BASE_DIR / "muestras_pdf"

def generar_pdf_tiendanube(ruta_destino: Path):
    """Genera una etiqueta de despacho de prueba estilo Tiendanube (10x15cm aprox o media carta)."""
    # 283 x 425 pt ~ 10cm x 15cm
    c = canvas.Canvas(str(ruta_destino), pagesize=(283, 425))
    w, h = 283, 425

    # Marco exterior
    c.setStrokeColor(colors.black)
    c.setLineWidth(2)
    c.rect(10, 10, w - 20, h - 20)

    # Encabezado
    c.setFillColor(colors.HexColor("#2B3A42"))
    c.rect(10, h - 50, w - 20, 40, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(w / 2, h - 35, "TIENDANUBE ENVIOS")

    # Tracking & Código de barras visual
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20, h - 75, "Seguimiento: TN-991823")
    c.setFont("Helvetica", 9)
    c.drawString(20, h - 90, "Servicio: Envío a Domicilio Estándar")

    # Simulación gráfica de código de barras
    c.setLineWidth(1)
    bar_x = 25
    import random
    random.seed(42)
    for _ in range(40):
        c.setLineWidth(random.choice([1, 2, 3]))
        c.line(bar_x, h - 100, bar_x, h - 135)
        bar_x += random.choice([4, 6])

    c.line(10, h - 145, w - 10, h - 145)

    # Datos del Destinatario
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20, h - 165, "DESTINATARIO:")
    c.setFont("Helvetica", 10)
    c.drawString(20, h - 180, "Alejandro Pérez")
    c.drawString(20, h - 195, "Bv. Oroño 1240 - Piso 4 B")
    c.drawString(20, h - 210, "Rosario, Santa Fe (CP 2000)")
    c.drawString(20, h - 225, "Tel: +54 341 555-8910")

    c.line(10, h - 235, w - 10, h - 235)

    # Detalle de Productos
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20, h - 255, "CONTENIDO DEL PAQUETE:")
    c.setFont("Helvetica", 9)
    c.drawString(25, h - 275, "• 2x REM-BLA-L (Remera Oversize Blanco L)")
    c.drawString(25, h - 292, "• 1x PAN-CAR-32 (Pantalón Cargo Beige 32)")

    # Pie de etiqueta
    c.setStrokeColor(colors.gray)
    c.line(10, 60, w - 10, 60)
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(colors.darkgray)
    c.drawString(20, 45, "Despax Logistics Mini - Validación automática")
    c.drawString(20, 30, "Fecha emisión: 2026-11-06 | Operador: Local")

    c.save()

def generar_pdf_oca(ruta_destino: Path):
    """
    Genera una etiqueta/comanda de despacho de OCA e-Pak oficial con su estructura real:
    - Encabezado violeta OCA Pak con código OR y número de operación.
    - Guía de 19 dígitos (9380100000000000507-1) con código de barras Code 128.
    - Cuadrícula: DOC. CLIENTE (orden 11225), BULTO (1/1), OPERATIVA (471048), PESO (1,85 kg).
    - Código de planta destino (A-PQC-D15P) y tipo de servicio (Domicilio).
    - Datos completos de destinatario y remitente.
    - Comanda de contenido declarado de prendas vinculadas al catálogo local.
    - Código QR de trazabilidad logística OCA.
    """
    # 283 x 480 pt (formato térmico estándar 10x17 cm aprox)
    w, h = 283, 480
    c = canvas.Canvas(str(ruta_destino), pagesize=(w, h))

    # Marco exterior
    c.setStrokeColor(colors.black)
    c.setLineWidth(1.5)
    c.rect(8, 8, w - 16, h - 16)

    # 1. HEADER OFICIAL OCA (Violeta Institucional #2E1461)
    c.setFillColor(colors.HexColor("#2E1461"))
    c.rect(8, h - 50, 115, 42, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(18, h - 33, "OCA Pak")

    # Recuadro "OR" (Origen Retiro / Puerta a Puerta)
    c.setFillColor(colors.HexColor("#E2E8F0"))
    c.rect(123, h - 50, 42, 42, fill=True, stroke=False)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(144, h - 33, "OR")

    # Número de operación OCA destacado
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(w - 16, h - 33, "148526656")

    c.setStrokeColor(colors.black)
    c.setLineWidth(1)
    c.line(8, h - 50, w - 8, h - 50)

    # 2. GUÍA OCA Y CÓDIGO DE BARRAS
    c.setFont("Helvetica-Bold", 10)
    c.drawString(16, h - 68, "GUIA: 9380100000000000507-1")

    # Simulación gráfica precisa de barras Code 128
    bar_x = 18
    import random
    random.seed(11225)
    for _ in range(48):
        bw = random.choice([1, 1.5, 2, 3])
        c.setLineWidth(bw)
        c.line(bar_x, h - 76, bar_x, h - 108)
        bar_x += random.choice([3.5, 5, 6])
        if bar_x > w - 24:
            break

    c.line(8, h - 114, w - 8, h - 114)

    # 3. CUADRÍCULA OCA: DOC CLIENTE | BULTO | OPERATIVA | PESO
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(14, h - 126, "DOC. CLIENTE")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(14, h - 140, "11225")

    c.line(85, h - 114, 85, h - 146)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(92, h - 126, "BULTO")
    c.setFont("Helvetica", 10)
    c.drawString(98, h - 140, "1/1")

    c.line(145, h - 114, 145, h - 146)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(152, h - 126, "OPERATIVA")
    c.setFont("Helvetica", 10)
    c.drawString(155, h - 140, "471048")

    c.line(215, h - 114, 215, h - 146)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(222, h - 126, "PESO")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(222, h - 140, "1.85 kg")

    c.line(8, h - 146, w - 8, h - 146)

    # 4. SUCURSAL / PLANTA DESTINO
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(14, h - 158, "PLANTA / SUCURSAL DESTINO:")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(140, h - 160, "A-PQC-D15P")
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(14, h - 172, "SERVICIO: DOMICILIO DEL DESTINATARIO (ESTÁNDAR)")

    c.line(8, h - 178, w - 8, h - 178)

    # 5. DESTINATARIO
    c.setFont("Helvetica-Bold", 8)
    c.drawString(14, h - 190, "ENTREGAR A (DESTINATARIO):")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(14, h - 204, "María Cevallos")
    c.setFont("Helvetica", 9)
    c.drawString(14, h - 217, "Av. Álvarez Thomas 1440 - Piso 3 Dpto B")
    c.drawString(14, h - 230, "Capital Federal, CABA (CP 1427)")
    c.drawString(14, h - 243, "Tel: +54 9 11 5897-9758")

    c.line(8, h - 250, w - 8, h - 250)

    # 6. REMITENTE
    c.setFont("Helvetica-Bold", 8)
    c.drawString(14, h - 262, "REMITENTE:")
    c.setFont("Helvetica", 8)
    c.drawString(14, h - 273, "Despax E-Commerce Indumentaria SRL - CUIT: 30-71882941-4")
    c.drawString(14, h - 284, "Sucursal Origen: VSF (Villa Santa Rita / Flores)")

    c.line(8, h - 292, w - 8, h - 292)

    # 7. COMANDA / DETALLE DE CONTENIDO DECLARADO (PICKING DE PRENDAS)
    c.setFillColor(colors.HexColor("#F8FAFC"))
    c.rect(8, h - 410, w - 16, 118, fill=True, stroke=False)
    c.setFillColor(colors.black)

    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(14, h - 305, "COMANDA DE PREPARACIÓN / CONTENIDO DECLARADO:")
    c.setFont("Helvetica", 8)
    c.drawString(18, h - 322, "• 1x REM-NEG-M — Remera Oversize Básica (Negro M)")
    c.drawString(18, h - 337, "• 1x BUZ-CAP-M — Buzo Hoodie Canguro (Gris M)")
    c.drawString(18, h - 352, "• 1x GOR-TRU-U — Gorra Trucker Bordada (Azul Único)")
    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillColor(colors.darkgray)
    c.drawString(18, h - 370, "Orden vinculada: #11225 Tiendanube | Embalaje: Bolsa de seguridad")

    # QR Simulador
    c.setStrokeColor(colors.black)
    c.setLineWidth(1)
    c.rect(w - 75, h - 402, 60, 60, fill=False)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(w - 45, h - 372, "OCA QR")
    c.setFont("Helvetica", 6)
    c.drawCentredString(w - 45, h - 382, "TRAZABILIDAD")

    # 8. PIE DE CONTROL
    c.setFillColor(colors.black)
    c.line(8, 45, w - 8, 45)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(14, 30, "CONTROL DE CALIDAD: VERIFICADO")
    c.setFont("Helvetica", 7)
    c.drawString(14, 18, "Firma del receptor: _______________________ DNI: __________________")

    c.save()

def generar_pdf_comanda(ruta_destino: Path):
    """Genera una comanda / hoja de picking de preparación A4."""
    c = canvas.Canvas(str(ruta_destino), pagesize=A4)
    w, h = A4

    # Cabecera
    c.setFillColor(colors.HexColor("#1E293B"))
    c.rect(30, h - 70, w - 60, 50, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(45, h - 45, "DESPAX - COMANDA DE PICKING Y EMPAQUE")
    c.setFont("Helvetica", 10)
    c.drawString(45, h - 60, "Hoja de ruta para preparación de pedidos en depósito")

    # Info pedido
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, h - 95, "Orden de Picking: #2026-0042")
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 110, "Cliente: Lucía Fernández")
    c.drawString(40, h - 125, "Destino: Calle 50 N° 842, La Plata (CP 1900)")
    c.drawString(40, h - 140, "Logística: Andreani (Código: AND-441209)")

    # Tabla de productos a recolectar
    c.line(30, h - 155, w - 30, h - 155)
    c.setFillColor(colors.HexColor("#F1F5F9"))
    c.rect(30, h - 185, w - 60, 25, fill=True, stroke=False)

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(45, h - 173, "SKU")
    c.drawString(140, h - 173, "DESCRIPCIÓN")
    c.drawString(330, h - 173, "TALLE")
    c.drawString(400, h - 173, "COLOR")
    c.drawString(470, h - 173, "CANTIDAD")
    c.drawString(535, h - 173, "CHECK")

    c.setFont("Helvetica", 10)
    items = [
        ("BUZ-CAP-M", "Buzo Hoodie Canguro", "M", "Gris", "1 unid."),
        ("REM-NEG-S", "Remera Oversize Básica", "S", "Negro", "2 unid."),
        ("GOR-TRU-U", "Gorra Trucker Bordada", "U", "Azul", "1 unid."),
    ]
    y = h - 210
    for sku, desc, tal, col, cant in items:
        c.drawString(45, y, sku)
        c.drawString(140, y, desc)
        c.drawString(330, y, tal)
        c.drawString(400, y, col)
        c.drawString(470, y, cant)
        c.rect(540, y - 2, 12, 12)  # Cuadro para tildar a mano
        c.line(30, y - 10, w - 30, y - 10)
        y -= 30

    # Instrucciones
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y - 20, "Instrucciones de empaque:")
    c.setFont("Helvetica", 9)
    c.drawString(40, y - 35, "1. Colocar las prendas dobladas en bolsa de polietileno con cierre adhesivo.")
    c.drawString(40, y - 50, "2. Incluir tarjeta de agradecimiento y sticker oficial.")
    c.drawString(40, y - 65, "3. Pegar etiqueta térmica de transporte en el frente sin tapar códigos de barras.")

    c.save()

def asegurar_muestras_pdf():
    """Genera los 3 PDFs de prueba si no existen en muestras_pdf/."""
    MUESTRAS_DIR.mkdir(parents=True, exist_ok=True)
    p1 = MUESTRAS_DIR / "etiqueta_tiendanube_ejemplo.pdf"
    p2 = MUESTRAS_DIR / "etiqueta_oca_ejemplo.pdf"
    p3 = MUESTRAS_DIR / "comanda_despacho_ejemplo.pdf"

    if not p1.exists():
        generar_pdf_tiendanube(p1)
    if not p2.exists():
        generar_pdf_oca(p2)
    if not p3.exists():
        generar_pdf_comanda(p3)

    return [p1, p2, p3]

def anotar_pdf(pdf_bytes_in: bytes, texto_estampa="DESPACHADO - SISTEMA DESPAX") -> bytes:
    """Toma un PDF en memoria, le añade un sello/anotación con reportlab y devuelve el PDF procesado."""
    writer = pypdf.PdfWriter(clone_from=io.BytesIO(pdf_bytes_in))

    for page in writer.pages:
        page_width = float(page.mediabox.width)
        page_height = float(page.mediabox.height)

        # Generar capa de anotación (overlay)
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page_width, page_height))
        
        # Sello en esquina superior derecha
        can.setFillColor(colors.HexColor("#10B981"))  # Verde esmeralda
        can.roundRect(page_width - 170, page_height - 35, 160, 25, 4, fill=True, stroke=False)
        can.setFillColor(colors.white)
        can.setFont("Helvetica-Bold", 8)
        can.drawCentredString(page_width - 90, page_height - 24, "✓ " + texto_estampa[:28])
        can.save()

        packet.seek(0)
        overlay_pdf = pypdf.PdfReader(packet)
        overlay_page = overlay_pdf.pages[0]

        # Fusionar directamente en la página asignada al writer
        page.merge_page(overlay_page)

    output_stream = io.BytesIO()
    writer.write(output_stream)
    return output_stream.getvalue()

def extraer_texto_pdf(pdf_path_or_bytes) -> str:
    """Extrae el contenido de texto de un PDF."""
    if isinstance(pdf_path_or_bytes, (str, Path)):
        reader = pypdf.PdfReader(str(pdf_path_or_bytes))
    else:
        reader = pypdf.PdfReader(io.BytesIO(pdf_path_or_bytes))
    
    text = ""
    for idx, page in enumerate(reader.pages):
        text += f"--- PÁGINA {idx + 1} ---\n"
        text += (page.extract_text() or "") + "\n\n"
    return text.strip()
