import sys
import os

# Tambahkan path root ke sys.path agar bisa import module app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.models.user import User, RiskProfileEnum
from app.core.security import get_password_hash

def create_users():
    db = SessionLocal()
    try:
        # Data User baru
        users_data = [
            {
                "email": "moderat@gmail.com",
                "password": "admin",
                "risk_profile": RiskProfileEnum.moderat
            },
            {
                "email": "agresif@gmail.com",
                "password": "admin",
                "risk_profile": RiskProfileEnum.agresif
            }
        ]

        for u_data in users_data:
            # Cek apakah user sudah ada
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if existing:
                print(f"User {u_data['email']} sudah ada.")
                existing.risk_profile = u_data["risk_profile"]
            else:
                new_user = User(
                    email=u_data["email"],
                    password_hash=get_password_hash(u_data["password"]),
                    risk_profile=u_data["risk_profile"]
                )
                db.add(new_user)
                print(f"User {u_data['email']} berhasil dibuat.")
        
        db.commit()
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_users()
