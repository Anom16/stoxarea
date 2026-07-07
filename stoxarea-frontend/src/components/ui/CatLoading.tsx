'use client'
import React from 'react'

interface CatLoadingProps {
  text?: string
}

export default function CatLoading({ text = 'Kucing AI sedang menyiapkan data... 🐾' }: CatLoadingProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      width: '100%',
      gap: 16,
      textAlign: 'center'
    }}>
      {/* CSS Styles for the Cat Spinner */}
      <style>{`
        @keyframes cat-bob {
          0% { transform: translateY(0) scaleY(1); }
          50% { transform: translateY(-10px) scaleY(0.95); }
          100% { transform: translateY(0) scaleY(1); }
        }
        @keyframes tail-wiggle {
          0% { transform: rotate(-5deg); }
          50% { transform: rotate(15deg); }
          100% { transform: rotate(-5deg); }
        }
        @keyframes ear-twitch-l {
          0%, 90%, 100% { transform: rotate(0); }
          95% { transform: rotate(-8deg); }
        }
        @keyframes ear-twitch-r {
          0%, 88%, 100% { transform: rotate(0); }
          93% { transform: rotate(8deg); }
        }
        .cat-spinner-body {
          animation: cat-bob 1.2s infinite ease-in-out;
        }
        .cat-spinner-tail {
          animation: tail-wiggle 1.2s infinite ease-in-out;
          transform-origin: 50px 72px;
        }
        .cat-ear-l {
          animation: ear-twitch-l 3s infinite ease-in-out;
          transform-origin: 35px 38px;
        }
        .cat-ear-r {
          animation: ear-twitch-r 3s infinite ease-in-out;
          transform-origin: 65px 38px;
        }
      `}</style>

      {/* Cute SVG Cat */}
      <svg 
        width="90" 
        height="90" 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="cat-spinner-body"
      >
        {/* Tail */}
        <path 
          d="M50 72 C44 82, 32 82, 32 72 C32 66, 38 63, 41 66" 
          stroke="#4CAF50" 
          strokeWidth="4" 
          strokeLinecap="round" 
          className="cat-spinner-tail"
        />
        {/* Body/Feet */}
        <ellipse cx="50" cy="70" rx="20" ry="11" fill="#16213e" stroke="#2a2e3d" strokeWidth="2.5" />
        {/* Head */}
        <circle cx="50" cy="48" r="16" fill="#16213e" stroke="#2a2e3d" strokeWidth="2.5" />
        {/* Left Ear */}
        <path d="M36 38 L32 25 L44 33" fill="#4CAF50" stroke="#2a2e3d" strokeWidth="2" strokeLinejoin="round" className="cat-ear-l" />
        {/* Right Ear */}
        <path d="M64 38 L68 25 L56 33" fill="#4CAF50" stroke="#2a2e3d" strokeWidth="2" strokeLinejoin="round" className="cat-ear-r" />
        {/* Eyes (Sleeping arcs) */}
        <path d="M42 48 Q44 50 46 48" stroke="#ccc" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M58 48 Q56 50 54 48" stroke="#ccc" strokeWidth="1.8" strokeLinecap="round" />
        {/* Nose/Mouth */}
        <path d="M50 50 L50 52 M50 52 Q49 53 48 53 M50 52 Q51 53 52 53" stroke="#ccc" strokeWidth="1.2" strokeLinecap="round" />
        {/* Whiskers */}
        <path d="M37 51 L29 50 M37 53 L27 53" stroke="#888" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M63 51 L71 50 M63 53 L73 53" stroke="#888" strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, letterSpacing: 0.5 }}>
        {text}
      </span>
    </div>
  )
}
