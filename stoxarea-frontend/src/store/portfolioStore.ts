import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Holding {
  ticker: string
  shares: number
  avgPrice: number
}

interface Transaction {
  id: string
  date: string
  ticker: string
  type: 'BUY' | 'SELL'
  shares: number
  price: number
  total: number
}

interface PortfolioState {
  cash: number
  holdings: Holding[]
  history: Transaction[]
  buyStock: (ticker: string, shares: number, price: number) => void
  sellStock: (ticker: string, shares: number, price: number) => void
  resetPortfolio: () => void
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      cash: 100000000, // Saldo awal Rp 100.000.000
      holdings: [],
      history: [],

      buyStock: (ticker, shares, price) => {
        const total = shares * price
        if (get().cash < total) {
          alert('Saldo tidak mencukupi!')
          return
        }

        set((state) => {
          const existing = state.holdings.find((h) => h.ticker === ticker)
          const newHoldings = existing
            ? state.holdings.map((h) =>
                h.ticker === ticker
                  ? {
                      ...h,
                      shares: h.shares + shares,
                      avgPrice: (h.avgPrice * h.shares + total) / (h.shares + shares),
                    }
                  : h
              )
            : [...state.holdings, { ticker, shares, avgPrice: price }]

          const newTx: Transaction = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            ticker,
            type: 'BUY',
            shares,
            price,
            total,
          }

          return {
            cash: state.cash - total,
            holdings: newHoldings,
            history: [newTx, ...state.history],
          }
        })
      },

      sellStock: (ticker, shares, price) => {
        const existing = get().holdings.find((h) => h.ticker === ticker)
        if (!existing || existing.shares < shares) {
          alert('Saham tidak mencukupi!')
          return
        }

        const total = shares * price
        set((state) => {
          const newHoldings = state.holdings
            .map((h) =>
              h.ticker === ticker ? { ...h, shares: h.shares - shares } : h
            )
            .filter((h) => h.shares > 0)

          const newTx: Transaction = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString(),
            ticker,
            type: 'SELL',
            shares,
            price,
            total,
          }

          return {
            cash: state.cash + total,
            holdings: newHoldings,
            history: [newTx, ...state.history],
          }
        })
      },

      resetPortfolio: () => set({ cash: 100000000, holdings: [], history: [] }),
    }),
    {
      name: 'stoxarea-portfolio',
    }
  )
)
