import { WebContentsView } from 'electron';
import * as WebSocket from 'ws';
import { Server as WebSocketServer } from 'ws';

/**
 * WebView CDP Proxy
 * Creates an isolated CDP endpoint for a specific WebView
 * Bridges between Magnitude/Playwright and webContents.debugger
 */
export class WebViewCDPProxy {
  private webView: WebContentsView;
  private debugger: Electron.Debugger;
  private wss: WebSocketServer | null = null;
  private port: number = 0;
  private messageId = 1;
  private pendingMessages = new Map<number, { resolve: Function, reject: Function }>();
  
  constructor(webView: WebContentsView) {
    this.webView = webView;
    this.debugger = webView.webContents.debugger;
  }

  /**
   * Start the CDP proxy server
   * Returns the WebSocket URL that Magnitude can connect to
   */
  async startProxy(basePort: number = 10000): Promise<string> {
    // Find an available port
    this.port = await this.findAvailablePort(basePort);
    
    // Attach the debugger to the WebView
    console.log('🔗 Attaching debugger to WebView...');
    try {
      this.debugger.attach('1.3');
    } catch (err) {
      if (!err.message.includes('already attached')) {
        throw err;
      }
      console.log('Debugger already attached, continuing...');
    }
    
    // Enable necessary CDP domains
    await this.enableCDPDomains();
    
    // Start WebSocket server
    this.wss = new WebSocketServer({ port: this.port });
    console.log(`🚀 WebView CDP Proxy started on port ${this.port}`);
    
    // Handle WebSocket connections
    this.wss.on('connection', (ws) => {
      console.log('📡 Magnitude/Playwright connected to WebView CDP Proxy');
      
      // Handle incoming messages from Magnitude
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleCDPMessage(ws, message);
        } catch (error) {
          console.error('Error handling CDP message:', error);
        }
      });
      
      // Set up debugger event forwarding
      this.setupEventForwarding(ws);
      
      ws.on('close', () => {
        console.log('📴 Magnitude/Playwright disconnected from WebView CDP Proxy');
      });
    });
    
    // Return the WebSocket URL for this isolated WebView
    const wsUrl = `ws://localhost:${this.port}`;
    console.log(`✅ WebView isolated CDP endpoint: ${wsUrl}`);
    return wsUrl;
  }

  /**
   * Find an available port
   */
  private async findAvailablePort(basePort: number): Promise<number> {
    const net = require('net');
    
    for (let port = basePort; port < basePort + 100; port++) {
      const available = await new Promise<boolean>((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
          server.close();
          resolve(true);
        });
        server.listen(port);
      });
      
      if (available) {
        return port;
      }
    }
    
    throw new Error('No available ports found');
  }

  /**
   * Enable necessary CDP domains
   */
  private async enableCDPDomains() {
    const domains = ['Page', 'Runtime', 'DOM', 'Network', 'Input', 'Console'];
    
    for (const domain of domains) {
      try {
        await this.debugger.sendCommand(`${domain}.enable`);
        console.log(`  ✓ Enabled ${domain} domain`);
      } catch (err) {
        console.log(`  ⚠ Could not enable ${domain} domain:`, err.message);
      }
    }
  }

  /**
   * Handle CDP messages from Magnitude/Playwright
   */
  private async handleCDPMessage(ws: WebSocket, message: any) {
    console.log(`CDP Message: ${message.method}`, message.params);
    
    // Handle different CDP message types
    if (message.method === 'Target.getTargets') {
      // Return only the WebView target
      const response = {
        id: message.id,
        result: {
          targetInfos: [{
            targetId: `webview-${this.webView.webContents.id}`,
            type: 'page',
            title: await this.webView.webContents.getTitle(),
            url: this.webView.webContents.getURL(),
            attached: true,
            browserContextId: 'default'
          }]
        }
      };
      ws.send(JSON.stringify(response));
    } else if (message.method === 'Target.getBrowserContexts') {
      // Return default browser context
      const response = {
        id: message.id,
        result: {
          browserContextIds: ['default']
        }
      };
      ws.send(JSON.stringify(response));
    } else if (message.method === 'Target.createTarget') {
      // Don't allow creating new targets - return existing WebView as if it was just created
      const response = {
        id: message.id,
        result: {
          targetId: `webview-${this.webView.webContents.id}`
        }
      };
      ws.send(JSON.stringify(response));
    } else if (message.method === 'Target.attachToTarget') {
      // Simulate target attachment
      const response = {
        id: message.id,
        result: {
          sessionId: `session-${this.webView.webContents.id}`
        }
      };
      ws.send(JSON.stringify(response));
    } else if (message.method === 'Browser.getVersion') {
      // Return browser version info
      const response = {
        id: message.id,
        result: {
          protocolVersion: '1.3',
          product: 'Chrome/Electron',
          userAgent: this.webView.webContents.getUserAgent()
        }
      };
      ws.send(JSON.stringify(response));
    } else if (message.method) {
      // Forward all other commands to the debugger
      try {
        const result = await this.debugger.sendCommand(message.method, message.params || {});
        const response = {
          id: message.id,
          result: result || {}
        };
        ws.send(JSON.stringify(response));
      } catch (error) {
        const response = {
          id: message.id,
          error: {
            code: -32603,
            message: error.message
          }
        };
        ws.send(JSON.stringify(response));
      }
    }
  }

  /**
   * Set up event forwarding from debugger to WebSocket
   */
  private setupEventForwarding(ws: WebSocket) {
    const eventHandler = (event: any, method: string, params: any) => {
      // Forward CDP events to Magnitude/Playwright
      const message = {
        method: method,
        params: params || {}
      };
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    };
    
    // Attach event handler
    this.debugger.on('message', eventHandler);
    
    // Clean up on disconnect
    ws.on('close', () => {
      this.debugger.removeListener('message', eventHandler);
    });
  }

  /**
   * Stop the proxy server
   */
  stop() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    try {
      this.debugger.detach();
    } catch (err) {
      // Ignore if already detached
    }
    
    console.log('🛑 WebView CDP Proxy stopped');
  }

  /**
   * Get the proxy URL
   */
  getProxyUrl(): string {
    return `ws://localhost:${this.port}`;
  }
}