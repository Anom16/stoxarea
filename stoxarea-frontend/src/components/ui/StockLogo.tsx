'use client'
import { useState } from 'react'

// Domain mapping untuk saham BEI Indonesia
const STOCK_DOMAINS: Record<string, string> = {
  BBCA: 'bcabank.co.id',
  BBNI: 'bankbni.co.id',
  BBRI: 'bankbri.co.id',
  BMRI: 'bankmandiri.co.id',
  BBTN: 'btn.co.id',
  BRIS: 'bankbsi.co.id',
  ARTO: 'jago.com',
  BDMN: 'danamon.co.id',
  BJBR: 'bankbjbr.co.id',
  BJTM: 'bankjatim.co.id',
  BNGA: 'cimbniaga.co.id',
  PNBN: 'panin.co.id',
  AGRO: 'bankraya.co.id',
  BBYB: 'bankneocommerce.id',
  BVIC: 'victoriabank.co.id',
  TLKM: 'telkom.co.id',
  ISAT: 'indosat.com',
  EXCL: 'xlaxiata.co.id',
  TOWR: 'sarana-menara.com',
  JSMR: 'jasamarga.com',
  ASII: 'astra.co.id',
  UNVR: 'unilever.co.id',
  HMSP: 'hm-sampoerna.com',
  GGRM: 'gudanggaramtbk.com',
  ICBP: 'indofood.co.id',
  INDF: 'indofood.co.id',
  CPIN: 'cpin.co.id',
  JPFA: 'japfacomfeed.co.id',
  KLBF: 'kalbefarma.com',
  SIDO: 'sido.com',
  MIKA: 'mitrakeluarga.com',
  HEAL: 'herminahospitals.com',
  MAPI: 'mapi.com',
  ACES: 'aces.com',
  ERAA: 'erajaya.com',
  LPPF: 'matahari.com',
  MLBI: 'multipolar.com',
  SCMA: 'scma.com',
  MNCN: 'mncgroup.com',
  INCO: 'inco.co.id',
  ANTM: 'antam.com',
  TINS: 'tins.com',
  MDKA: 'merdekacoppergold.com',
  HRUM: 'harumenergy.com',
  CTRA: 'ctra.com',
  PWON: 'pwon.com',
  SMRA: 'smra.com',
  BSDE: 'bsde.com',
  LPCK: 'lippo.co.id',
  PGAS: 'pgn.co.id',
  PTBA: 'ptba.co.id',
  ADRO: 'adro.co.id',
  ITMG: 'itmg.co.id',
  MEDC: 'medcoenergi.com',
  INDY: 'indikaenergy.com',
  BUMI: 'bumi.co.id',
  TPIA: 'chandra-asri.co.id',
  BRPT: 'barito-pacific.com',
  INKP: 'app.co.id',
  TKIM: 'app.co.id',
  SMGR: 'sig.id',
  INTP: 'indocement.co.id',
  AMMN: 'amman.ne',
  GOTO: 'goto.com',
  BUKA: 'bukalapak.com',
  EMTK: 'emtek.com',
  PTPP: 'ptpp.co.id',
  ADHI: 'adhi.co.id',
  ASSA: 'assarent.cn',
  BIRD: 'bluebirdgroup.com',
  GIAA: 'garuda-indonesia.com',
  SMDR: 'samudera.id',
  TMAS: 'temasline.com',
  ULTJ: 'ultrajaya.co.id',
  ROTI: 'nipponindosari.co.id',
  WOOD: 'integraco.co.id',
  AVIA: 'aviabrands.com',
  AUTO: 'component.astra.co.id',
  DRMA: 'dharmapoli.com',
  SMSM: 'selamatsempurna.com',
  GJTL: 'gtires.com',
}

// Generate color from ticker
function getTickerColor(ticker: string): string {
  const colors = ['#1e88e5', '#43a047', '#e53935', '#fb8c00', '#8e24aa', '#00acc1', '#f4511e', '#6d4c41', '#546e7a']
  let hash = 0
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

interface StockLogoProps {
  ticker: string
  size?: number
}

export default function StockLogo({ ticker, size = 28 }: StockLogoProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const cleanT = ticker.replace('.JK', '').toUpperCase()
  const domain = STOCK_DOMAINS[cleanT]

  // Fallback placeholder dengan inisial
  const Placeholder = () => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: getTickerColor(cleanT),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
      }}
      title={cleanT}
    >
      {cleanT.substring(0, 2)}
    </div>
  )

  // Jika tidak ada domain mapping, tampilkan placeholder
  if (!domain) {
    return <Placeholder />
  }

  const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        overflow: 'hidden',
        flexShrink: 0,
        background: 'var(--bg-card, #1e293b)',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={cleanT}
    >
      {!loaded && !error && <Placeholder />}
      <img
        src={logoUrl}
        alt={cleanT}
        width={size}
        height={size}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          // If Google favicon fails, fallback to Clearbit before placeholder
          if (!logoUrl.includes('clearbit')) {
            const img = document.createElement('img')
            img.src = `https://logo.clearbit.com/${domain}`
            img.onload = () => setLoaded(true)
            img.onerror = () => setError(true)
          } else {
            setError(true)
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          padding: 2,
          display: loaded && !error ? 'block' : 'none',
        }}
      />
      {error && <Placeholder />}
    </div>
  )
}
