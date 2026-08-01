'use client'

import React from 'react'

interface QualificationModalProps {
  isOpen: boolean
  onClose: () => void
  totalQualified?: number
}

export default function QualificationModal({ isOpen, onClose, totalQualified = 112 }: QualificationModalProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 20,
          maxWidth: 540,
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          padding: '24px 28px',
          color: 'var(--text-primary, #0f172a)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'var(--bg-hover, #f1f5f9)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: 'var(--text-secondary, #64748b)',
            fontWeight: 'bold',
            transition: 'all 0.15s'
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(37, 99, 235, 0.1)',
            color: 'var(--accent, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 800
          }}>
            🛡️
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
              Sistem Filtrasi & Kualifikasi Saham
            </h3>
            <span style={{ fontSize: 13, color: 'var(--accent, #2563eb)', fontWeight: 700 }}>
              {totalQualified} Saham Terpilih Lolos Kualifikasi Ketat
            </span>
          </div>
        </div>

        {/* Modal Description */}
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #475569)', lineHeight: 1.5, marginBottom: 20 }}>
          Dari 900+ emiten di Bursa Efek Indonesia (BEI), <strong>STOXAREA secara otomatis mengeliminasi saham "tidur", tidak likuid, dan gocap</strong>. Hanya emiten yang memenuhi <strong>3 Aturan Kuantitatif Likuiditas</strong> yang diikutsertakan:
        </p>

        {/* 3 Qualification Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 14,
            borderRadius: 12,
            background: 'var(--bg-secondary, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)'
          }}>
            <div style={{ fontSize: 20 }}>📈</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                1. Volume Transaksi &gt; 10.000 Lot / Hari
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
                Rata-rata volume perdagangan 30 hari &gt; 1.000.000 lembar per hari untuk menjamin saham mudah diperjualbelikan.
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 14,
            borderRadius: 12,
            background: 'var(--bg-secondary, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)'
          }}>
            <div style={{ fontSize: 20 }}>🗓️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                2. Hari Aktif Perdagangan &ge; 100 Hari / Tahun
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
                Emiten wajib aktif bertransaksi di bursa (mengeliminasi saham mati/suspend).
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 14,
            borderRadius: 12,
            background: 'var(--bg-secondary, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)'
          }}>
            <div style={{ fontSize: 20 }}>💵</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                3. Harga Penutupan Terakhir &gt; Rp 50
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
                Bebas dari saham gocap dan papan pemantauan khusus tanpa transaksi.
              </div>
            </div>
          </div>

        </div>

        {/* Footer Info & Action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✓</span> Terhubung dengan AI XGBoost & Engine SAW
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              background: 'var(--accent, #2563eb)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
              transition: 'transform 0.15s'
            }}
          >
            Paham, Terima Kasih
          </button>
        </div>

      </div>
    </div>
  )
}
