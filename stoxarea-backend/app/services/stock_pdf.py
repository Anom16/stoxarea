from fpdf import FPDF
from datetime import datetime

def generate_stock_report_pdf(ticker: str, fund: dict, hist: dict, ai: dict) -> bytes:
    # Initialize A4 Portrait PDF
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Formatting helper for currency
    def format_idr(val: float) -> str:
        try:
            return f"Rp {int(val):,}".replace(",", ".")
        except:
            return "—"
            
    # Format percent helper
    def format_pct(val: float) -> str:
        try:
            return f"{float(val * 100):.2f}%"
        except:
            return "—"

    # Format normal float helper
    def format_num(val: float, decimals=2) -> str:
        try:
            return f"{float(val):.{decimals}f}"
        except:
            return "—"

    # ─── HEADER SECTION ───
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(26, 54, 93)  # Deep Blue
    pdf.cell(0, 10, "STOXAREA", new_x="LMARGIN", new_y="NEXT", align="L")
    
    pdf.set_font("helvetica", "B", 12)
    pdf.set_text_color(74, 85, 104)  # Muted Dark Grey
    comp_name = fund.get("name", "Laporan Riset Saham")
    pdf.cell(0, 6, f"Laporan Riset Emiten: {comp_name} ({ticker.replace('.JK', '')})", new_x="LMARGIN", new_y="NEXT", align="L")
    pdf.ln(2)
    
    # Metadata info (Timestamp)
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(113, 128, 150)  # Cool Grey
    pdf.cell(100, 5, f"Sektor: {fund.get('sector', '—')} · Industri: {fund.get('industry', '—')}", new_x="RIGHT", new_y="LAST")
    
    print_time = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    pdf.cell(0, 5, f"Tanggal Ekspor: {print_time}", new_x="LMARGIN", new_y="NEXT", align="R")
    pdf.ln(4)
    
    # Draw separator line
    pdf.set_draw_color(226, 232, 240)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    # ─── SECTION 1: AI & MARKET INTELLIGENCE ───
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(26, 54, 93)
    pdf.cell(0, 7, "1. AI SCORE & RATING (XGBoost)", new_x="LMARGIN", new_y="NEXT", align="L")
    pdf.ln(2)
    
    # Render AI details side-by-side
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(45, 55, 72)
    pdf.cell(45, 6, "AI Score (Momentum):", border=0, new_x="RIGHT", new_y="LAST")
    
    ai_score_percent = ai.get("ai_score_percent", "—")
    ai_score = ai.get("ai_score", 0)
    
    pdf.set_font("helvetica", "", 10)
    pdf.cell(45, 6, f"{ai_score_percent}", border=0, new_x="RIGHT", new_y="LAST")
    
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(45, 6, "Sinyal / Outlook:", border=0, new_x="RIGHT", new_y="LAST")
    
    outlook = "BULLISH" if ai_score >= 0.6 else "BEARISH" if ai_score < 0.4 else "NETRAL"
    pdf.set_font("helvetica", "B", 10)
    if outlook == "BULLISH":
        pdf.set_text_color(38, 162, 67)
    elif outlook == "BEARISH":
        pdf.set_text_color(225, 41, 41)
    else:
        pdf.set_text_color(245, 158, 11)
    pdf.cell(0, 6, outlook, border=0, new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_text_color(45, 55, 72)
    pdf.ln(4)

    # ─── SECTION 2: DATA FUNDAMENTAL & VALUASI ───
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(26, 54, 93)
    pdf.cell(0, 7, "2. RINGKASAN DATA FUNDAMENTAL", new_x="LMARGIN", new_y="NEXT", align="L")
    pdf.ln(2)

    val = fund.get("valuation", {})
    prof = fund.get("profitability", {})
    health = fund.get("health", {})
    price = fund.get("price", {})
    div = fund.get("dividend", {})

    metrics = [
        ("Harga Terakhir", format_idr(price.get("current")), "PBV", format_num(val.get("pbv")) + "x"),
        ("52W High", format_idr(price.get("week_52_high")), "Beta Saham", format_num(price.get("beta"))),
        ("ROE", format_pct(prof.get("roe")), "DER", format_num(health.get("der"))),
        ("ROA", format_pct(prof.get("roa")), "Div. Yield", format_pct(div.get("yield_pct"))),
        ("Net Margin", format_pct(prof.get("net_margin")), "Payout Ratio", format_pct(div.get("payout_ratio")))
    ]

    for label1, val1, label2, val2 in metrics:
        pdf.set_font("helvetica", "B", 9)
        pdf.set_text_color(113, 128, 150)
        pdf.cell(40, 6, label1, new_x="RIGHT", new_y="LAST")
        
        pdf.set_font("helvetica", "", 9)
        pdf.set_text_color(45, 55, 72)
        pdf.cell(50, 6, val1, new_x="RIGHT", new_y="LAST")

        pdf.set_font("helvetica", "B", 9)
        pdf.set_text_color(113, 128, 150)
        pdf.cell(40, 6, label2, new_x="RIGHT", new_y="LAST")
        
        pdf.set_font("helvetica", "", 9)
        pdf.set_text_color(45, 55, 72)
        pdf.cell(0, 6, val2, new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)

    # ─── SECTION 3: LAPORAN KEUANGAN ───
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(26, 54, 93)
    pdf.cell(0, 7, "3. KINERJA LAPORAN KEUANGAN HISTORIS", new_x="LMARGIN", new_y="NEXT", align="L")
    pdf.ln(2)

    fin_hist = hist.get("financials_history", [])
    bs_hist = hist.get("balance_sheet_history", [])

    if fin_hist:
        # Table Headers: Tahun, Pendapatan, Laba Bersih, Aset, Liabilitas, Ekuitas
        headers = ["Tahun", "Pendapatan", "Laba Bersih", "Total Aset", "Total Liabilitas", "Ekuitas"]
        widths = [20, 32, 32, 32, 32, 32]
        
        pdf.set_fill_color(26, 54, 93)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("helvetica", "B", 9)
        
        for i in range(len(headers)):
            pdf.cell(widths[i], 7, headers[i], border=1, align="C", fill=True)
        pdf.ln()

        pdf.set_font("helvetica", "", 8.5)
        pdf.set_text_color(45, 55, 72)
        pdf.set_draw_color(237, 242, 249)

        for i, f_item in enumerate(fin_hist):
            year = f_item.get("year")
            # Cari Neraca yang tahunnya sama
            b_item = next((b for b in bs_hist if str(b.get("year")) == str(year)), {})
            
            fill = i % 2 == 0
            if fill:
                pdf.set_fill_color(247, 250, 252)
            else:
                pdf.set_fill_color(255, 255, 255)

            pdf.cell(widths[0], 7, str(year), border=1, align="C", fill=fill)
            pdf.cell(widths[1], 7, format_idr(f_item.get("revenue")), border=1, align="R", fill=fill)
            pdf.cell(widths[2], 7, format_idr(f_item.get("net_income")), border=1, align="R", fill=fill)
            pdf.cell(widths[3], 7, format_idr(b_item.get("assets")), border=1, align="R", fill=fill)
            pdf.cell(widths[4], 7, format_idr(b_item.get("liabilities")), border=1, align="R", fill=fill)
            pdf.cell(widths[5], 7, format_idr(b_item.get("equity")), border=1, align="R", fill=fill)
            pdf.ln()
    else:
        pdf.set_font("helvetica", "I", 9)
        pdf.set_text_color(113, 128, 150)
        pdf.cell(0, 6, "Data laporan keuangan historis belum dimuat atau tidak tersedia.", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)

    # ─── SECTION 4: RIWAYAT DIVIDEN ───
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(26, 54, 93)
    pdf.cell(0, 7, "4. RIWAYAT DIVIDEN (10 DISTRIBUSI TERAKHIR)", new_x="LMARGIN", new_y="NEXT", align="L")
    pdf.ln(2)

    div_hist = hist.get("dividend_history", [])
    if div_hist:
        widths_div = [40, 60]
        pdf.set_fill_color(26, 54, 93)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("helvetica", "B", 9)
        pdf.cell(widths_div[0], 7, "Tanggal Pembagian", border=1, align="C", fill=True)
        pdf.cell(widths_div[1], 7, "Besaran Dividen per Lembar", border=1, align="C", fill=True)
        pdf.ln()

        pdf.set_font("helvetica", "", 8.5)
        pdf.set_text_color(45, 55, 72)
        pdf.set_draw_color(237, 242, 249)

        for i, d_item in enumerate(div_hist):
            fill = i % 2 == 0
            if fill:
                pdf.set_fill_color(247, 250, 252)
            else:
                pdf.set_fill_color(255, 255, 255)

            # Format date
            date_str = d_item.get("date")
            try:
                date_formatted = datetime.strptime(date_str, "%Y-%m-%d").strftime("%d-%m-%Y")
            except:
                date_formatted = date_str

            pdf.cell(widths_div[0], 7, date_formatted, border=1, align="C", fill=fill)
            pdf.cell(widths_div[1], 7, f"Rp {d_item.get('amount'):.2f}", border=1, align="R", fill=fill)
            pdf.ln()
    else:
        pdf.set_font("helvetica", "I", 9)
        pdf.set_text_color(113, 128, 150)
        pdf.cell(0, 6, "Emiten ini tidak memiliki riwayat pembagian dividen dalam waktu dekat.", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(8)
    
    # ─── FOOTER/DISCLAIMER ───
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(160, 174, 192)
    pdf.cell(0, 5, "Disclaimer: Data laporan riset di atas diproses secara algoritmik dari data Yahoo Finance untuk keperluan edukasi.", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 5, "StoxArea tidak bertanggung jawab atas kerugian investasi yang dialami pengguna. Selalu lakukan analisis mandiri.", new_x="LMARGIN", new_y="NEXT", align="C")

    return bytes(pdf.output())
