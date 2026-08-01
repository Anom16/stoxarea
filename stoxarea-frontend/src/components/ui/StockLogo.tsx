'use client'
import { useState } from 'react'

// Domain mapping untuk 115 saham BEI Indonesia Qualified
const STOCK_DOMAINS: Record<string, string> = {
  BBCA: 'bcabank.co.id',
  BBRI: 'bankbri.co.id',
  BMRI: 'bankmandiri.co.id',
  BBNI: 'bankbni.co.id',
  TLKM: 'telkom.co.id',
  ASII: 'astra.co.id',
  UNTR: 'unitedtractors.com',
  ADRO: 'adro.co.id',
  PTBA: 'ptba.co.id',
  ITMG: 'itmg.co.id',
  UNVR: 'unilever.co.id',
  ICBP: 'indofoodcbp.com',
  INDF: 'indofood.com',
  KLBF: 'kalbefarma.com',
  CPIN: 'cpin.co.id',
  AMRT: 'alfamart.co.id',
  PGAS: 'pgn.co.id',
  AKRA: 'akr.co.id',
  TOWR: 'sarana-menara.com',
  BRPT: 'barito-pacific.com',
  TPIA: 'chandra-asri.com',
  INKP: 'app.co.id',
  TKIM: 'app.co.id',
  SMGR: 'sig.id',
  INTP: 'indocement.co.id',
  ANTM: 'antam.com',
  TINS: 'timah.com',
  MDKA: 'merdekacoppergold.com',
  HRUM: 'harumenergy.com',
  MEDC: 'medcoenergi.com',
  INDY: 'indikaenergy.com',
  EXCL: 'xlaxiata.co.id',
  ISAT: 'indosat.com',
  JSMR: 'jasamarga.com',
  PTPP: 'ptpp.co.id',
  ADHI: 'adhi.co.id',
  BSDE: 'bsde.co.id',
  PWON: 'pakuwon.com',
  CTRA: 'ciputra.com',
  SMRA: 'summarecon.com',
  ASSA: 'assa.id',
  BIRD: 'bluebirdgroup.com',
  GIAA: 'garuda-indonesia.com',
  SMDR: 'samudera.id',
  TMAS: 'temasline.com',
  SCMA: 'sctv.co.id',
  MNCN: 'mncmedia.co.id',
  EMTK: 'emtek.co.id',
  BUKA: 'bukalapak.com',
  MIKA: 'mitrakeluarga.com',
  HEAL: 'herminahospitals.com',
  SIDO: 'sidomuncul.co.id',
  MYOR: 'mayora.com',
  ULTJ: 'ultrajaya.co.id',
  ROTI: 'nipponindosari.co.id',
  WOOD: 'integraco.co.id',
  AVIA: 'aviabrands.com',
  ACES: 'acehardware.co.id',
  ERAA: 'erajaya.com',
  LPPF: 'matahari.com',
  MAPI: 'map.co.id',
  AMMN: 'amman.ne',
  BRIS: 'bankbsi.co.id',
  BBTN: 'btn.co.id',
  BJBR: 'bankbjbr.co.id',
  BJTM: 'bankjatim.co.id',
  ARTO: 'jago.com',
  BNGA: 'cimbniaga.co.id',
  PNBN: 'panin.co.id',
  BDMN: 'danamon.co.id',
  AGRO: 'bankraya.co.id',
  BBYB: 'bankneocommerce.id',
  BVIC: 'victoriabank.co.id',
  FILM: 'mdcorp.co.id',
  RAAM: 'rapifilm.com',
  MTDL: 'metrodata.co.id',
  PTSN: 'satnusa.com',
  BULL: 'buana-laju.com',
  ELSA: 'elsa.co.id',
  WINS: 'wintermar.com',
  MBMA: 'merdekabattery.com',
  NCKL: 'haritanickel.com',
  ABMM: 'abm-investama.com',
  ADMR: 'adarominerals.id',
  DOID: 'deltadunia.com',
  KKGI: 'resource-alam.com',
  RMKE: 'rmkenergy.com',
  CUAN: 'petrindo.co.id',
  BREN: 'baritorenewables.co.id',
  MBSS: 'mitrabahasasamudera.com',
  HAIS: 'pelayaran-hais.com',
  TPMA: 'transpower.co.id',
  LSIP: 'pplonsum.com',
  AALI: 'astra-agro.co.id',
  TAPG: 'triputra-agro.com',
  DSNG: 'dsn.co.id',
  SIMP: 'salimivomas.com',
  BWPT: 'eaglehighplantations.com',
  TBLA: 'tunasbaru-lampung.com',
  JPFA: 'japfacomfeed.co.id',
  MAIN: 'malindofeedmill.com',
  WMUU: 'widodo-makmur.com',
  STAA: 'sumbertaniagung.com',
  CLEO: 'sariguna.co.id',
  PANI: 'pantai-indah-kapuk.com',
  DILD: 'intiland.com',
  KIJA: 'jababeka.com',
  SSIA: 'surjaindah.co.id',
  BEST: 'bebeka.co.id',
  ASRI: 'alamsuterarealty.com',
  NZIA: 'nusantara-almazia.com',
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

  // Urutan pencarian logo asli (Real Corporate Logo Sources)
  const sources = [
    `/logos/${cleanT}.svg`,
    `/logos/${cleanT}.png`,
    domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : '',
    domain ? `https://logo.clearbit.com/${domain}` : '',
    domain ? `https://icon.horse/icon/${domain}` : '',
    domain ? `https://unavatar.io/${domain}?fallback=false` : '',
  ].filter(Boolean)

  const [sourceIndex, setSourceIndex] = useState(0)

  const currentSrc = sources[sourceIndex] || ''

  const handleNextSource = () => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((prev) => prev + 1)
    } else {
      setError(true)
    }
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        overflow: 'hidden',
        flexShrink: 0,
        background: '#ffffff',
        border: '1px solid var(--border-color, rgba(225, 231, 239, 0.15))',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
      title={cleanT}
    >
      {/* Skeleton Loading saat gambar logo asli sedang dimuat */}
      {!loaded && !error && (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '200% 100%',
            animation: 'pulse 1.5s infinite',
          }}
        />
      )}

      {/* Gambar Logo Asli Perusahaan */}
      {!error && currentSrc && (
        <img
          src={currentSrc}
          alt={cleanT}
          width={size}
          height={size}
          loading="lazy"
          onLoad={(e) => {
            const img = e.currentTarget
            if (img.naturalWidth <= 12 && img.naturalHeight <= 12) {
              handleNextSource()
            } else {
              setLoaded(true)
            }
          }}
          onError={handleNextSource}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 2,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.15s ease-in-out',
          }}
        />
      )}

      {/* Fallback Badge jika semua 6 sumber API online/lokal gagal */}
      {error && (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: getTickerColor(cleanT),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.38,
            fontWeight: 800,
            color: '#fff',
          }}
        >
          {cleanT.substring(0, 2)}
        </div>
      )}
    </div>
  )
}
