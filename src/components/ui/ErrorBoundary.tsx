'use client'

import { Component, ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { Error as ErrorIcon } from '@mui/icons-material'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Box className="h-screen w-screen flex items-center justify-center bg-gray-100 p-4">
          <Box className="bg-white elevation-3 rounded-lg p-8 max-w-md text-center">
            <ErrorIcon className="text-red-500 mb-4" style={{ fontSize: 64 }} />
            <Typography variant="h5" className="mb-2 font-medium">
              Something went wrong
            </Typography>
            <Typography variant="body2" className="text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                // Soft reset: clearing the boundary is enough to re-mount
                // the children and preserve sidebar / tab / playback state.
                // A full page reload should stay reserved for genuinely
                // unrecoverable failures.
                this.setState({ hasError: false, error: null })
              }}
            >
              Try Again
            </Button>
          </Box>
        </Box>
      )
    }

    return this.props.children
  }
}
