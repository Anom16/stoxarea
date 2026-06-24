from fpdf import FPDF
from datetime import datetime

def generate_transaction_history_pdf(user_email: str, transactions: list) -> bytes:
    # Initialize FPDF
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # ─── HEADER SECTION ───
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(26, 54, 93)  # Brand Deep Blue (Primary)
    pdf.cell(0, 10, "STOXAREA", new_x="LMARGIN", new_y="NEXT", align="L")
    
    pdf.set_font("helvetica", "B", 12)
    pdf.set_text_color(74, 85, 104)  # Muted Dark Grey
    pdf.cell(0, 6, "Laporan Riwayat Transaksi Virtual Trading", new_x="LMARGIN", new_y="NEXT", align="L")
    pdf.ln(2)
    
    # Metadata info (User Email and Timestamp)
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(113, 128, 150)  # Cool Grey
    pdf.cell(100, 5, f"Pengguna: {user_email}", new_x="RIGHT", new_y="LAST")
    
    # Format current run timestamp
    print_time = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    pdf.cell(0, 5, f"Waktu Ekspor: {print_time}", new_x="LMARGIN", new_y="NEXT", align="R")
    pdf.ln(4)
    
    # Draw separator line
    pdf.set_draw_color(226, 232, 240)  # Light border color
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)
    
    # ─── TABLE CONFIGURATION ───
    # Columns: No (8), Ticker (22), Tipe (15), Tanggal & Jam (40), Qty (15), Harga (27), Fee (23), Total Net (40)
    headers = ["No", "Ticker", "Tipe", "Tanggal & Waktu", "Jumlah", "Harga", "Fee", "Total Net"]
    col_widths = [8, 22, 15, 38, 16, 26, 25, 40]
    
    # Header row styling
    pdf.set_fill_color(26, 54, 93)     # Deep Blue fill
    pdf.set_text_color(255, 255, 255)  # White text
    pdf.set_font("helvetica", "B", 9)
    
    for i in range(len(headers)):
        pdf.cell(col_widths[i], 8, headers[i], border=1, align="C", fill=True)
    pdf.ln()
    
    # ─── DATA ROWS ───
    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(45, 55, 72)     # Dark slate text
    pdf.set_draw_color(237, 242, 249)  # Soft borders
    
    for idx, tx in enumerate(transactions, 1):
        # Alternating row background for readability
        fill = idx % 2 == 0
        if fill:
            pdf.set_fill_color(247, 250, 252)  # Soft grey-blue
        else:
            pdf.set_fill_color(255, 255, 255)  # White
            
        # 1. No
        pdf.cell(col_widths[0], 7, str(idx), border=1, align="C", fill=fill)
        
        # 2. Ticker
        pdf.cell(col_widths[1], 7, tx["ticker"], border=1, align="C", fill=fill)
        
        # 3. Tipe (BUY/SELL) - Custom text styling
        type_str = tx["type"].upper()
        if type_str == "BUY":
            pdf.set_text_color(38, 162, 67)    # Green for Beli
            pdf.set_font("helvetica", "B", 8)
            display_type = "BELI"
        else:
            pdf.set_text_color(225, 41, 41)    # Red for Jual
            pdf.set_font("helvetica", "B", 8)
            display_type = "JUAL"
            
        pdf.cell(col_widths[2], 7, display_type, border=1, align="C", fill=fill)
        
        # Reset standard font styles
        pdf.set_text_color(45, 55, 72)
        pdf.set_font("helvetica", "", 8)
        
        # 4. Tanggal & Waktu (Format string output)
        dt_str = tx["timestamp"]
        try:
            # Parse datetime string from database representation
            dt_obj = datetime.strptime(dt_str.split(".")[0], "%Y-%m-%d %H:%M:%S")
            formatted_date = dt_obj.strftime("%d-%m-%Y %H:%M:%S")
        except Exception:
            formatted_date = dt_str
            
        pdf.cell(col_widths[3], 7, formatted_date, border=1, align="C", fill=fill)
        
        # 5. Quantity (Show in Lots)
        lot = int(tx["qty"]) // 100
        pdf.cell(col_widths[4], 7, f"{lot} lot", border=1, align="C", fill=fill)
        
        # Currency formatting helpers (Rp. X.XXX)
        def format_idr(val: float) -> str:
            return f"Rp {int(val):,}".replace(",", ".")
            
        # 6. Price
        pdf.cell(col_widths[5], 7, format_idr(tx["price"]), border=1, align="R", fill=fill)
        
        # 7. Fee
        pdf.cell(col_widths[6], 7, format_idr(tx["fee"]), border=1, align="R", fill=fill)
        
        # 8. Total Net
        pdf.cell(col_widths[7], 7, format_idr(tx["net_value"]), border=1, align="R", fill=fill)
        pdf.ln()
        
    # Return binary representation
    return bytes(pdf.output())


