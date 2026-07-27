import { useState, useEffect, useCallback } from 'react'

export interface StockNote {
  ticker: string
  note: string
  updatedAt: string
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const savedWatchlist = localStorage.getItem('stoxarea_watchlist')
      if (savedWatchlist) {
        setWatchlist(JSON.parse(savedWatchlist))
      }
      const savedNotes = localStorage.getItem('stoxarea_stock_notes')
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes))
      }
    } catch (err) {
      console.error('Failed to load watchlist from localStorage', err)
    }
  }, [])

  const saveWatchlist = (newList: string[]) => {
    setWatchlist(newList)
    if (typeof window !== 'undefined') {
      localStorage.setItem('stoxarea_watchlist', JSON.stringify(newList))
    }
  }

  const toggleWatchlist = useCallback((ticker: string) => {
    const cleanTicker = ticker.toUpperCase().replace('.JK', '')
    setWatchlist(prev => {
      const exists = prev.includes(cleanTicker)
      const next = exists ? prev.filter(t => t !== cleanTicker) : [...prev, cleanTicker]
      if (typeof window !== 'undefined') {
        localStorage.setItem('stoxarea_watchlist', JSON.stringify(next))
      }
      return next
    })
  }, [])

  const isWatchlisted = useCallback((ticker: string) => {
    const cleanTicker = ticker.toUpperCase().replace('.JK', '')
    return watchlist.includes(cleanTicker)
  }, [watchlist])

  const saveNote = (ticker: string, noteText: string) => {
    const cleanTicker = ticker.toUpperCase().replace('.JK', '')
    const updatedNotes = { ...notes, [cleanTicker]: noteText }
    setNotes(updatedNotes)
    if (typeof window !== 'undefined') {
      localStorage.setItem('stoxarea_stock_notes', JSON.stringify(updatedNotes))
    }
  }

  return {
    watchlist,
    notes,
    mounted,
    toggleWatchlist,
    isWatchlisted,
    saveNote,
  }
}
