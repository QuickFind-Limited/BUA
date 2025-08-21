/**
 * Recording Toolbar Injector
 * Creates a draggable floating toolbar for page recording control
 * Designed to be injected via page.addInitScript() during recording sessions
 */

export const createRecordingToolbarScript = () => {
  return `
    (function() {
      // Only inject once per page
      if (window.__recordingToolbarInjected) return;
      window.__recordingToolbarInjected = true;

      let toolbar = null;
      let isDragging = false;
      let currentX = 0;
      let currentY = 0;
      let initialX = 0;
      let initialY = 0;
      let startTime = Date.now();
      let timerInterval = null;

      // Recording state
      let recordingState = {
        isRecording: false,
        isPaused: false,
        startTime: null,
        elapsedTime: 0
      };

      // Create toolbar with modern styling based on existing CSS patterns
      function createToolbar() {
        if (toolbar) return toolbar;

        toolbar = document.createElement('div');
        toolbar.id = 'cua-recording-toolbar';
        toolbar.innerHTML = \`
          <div class="toolbar-handle">
            <div class="toolbar-drag-indicator">⋮⋮</div>
          </div>
          <div class="toolbar-content">
            <div class="recording-status">
              <div class="recording-dot"></div>
              <span class="status-text">Ready</span>
              <span class="recording-timer">00:00</span>
            </div>
            <div class="toolbar-controls">
              <button id="start-btn" class="toolbar-btn primary" title="Start Recording">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                Start
              </button>
              <button id="pause-btn" class="toolbar-btn secondary" title="Pause Recording" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
                Pause
              </button>
              <button id="resume-btn" class="toolbar-btn success" title="Resume Recording" disabled style="display: none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                Resume
              </button>
              <button id="stop-btn" class="toolbar-btn danger" title="Stop Recording" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="18" height="18"/>
                </svg>
                Stop
              </button>
            </div>
            <button class="toolbar-minimize" title="Minimize">−</button>
          </div>
        \`;

        // Apply comprehensive inline styles based on existing design system
        const styles = \`
          #cua-recording-toolbar {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 999999;
            user-select: none;
            min-width: 280px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
          }

          #cua-recording-toolbar:hover {
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
          }

          #cua-recording-toolbar.minimized {
            min-width: auto;
          }

          #cua-recording-toolbar.minimized .toolbar-content {
            display: none;
          }

          #cua-recording-toolbar.minimized .toolbar-handle {
            padding: 8px 12px;
            border-radius: 8px;
            background: #2196F3;
            color: white;
            cursor: pointer;
          }

          .toolbar-handle {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
            background: #f8f8f8;
            border-bottom: 1px solid #e0e0e0;
            border-radius: 8px 8px 0 0;
            cursor: move;
          }

          .toolbar-drag-indicator {
            color: #666666;
            font-size: 12px;
            letter-spacing: 2px;
            font-weight: bold;
          }

          .toolbar-content {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .recording-status {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: #f5f5f5;
            border-radius: 6px;
            font-size: 13px;
          }

          .recording-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #cccccc;
            transition: all 0.3s ease;
          }

          .recording-status.recording .recording-dot {
            background: #ff4444;
            animation: pulse 1.5s ease-in-out infinite;
          }

          .recording-status.paused .recording-dot {
            background: #ff9800;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.2); }
          }

          .status-text {
            font-weight: 500;
            color: #333333;
            flex: 1;
          }

          .recording-timer {
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
            font-size: 12px;
            color: #666666;
            background: #ffffff;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid #d0d0d0;
            min-width: 45px;
            text-align: center;
          }

          .toolbar-controls {
            display: flex;
            gap: 6px;
          }

          .toolbar-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 10px;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            flex: 1;
          }

          .toolbar-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .toolbar-btn.primary {
            background: #2196F3;
            color: white;
          }

          .toolbar-btn.primary:hover:not(:disabled) {
            background: #1976D2;
          }

          .toolbar-btn.secondary {
            background: #6c757d;
            color: white;
          }

          .toolbar-btn.secondary:hover:not(:disabled) {
            background: #5a6268;
          }

          .toolbar-btn.success {
            background: #4caf50;
            color: white;
          }

          .toolbar-btn.success:hover:not(:disabled) {
            background: #45a049;
          }

          .toolbar-btn.danger {
            background: #ff4444;
            color: white;
          }

          .toolbar-btn.danger:hover:not(:disabled) {
            background: #cc0000;
          }

          .toolbar-minimize {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 24px;
            height: 24px;
            border: none;
            background: transparent;
            color: #666666;
            cursor: pointer;
            border-radius: 4px;
            font-size: 16px;
            line-height: 1;
            transition: all 0.2s ease;
          }

          .toolbar-minimize:hover {
            background: #f0f0f0;
            color: #333333;
          }

          /* Responsive adjustments */
          @media (max-width: 600px) {
            #cua-recording-toolbar {
              right: 10px;
              top: 10px;
              min-width: 240px;
            }
            
            .toolbar-controls {
              flex-direction: column;
              gap: 4px;
            }
            
            .toolbar-btn {
              justify-content: center;
            }
          }
        \`;

        // Inject styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Add drag functionality
        setupDragHandling();
        
        // Add button event listeners
        setupButtonHandlers();

        // Position toolbar
        positionToolbar();

        document.body.appendChild(toolbar);
        return toolbar;
      }

      function setupDragHandling() {
        const handle = toolbar.querySelector('.toolbar-handle');
        
        handle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        // Touch support for mobile
        handle.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', dragEnd);
      }

      function dragStart(e) {
        const event = e.touches ? e.touches[0] : e;
        initialX = event.clientX - currentX;
        initialY = event.clientY - currentY;

        if (e.target === toolbar.querySelector('.toolbar-handle') || 
            e.target === toolbar.querySelector('.toolbar-drag-indicator')) {
          isDragging = true;
          toolbar.style.transition = 'none';
        }
      }

      function drag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        const event = e.touches ? e.touches[0] : e;
        
        currentX = event.clientX - initialX;
        currentY = event.clientY - initialY;

        // Constrain to viewport
        const rect = toolbar.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));

        toolbar.style.transform = \`translate(\${currentX}px, \${currentY}px)\`;
      }

      function dragEnd() {
        if (!isDragging) return;
        
        isDragging = false;
        toolbar.style.transition = 'all 0.3s ease';
        
        // Snap to edges if close
        const rect = toolbar.getBoundingClientRect();
        const snapThreshold = 20;
        
        if (currentX < snapThreshold) {
          currentX = 0;
          toolbar.style.transform = \`translate(\${currentX}px, \${currentY}px)\`;
        } else if (currentX > window.innerWidth - rect.width - snapThreshold) {
          currentX = window.innerWidth - rect.width;
          toolbar.style.transform = \`translate(\${currentX}px, \${currentY}px)\`;
        }
      }

      function positionToolbar() {
        // Start in top-right corner
        const rect = toolbar.getBoundingClientRect();
        currentX = window.innerWidth - rect.width - 20;
        currentY = 20;
        toolbar.style.transform = \`translate(\${currentX}px, \${currentY}px)\`;
      }

      function setupButtonHandlers() {
        const startBtn = toolbar.querySelector('#start-btn');
        const pauseBtn = toolbar.querySelector('#pause-btn');
        const resumeBtn = toolbar.querySelector('#resume-btn');
        const stopBtn = toolbar.querySelector('#stop-btn');
        const minimizeBtn = toolbar.querySelector('.toolbar-minimize');

        startBtn.addEventListener('click', startRecording);
        pauseBtn.addEventListener('click', pauseRecording);
        resumeBtn.addEventListener('click', resumeRecording);
        stopBtn.addEventListener('click', stopRecording);
        minimizeBtn.addEventListener('click', toggleMinimize);
      }

      function updateTimer() {
        if (!recordingState.startTime) return;
        
        const elapsed = recordingState.isPaused ? 
          recordingState.elapsedTime : 
          (Date.now() - recordingState.startTime + recordingState.elapsedTime);
        
        const minutes = Math.floor(elapsed / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
        
        toolbar.querySelector('.recording-timer').textContent = \`\${minutes}:\${seconds}\`;
      }

      function updateUI() {
        const statusElement = toolbar.querySelector('.recording-status');
        const statusText = toolbar.querySelector('.status-text');
        const startBtn = toolbar.querySelector('#start-btn');
        const pauseBtn = toolbar.querySelector('#pause-btn');
        const resumeBtn = toolbar.querySelector('#resume-btn');
        const stopBtn = toolbar.querySelector('#stop-btn');

        // Reset classes
        statusElement.className = 'recording-status';
        
        if (recordingState.isRecording && !recordingState.isPaused) {
          statusElement.classList.add('recording');
          statusText.textContent = 'Recording';
          startBtn.disabled = true;
          pauseBtn.disabled = false;
          pauseBtn.style.display = '';
          resumeBtn.style.display = 'none';
          stopBtn.disabled = false;
        } else if (recordingState.isPaused) {
          statusElement.classList.add('paused');
          statusText.textContent = 'Paused';
          startBtn.disabled = true;
          pauseBtn.disabled = true;
          pauseBtn.style.display = 'none';
          resumeBtn.style.display = '';
          resumeBtn.disabled = false;
          stopBtn.disabled = false;
        } else {
          statusText.textContent = 'Ready';
          startBtn.disabled = false;
          pauseBtn.disabled = true;
          pauseBtn.style.display = '';
          resumeBtn.style.display = 'none';
          stopBtn.disabled = true;
        }
      }

      // Recording control functions
      function startRecording() {
        recordingState.isRecording = true;
        recordingState.isPaused = false;
        recordingState.startTime = Date.now();
        recordingState.elapsedTime = 0;
        
        // Start timer
        timerInterval = setInterval(updateTimer, 1000);
        
        // Call recording API if available
        if (window.__recordingAPI && window.__recordingAPI.start) {
          window.__recordingAPI.start();
        }
        
        updateUI();
        console.log('🎬 Recording started');
      }

      function pauseRecording() {
        if (!recordingState.isRecording) return;
        
        recordingState.isPaused = true;
        recordingState.elapsedTime += Date.now() - recordingState.startTime;
        
        if (window.__recordingAPI && window.__recordingAPI.pause) {
          window.__recordingAPI.pause();
        }
        
        updateUI();
        console.log('⏸️ Recording paused');
      }

      function resumeRecording() {
        if (!recordingState.isPaused) return;
        
        recordingState.isPaused = false;
        recordingState.startTime = Date.now();
        
        if (window.__recordingAPI && window.__recordingAPI.resume) {
          window.__recordingAPI.resume();
        }
        
        updateUI();
        console.log('▶️ Recording resumed');
      }

      function stopRecording() {
        recordingState.isRecording = false;
        recordingState.isPaused = false;
        recordingState.startTime = null;
        recordingState.elapsedTime = 0;
        
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        
        // Reset timer display
        toolbar.querySelector('.recording-timer').textContent = '00:00';
        
        if (window.__recordingAPI && window.__recordingAPI.stop) {
          window.__recordingAPI.stop();
        }
        
        updateUI();
        console.log('⏹️ Recording stopped');
      }

      function toggleMinimize() {
        toolbar.classList.toggle('minimized');
        
        if (toolbar.classList.contains('minimized')) {
          toolbar.querySelector('.toolbar-handle').textContent = '📹';
          toolbar.querySelector('.toolbar-handle').style.cursor = 'pointer';
          toolbar.querySelector('.toolbar-handle').onclick = toggleMinimize;
        } else {
          toolbar.querySelector('.toolbar-handle').innerHTML = \`
            <div class="toolbar-drag-indicator">⋮⋮</div>
          \`;
          toolbar.querySelector('.toolbar-handle').style.cursor = 'move';
          toolbar.querySelector('.toolbar-handle').onclick = null;
        }
      }

      // Expose global interface for external control
      window.__recordingToolbar = {
        show: () => {
          if (!toolbar) createToolbar();
          toolbar.style.display = '';
        },
        hide: () => {
          if (toolbar) toolbar.style.display = 'none';
        },
        destroy: () => {
          if (toolbar) {
            toolbar.remove();
            toolbar = null;
          }
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }
        },
        setStatus: (status) => {
          if (!toolbar) return;
          const statusText = toolbar.querySelector('.status-text');
          if (statusText) statusText.textContent = status;
        },
        getState: () => recordingState
      };

      // Auto-create toolbar when script loads
      createToolbar();
      updateUI();

      // Handle page unload
      window.addEventListener('beforeunload', () => {
        if (window.__recordingToolbar) {
          window.__recordingToolbar.destroy();
        }
      });

      console.log('🎬 Recording toolbar injected successfully');
    })();
  `;
};

/**
 * Typescript interface for the recording API that should be exposed on the page
 */
export interface RecordingAPI {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  getStatus(): {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
  };
}

/**
 * Helper function to inject the toolbar into a Playwright page
 */
export const injectRecordingToolbar = async (page: any) => {
  try {
    await page.addInitScript(createRecordingToolbarScript());
    console.log('✅ Recording toolbar script injected into page');
  } catch (error) {
    console.error('❌ Failed to inject recording toolbar:', error);
  }
};

/**
 * Example usage with recording API exposure
 */
export const exposeRecordingAPI = async (page: any, recordingControls: any) => {
  try {
    await page.exposeFunction('__recordingAPI', {
      start: () => {
        console.log('Recording API: Start called');
        return recordingControls.start();
      },
      pause: () => {
        console.log('Recording API: Pause called');
        return recordingControls.pause();
      },
      resume: () => {
        console.log('Recording API: Resume called');
        return recordingControls.resume();
      },
      stop: () => {
        console.log('Recording API: Stop called');
        return recordingControls.stop();
      }
    });
    
    console.log('✅ Recording API exposed to page context');
  } catch (error) {
    console.error('❌ Failed to expose recording API:', error);
  }
};