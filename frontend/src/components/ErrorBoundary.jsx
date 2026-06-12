import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary Caught Crash]', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    // Safely reload the page to reconnect and restore match state from server
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #090e18, #050a12)',
          color: '#f3f4f6',
          fontFamily: "'DM Sans', sans-serif",
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '500px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1.5px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '24px',
            padding: '40px 32px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(239, 68, 68, 0.05) inset',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}>
              ⚠️
            </div>
            
            <div>
              <h1 style={{
                fontSize: '20px',
                fontWeight: 800,
                color: '#ef4444',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Match Interface Error
              </h1>
              <p style={{
                fontSize: '13px',
                color: 'rgba(156, 163, 175, 0.8)',
                lineHeight: 1.6,
                margin: 0,
              }}>
                A temporary rendering exception occurred in the board interface. Since the match state is securely saved on our server, you can safely reload to resume your game exactly where you left off.
              </p>
            </div>

            <button
              onClick={this.handleReload}
              style={{
                width: '100%',
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #d4af37 0%, #aa771c 100%)',
                border: 'none',
                color: '#000000',
                fontWeight: 900,
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(212, 175, 55, 0.25)',
                transition: 'all 0.2s',
              }}
            >
              🔄 Reload & Resume Match
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
