import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).resolve().parent / "despax_local.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inicializa las tablas en la base de datos SQLite local."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_sku TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            talle TEXT DEFAULT 'U',
            color TEXT DEFAULT 'Negro',
            stock INTEGER DEFAULT 10,
            precio REAL DEFAULT 0.0
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS envios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nro_seguimiento TEXT UNIQUE NOT NULL,
            destinatario TEXT NOT NULL,
            direccion TEXT NOT NULL,
            items TEXT NOT NULL,
            estado TEXT DEFAULT 'Listo para despachar',
            creado_en TEXT NOT NULL
        );
    """)

    # Cargar datos de prueba si está vacía
    cursor.execute("SELECT COUNT(*) FROM productos")
    if cursor.fetchone()[0] == 0:
        productos_iniciales = [
            ("REM-NEG-S", "Remera Oversize Básica", "Remeras", "S", "Negro", 25, 14500.0),
            ("REM-NEG-M", "Remera Oversize Básica", "Remeras", "M", "Negro", 30, 14500.0),
            ("REM-BLA-L", "Remera Oversize Básica", "Remeras", "L", "Blanco", 18, 14500.0),
            ("BUZ-CAP-M", "Buzo Hoodie Canguro", "Abrigo", "M", "Gris", 12, 32000.0),
            ("BUZ-CAP-XL", "Buzo Hoodie Canguro", "Abrigo", "XL", "Negro", 8, 32000.0),
            ("PAN-CAR-32", "Pantalón Cargo Urbano", "Pantalones", "32", "Beige", 15, 28000.0),
            ("GOR-TRU-U", "Gorra Trucker Bordada", "Accesorios", "U", "Azul", 40, 9500.0),
        ]
        cursor.executemany("""
            INSERT INTO productos (codigo_sku, nombre, categoria, talle, color, stock, precio)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, productos_iniciales)

    cursor.execute("SELECT COUNT(*) FROM envios")
    if cursor.fetchone()[0] == 0:
        envios_iniciales = [
            ("OCA-892341", "Martín Gómez", "Av. Santa Fe 2341, CABA", "1x REM-NEG-M, 1x GOR-TRU-U", "Despachado", datetime.now().strftime("%Y-%m-%d %H:%M")),
            ("AND-441209", "Lucía Fernández", "Calle 50 N° 842, La Plata", "1x BUZ-CAP-M", "Listo para despachar", datetime.now().strftime("%Y-%m-%d %H:%M")),
            ("TN-991823", "Alejandro Pérez", "Bv. Oroño 1240, Rosario", "2x REM-BLA-L, 1x PAN-CAR-32", "Pendiente etiquetado", datetime.now().strftime("%Y-%m-%d %H:%M")),
        ]
        cursor.executemany("""
            INSERT INTO envios (nro_seguimiento, destinatario, direccion, items, estado, creado_en)
            VALUES (?, ?, ?, ?, ?, ?)
        """, envios_iniciales)

    conn.commit()
    conn.close()

def listar_productos():
    conn = get_db()
    productos = conn.execute("SELECT * FROM productos ORDER BY categoria, nombre").fetchall()
    conn.close()
    return [dict(p) for p in productos]

def agregar_producto(sku, nombre, categoria, talle, color, stock, precio):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO productos (codigo_sku, nombre, categoria, talle, color, stock, precio)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (sku.strip().upper(), nombre.strip(), categoria.strip(), talle.strip().upper(), color.strip(), stock, precio))
    conn.commit()
    conn.close()

def listar_envios():
    conn = get_db()
    envios = conn.execute("SELECT * FROM envios ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(e) for e in envios]

def registrar_envio(nro_seguimiento, destinatario, direccion, items, estado="Listo para despachar"):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO envios (nro_seguimiento, destinatario, direccion, items, estado, creado_en)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (nro_seguimiento.strip(), destinatario.strip(), direccion.strip(), items.strip(), estado, datetime.now().strftime("%Y-%m-%d %H:%M")))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("[OK] Base de datos despax_local.db creada e inicializada.")