def generate_transaction_receipt_pdf(user_email: str, tx: dict) -> bytes:
    # Initialize A5 size PDF for a compact receipt look
    pdf = FPDF(orientation="P", unit="mm", format="A5")
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Outer decorative border
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(5, 5, 138, 200)
    
    # ─── HEADER ───
    pdf.set_font("helvetica", "B", 16)
    pdf.set_text_color(26, 54, 93)  # Brand Primary Blue
    pdf.cell(0, 10, "STOXAREA", new_x="LMARGIN", new_y="NEXT", align="C")
    
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(74, 85, 104)
    pdf.cell(0, 6, "NOTA TRANSAKSI", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(3)
    
    # Horizontal line
    pdf.set_draw_color(203, 213, 224)
    pdf.line(10, pdf.get_y(), 138, pdf.get_y())
    pdf.ln(5)
    
    # Formatting helper for currency
    def format_idr(val: float) -> str:
        return f"Rp {int(val):,}".replace(",", ".")
        
    dt_str = tx["timestamp"]
    try:
        dt_obj = datetime.strptime(dt_str.split(".")[0], "%Y-%m-%d %H:%M:%S")
        formatted_date = dt_obj.strftime("%d-%m-%Y %H:%M:%S")
    except Exception:
        formatted_date = dt_str
        
    type_str = tx["type"].upper()
    display_type = "BELI (BUY)" if type_str == "BUY" else "JUAL (SELL)"
    
    # Key-value pairs for the receipt content (fully professional and no 'virtual' tags)
    details = [
        ("No. Transaksi", f"TX-{tx['id']}"),
        ("Klien", user_email),
        ("Tanggal & Waktu", formatted_date),
        ("Emiten", tx["ticker"].replace(".JK", "")),
        ("Jenis Transaksi", display_type),
        ("Volume", f"{int(tx['qty']) // 100} Lot ({tx['qty']:,} Lembar)"),
        ("Harga", f"{format_idr(tx['price'])} / Lembar"),
        ("Nilai Transaksi", format_idr(tx["qty"] * tx["price"])),
        ("Biaya Transaksi", format_idr(tx["fee"])),
        ("Total Bersih", format_idr(tx["net_value"]))
    ]
    
    # Render fields
    for label, val in details:
        # Field Label
        pdf.set_font("helvetica", "B", 9)
        pdf.set_text_color(113, 128, 150)
        pdf.cell(50, 7.5, label, border=0, new_x="RIGHT", new_y="LAST")
        
        # Field Value
        pdf.set_font("helvetica", "", 9)
        if label == "Jenis Transaksi":
            if type_str == "BUY":
                pdf.set_text_color(38, 162, 67)    # Green
                pdf.set_font("helvetica", "B", 9)
            else:
                pdf.set_text_color(225, 41, 41)    # Red
                pdf.set_font("helvetica", "B", 9)
        elif label == "Total Bersih":
            pdf.set_text_color(26, 54, 93)      # Brand Blue
            pdf.set_font("helvetica", "B", 10)
        else:
            pdf.set_text_color(45, 55, 72)
            
        pdf.cell(0, 7.5, val, border=0, new_x="LMARGIN", new_y="NEXT", align="L")
        
    pdf.ln(5)
    pdf.line(10, pdf.get_y(), 138, pdf.get_y())
    
    return bytes(pdf.output())
