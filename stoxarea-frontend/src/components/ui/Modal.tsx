'use client'
import { useState, useEffect } from 'react'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  ticker: string
  companyName?: string
  actionType: 'BUY' | 'SELL'
  currentPrice: number
  balance: number
  holdingQty: number // in shares (e.g. 500 shares)
  onConfirm: (lots: number) => Promise<void>
  processing: boolean
}

export default function TransactionModal({
  isOpen,
  onClose,
  ticker,
  companyName,
  actionType,
  currentPrice,
  balance,
  holdingQty,
  onConfirm,
  processing
}: TransactionModalProps) {
  const [lots, setLots] = useState(1)
  const tickerClean = ticker.replace('.JK', '').toUpperCase()

  // Reset lots to 1 when modal opens
  useEffect(() => {
    if (isOpen) {
      setLots(1)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Calculations
  const qtyShares = lots * 100
  const grossValue = currentPrice * qtyShares
  
  // Fees: Buy is 0.15%, Sell is 0.25%
  const feeRate = actionType === 'BUY' ? 0.0015 : 0.0025
  const feeAmount = Math.round(grossValue * feeRate)
  
  // Net Value: Buy is gross + fee, Sell is gross - fee
  const netValue = actionType === 'BUY' ? grossValue + feeAmount : grossValue - feeAmount

  // Limits
  const maxBuyLots = Math.floor(balance / (currentPrice * 100 * (1 + 0.0015)))
  const maxSellLots = Math.floor(holdingQty / 100)

  const isBuy = actionType === 'BUY'
  const isInsufficient = isBuy ? balance < netValue : holdingQty < qtyShares

  const handleLotsChange = (value: number) => {
    if (value < 1) return
    setLots(value)
  }

  const handleConfirm = async () => {
    if (isInsufficient || processing) return
    await onConfirm(lots)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 8, 16, 0.85)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s',
        }}
      />

      {/* Modal Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 460,
        maxHeight: '90vh',
        overflowY: 'auto',
        background: 'var(--bg-card, #161d2e)',
        border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
        borderRadius: 16,
        boxShadow: `0 24px 64px rgba(0, 0, 0, 0.6), 0 0 40px ${isBuy ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}`,
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border, #1f2d45)',
          background: isBuy 
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.01))' 
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.01))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 800, 
              color: isBuy ? 'var(--accent, #10b981)' : 'var(--red, #ef4444)',
              textTransform: 'uppercase',
              letterSpacing: 1
            }}>
              {isBuy ? '📈 Order Beli Saham' : '📉 Order Jual Saham'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #f1f5f9)', marginTop: 2 }}>
              {tickerClean}
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #94a3b8)',
              fontSize: 18,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Info Emiten */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            background: 'var(--bg-primary, #0a0e1a)',
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 20,
            border: '1px solid var(--border, #1f2d45)'
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #475569)', textTransform: 'uppercase', fontWeight: 600 }}>Nama Perusahaan</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: 'var(--text-primary, #f1f5f9)' }}>
                {companyName || 'Saham Pilihan'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #475569)', textTransform: 'uppercase', fontWeight: 600 }}>Harga Pasar</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: 'var(--accent, #10b981)' }}>
                Rp {currentPrice.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Account virtual balances */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border, #1f2d45)',
              borderRadius: 10,
              padding: '10px 14px'
            }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted, #475569)', textTransform: 'uppercase', fontWeight: 600 }}>💵 Saldo Kas</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                Rp {balance.toLocaleString('id-ID')}
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border, #1f2d45)',
              borderRadius: 10,
              padding: '10px 14px'
            }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted, #475569)', textTransform: 'uppercase', fontWeight: 600 }}>📦 Kepemilikan</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                {holdingQty > 0 ? `${(holdingQty / 100).toFixed(0)} Lot` : '0 Lot'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary, #94a3b8)', marginTop: 1 }}>
                ({holdingQty.toLocaleString('id-ID')} lembar)
              </div>
            </div>
          </div>

          {/* Input Lot */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Jumlah Transaksi (Lot)
              </label>
              <span style={{ fontSize: 10, color: 'var(--text-muted, #475569)' }}>1 Lot = 100 lembar</span>
            </div>
            
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button 
                type="button"
                onClick={() => handleLotsChange(lots - 1)}
                disabled={lots <= 1}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: '1px solid var(--border, #1f2d45)',
                  background: 'var(--bg-hover, #1e2940)',
                  color: 'var(--text-primary, #f1f5f9)',
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: lots <= 1 ? 0.3 : 1,
                  transition: 'all 0.15s'
                }}
              >-</button>
              
              <input 
                type="number"
                min={1}
                value={lots}
                onChange={e => handleLotsChange(parseInt(e.target.value) || 1)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  border: '1px solid var(--border, #1f2d45)',
                  background: 'var(--bg-primary, #0a0e1a)',
                  color: 'var(--text-primary, #f1f5f9)',
                  fontSize: 16,
                  fontWeight: 800,
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
              
              <button 
                type="button"
                onClick={() => handleLotsChange(lots + 1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: '1px solid var(--border, #1f2d45)',
                  background: 'var(--bg-hover, #1e2940)',
                  color: 'var(--text-primary, #f1f5f9)',
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s'
                }}
              >+</button>
            </div>

            {/* Quick Selection Buttons */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {[1, 5, 10, 50, 100].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setLots(val)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border, #1f2d45)',
                    background: lots === val ? 'var(--bg-hover, #1e2940)' : 'transparent',
                    color: lots === val ? 'var(--accent, #10b981)' : 'var(--text-secondary, #94a3b8)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {val} Lot
                </button>
              ))}
              
              <button
                type="button"
                onClick={() => setLots(Math.max(1, isBuy ? maxBuyLots : maxSellLots))}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  background: 'transparent',
                  color: isBuy ? 'var(--accent, #10b981)' : 'var(--red, #ef4444)',
                  fontSize: 11,
                  fontWeight: 700,
                  marginLeft: 'auto',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Max {isBuy ? 'Beli' : 'Jual'} ({isBuy ? maxBuyLots : maxSellLots} Lot)
              </button>
            </div>
          </div>

          {/* Checkout / Invoice Breakdown */}
          <div style={{ 
            background: 'var(--bg-primary, #0a0e1a)',
            border: '1px solid var(--border, #1f2d45)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', marginBottom: 12 }}>
              Rincian Pembayaran
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: 'var(--text-secondary, #94a3b8)' }}>
              <span>Nilai Saham ({qtyShares.toLocaleString('id-ID')} lbr)</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
                Rp {grossValue.toLocaleString('id-ID')}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12, color: 'var(--text-secondary, #94a3b8)' }}>
              <span>Biaya Transaksi ({(feeRate * 100).toFixed(2)}%)</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
                Rp {feeAmount.toLocaleString('id-ID')}
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border, #1f2d45)', margin: '12px 0 8px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                {isBuy ? 'Total Pembayaran' : 'Total Diterima'}
              </span>
              <span style={{ 
                fontSize: 18, 
                fontWeight: 800, 
                color: isBuy ? 'var(--accent, #10b981)' : 'var(--yellow, #f59e0b)' 
              }}>
                Rp {netValue.toLocaleString('id-ID')}
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border, #1f2d45)', margin: '8px 0 8px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted, #475569)' }}>
              <span>Estimasi Sisa Saldo:</span>
              <span style={{ fontWeight: 600, color: isInsufficient ? 'var(--red, #ef4444)' : 'var(--text-secondary, #94a3b8)' }}>
                Rp {(isBuy ? Math.max(0, balance - netValue) : (balance + netValue)).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {isInsufficient && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--red, #ef4444)',
              lineHeight: 1.5,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8
            }}>
              <span>⚠️</span>
              <span>
                {isBuy 
                  ? `Saldo virtual tidak mencukupi. Kurang Rp ${(netValue - balance).toLocaleString('id-ID')}`
                  : `Kepemilikan saham ${tickerClean} tidak mencukupi untuk dijual. Kurang ${(lots - maxSellLots)} Lot.`}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 10,
                border: '1px solid var(--border, #1f2d45)',
                background: 'transparent',
                color: 'var(--text-secondary, #94a3b8)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isInsufficient || processing}
              onClick={handleConfirm}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: isInsufficient 
                  ? 'var(--border, #1f2d45)' 
                  : isBuy ? 'var(--accent, #10b981)' : 'var(--red, #ef4444)',
                color: isInsufficient ? 'var(--text-muted, #475569)' : '#fff',
                fontWeight: 800,
                fontSize: 14,
                cursor: isInsufficient || processing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseEnter={e => {
                if (!isInsufficient && !processing) {
                  e.currentTarget.style.background = isBuy ? 'var(--accent-dim, #059669)' : '#dc2626'
                }
              }}
              onMouseLeave={e => {
                if (!isInsufficient && !processing) {
                  e.currentTarget.style.background = isBuy ? 'var(--accent, #10b981)' : 'var(--red, #ef4444)'
                }
              }}
            >
              {processing ? (
                <>
                  <span className="spinner-icon">⏳</span> Memproses...
                </>
              ) : (
                isBuy ? 'Konfirmasi & Bayar' : 'Konfirmasi & Jual'
              )}
            </button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .spinner-icon {
          animation: spin 1s linear infinite;
          display: inline-block;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
