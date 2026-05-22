"""
Script untuk menambahkan kolom fee dan net_value ke tabel transactions
Jalankan sekali saja untuk memperbaiki schema database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine

def add_transaction_columns():
    """Tambahkan kolom fee dan net_value ke tabel transactions"""
    
    with engine.connect() as conn:
        try:
            # Cek apakah kolom sudah ada
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='transactions' 
                AND column_name IN ('fee', 'net_value')
            """)
            result = conn.execute(check_query)
            existing_columns = [row[0] for row in result]
            
            if 'fee' in existing_columns and 'net_value' in existing_columns:
                print("✅ Kolom fee dan net_value sudah ada di database")
                return
            
            # Tambahkan kolom fee jika belum ada
            if 'fee' not in existing_columns:
                print("➕ Menambahkan kolom 'fee'...")
                conn.execute(text("""
                    ALTER TABLE transactions 
                    ADD COLUMN fee DOUBLE PRECISION NOT NULL DEFAULT 0.0
                """))
                conn.commit()
                print("✅ Kolom 'fee' berhasil ditambahkan")
            
            # Tambahkan kolom net_value jika belum ada
            if 'net_value' not in existing_columns:
                print("➕ Menambahkan kolom 'net_value'...")
                conn.execute(text("""
                    ALTER TABLE transactions 
                    ADD COLUMN net_value DOUBLE PRECISION NOT NULL DEFAULT 0.0
                """))
                conn.commit()
                print("✅ Kolom 'net_value' berhasil ditambahkan")
            
            # Update nilai untuk transaksi yang sudah ada (hitung ulang fee dan net_value)
            print("🔄 Mengupdate nilai fee dan net_value untuk transaksi lama...")
            conn.execute(text("""
                UPDATE transactions
                SET 
                    fee = CASE 
                        WHEN type = 'BUY' THEN (price * qty * 0.0015)
                        WHEN type = 'SELL' THEN (price * qty * 0.0025)
                    END,
                    net_value = CASE 
                        WHEN type = 'BUY' THEN (price * qty * 1.0015)
                        WHEN type = 'SELL' THEN (price * qty * 0.9975)
                    END
                WHERE fee = 0.0 AND net_value = 0.0
            """))
            conn.commit()
            print("✅ Nilai fee dan net_value berhasil diupdate")
            
            print("\n🎉 Migrasi database selesai!")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    print("🚀 Memulai migrasi database...")
    print("📊 Menambahkan kolom fee dan net_value ke tabel transactions\n")
    add_transaction_columns()
