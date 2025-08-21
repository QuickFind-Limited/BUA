/**
 * Recording UI Handler
 * Manages UI state during recording sessions
 */
class RecordingUIHandler {
  constructor() {
    this.originalTabbarDisplay = '';
    this.originalWebviewDisplay = '';
    this.isRecording = false;
    this.setupIpcListeners();
  }

  setupIpcListeners() {
    // Check if electronAPI exists and has event methods
    if (!window.electronAPI || !window.electronAPI.onTabsUpdated) {
      console.log('ElectronAPI event listeners not available yet');
      return;
    }
    
    // Listen for recording state changes using the tab update mechanism
    // Since we don't have generic 'on' method, we'll need to use what's available
    // or implement these in the preload script
    console.log('Recording UI handler ready, waiting for IPC messages');
  }

  /**
   * Hide Electron tabbar to make room for Chromium tabs
   */
  hideTabbarForRecording() {
    console.log('Hiding Electron tabbar for recording...');
    
    // Find tabbar element
    const tabbar = document.querySelector('.tab-bar');
    const navbar = document.querySelector('.nav-bar');
    
    if (tabbar) {
      this.originalTabbarDisplay = tabbar.style.display;
      tabbar.style.display = 'none';
    }
    
    // Also hide navigation bar if it exists
    if (navbar) {
      navbar.style.display = 'none';
    }
    
    // Adjust sidebar to use full height
    const sidebar = document.querySelector('.analysis-sidebar');
    if (sidebar) {
      sidebar.style.top = '0';
      sidebar.style.height = '100vh';
    }
    
    // Show recording indicator in sidebar
    this.showRecordingIndicator();
    
    // Notify main process that UI is ready
    window.electronAPI.send('tabbar-hidden');
  }

  /**
   * Restore Electron tabbar after recording
   */
  showTabbarAfterRecording() {
    console.log('Restoring Electron tabbar...');
    
    // Restore tabbar
    const tabbar = document.querySelector('.tab-bar');
    const navbar = document.querySelector('.nav-bar');
    
    if (tabbar) {
      tabbar.style.display = this.originalTabbarDisplay || '';
    }
    
    if (navbar) {
      navbar.style.display = '';
    }
    
    // Restore sidebar position
    const sidebar = document.querySelector('.analysis-sidebar');
    if (sidebar) {
      sidebar.style.top = '';
      sidebar.style.height = '';
    }
    
    // Hide recording indicator
    this.hideRecordingIndicator();
    
    // Notify main process
    window.electronAPI.send('tabbar-shown');
  }

  /**
   * Hide WebContentsView during recording
   */
  hideWebContentsView() {
    // WebContentsView is managed by main process
    // This is just for any UI adjustments needed
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      this.originalWebviewDisplay = contentArea.style.display;
      contentArea.style.display = 'none';
    }
  }

  /**
   * Show WebContentsView after recording
   */
  showWebContentsView() {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.style.display = this.originalWebviewDisplay || '';
    }
  }

  /**
   * Show recording indicator in sidebar
   */
  showRecordingIndicator() {
    // Check if indicator already exists
    let indicator = document.querySelector('.recording-indicator');
    if (indicator) return;
    
    // Create recording indicator
    indicator = document.createElement('div');
    indicator.className = 'recording-indicator';
    indicator.innerHTML = `
      <div class="recording-dot"></div>
      <span>Recording in Progress</span>
      <div class="recording-instructions">
        <p>Use Chromium tabs:</p>
        <ul>
          <li><kbd>Ctrl+T</kbd> New tab</li>
          <li><kbd>Ctrl+Tab</kbd> Switch tabs</li>
          <li><kbd>Ctrl+W</kbd> Close tab</li>
        </ul>
      </div>
    `;
    
    // Add to sidebar
    const sidebar = document.querySelector('.analysis-sidebar');
    if (sidebar) {
      sidebar.insertBefore(indicator, sidebar.firstChild);
    }
    
    // Add CSS if not already present
    if (!document.querySelector('#recording-indicator-styles')) {
      const style = document.createElement('style');
      style.id = 'recording-indicator-styles';
      style.textContent = `
        .recording-indicator {
          background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
          color: white;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          position: relative;
          overflow: hidden;
        }
        
        .recording-dot {
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }
        
        .recording-instructions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 12px;
          font-size: 12px;
          font-weight: normal;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
          z-index: 1000;
        }
        
        .recording-indicator:hover .recording-instructions {
          opacity: 1;
        }
        
        .recording-instructions ul {
          margin: 8px 0 0 20px;
          padding: 0;
        }
        
        .recording-instructions li {
          margin: 4px 0;
        }
        
        .recording-instructions kbd {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 11px;
        }
        
        /* Adjust sidebar when recording */
        .analysis-sidebar.recording-mode {
          padding-top: 0;
        }
        
        /* Hide Electron tabs during recording */
        .recording-active .tab-bar,
        .recording-active .nav-bar {
          display: none !important;
        }
        
        /* Full height sidebar during recording */
        .recording-active .analysis-sidebar {
          top: 0 !important;
          height: 100vh !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Add recording class to body
    document.body.classList.add('recording-active');
  }

  /**
   * Hide recording indicator
   */
  hideRecordingIndicator() {
    const indicator = document.querySelector('.recording-indicator');
    if (indicator) {
      indicator.remove();
    }
    
    // Remove recording class from body
    document.body.classList.remove('recording-active');
  }

  /**
   * Handle recording started event
   */
  onRecordingStarted(data) {
    this.isRecording = true;
    console.log('Recording started:', data);
    
    // Update sidebar progress if needed
    if (window.sidebarManager) {
      window.sidebarManager.updateProgress('recording', 'active');
    }
    
    // Show notification
    this.showNotification('Recording Started', `Session: ${data.sessionId}`);
  }

  /**
   * Handle recording stopped event
   */
  onRecordingStopped(data) {
    this.isRecording = false;
    console.log('Recording stopped:', data);
    
    // Update sidebar progress
    if (window.sidebarManager) {
      window.sidebarManager.updateProgress('recording', 'completed');
    }
    
    // Show notification
    this.showNotification('Recording Complete', 
      `${data.tabCount || 1} tabs, ${data.actionCount || 0} actions recorded`);
  }

  /**
   * Show notification
   */
  showNotification(title, message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'recording-notification';
    notification.innerHTML = `
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    `;
    
    // Add styles if needed
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        .recording-notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 16px 20px;
          border-radius: 8px;
          min-width: 250px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease;
          z-index: 10000;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .notification-title {
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .notification-message {
          font-size: 14px;
          opacity: 0.9;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
}

// Initialize handler when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.recordingUIHandler = new RecordingUIHandler();
  });
} else {
  window.recordingUIHandler = new RecordingUIHandler();
}