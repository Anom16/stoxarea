# Dokumen Rancangan Diagram Sistem: STOXAREA

Dokumen ini memuat spesifikasi rancangan diagram alir data (DFD Level 0 & Level 1), Diagram Kelas UML, dan Entity Relationship Diagram (ERD) untuk sistem **STOXAREA**. Diagram-diagram di bawah ini ditulis menggunakan sintaksis **Mermaid** dengan seluruh penjelasan dan alur hubungan dalam **Bahasa Indonesia**.

---

## 1. DFD Level 0 (Diagram Konteks)

DFD Level 0 (Diagram Konteks) menggambarkan batas sistem **STOXAREA** secara eksternal, memperlihatkan entitas luar yang berinteraksi dengan sistem, serta arus data utama masuk dan keluar sistem.

```mermaid
graph TD
    %% Entitas Luar
    User["Pengguna (Investor Ritel)"]
    Admin["Administrator (Pengelola)"]
    YFinance["API Yahoo Finance"]

    %% Sistem Pusat (Bentuk Stadium)
    System(["Sistem Pusat STOXAREA"])

    %% Arus Data User -> Sistem
    User -->|1. Pendaftaran dan Onboarding| System
    User -->|2. Pengisian Kuesioner Profil K1-K5| System
    User -->|3. Perintah Transaksi BELI dan JUAL| System

    %% Arus Data Sistem -> User
    System -->|4. Hasil Klasifikasi Profil Risiko| User
    System -->|5. Rekomendasi Unggulan Top Picks SAW| User
    System -->|6. Visualisasi Analisis SHAP| User
    System -->|7. Laporan Portofolio & Catatan Transaksi| User

    %% Arus Data API -> Sistem
    YFinance -->|8. Data Riwayat Harga OHLCV| System
    YFinance -->|9. Rasio Fundamental ROE, DER, PBV| System

    %% Arus Data Admin -> Sistem
    Admin -->|10. Validasi & Aksi Korporasi Manual| System
    Admin -->|11. Perintah Latih Ulang Model ML| System

    %% Arus Data Sistem -> Admin
    System -->|12. Notifikasi Anomali Harga Ekstrem| Admin

    style System fill:#1B365D,stroke:#333,stroke-width:2px,color:#fff
    style User fill:#F7FAFC,stroke:#1B365D,stroke-width:1.5px
    style Admin fill:#F7FAFC,stroke:#1B365D,stroke-width:1.5px
    style YFinance fill:#FFF5F5,stroke:#E53E3E,stroke-width:1.5px
```

---

## 2. DFD Level 1 (Diagram Dekomposisi Modul)

DFD Level 1 mendekomposisi proses utama sistem STOXAREA menjadi **3 modul operasional teragregasi** yang berinteraksi secara aktif dengan penyimpanan data database (*Data Stores*).

```mermaid
graph TD
    %% Entitas Luar
    User["Pengguna (Investor Ritel)"]
    Admin["Administrator (Pengelola)"]
    YFinance["API Yahoo Finance"]

    %% Penyimpanan Data (Bentuk Silinder Database)
    D1[("D1: Tabel users Pengguna")]
    D2[("D2: Tabel stocks Saham")]
    D3[("D3: Tabel portfolios Portofolio")]
    D4[("D4: Tabel transactions Transaksi")]
    D5[("D5: Tabel corporate_action_flags Aksi Korporasi")]
    D6[("D6: Tabel financial_history Riwayat Laporan")]

    %% Proses-Proses Teragregasi (Bentuk Stadium)
    P1(["1.0 Modul Penentuan Profil Risiko & Veto"])
    P2(["2.0 Modul Pipeline Data & Prediksi AI XGBoost"])
    P3(["3.0 Modul Rekomendasi SAW & Simulator Trading"])

    %% Aliran Proses 1.0
    User -->|Pendaftaran & Jawaban Kuesioner| P1
    P1 -->|Simpan Profil Risiko & Saldo Kas| D1
    D1 -->|Akses Bobot Profil & Saldo Kas| P3
    P1 -->|Informasi Klasifikasi Profil Risiko| User

    %% Aliran Proses 2.0
    YFinance -->|Data Mentah Harga & Fundamental| P2
    P2 -->|Simpan & Perbarui Data Saham| D2
    P2 -->|Simpan Riwayat Laporan Keuangan| D6
    D2 -->|Data Historis untuk Training & Prediksi| P2
    P2 -->|Simpan AI Score & Analisis SHAP| D2

    %% Aliran Proses 3.0
    D2 -->|Data AI Score & Fundamental Bersih| P3
    P3 -->|Skor Agregasi Rekomendasi Top Picks| User
    User -->|Kirim Order Beli & Jual Virtual| P3
    P3 -->|Perbarui Posisi Aset & Avg Price| D3
    P3 -->|Catat Riwayat Transaksi Simulator| D4
    P2 -->|Deteksi Lompatan Harga Ekstrem >35%| P3
    P3 -->|Tandai Anomali Aksi Korporasi| D5
    Admin -->|Validasi & Eksekusi Stock Split| P3

    style P1 fill:#EBF8FF,stroke:#3182CE,stroke-width:1.5px
    style P2 fill:#EBF8FF,stroke:#3182CE,stroke-width:1.5px
    style P3 fill:#EBF8FF,stroke:#3182CE,stroke-width:1.5px
    style D1 fill:#EDF2F7,stroke:#4A5568,stroke-width:1.5px
    style D2 fill:#EDF2F7,stroke:#4A5568,stroke-width:1.5px
    style D3 fill:#EDF2F7,stroke:#4A5568,stroke-width:1.5px
    style D4 fill:#EDF2F7,stroke:#4A5568,stroke-width:1.5px
    style D5 fill:#EDF2F7,stroke:#4A5568,stroke-width:1.5px
    style D6 fill:#EDF2F7,stroke:#4A5568,stroke-width:1.5px
```

