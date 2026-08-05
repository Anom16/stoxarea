'use client'

export default function StoxCatLoader({
  message = 'Loading...',
}: {
  message?: string
  subMessage?: string
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#090d16',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {/* Background Radial Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(9, 13, 22, 0) 70%)',
          borderRadius: '50%',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Clean Loading Container */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Sleek Dual-Ring Radar Spinner */}
        <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 20 }}>
          {/* Outer Track Ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid rgba(255, 255, 255, 0.08)',
            }}
          />

          {/* Glowing Animated Spinner Ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: '#2563eb',
              borderRightColor: '#38bdf8',
              animation: 'sleekSpin 0.9s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite',
              filter: 'drop-shadow(0 0 10px rgba(37, 99, 235, 0.5))',
            }}
          />
        </div>

        {/* Clean Loading Text */}
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#f8fafc',
            letterSpacing: 0.5,
            opacity: 0.9,
          }}
        >
          {message}
        </span>
      </div>

      {/* Keyframe Animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes sleekSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `,
        }}
      />
    </div>
  )
}
