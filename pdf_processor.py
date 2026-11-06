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
    """Genera una etiqueta de despacho de prueba estilo OCA."""
    c = canvas.Canvas(str(ruta_destino), pagesize=(283, 425))
    w, h = 283, 425

    # Marco
    c.setStrokeColor(colors.HexColor("#780016"))
    c.setLineWidth(3)
    c.rect(10, 10, w - 20, h - 20)

    # Logo / Header OCA
    c.setFillColor(colors.HexColor("#A3001E"))
    c.rect(10, h - 45, w - 20, 35, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(25, h - 30, "OCA EXPRESS PAK")

    # Tracking
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20, h - 65, "N° GUÍA: OCA-892341")

    # Simulación de código de barras
    bar_x = 25
    import random
    random.seed(99)
    for _ in range(42):
        c.setLineWidth(random.choice([1, 2, 4]))
        c.line(bar_x, h - 75, bar_x, h - 110)
        bar_x += random.choice([4, 5])

    c.setStrokeColor(colors.black)
    c.setLineWidth(1)
    c.line(10, h - 120, w - 10, h - 120)

    # Remitente
    c.setFont("Helvetica-Bold", 8)
    c.drawString(20, h - 135, "REMITENTE: Despax E-Commerce Indumentaria")
    c.setFont("Helvetica", 8)
    c.drawString(20, h - 147, "Palermo Soho, CABA (CP 1414)")

    c.line(10, h - 157, w - 10, h - 157)

    # Destino
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20, h - 175, "ENTREGAR A:")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20, h - 192, "Martín Gómez")
    c.setFont("Helvetica", 10)
    c.drawString(20, h - 208, "Av. Santa Fe 2341 - 2do A")
    c.drawString(20, h - 223, "CABA, Capital Federal (CP 1123)")

    c.line(10, h - 235, w - 10, h - 235)

    # Items
    c.setFont("Helvetica-Bold", 9)
    c.drawString(20, h - 252, "ITEMS DECLARADOS:")
    c.setFont("Helvetica", 9)
    c.drawString(25, h - 270, "- 1x REM-NEG-M (Remera Oversize Negra M)")
    c.drawString(25, h - 286, "- 1x GOR-TRU-U (Gorra Trucker Azul)")

    c.rect(15, 30, w - 30, 45)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(w / 2, 58, "CONTROL DE CALIDAD: OK")
    c.setFont("Helvetica", 8)
    c.drawCentredString(w / 2, 40, "Paquete verificado en depósito")

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