---

## 3. Diagram Kelas UML (UML Class Diagram)

Diagram Kelas UML di bawah ini menggambarkan pemodelan kelas pemrograman (*OOP Class Models*) pada kode backend, lengkap dengan nama relasi asosiasi dalam **Bahasa Indonesia**.

```mermaid
classDiagram
    class User {
        +int id
        +string email
        +string hashed_password
        +string full_name
        +string risk_profile
        +decimal virtual_balance
        +datetime created_at
        +datetime updated_at
        +calculate_risk_profile(answers: QuestionnaireInput) RiskProfileEnum
        +update_balance(amount: decimal) bool
    }

    class Stock {
        +string ticker
        +string name
        +string sector
        +decimal roe
        +decimal der
        +decimal pbv
        +bool is_qualified
        +datetime updated_at
        +get_qualified_stocks_for_saw() List
        +get_top_momentum_stocks() List
    }

    class Portfolio {
        +int id
        +int user_id
        +string ticker
        +int qty
        +decimal avg_price
        +datetime created_at
        +datetime updated_at
        +calculate_floating_pnl(current_price: decimal) decimal
    }

    class Transaction {
        +int id
        +int user_id
        +string ticker
        +string type
        +decimal price
        +int qty
        +decimal fee
        +decimal net_value
        +timestamp timestamp
        +execute_transaction(db: Session) bool
    }

    class CorporateActionFlag {
        +int id
        +string ticker
        +decimal prev_close
        +decimal curr_close
        +decimal change_pct
        +bool is_resolved
        +string action_type
        +decimal split_ratio
        +string admin_notes
        +timestamp detected_at
        +timestamp resolved_at
        +resolve_split(db: Session) bool
    }

    class FinancialHistory {
        +int id
        +string ticker
        +string year
        +decimal revenue
        +decimal net_income
        +decimal assets
        +decimal liabilities
        +decimal equity
    }

    %% Hubungan Asosiasi Klasifikasi (Bahasa Indonesia)
    User "1" --> "0..*" Portfolio : memiliki
    User "1" --> "0..*" Transaction : melakukan
    Stock "1" --> "0..* " Portfolio : disimpan_pada
    Stock "1" --> "0..*" Transaction : ditransaksikan_pada
    Stock "1" --> "0..*" CorporateActionFlag : ditandai_anomali_pada
    Stock "1" --> "0..*" FinancialHistory : memiliki_riwayat
```

---

## 4. Entity Relationship Diagram (ERD)

ERD di bawah ini memodelkan struktur penyimpanan data relasional pada database PostgreSQL dengan menerapkan aturan kunci (*Primary Key*, *Foreign Key*) serta derajat kardinalitas dan relasi dalam **Bahasa Indonesia**.

```mermaid
erDiagram
    USERS {
        int id PK
        varchar email UK
        varchar hashed_password
        varchar full_name
        varchar risk_profile
        decimal virtual_balance
        timestamp created_at
        timestamp updated_at
    }

    STOCKS {
        varchar ticker PK
        varchar name
        varchar sector
        decimal roe
        decimal der
        decimal pbv
        boolean is_qualified
        timestamp updated_at
    }

    PORTFOLIOS {
        int id PK
        int user_id FK
        varchar ticker FK
        int qty
        decimal avg_price
        timestamp created_at
        timestamp updated_at
    }

    TRANSACTIONS {
        int id PK
        int user_id FK
        varchar ticker FK
        varchar type
        decimal price
        int qty
        decimal fee
        decimal net_value
        timestamp timestamp
    }

    CORPORATE_ACTION_FLAGS {
        int id PK
        varchar ticker FK
        decimal prev_close
        decimal curr_close
        decimal change_pct
        boolean is_resolved
        varchar action_type
        decimal split_ratio
        text admin_notes
        timestamp detected_at
        timestamp resolved_at
    }

    FINANCIAL_HISTORY {
        int id PK
        varchar ticker FK
        varchar year
        decimal revenue
        decimal net_income
        decimal assets
        decimal liabilities
        decimal equity
    }

    %% Kardinalitas Relasi Relasional (Bahasa Indonesia)
    USERS ||--o{ PORTFOLIOS : "memiliki"
    USERS ||--o{ TRANSACTIONS : "melakukan"
    STOCKS ||--o{ PORTFOLIOS : "disimpan pada"
    STOCKS ||--o{ TRANSACTIONS : "ditransaksikan pada"
    STOCKS ||--o{ CORPORATE_ACTION_FLAGS : "mengalami anomali pada"
    STOCKS ||--o{ FINANCIAL_HISTORY : "melaporkan"
```
