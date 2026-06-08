import urllib.request
import base64
import re
import os

def run():
    md_file = "stoxarea_system_diagrams.md"
    if not os.path.exists(md_file):
        print(f"File {md_file} tidak ditemukan di direktori saat ini.")
        return

    print("Membaca file stoxarea_system_diagrams.md...")
    with open(md_file, "r", encoding="utf-8") as f:
        text = f.read()

    # Cari seluruh block code ```mermaid ... ```
    blocks = re.findall(r"```mermaid\s*(.*?)\s*```", text, re.DOTALL)
    
    if len(blocks) < 4:
        print(f"Hanya menemukan {len(blocks)} diagram Mermaid. Dibutuhkan 4 diagram.")
        return

    names = [
        "dfd_level_0.png",
        "dfd_level_1.png",
        "uml_class_diagram.png",
        "erd_diagram.png"
    ]

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }

    for code, name in zip(blocks, names):
        # 1. Bersihkan spasi berlebih
        clean_code = code.strip()
        
        # 2. Base64 encode
        code_bytes = clean_code.encode("utf-8")
        b64_bytes = base64.b64encode(code_bytes)
        b64_str = b64_bytes.decode("ascii")
        
        # Make URL safe as required by mermaid.ink
        b64_str_safe = b64_str.replace('+', '-').replace('/', '_')
        
        # Format URL untuk mermaid.ink
        url = f"https://mermaid.ink/img/{b64_str_safe}"
        
        print(f"Mengunduh {name}...")
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as response:
                with open(name, "wb") as out_file:
                    out_file.write(response.read())
            print(f"[OK] Berhasil menyimpan: {name}")
        except Exception as e:
            print(f"[ERROR] Gagal mengunduh {name}: {e}")

if __name__ == "__main__":
    run()
