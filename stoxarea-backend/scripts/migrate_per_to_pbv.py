import sys
import os

# Tambahkan path root backend agar app dapat di-import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from sqlalchemy import text

def run_migration():
    db = SessionLocal()
    try:
        print("Mencoba mengubah nama kolom 'per' menjadi 'pbv' di tabel 'stocks'...")
        # Lakukan rename column
        db.execute(text("ALTER TABLE stocks RENAME COLUMN per TO pbv;"))
        db.commit()
        print("SUCCESS: Kolom 'per' berhasil diubah menjadi 'pbv' di database!")
    except Exception as e:
        db.rollback()
        print(f"WARNING: Migrasi gagal atau kolom sudah pernah diubah: {e}")
        
        # Fallback: pastikan tabel memiliki kolom pbv jika dibuat baru
        try:
            print("Mencoba membuat kolom 'pbv' secara manual jika belum ada...")
            db.execute(text("ALTER TABLE stocks ADD COLUMN pbv FLOAT;"))
            db.commit()
            print("SUCCESS: Kolom 'pbv' berhasil ditambahkan!")
        except Exception as add_err:
            db.rollback()
            print(f"INFO: Kolom 'pbv' mungkin sudah ada: {add_err}")
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
