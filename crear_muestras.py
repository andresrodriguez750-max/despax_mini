import sys
from pathlib import Path
from database import init_db
from pdf_processor import asegurar_muestras_pdf

def main():
    print("=========================================")
    print(" INICIALIZANDO PROYECTO DESPAX MINI")
    print("=========================================")
    print("[1/2] Creando base de datos SQLite local...")
    init_db()
    print("      Base de datos inicializada con éxito.")

    print("[2/2] Generando PDFs de prueba en muestras_pdf/...")
    archivos = asegurar_muestras_pdf()
    for f in archivos:
        print(f"      - {f.name} ({f.stat().st_size} bytes)")

    print("\n[LISTO] Todo configurado correctamente.")
    print("Para iniciar el servidor web corre:")
    print("    python app.py")
    print("=========================================")

if __name__ == "__main__":
    main()
