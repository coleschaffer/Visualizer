import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './popup.css';

function Popup() {
  const [isActive, setIsActive] = useState(false);
  const [mcpToken, setMcpToken] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Load initial state
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response) {
        setIsActive(response.isActive || false);
        setMcpToken(response.mcpToken || '');
        setConnectionStatus(response.connectionStatus || 'disconnected');
      }
    });
  }, []);

  // Toggle active state
  const handleToggle = async () => {
    const newState = !isActive;
    setIsActive(newState);

    // Get current tab and toggle
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_ACTIVE', active: newState });
    }

    chrome.runtime.sendMessage({ type: 'SET_ACTIVE', active: newState });
  };

  // Connect to MCP
  const handleConnect = () => {
    if (mcpToken.trim()) {
      chrome.runtime.sendMessage({ type: 'CONNECT_MCP', token: mcpToken.trim() }, () => {
        // Poll for status update after connecting
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
            if (response) {
              setConnectionStatus(response.connectionStatus || 'disconnected');
            }
          });
        }, 500);
      });
      setShowTokenInput(false);
      setConnectionStatus('connecting');
    }
  };

  const statusColors: Record<string, string> = {
    disconnected: '#9ca3af',
    connecting: '#f59e0b',
    connected: '#22c55e',
    error: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    disconnected: 'Not connected',
    connecting: 'Connecting...',
    connected: 'Connected to Claude Code',
    error: 'Connection error',
  };

  return (
    <div className="popup">
      <div className="popup-header">
        <h1>Visual Feedback</h1>
        <div
          className="status-dot"
          style={{ backgroundColor: statusColors[connectionStatus] }}
          title={statusLabels[connectionStatus]}
        />
      </div>

      <div className="popup-content">
        {/* Active toggle */}
        <div className="toggle-row">
          <span>Enable on current page</span>
          <button
            className={`toggle-btn ${isActive ? 'active' : ''}`}
            onClick={handleToggle}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        {/* Connection status */}
        <div className="status-section">
          <div className="status-row">
            <span className="status-label">Claude Code MCP</span>
            <span
              className="status-value"
              style={{ color: statusColors[connectionStatus] }}
            >
              {statusLabels[connectionStatus]}
            </span>
          </div>

          {connectionStatus === 'disconnected' && (
            <button
              className="connect-btn"
              onClick={() => setShowTokenInput(!showTokenInput)}
            >
              {showTokenInput ? 'Cancel' : 'Connect'}
            </button>
          )}

          {showTokenInput && (
            <div className="token-input-section">
              <input
                type="text"
                placeholder="Enter MCP token"
                value={mcpToken}
                onChange={(e) => setMcpToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              />
              <button onClick={handleConnect}>Connect</button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="instructions">
          <h3>How to use:</h3>
          <ol>
            <li>Click the toggle to enable</li>
            <li>Hover over elements to see info</li>
            <li>Click to select an element</li>
            <li>Adjust visually or type feedback</li>
            <li>Click Confirm to send to Claude</li>
          </ol>
        </div>

        {/* Keyboard shortcuts */}
        <div className="shortcuts">
          <h3>Shortcuts:</h3>
          <div className="shortcut-row">
            <kbd>Esc</kbd>
            <span>Deselect / Disable</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘Z</kbd>
            <span>Undo changes</span>
          </div>
          <div className="shortcut-row">
            <kbd>⌘Enter</kbd>
            <span>Confirm & send</span>
          </div>
        </div>
      </div>

      <div className="popup-footer">
        <span>v0.1.0</span>
        <a href="https://github.com/your-repo" target="_blank" rel="noopener">
          GitHub
        </a>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
