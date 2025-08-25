"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagnitudeElectronAdapter = void 0;
const playwright = __importStar(require("playwright"));
/**
 * Adapter to make Magnitude work with Electron's WebView
 * Handles the special case where Electron doesn't support Target.createTarget
 */
class MagnitudeElectronAdapter {
    /**
     * Connect to Electron's CDP and get a working page
     * This handles the case where connectOverCDP doesn't immediately see pages
     */
    static async connectToElectron(cdpEndpoint, webView) {
        console.log('🔌 MagnitudeElectronAdapter: Connecting to Electron CDP...');
        // Connect to CDP
        const browser = await playwright.chromium.connectOverCDP(cdpEndpoint);
        console.log('✅ Connected to CDP');
        // Get or create context
        let context;
        if (browser.contexts().length > 0) {
            context = browser.contexts()[0];
            console.log('📦 Using existing context');
        }
        else {
            // This might fail in Electron, but let's try
            try {
                context = await browser.newContext();
                console.log('📦 Created new context');
            }
            catch (error) {
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
        }
        else {
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
                const webViewTarget = targets.targetInfos.find(t => t.type === 'page' &&
                    (t.url.startsWith('http://') || t.url.startsWith('https://')));
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
                            goto: async (url) => {
                                await webView.webContents.loadURL(url);
                                return null;
                            },
                            evaluate: async (fn, ...args) => {
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
                            waitForTimeout: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                            locator: (selector) => ({
                                count: async () => {
                                    const result = await webView.webContents.executeJavaScript(`document.querySelectorAll('${selector}').length`);
                                    return result;
                                }
                            }),
                            // Add minimal keyboard/mouse support
                            keyboard: {
                                type: async (text) => {
                                    for (const char of text) {
                                        webView.webContents.sendInputEvent({
                                            type: 'char',
                                            keyCode: char
                                        });
                                    }
                                },
                                press: async (key) => {
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
                                click: async (x, y) => {
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
                    }
                    catch (attachError) {
                        console.log('⚠️ Could not attach to target:', attachError);
                    }
                }
            }
            catch (cdpError) {
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
    }
    /**
     * Create a minimal page wrapper that uses WebView directly
     */
    static createWebViewPage(webView) {
        return {
            url: () => webView.webContents.getURL(),
            title: () => webView.webContents.getTitle(),
            goto: async (url) => {
                await webView.webContents.loadURL(url);
                return null;
            },
            evaluate: async (fn, ...args) => {
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
            waitForTimeout: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
            waitForSelector: async (selector, options = {}) => {
                const timeout = options.timeout || 30000;
                const startTime = Date.now();
                while (Date.now() - startTime < timeout) {
                    const exists = await webView.webContents.executeJavaScript(`!!document.querySelector('${selector}')`);
                    if (exists)
                        return true;
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                throw new Error(`Timeout waiting for selector: ${selector}`);
            },
            click: async (selector) => {
                await webView.webContents.executeJavaScript(`
          const element = document.querySelector('${selector}');
          if (element) element.click();
        `);
            },
            fill: async (selector, value) => {
                await webView.webContents.executeJavaScript(`
          const element = document.querySelector('${selector}');
          if (element) {
            element.value = '${value}';
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        `);
            },
            type: async (selector, text) => {
                await webView.webContents.executeJavaScript(`
          const element = document.querySelector('${selector}');
          if (element) {
            element.focus();
            element.value = '${text}';
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        `);
            },
            locator: (selector) => ({
                count: async () => {
                    const result = await webView.webContents.executeJavaScript(`document.querySelectorAll('${selector}').length`);
                    return result;
                },
                click: async () => {
                    await webView.webContents.executeJavaScript(`
            const element = document.querySelector('${selector}');
            if (element) element.click();
          `);
                },
                fill: async (value) => {
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
exports.MagnitudeElectronAdapter = MagnitudeElectronAdapter;
