from app.core.database import Base
from app.models.user import User, RiskProfileEnum
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.models.stock import Stock
from app.models.financials import FinancialHistory
from app.models.corporate_action import CorporateActionFlag

# Ini agar Base.metadata.create_all() bisa mendeteksi semua tabel
