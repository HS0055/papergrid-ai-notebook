import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary specifically for 3D Canvas components.
 * Catches WebGL crashes, missing module errors, etc.
 * Renders nothing (or a fallback) instead of crashing the page.
 */
export class Canvas3DErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[PaperGrid] 3D scene error (gracefully hidden):', error.message);
    if (import.meta.env.DEV) {
      console.warn('[PaperGrid] Component stack:', info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
