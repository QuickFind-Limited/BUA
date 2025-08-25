import { WebContentsView } from 'electron';
import * as playwright from 'playwright';

/**
 * Adapter to make Magnitude work with Electron's WebView
 * Handles the special case where Electron doesn't support Target.createTarget
 */
export class MagnitudeElectronAdapter {
  /**
   * Connect to Electron's CDP and get a working page
   * This handles the case where connectOverCDP doesn't immediately see pages
   */
  static async connectToElectron(cdpEndpoint: string, webView: WebContentsView): Promise<any> {
    console.log('🔌 MagnitudeElectronAdapter: Connecting to Electron CDP...');
    
    // Convert WebSocket endpoint to HTTP if needed for connectOverCDP
    let httpEndpoint = cdpEndpoint;
    if (cdpEndpoint.startsWith('ws://')) {
      httpEndpoint = cdpEndpoint.replace('ws://', 'http://');
    } else if (cdpEndpoint.startsWith('wss://')) {
      httpEndpoint = cdpEndpoint.replace('wss://', 'https://');
    }
    
    console.log('📡 Using CDP endpoint:', httpEndpoint);
    
    try {
      // Connect to CDP
      const browser = await playwright.chromium.connectOverCDP(httpEndpoint);
      console.log('✅ Connected to CDP');
    
    // Get or create context
    let context;
    if (browser.contexts().length > 0) {
      context = browser.contexts()[0];
      console.log('📦 Using existing context');
    } else {
      // This might fail in Electron, but let's try
      try {
        context = await browser.newContext();
        console.log('📦 Created new context');
      } catch (error) {
        console.log('⚠️ Could not create new context, using default');
        // In Electron, there might be a default context we can't see
        context = browser.contexts()[0] || browser;
      }
    }
    
    // Wait for pages to become available or use a workaround
    let page = null;
    
    // First, check if there are already pages
    if (context.pages && context.pages().length > 0) {
      page = context.pages()[0];
      console.log('📄 Found existing page');
    } else {
      console.log('🔍 No pages found, trying workarounds...');
      
      // Workaround 1: Navigate the WebView to ensure it has a page
      const currentUrl = webView.webContents.getURL();
      if (!currentUrl || currentUrl === 'about:blank') {
        console.log('📍 WebView is blank, navigating to create page...');
        await webView.webContents.loadURL('https://www.google.com');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Workaround 2: Try to get the page directly from CDP targets
      try {
        const cdpSession = await context.newCDPSession(page || context);
        const targets = await cdpSession.send('Target.getTargets');
        console.log('🎯 CDP Targets:', targets);
        
        // Find the WebView's target
        const webViewTarget = targets.targetInfos.find(t => 
          t.type === 'page' && 
          (t.url.startsWith('http://') || t.url.startsWith('https://'))
        );
        
        if (webViewTarget) {
          console.log('🎯 Found WebView target:', webViewTarget.url);
          
          // Try to attach to this target
          try {
            const { sessionId } = await cdpSession.send('Target.attachToTarget', {
              targetId: webViewTarget.targetId,
              flatten: true
            });
            console.log('📎 Attached to target with session:', sessionId);
            
            // Create a page wrapper for this target
            page = {
              _targetId: webViewTarget.targetId,
              _sessionId: sessionId,
              _cdpSession: cdpSession,
              url: () => webViewTarget.url,
              title: () => webViewTarget.title,
              goto: async (url: string) => {
                await webView.webContents.loadURL(url);
                return null;
              },
              evaluate: async (fn: any, ...args: any[]) => {
                const fnString = fn.toString();
                const argsString = JSON.stringify(args);
                const script = `(${fnString})(...${argsString})`;
                return await webView.webContents.executeJavaScript(script);
              },
              screenshot: async () => {
                // Use WebView's capture capability
                const image = await webView.webContents.capturePage();
                return image.toPNG();
              },
              waitForTimeout: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
              locator: (selector: string) => ({
                count: async () => {
                  const result = await webView.webContents.executeJavaScript(
                    `document.querySelectorAll('${selector}').length`
                  );
                  return result;
                }
              }),
              // Add minimal keyboard/mouse support
              keyboard: {
                type: async (text: string) => {
                  for (const char of text) {
                    webView.webContents.sendInputEvent({
                      type: 'char',
                      keyCode: char
                    });
                  }
                },
                press: async (key: string) => {
                  webView.webContents.sendInputEvent({
                    type: 'keyDown',
                    keyCode: key
                  });
                  webView.webContents.sendInputEvent({
                    type: 'keyUp',
                    keyCode: key
                  });
                }
              },
              mouse: {
                click: async (x: number, y: number) => {
                  webView.webContents.sendInputEvent({
                    type: 'mouseDown',
                    x,
                    y,
                    button: 'left',
                    clickCount: 1
                  });
                  webView.webContents.sendInputEvent({
                    type: 'mouseUp',
                    x,
                    y,
                    button: 'left',
                    clickCount: 1
                  });
                }
              }
            };
          } catch (attachError) {
            console.log('⚠️ Could not attach to target:', attachError);
          }
        }
      } catch (cdpError) {
        console.log('⚠️ CDP workaround failed:', cdpError);
      }
      
      // Workaround 3: Wait a bit and check again
      if (!page) {
        console.log('⏳ Waiting for pages to appear...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (context.pages && context.pages().length > 0) {
          page = context.pages()[0];
          console.log('📄 Page appeared after waiting');
        }
      }
    }
    
    // Return an object that Magnitude can use
    return {
      browser,
      context,
      page,
      // Add a flag so Magnitude knows this is Electron
      isElectron: true,
      webView
    };
    } catch (connectionError) {
      console.error('❌ Failed to connect to CDP endpoint:', connectionError);
      
      // Fallback: Don't use CDP, just control WebView directly
      console.log('🔄 Falling back to direct WebView control...');
      return {
        browser: null,
        context: null,
        page: MagnitudeElectronAdapter.createWebViewPage(webView),
        isElectron: true,
        webView,
        directControl: true
      };
    }
  }
  
  /**
   * Create a minimal page wrapper that uses WebView directly
   */
  static createWebViewPage(webView: WebContentsView): any {
    return {
      url: () => webView.webContents.getURL(),
      title: () => webView.webContents.getTitle(),
      goto: async (url: string) => {
        await webView.webContents.loadURL(url);
        return null;
      },
      evaluate: async (fn: any, ...args: any[]) => {
        if (typeof fn === 'string') {
          return await webView.webContents.executeJavaScript(fn);
        }
        const fnString = fn.toString();
        const argsString = JSON.stringify(args);
        const script = `(${fnString})(...${argsString})`;
        return await webView.webContents.executeJavaScript(script);
      },
      screenshot: async () => {
        const image = await webView.webContents.capturePage();
        return image.toPNG();
      },
      waitForTimeout: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
      waitForSelector: async (selector: string, options: any = {}) => {
        const timeout = options.timeout || 30000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          const exists = await webView.webContents.executeJavaScript(
            `!!document.querySelector('${selector}')`
          );
          if (exists) return true;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Timeout waiting for selector: ${selector}`);
      },
      click: async (selector: string) => {
        await webView.webContents.executeJavaScript(`
          const element = document.querySelector('${selector}');
          if (element) element.click();
        `);
      },
      fill: async (selector: string, value: string) => {
        await webView.webContents.executeJavaScript(`
          const element = document.querySelector('${selector}');
          if (element) {
            element.value = '${value}';
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        `);
      },
      type: async (selector: string, text: string) => {
        await webView.webContents.executeJavaScript(`
          const element = document.querySelector('${selector}');
          if (element) {
            element.focus();
            element.value = '${text}';
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        `);
      },
      locator: (selector: string) => ({
        count: async () => {
          const result = await webView.webContents.executeJavaScript(
            `document.querySelectorAll('${selector}').length`
          );
          return result;
        },
        click: async () => {
          await webView.webContents.executeJavaScript(`
            const element = document.querySelector('${selector}');
            if (element) element.click();
          `);
        },
        fill: async (value: string) => {
          await webView.webContents.executeJavaScript(`
            const element = document.querySelector('${selector}');
            if (element) {
              element.value = '${value}';
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }
          `);
        }
      })
    };
  }
}