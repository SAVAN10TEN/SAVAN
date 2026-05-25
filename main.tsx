import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in AMEDI TV:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f0a1e] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 rounded-2xl bg-[#9333ea]/10 border border-[#9333ea]/20 flex items-center justify-center mb-6 animate-pulse">
            <svg className="w-8 h-8 text-[#9333ea]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black mb-2 uppercase tracking-tight text-white/90 font-sans">Application Error</h1>
          <p className="text-xs text-[#94a3b8] max-w-sm mb-6 leading-relaxed opacity-70 font-sans">
            {this.state.error?.message || "Something went wrong in the application. Please try reloading or resetting the app."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs font-sans">
            <button
              onClick={this.handleReload}
              className="w-full px-5 py-3 rounded-2xl bg-[#9333ea] hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#9333ea]/20 hover:scale-[1.02] active:scale-95"
            >
              Reload Page
            </button>
            <button
              onClick={this.handleReset}
              className="w-full px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-black text-xs uppercase tracking-widest transition-all border border-white/10 cursor-pointer shadow-md hover:scale-[1.02] active:scale-95"
            >
              Reset App Data
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Suppress benign Vite WebSocket connection errors that can show as unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = event.reason ? String(event.reason) : '';
  const messageStr = event.reason?.message ? String(event.reason.message) : '';
  const isWebsocketError = 
    reasonStr.includes('WebSocket') || 
    reasonStr.includes('websocket') ||
    messageStr.includes('WebSocket') ||
    messageStr.includes('websocket') ||
    reasonStr.includes('failed to connect') ||
    messageStr.includes('failed to connect') ||
    reasonStr.includes('closed without opened') ||
    messageStr.includes('closed without opened');

  if (isWebsocketError) {
    event.preventDefault();
    event.stopPropagation();
  }
});

// Suppress uncaught WebSocket error events
window.addEventListener('error', (event) => {
  const messageStr = event.message ? String(event.message) : '';
  const errorStr = event.error ? String(event.error) : '';
  const isWebsocketError = 
    messageStr.includes('WebSocket') || 
    messageStr.includes('websocket') ||
    errorStr.includes('WebSocket') ||
    errorStr.includes('websocket') ||
    messageStr.includes('closed without opened') ||
    errorStr.includes('closed without opened');

  if (isWebsocketError) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
