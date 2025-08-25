import { WebContentsView, BrowserWindow } from 'electron';

/**
 * Magnitude WebView Bridge
 * Creates a hidden WebView that Magnitude can control
 * which then mirrors actions to the actual visible WebView
 */
export class MagnitudeWebViewBridge {
  private mainWebView: WebContentsView;  // The visible WebView in the app
  private magnitudeWebView: WebContentsView | null = null;  // Hidden WebView for Magnitude
  
  constructor(mainWebView: WebContentsView) {
    this.mainWebView = mainWebView;
  }
  
  /**
   * Create a hidden WebView for Magnitude to control
   * This WebView will be at the same URL as the main WebView
   */
  async createMagnitudeWebView(parentWindow: BrowserWindow): Promise<WebContentsView> {
    console.log('🔧 Creating hidden WebView for Magnitude...');
    
    // Create a new WebView with similar settings
    this.magnitudeWebView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: false,
        partition: 'magnitude-session'  // Separate session to avoid conflicts
      }
    });
    
    // Add it to the window but hide it (size 0x0)
    parentWindow.contentView.addChildView(this.magnitudeWebView);
    this.magnitudeWebView.setBounds({ x: 0, y: 0, width: 1, height: 1 });
    
    // Load the same URL as the main WebView
    const mainUrl = this.mainWebView.webContents.getURL();
    await this.magnitudeWebView.webContents.loadURL(mainUrl);
    
    console.log('✅ Hidden WebView created for Magnitude');
    
    // Set up mirroring - actions on Magnitude WebView are mirrored to main WebView
    this.setupMirroring();
    
    return this.magnitudeWebView;
  }
  
  /**
   * Set up mirroring between Magnitude WebView and main WebView
   */
  private setupMirroring() {
    if (!this.magnitudeWebView) return;
    
    // Mirror navigation
    this.magnitudeWebView.webContents.on('did-navigate', (event, url) => {
      console.log(`🔄 Mirroring navigation to: ${url}`);
      this.mainWebView.webContents.loadURL(url);
    });
    
    // Mirror page actions via script injection
    this.magnitudeWebView.webContents.on('dom-ready', () => {
      // Inject script to capture and forward user actions
      this.magnitudeWebView!.webContents.executeJavaScript(`
        // Capture form inputs and mirror to main WebView
        document.addEventListener('input', (e) => {
          if (e.target && e.target.tagName) {
            const selector = e.target.id ? '#' + e.target.id : 
                           e.target.name ? '[name="' + e.target.name + '"]' : 
                           e.target.tagName.toLowerCase();
            const value = e.target.value;
            
            // Send to main process to mirror
            window.electronAPI?.mirrorAction({
              type: 'input',
              selector: selector,
              value: value
            });
          }
        });
        
        // Capture clicks
        document.addEventListener('click', (e) => {
          if (e.target && e.target.tagName) {
            const selector = e.target.id ? '#' + e.target.id : 
                           e.target.textContent ? 'text=' + e.target.textContent.trim() :
                           e.target.tagName.toLowerCase();
            
            window.electronAPI?.mirrorAction({
              type: 'click',
              selector: selector
            });
          }
        });
      `).catch(console.error);
    });
  }
  
  /**
   * Execute action on main WebView
   */
  async executeOnMainWebView(action: any) {
    switch (action.type) {
      case 'input':
        await this.mainWebView.webContents.executeJavaScript(`
          const el = document.querySelector('${action.selector}');
          if (el) {
            el.value = '${action.value}';
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        `);
        break;
        
      case 'click':
        await this.mainWebView.webContents.executeJavaScript(`
          const el = document.querySelector('${action.selector}');
          if (el) {
            el.click();
          }
        `);
        break;
    }
  }
  
  /**
   * Get the Magnitude WebView
   */
  getMagnitudeWebView(): WebContentsView | null {
    return this.magnitudeWebView;
  }
  
  /**
   * Clean up
   */
  destroy() {
    if (this.magnitudeWebView) {
      this.magnitudeWebView.webContents.close();
      this.magnitudeWebView = null;
    }
  }
}