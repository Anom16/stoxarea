import requests
import yfinance as yf
import pandas as pd
import json
import time
import logging
from bs4 import BeautifulSoup
from pathlib import Path

# -- Setup logging --
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

OUTPUT_PATH = Path("data/tickers/tickers_bei.json")
REQUEST_DELAY = 0.2 

def get_fallback_tickers():
    # Daftar 150+ saham populer IDX dengan sektornya
    tickers_data = [
        {"ticker": "BBCA", "name": "Bank Central Asia", "sector": "Finance"},
        {"ticker": "BBRI", "name": "Bank Rakyat Indonesia", "sector": "Finance"},
        {"ticker": "BMRI", "name": "Bank Mandiri", "sector": "Finance"},
        {"ticker": "BBNI", "name": "Bank Negara Indonesia", "sector": "Finance"},
        {"ticker": "TLKM", "name": "Telkom Indonesia", "sector": "Infrastructure"},
        {"ticker": "ASII", "name": "Astra International", "sector": "Industrials"},
        {"ticker": "UNTR", "name": "United Tractors", "sector": "Industrials"},
        {"ticker": "GOTO", "name": "GoTo Gojek Tokopedia", "sector": "Technology"},
        {"ticker": "ADRO", "name": "Adaro Energy", "sector": "Energy"},
        {"ticker": "PTBA", "name": "Bukit Asam", "sector": "Energy"},
        {"ticker": "ITMG", "name": "Indo Tambangraya Megah", "sector": "Energy"},
        {"ticker": "UNVR", "name": "Unilever Indonesia", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "ICBP", "name": "Indofood CBP", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "INDF", "name": "Indofood Sukses Makmur", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "KLBF", "name": "Kalbe Farma", "sector": "Healthcare"},
        {"ticker": "CPIN", "name": "Charoen Pokphand", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "AMRT", "name": "Sumber Alfaria Trijaya", "sector": "Consumer Cyclicals"},
        {"ticker": "PGAS", "name": "Perusahaan Gas Negara", "sector": "Energy"},
        {"ticker": "AKRA", "name": "AKR Corporindo", "sector": "Energy"},
        {"ticker": "TOWR", "name": "Sarana Menara Nusantara", "sector": "Infrastructure"},
        {"ticker": "BRPT", "name": "Barito Pacific", "sector": "Basic Materials"},
        {"ticker": "TPIA", "name": "Chandra Asri Petrochemical", "sector": "Basic Materials"},
        {"ticker": "INKP", "name": "Indah Kiat Pulp & Paper", "sector": "Basic Materials"},
        {"ticker": "TKIM", "name": "Pabrik Kertas Tjiwi Kimia", "sector": "Basic Materials"},
        {"ticker": "SMGR", "name": "Semen Indonesia", "sector": "Basic Materials"},
        {"ticker": "INTP", "name": "Indocement Tunggal Prakarsa", "sector": "Basic Materials"},
        {"ticker": "ANTM", "name": "Aneka Tambang", "sector": "Basic Materials"},
        {"ticker": "TINS", "name": "Timah", "sector": "Basic Materials"},
        {"ticker": "MDKA", "name": "Merdeka Copper Gold", "sector": "Basic Materials"},
        {"ticker": "HRUM", "name": "Harum Energy", "sector": "Energy"},
        {"ticker": "MEDC", "name": "Medco Energi", "sector": "Energy"},
        {"ticker": "INDY", "name": "Indika Energy", "sector": "Energy"},
        {"ticker": "EXCL", "name": "XL Axiata", "sector": "Infrastructure"},
        {"ticker": "ISAT", "name": "Indosat Ooredoo Hutchison", "sector": "Infrastructure"},
        {"ticker": "JSMR", "name": "Jasa Marga", "sector": "Infrastructure"},
        {"ticker": "WSKT", "name": "Waskita Karya", "sector": "Infrastructure"},
        {"ticker": "WIKA", "name": "Wijaya Karya", "sector": "Infrastructure"},
        {"ticker": "PTPP", "name": "PP Persero", "sector": "Infrastructure"},
        {"ticker": "ADHI", "name": "Adhi Karya", "sector": "Infrastructure"},
        {"ticker": "BSDE", "name": "Bumi Serpong Damai", "sector": "Properties & Real Estate"},
        {"ticker": "PWON", "name": "Pakuwon Jati", "sector": "Properties & Real Estate"},
        {"ticker": "CTRA", "name": "Ciputra Development", "sector": "Properties & Real Estate"},
        {"ticker": "SMRA", "name": "Summarecon Agung", "sector": "Properties & Real Estate"},
        {"ticker": "ASSA", "name": "Adi Sarana Armada", "sector": "Transportation & Logistics"},
        {"ticker": "BIRD", "name": "Blue Bird", "sector": "Transportation & Logistics"},
        {"ticker": "GIAA", "name": "Garuda Indonesia", "sector": "Transportation & Logistics"},
        {"ticker": "SMDR", "name": "Samudera Indonesia", "sector": "Transportation & Logistics"},
        {"ticker": "TMAS", "name": "Temas", "sector": "Transportation & Logistics"},
        {"ticker": "SCMA", "name": "Surya Citra Media", "sector": "Consumer Cyclicals"},
        {"ticker": "MNCN", "name": "Media Nusantara Citra", "sector": "Consumer Cyclicals"},
        {"ticker": "EMTK", "name": "Elang Mahkota Teknologi", "sector": "Technology"},
        {"ticker": "BUKA", "name": "Bukalapak.com", "sector": "Technology"},
        {"ticker": "MIKA", "name": "Mitra Keluarga Karyasehat", "sector": "Healthcare"},
        {"ticker": "HEAL", "name": "Medikaloka Hermina", "sector": "Healthcare"},
        {"ticker": "SILO", "name": "Siloam International Hospitals", "sector": "Healthcare"},
        {"ticker": "SIDO", "name": "Industri Jamu Sido Muncul", "sector": "Healthcare"},
        {"ticker": "MYOR", "name": "Mayora Indah", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "ULTJ", "name": "Ultra Jaya Milk", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "ROTI", "name": "Nippon Indosari Corpindo", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "WOOD", "name": "Integra Indocabinet", "sector": "Consumer Cyclicals"},
        {"ticker": "AVIA", "name": "Avia Avian", "sector": "Basic Materials"},
        {"ticker": "ACES", "name": "Ace Hardware Indonesia", "sector": "Consumer Cyclicals"},
        {"ticker": "ERAA", "name": "Erajaya Swasembada", "sector": "Consumer Cyclicals"},
        {"ticker": "LPPF", "name": "Matahari Department Store", "sector": "Consumer Cyclicals"},
        {"ticker": "MAPI", "name": "Mitra Adiperkasa", "sector": "Consumer Cyclicals"},
        {"ticker": "AMMN", "name": "Amman Mineral Internasional", "sector": "Basic Materials"},
        {"ticker": "BRIS", "name": "Bank Syariah Indonesia", "sector": "Finance"},
        {"ticker": "BBTN", "name": "Bank Tabungan Negara", "sector": "Finance"},
        {"ticker": "BJBR", "name": "Bank BJB", "sector": "Finance"},
        {"ticker": "BJTM", "name": "Bank Jatim", "sector": "Finance"},
        {"ticker": "ARTO", "name": "Bank Jago", "sector": "Finance"},
        {"ticker": "BNGA", "name": "Bank CIMB Niaga", "sector": "Finance"},
        {"ticker": "PNBN", "name": "Bank Pan Indonesia", "sector": "Finance"},
        {"ticker": "BDMN", "name": "Bank Danamon", "sector": "Finance"},
        {"ticker": "BTPN", "name": "Bank BTPN", "sector": "Finance"},
        {"ticker": "BBHI", "name": "Allo Bank Indonesia", "sector": "Finance"},
        {"ticker": "AGRO", "name": "Bank Raya Indonesia", "sector": "Finance"},
        {"ticker": "BBYB", "name": "Bank Neo Commerce", "sector": "Finance"},
        {"ticker": "BVIC", "name": "Bank Victoria International", "sector": "Finance"},
        {"ticker": "BCIC", "name": "Bank JTrust Indonesia", "sector": "Finance"},
        {"ticker": "FILM", "name": "MD Pictures", "sector": "Consumer Cyclicals"},
        {"ticker": "RAAM", "name": "Tripar Multivision Plus", "sector": "Consumer Cyclicals"},
        {"ticker": "DNET", "name": "Indoritel Makmur Internasional", "sector": "Consumer Cyclicals"},
        {"ticker": "MLPT", "name": "Multipolar Technology", "sector": "Technology"},
        {"ticker": "EDGE", "name": "Global Digital Niaga (Blibli)", "sector": "Technology"},
        {"ticker": "MTDL", "name": "Metrodata Electronics", "sector": "Technology"},
        {"ticker": "MCAS", "name": "M Cash Integrasi", "sector": "Technology"},
        {"ticker": "PTSN", "name": "Sat Nusapersada", "sector": "Technology"},
        {"ticker": "KREN", "name": "Kresna Graha Investama", "sector": "Finance"},
        {"ticker": "CASS", "name": "Cardig Aero Services", "sector": "Transportation & Logistics"},
        {"ticker": "BULL", "name": "Buana Lintas Lautan", "sector": "Transportation & Logistics"},
        {"ticker": "PSSI", "name": "Pelita Samudera Shipping", "sector": "Transportation & Logistics"},
        {"ticker": "ELSA", "name": "Elnusa", "sector": "Energy"},
        {"ticker": "WINS", "name": "Wintermar Offshore Marine", "sector": "Energy"},
        {"ticker": "MBMA", "name": "Merdeka Battery Materials", "sector": "Basic Materials"},
        {"ticker": "NCKL", "name": "Trimegah Bangun Persada", "sector": "Basic Materials"},
        {"ticker": "MBAP", "name": "Mitrabara Adiperdana", "sector": "Energy"},
        {"ticker": "ABMM", "name": "ABM Investama", "sector": "Energy"},
        {"ticker": "ADMR", "name": "Adaro Minerals Indonesia", "sector": "Energy"},
        {"ticker": "DOID", "name": "Delta Dunia Makmur", "sector": "Energy"},
        {"ticker": "KKGI", "name": "Resource Alam Indonesia", "sector": "Energy"},
        {"ticker": "RMKE", "name": "RMK Energy", "sector": "Energy"},
        {"ticker": "GEMS", "name": "Golden Energy Mines", "sector": "Energy"},
        {"ticker": "BYAN", "name": "Bayan Resources", "sector": "Energy"},
        {"ticker": "CUAN", "name": "Petrindo Jaya Kreasi", "sector": "Energy"},
        {"ticker": "BREN", "name": "Barito Renewables Energy", "sector": "Energy"},
        {"ticker": "MBSS", "name": "Mitrabahtera Segara Sejati", "sector": "Transportation & Logistics"},
        {"ticker": "HAIS", "name": "Hasnur Internasional Shipping", "sector": "Transportation & Logistics"},
        {"ticker": "NELY", "name": "Pelayaran Nelly Dwi Putri", "sector": "Transportation & Logistics"},
        {"ticker": "TPMA", "name": "Trans Power Marine", "sector": "Transportation & Logistics"},
        {"ticker": "LSIP", "name": "PP London Sumatra Indonesia", "sector": "Agriculture"},
        {"ticker": "AALI", "name": "Astra Agro Lestari", "sector": "Agriculture"},
        {"ticker": "TAPG", "name": "Triputra Agro Persada", "sector": "Agriculture"},
        {"ticker": "DSNG", "name": "Dharma Satya Nusantara", "sector": "Agriculture"},
        {"ticker": "SIMP", "name": "Salim Ivomas Pratama", "sector": "Agriculture"},
        {"ticker": "BWPT", "name": "Eagle High Plantations", "sector": "Agriculture"},
        {"ticker": "TLAU", "name": "Tunas Baru Lampung", "sector": "Agriculture"},
        {"ticker": "TBLA", "name": "Tunas Baru Lampung", "sector": "Agriculture"},
        {"ticker": "ANJT", "name": "Austindo Nusantara Jaya", "sector": "Agriculture"},
        {"ticker": "SGRO", "name": "Sampoerna Agro", "sector": "Agriculture"},
        {"ticker": "JPFA", "name": "Japfa Comfeed Indonesia", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "MAIN", "name": "Malindo Feedmill", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "WMUU", "name": "Widodo Makmur Unggas", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "STAA", "name": "Sumber Tani Agung Resources", "sector": "Agriculture"},
        {"ticker": "GOOD", "name": "Garudafood Putra Putri Jaya", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "CLEO", "name": "Sariguna Primatirta", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "CAMP", "name": "Campina Ice Cream Industry", "sector": "Consumer Non-Cyclicals"},
        {"ticker": "PANI", "name": "Pantai Indah Kapuk Dua", "sector": "Properties & Real Estate"},
        {"ticker": "DUTI", "name": "Duta Pertiwi", "sector": "Properties & Real Estate"},
        {"ticker": "DILD", "name": "Intiland Development", "sector": "Properties & Real Estate"},
        {"ticker": "KIJA", "name": "Kawasan Industri Jababeka", "sector": "Properties & Real Estate"},
        {"ticker": "SSIA", "name": "Surya Semesta Internusa", "sector": "Properties & Real Estate"},
        {"ticker": "BEST", "name": "Bekasi Fajar Industrial Estate", "sector": "Properties & Real Estate"},
        {"ticker": "MTLA", "name": "Metropolitan Land", "sector": "Properties & Real Estate"},
        {"ticker": "ASRI", "name": "Alam Sutera Realty", "sector": "Properties & Real Estate"},
        {"ticker": "JRPT", "name": "Jaya Real Property", "sector": "Properties & Real Estate"},
        {"ticker": "NZIA", "name": "Nusantara Almazia", "sector": "Properties & Real Estate"},
        {"ticker": "OMRE", "name": "Indonesia Prima Property", "sector": "Properties & Real Estate"},
        {"ticker": "AUTO", "name": "Astra Otoparts", "sector": "Consumer Cyclicals"},
        {"ticker": "DRMA", "name": "Dharma Polimetal", "sector": "Consumer Cyclicals"},
        {"ticker": "SMSM", "name": "Selamat Sempurna", "sector": "Consumer Cyclicals"},
        {"ticker": "GJTL", "name": "Gajah Tunggal", "sector": "Consumer Cyclicals"},
        {"ticker": "MASA", "name": "Multistrada Arah Sarana", "sector": "Consumer Cyclicals"},
        {"ticker": "PRAS", "name": "Prima Alloy Steel Universal", "sector": "Consumer Cyclicals"},
        {"ticker": "IMAS", "name": "Indomobil Sukses Internasional", "sector": "Consumer Cyclicals"},
        {"ticker": "TURI", "name": "Tunas Ridean", "sector": "Consumer Cyclicals"},
        {"ticker": "BRAM", "name": "Indo Kordsa", "sector": "Consumer Cyclicals"},
        {"ticker": "GDYR", "name": "Goodyear Indonesia", "sector": "Consumer Cyclicals"}
    ]
    return tickers_data

def validate_ticker_yfinance(ticker_raw):
    ticker_jk = f"{ticker_raw}.JK"
    try:
        df = yf.download(ticker_jk, period="5d", progress=False, auto_adjust=True)
        return not df.empty
    except: return False

def run_validation(emiten_list, max_valid=150):
    valid_data = []
    total = len(emiten_list)
    for i, emiten in enumerate(emiten_list):
        if len(valid_data) >= max_valid: break
        ticker = emiten["ticker"]
        if validate_ticker_yfinance(ticker):
            emiten["ticker"] = f"{ticker}.JK"
            valid_data.append(emiten)
            logger.info(f"[{len(valid_data)}/{max_valid}] {ticker}.JK - VALID")
        time.sleep(REQUEST_DELAY)
    return valid_data

def run():
    logger.info("Memulai pengambilan data 150 saham lengkap dengan Sektor...")
    emiten_list = get_fallback_tickers()
    valid = run_validation(emiten_list, 150)
    
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(valid, f, indent=2)
    logger.info(f"Selesai! {len(valid)} saham dengan detail lengkap disimpan.")

if __name__ == "__main__":
    run()
