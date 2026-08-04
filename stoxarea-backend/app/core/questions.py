# Data Statis untuk Kuesioner Profiling (SPK Lapis 1)

QUESTIONNAIRE_DATA = [
    {
        "id": "q1",
        "category": "k1_target_keuntungan",
        "question": "Apa orientasi utama Anda dalam merencanakan target investasi portofolio saham?",
        "options": [
            {"value": 1, "text": "Mengutamakan pelestarian modal dengan target imbal hasil konsisten di atas inflasi."},
            {"value": 3, "text": "Mengincar akumulasi modal jangka menengah melalui capital gain yang terukur."},
            {"value": 5, "text": "Memaksimalkan capital gain jangka pendek melalui volatilitas pasar yang tinggi."}
        ]
    },
    {
        "id": "q2",
        "category": "k1_target_keuntungan",
        "question": "Saat melihat salah satu aset Anda mencatatkan lonjakan harga secara tiba-tiba dalam hitungan hari, strategi apa yang Anda terapkan?",
        "options": [
            {"value": 1, "text": "Segera merealisasikan keuntungan (Take Profit) untuk mengamankan posisi modal."},
            {"value": 3, "text": "Merealisasikan sebagian porsi untuk mengurangi risiko, sambil membiarkan sisanya mengikuti tren."},
            {"value": 5, "text": "Menahan keseluruhan posisi untuk memaksimalkan potensi upside dari momentum tren."}
        ]
    },
    {
        "id": "q3",
        "category": "k2_kualitas_perusahaan",
        "question": "Sejauh mana kapitalisasi pasar dan rekam jejak fundamental menjadi faktor penentu keputusan pembelian Anda?",
        "options": [
            {"value": 1, "text": "Faktor absolut. Saya hanya mengalokasikan dana pada emiten Blue Chip dengan dividen historis yang kuat."},
            {"value": 3, "text": "Cukup penting, namun saya juga mencari emiten lapis kedua dengan proyeksi laba yang solid."},
            {"value": 5, "text": "Tidak signifikan. Saya lebih berfokus pada momentum teknikal dan sentimen pasar saat ini."}
        ]
    },
    {
        "id": "q4",
        "category": "k2_kualitas_perusahaan",
        "question": "Bagaimana pandangan Anda terhadap emiten di sektor 'New Economy' yang saat ini merugi secara finansial namun memiliki basis pengguna masif?",
        "options": [
            {"value": 1, "text": "Dihindari sepenuhnya. Saya menghindari perusahaan dengan rasio profitabilitas negatif."},
            {"value": 3, "text": "Dapat dialokasikan sebagian kecil dari portofolio untuk diversifikasi aset pertumbuhan."},
            {"value": 5, "text": "Sangat menarik. Prospek valuasi masa depan (Growth) jauh lebih krusial dibanding laba periode berjalan."}
        ]
    },
    {
        "id": "q5",
        "category": "k3_toleransi_risiko",
        "question": "Dalam skenario koreksi pasar secara luas yang menyebabkan portofolio Anda turun signifikan dalam waktu singkat, bagaimana respons Anda?",
        "options": [
            {"value": 1, "text": "Cenderung melikuidasi aset untuk mencegah depresiasi lebih lanjut (Cut Loss)."},
            {"value": 3, "text": "Mengevaluasi kembali sentimen pasar sebelum melakukan rasionalisasi portofolio."},
            {"value": 5, "text": "Memanfaatkan koreksi harga sebagai momentum strategis untuk menambah akumulasi aset (Averaging Down)."}
        ]
    },
    {
        "id": "q6",
        "category": "k3_toleransi_risiko",
        "question": "Seberapa nyaman Anda berinvestasi pada emiten dengan tingkat leverage (Debt-to-Equity Ratio) yang agresif demi mendanai ekspansi masif?",
        "options": [
            {"value": 1, "text": "Sangat tidak nyaman. Leverage tinggi meningkatkan probabilitas risiko default secara eksponensial."},
            {"value": 3, "text": "Toleran, selama struktur utangnya produktif dan sesuai dengan rata-rata industrinya."},
            {"value": 5, "text": "Sangat nyaman. Leverage merupakan instrumen akselerasi bisnis yang dapat meroketkan valuasi saham."}
        ]
    },
    {
        "id": "q7",
        "category": "k4_sensitivitas_harga",
        "question": "Pendekatan valuasi seperti apa yang paling mendeskripsikan filosofi analitis Anda?",
        "options": [
            {"value": 1, "text": "Value Investing: Membeli aset solid yang terdiskon tajam dari nilai intrinsiknya (Undervalued)."},
            {"value": 3, "text": "Growth at a Reasonable Price (GARP): Membeli emiten potensial pada tingkat harga yang masih wajar."},
            {"value": 5, "text": "Momentum Investing: Mengakuisisi saham dengan tren bullish kuat tanpa mempedulikan indikator valuasi tradisional."}
        ]
    },
    {
        "id": "q8",
        "category": "k4_sensitivitas_harga",
        "question": "Bila suatu emiten favorit telah mengalami reli harga hingga valuasi P/E Ratio-nya melonjak menjadi overvalued, keputusan apa yang Anda ambil?",
        "options": [
            {"value": 1, "text": "Mencoretnya dari watchlist karena margin of safety sudah tidak lagi relevan."},
            {"value": 3, "text": "Menempatkan pada radar pantauan hingga terjadi koreksi harga teknikal yang signifikan."},
            {"value": 5, "text": "Tetap melakukan entry beli, meyakini bahwa sentimen positif institusional akan terus mendorong harga naik."}
        ]
    },
    {
        "id": "q9",
        "category": "k6_valuasi_per",
        "question": "Dua perusahaan di industri yang sama memiliki prospek bisnis serupa. Perusahaan A dijual pada tingkat harga yang relatif murah dibanding laba tahunannya, sedangkan Perusahaan B dihargai sangat mahal karena sedang populer. Apa keputusan investasi Anda?",
        "options": [
            {"value": 1, "text": "Memilih Perusahaan A karena harganya murah dan memberikan perlindungan nilai (margin of safety) yang lebih aman."},
            {"value": 3, "text": "Membagi alokasi dana ke kedua perusahaan untuk menyeimbangkan antara faktor harga murah dan popularitas pasar."},
            {"value": 5, "text": "Memilih Perusahaan B karena antusiasme pasar yang tinggi biasanya mendorong harga terus naik lebih tinggi."}
        ]
    },
    {
        "id": "q10",
        "category": "k6_valuasi_per",
        "question": "Ketika Anda menemukan sebuah saham dengan kinerja pendapatan tumbuh pesat, namun harga sahamnya sudah naik begitu tinggi sehingga keuntungan tahunannya terlihat kecil dibanding harganya, bagaimana tindakan Anda?",
        "options": [
            {"value": 1, "text": "Menghindari saham tersebut karena harganya sudah terlalu mahal dibanding laba bersih riil yang dihasilkannya."},
            {"value": 3, "text": "Menunggu hingga terjadi penurunan harga (koreksi teknikal) ke level wajar sebelum mempertimbangkan untuk membeli."},
            {"value": 5, "text": "Tetap melakukan aksi beli, meyakini bahwa perusahaan dengan pertumbuhan pesat memang layak dihargai mahal oleh pasar."}
        ]
    },
    {
        "id": "q11",
        "category": "k5_kapasitas_finansial",
        "question": "Jika didefinisikan secara struktur keuangan pribadi, dari mana asal likuiditas yang Anda gunakan di StoxArea?",
        "options": [
            {"value": 1, "text": "Sebagian berasal dari alokasi dana operasional atau tabungan jangka pendek."},
            {"value": 3, "text": "Berasal dari idle fund yang diproyeksikan tidak akan ditarik dalam rentang 1-3 tahun ke depan."},
            {"value": 5, "text": "Sepenuhnya berasal dari dana risiko tinggi (uang dingin) yang tidak akan mengganggu kestabilan finansial apabila terjadi loss total."}
        ]
    },
    {
        "id": "q12",
        "category": "k5_kapasitas_finansial",
        "question": "Berapa proporsi dari total aset likuid (kekayaan cair) Anda yang dialokasikan khusus pada instrumen ekuitas atau saham?",
        "options": [
            {"value": 1, "text": "Di atas 60%, mayoritas likuiditas saya dipusatkan pada ekuitas untuk mengejar imbal hasil."},
            {"value": 3, "text": "Sekitar 20% hingga 50%, mencerminkan diversifikasi portofolio yang seimbang."},
            {"value": 5, "text": "Kurang dari 20%, hanya sebagai alokasi marginal dari portofolio kekayaan secara keseluruhan."}
        ]
    }
]
