// Modern Sidebar Manager with WebContentsView bounds integration
class ModernSidebar {
  constructor() {
    this.sidebar = null;
    this.isVisible = false;
    this.isCollapsed = false;
    this.floatingToggle = null;
    
    this.initialize();
  }
  
  initialize() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createSidebar());
    } else {
      this.createSidebar();
    }
  }
  
  createSidebar() {
    // Use existing sidebar from HTML instead of creating a new one
    this.sidebar = document.getElementById('analysis-sidebar');
    
    if (this.sidebar) {
      console.log('Using existing analysis-sidebar element');
      // Get references to existing elements
      this.toggleBtn = document.getElementById('sidebar-toggle-btn');
      this.floatingToggle = document.getElementById('floating-toggle');
      // Timer element removed
      this.detailContent = document.getElementById('detail-content');
      
      // Initialize sidebar as always expanded and visible
      this.isVisible = true;
      this.isCollapsed = false;
      this.sidebar.classList.add('active');
      this.sidebar.classList.remove('collapsed');
      document.body.classList.add('sidebar-open');
      document.body.classList.remove('sidebar-collapsed');
      
      // Hide toggle button - sidebar is always expanded
      if (this.toggleBtn) {
        this.toggleBtn.style.display = 'none';
      }
      
      // Hide floating toggle since we don't need hidden state
      if (this.floatingToggle) {
        this.floatingToggle.style.display = 'none';
      }
      
      console.log('Initial sidebar state - isVisible:', this.isVisible, 'isCollapsed:', this.isCollapsed);
      
      // Notify main process to set sidebar to full width (320px)
      if (window.electronAPI && window.electronAPI.sidebar) {
        window.electronAPI.sidebar.resize(320).then(result => {
          console.log('Sidebar width set to 320px (always expanded):', result);
        });
      }
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Create and add floating toggle if needed
      // this.createFloatingToggle(); // Skip for now since we're using existing HTML
      return;
    }
    
    console.log('Creating new modern-sidebar element');
    // Fallback: Create sidebar HTML structure if it doesn't exist
    const sidebarHTML = `
      <div id="modern-sidebar" class="modern-sidebar">
        <div class="sidebar-header">
          <h3>Workflow Analysis</h3>
          <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" title="Collapse">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>
        
        <div class="progress-section">
          <div class="progress-item" id="progress-recording">
            <span class="progress-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
            </span>
            <span class="progress-label">Recording captured</span>
            <span class="progress-status"></span>
          </div>
          
          <div class="progress-item" id="progress-parsing">
            <span class="progress-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </span>
            <span class="progress-label">Parsing actions</span>
            <span class="progress-status"></span>
          </div>
          
          <div class="progress-item" id="progress-analyzing">
            <span class="progress-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
            </span>
            <span class="progress-label">AI analysis</span>
            <span class="progress-status"></span>
          </div>
          
          <div class="progress-item" id="progress-variables">
            <span class="progress-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </span>
            <span class="progress-label">Extracting variables</span>
            <span class="progress-status"></span>
          </div>
          
          <div class="progress-item" id="progress-generating">
            <span class="progress-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </span>
            <span class="progress-label">Generating Intent Spec</span>
            <span class="progress-status"></span>
          </div>
          
          <div class="progress-item" id="progress-validating">
            <span class="progress-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
              </svg>
            </span>
            <span class="progress-label">Validating output</span>
            <span class="progress-status"></span>
          </div>
        </div>
        
        <div class="analysis-details">
          <h4>Details</h4>
          <div class="detail-content" id="detail-content">
            <div class="detail-item">Ready to analyze...</div>
          </div>
        </div>
      </div>
      
      <button class="floating-toggle" id="floating-toggle" title="Show Analysis Panel">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    `;
    
    // Add to document
    const container = document.createElement('div');
    container.innerHTML = sidebarHTML;
    document.body.appendChild(container.firstElementChild);
    document.body.appendChild(container.firstElementChild);
    
    // Get references
    this.sidebar = document.getElementById('modern-sidebar');
    this.toggleBtn = document.getElementById('sidebar-toggle-btn');
    this.floatingToggle = document.getElementById('floating-toggle');
    this.timerElement = document.getElementById('analysis-timer');
    this.detailContent = document.getElementById('detail-content');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load modern styles if not already loaded
    if (!document.querySelector('link[href*="styles-modern.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'styles-modern.css';
      document.head.appendChild(link);
    }
  }
  
  setupEventListeners() {
    // Toggle button disabled - sidebar always expanded
    // if (this.toggleBtn) {
    //   this.toggleBtn.addEventListener('click', () => this.toggleCollapse());
    // }
    
    // Floating toggle button - disabled since we don't need hidden state
    // No floating toggle needed
    
    // Listen for bounds updates from main process
    if (window.electronAPI && window.electronAPI.sidebar) {
      window.electronAPI.sidebar.onBoundsUpdate((data) => {
        console.log('Bounds updated:', data);
        // You can use this to adjust UI if needed
      });
    }
  }
  
  async show() {
    console.log('ModernSidebar.show() called, isVisible:', this.isVisible);
    console.log('Sidebar element exists:', !!this.sidebar);
    
    if (!this.sidebar) {
      console.error('Sidebar element not found!');
      return;
    }
    
    if (!this.isVisible) {
      console.log('Showing sidebar...');
      this.isVisible = true;
      // Show as expanded when analysis starts
      this.isCollapsed = false;
      this.sidebar.classList.add('active');
      this.sidebar.classList.remove('collapsed');
      document.body.classList.add('sidebar-open');
      document.body.classList.remove('sidebar-collapsed');
      
      if (this.floatingToggle) {
        this.floatingToggle.classList.remove('visible');
      }
      
      // Set toggle button to collapse state (left arrow)
      if (this.toggleBtn) {
        const svg = this.toggleBtn.querySelector('svg polyline');
        if (svg) {
          svg.setAttribute('points', '15 18 9 12 15 6'); // Left arrow for collapse
        }
        this.toggleBtn.setAttribute('title', 'Collapse');
      }
      
      console.log('Sidebar classes added, should be visible now');
      
      // Notify main process to adjust WebContentsView bounds
      if (window.electronAPI && window.electronAPI.sidebar) {
        const result = await window.electronAPI.sidebar.toggle(true);
        console.log('Sidebar shown, WebContentsView adjusted:', result);
      }
      
      // Timer removed
      this.resetProgress();
    }
  }
  
  async hide() {
    if (this.isVisible) {
      this.isVisible = false;
      this.sidebar.classList.remove('active');
      document.body.classList.remove('sidebar-open', 'sidebar-collapsed');
      
      if (this.floatingToggle) {
        this.floatingToggle.classList.add('visible');
        
        // Ensure floating toggle shows right arrow (to expand)
        const floatingSvg = this.floatingToggle.querySelector('svg polyline');
        if (floatingSvg) {
          floatingSvg.setAttribute('points', '9 18 15 12 9 6'); // Right arrow
        }
      }
      
      // Notify main process to restore WebContentsView bounds
      if (window.electronAPI && window.electronAPI.sidebar) {
        const result = await window.electronAPI.sidebar.toggle(false);
        console.log('Sidebar hidden, WebContentsView restored:', result);
      }
      
      // Timer removed
    }
  }
  
  async toggleCollapse() {
    // Only work if sidebar is visible
    if (!this.isVisible) return;
    
    if (this.isCollapsed) {
      // Expand the sidebar
      this.isCollapsed = false;
      this.sidebar.classList.remove('collapsed');
      document.body.classList.remove('sidebar-collapsed');
      document.body.classList.add('sidebar-open');
      
      // Update toggle button icon to collapse arrow
      if (this.toggleBtn) {
        const svg = this.toggleBtn.querySelector('svg polyline');
        if (svg) {
          svg.setAttribute('points', '15 18 9 12 15 6'); // Left arrow for collapse
        }
        this.toggleBtn.setAttribute('title', 'Collapse');
      }
    } else {
      // Collapse the sidebar but keep it visible
      this.isCollapsed = true;
      this.sidebar.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
      document.body.classList.remove('sidebar-open');
      
      // Update toggle button icon to expand arrow (RIGHT arrow when collapsed)
      if (this.toggleBtn) {
        const svg = this.toggleBtn.querySelector('svg polyline');
        if (svg) {
          console.log('Setting collapsed toggle to RIGHT arrow for expand');
          svg.setAttribute('points', '9 18 15 12 9 6'); // Right arrow for expand
        }
        this.toggleBtn.setAttribute('title', 'Expand');
      }
    }
    
    // Notify main process to adjust WebContentsView bounds
    if (window.electronAPI && window.electronAPI.sidebar) {
      // When collapsed, keep sidebar at 48px width (matching CSS); when expanded, use full 320px width
      const width = this.isCollapsed ? 48 : 320;
      const result = await window.electronAPI.sidebar.resize(width);
      console.log('Sidebar toggled, WebContentsView adjusted:', result);
    }
  }
  
  // Timer methods removed
  
  resetProgress() {
    console.log('resetProgress called');
    // Reset all progress items except recording
    const items = ['parsing', 'analyzing', 'variables', 'generating', 'validating'];
    items.forEach(item => {
      const element = document.getElementById(`progress-${item}`);
      if (element) {
        element.classList.remove('active', 'completed');
      }
    });
    
    // Handle recording step separately - keep it completed if we have a valid recording
    const recordingElement = document.getElementById('progress-recording');
    if (recordingElement) {
      if (window.lastRecordingSession) {
        // We have a valid recording, mark as completed
        recordingElement.classList.add('completed');
        recordingElement.classList.remove('active');
      } else {
        // No recording available, reset it
        recordingElement.classList.remove('active', 'completed');
      }
    }
    
    // Start with parsing step active when resetting for re-analysis
    const parsingElement = document.getElementById('progress-parsing');
    if (parsingElement) {
      parsingElement.classList.add('active');
    }
    
    // Clear details
    if (this.detailContent) {
      this.detailContent.innerHTML = '<div class="detail-item">Starting analysis...</div>';
    }
  }
  
  updateProgress(step, status = 'active', details = null) {
    console.log(`updateProgress called: step=${step}, status=${status}, details=${details}`);
    const elementId = `progress-${step}`;
    const element = document.getElementById(elementId);
    console.log(`Looking for element: ${elementId}, found:`, !!element);
    
    if (element) {
      // Remove active from all
      document.querySelectorAll('.progress-item.active').forEach(item => {
        item.classList.remove('active');
      });
      
      if (status === 'active') {
        element.classList.add('active');
        element.classList.remove('completed');
      } else if (status === 'completed') {
        element.classList.remove('active');
        element.classList.add('completed');
      }
    }
    
    // Update details if provided
    if (details && this.detailContent) {
      const detailItem = document.createElement('div');
      detailItem.className = 'detail-item';
      detailItem.textContent = details;
      this.detailContent.appendChild(detailItem);
      
      // Keep only last 10 items
      while (this.detailContent.children.length > 10) {
        this.detailContent.removeChild(this.detailContent.firstChild);
      }
      
      // Scroll to bottom
      this.detailContent.scrollTop = this.detailContent.scrollHeight;
    }
  }
  
  completeAnalysis(success = true) {
    // Timer removed
    if (success) {
      this.updateProgress('validating', 'completed', 'Analysis completed successfully!');
      
      // Auto-collapse analysis section and show flow variables section
      setTimeout(() => {
        // Collapse analysis progress section
        const analysisContent = document.getElementById('analysis-progress-content');
        const analysisChevron = document.getElementById('analysis-progress-chevron');
        if (analysisContent && !analysisContent.classList.contains('collapsed')) {
          analysisContent.classList.add('collapsed');
          if (analysisChevron) {
            analysisChevron.classList.add('collapsed');
            analysisChevron.textContent = '▶';
          }
        }
        
        // Show and expand flow variables section
        const flowVarsSection = document.getElementById('flow-variables-section');
        const flowVarsContent = document.getElementById('flow-variables-content');
        const flowVarsChevron = document.getElementById('flow-variables-chevron');
        if (flowVarsSection) {
          flowVarsSection.style.display = 'block';
          if (flowVarsContent && flowVarsContent.classList.contains('collapsed')) {
            flowVarsContent.classList.remove('collapsed');
          }
          if (flowVarsChevron) {
            flowVarsChevron.classList.remove('collapsed');
            // Keep the same character, CSS handles rotation
          }
        }
      }, 1000); // Wait 1 second after completion before collapsing
    } else {
      if (this.detailContent) {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';
        detailItem.style.color = '#ef4444';
        detailItem.textContent = 'Analysis failed. Please check the console for details.';
        this.detailContent.appendChild(detailItem);
      }
    }
  }
}

// Export for use in other scripts
window.ModernSidebar = ModernSidebar;

// Auto-initialize when script loads
const modernSidebar = new ModernSidebar();
window.modernSidebar = modernSidebar;

// Listen for recording completion event to mark Recording step as complete
window.addEventListener('recordingComplete', (event) => {
  console.log('Recording complete event received in sidebar-manager');
  // Mark recording step as completed when recording files are saved
  modernSidebar.updateProgress('recording', 'completed', 'Recording saved successfully');
});

// Function to toggle collapsible sections
function toggleSection(sectionName) {
  console.log('Toggling section:', sectionName);
  const chevron = document.getElementById(`${sectionName}-chevron`);
  const content = document.getElementById(`${sectionName}-content`);
  
  if (chevron && content) {
    if (content.classList.contains('collapsed')) {
      // Expand
      content.classList.remove('collapsed');
      chevron.classList.remove('collapsed');
      // Keep the same character, let CSS handle rotation
    } else {
      // Collapse
      content.classList.add('collapsed');
      chevron.classList.add('collapsed');
      // Keep the same character, let CSS handle rotation
    }
  }
}

// Make toggleSection globally available
window.toggleSection = toggleSection;