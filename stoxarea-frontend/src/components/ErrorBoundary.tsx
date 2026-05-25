'use client'

import React, { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary Component
 * Catches errors in child components and displays fallback UI
 * Prevents entire app from crashing due to one component error
 * 
 * Usage:
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // You can also log to an error reporting service here
    // logErrorToService(error, errorInfo)
    
    this.setState((prevState) => ({
      ...prevState,
      errorInfo,
    }))
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-red-950">
          <div className="max-w-md w-full mx-4 p-6 bg-red-900 rounded-lg shadow-lg">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-800 p-3">
                <svg
                  className="w-6 h-6 text-red-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4v2m0-8a5 5 0 110 10 5 5 0 010-10z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold text-red-100 text-center mb-2">
              Oops! Something went wrong
            </h1>

            {/* Error Message */}
            <p className="text-red-200 text-center mb-4">
              An unexpected error occurred. Please try refreshing the page or contact support if
              the problem persists.
            </p>

            {/* Error Details (Development only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 bg-red-800 p-3 rounded text-sm text-red-100 max-h-40 overflow-auto">
                <summary className="cursor-pointer font-semibold mb-2">Error Details</summary>
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre className="whitespace-pre-wrap break-words text-xs mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600 transition font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition font-medium"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
