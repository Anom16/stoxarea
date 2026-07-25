from app.core.database import Base
from app.models.user import User, RiskProfileEnum
from app.models.risk_profile import RiskProfile
from app.models.portfolio import Portfolio
from app.models.transaction import Transaction, TransactionTypeEnum
from app.models.stock import Stock
from app.models.financials import FinancialHistory
from app.models.indicator import Indicator, ProfileIndicatorWeight, StockIndicatorValue, StockProfileMapping
from app.models.question import Question, QuestionOption

# Ini agar Base.metadata.create_all() bisa mendeteksi semua tabel

