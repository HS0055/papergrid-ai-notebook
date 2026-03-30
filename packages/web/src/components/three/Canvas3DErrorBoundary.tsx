import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Change this key to reset the error state (e.g. when switching notebooks) */
  resetKey?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary specifically for 3D Canvas components.
 * Catches WebGL crashes, missing module errors, etc.
 * Renders the fallback instead of crashing the page.
 * Resets automatically when resetKey changes.
 */
export class Canvas3DErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
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
