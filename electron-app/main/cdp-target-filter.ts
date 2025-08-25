import * as http from 'http';

/**
 * CDP Target Filter
 * Finds and filters specific WebView targets from CDP endpoint
 */

export interface CDPTarget {
  description: string;
  devtoolsFrontendUrl: string;
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

/**
 * Get all CDP targets from the debugging endpoint
 */
export async function getCDPTargets(port: string | number): Promise<CDPTarget[]> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/json',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const targets = JSON.parse(data);
          resolve(targets);
        } catch (error) {
          reject(new Error('Failed to parse CDP targets response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error fetching CDP targets:', error);
      reject(error);
    });

    req.end();
  });
}

/**
 * Find the WebView target, excluding Electron UI pages
 */
export async function findWebViewTarget(port: string | number): Promise<CDPTarget | null> {
  const targets = await getCDPTargets(port);
  
  console.log(`🔍 Found ${targets.length} CDP targets:`);
  targets.forEach((target, index) => {
    console.log(`  ${index + 1}. Type: ${target.type}, URL: ${target.url}, Title: ${target.title}`);
  });
  
  // Filter out Electron UI pages and find actual web content
  // Electron UI pages typically have chrome-extension:// or file:// URLs
  const webTargets = targets.filter(target => {
    // Only look for 'page' type targets
    if (target.type !== 'page') return false;
    
    // Exclude Electron UI pages
    if (target.url.startsWith('chrome-extension://')) return false;
    if (target.url.startsWith('devtools://')) return false;
    if (target.url.includes('tabbar.html')) return false;
    if (target.url.includes('sidebar.html')) return false;
    if (target.url.includes('ui/')) return false;
    
    // Exclude about:blank unless it's the only option
    if (target.url === 'about:blank' && targets.length > 1) return false;
    
    // Include actual web content
    return target.url.startsWith('http://') || 
           target.url.startsWith('https://') || 
           target.url === 'about:blank';
  });
  
  if (webTargets.length === 0) {
    console.warn('⚠️ No WebView targets found. All targets might be Electron UI.');
    return null;
  }
  
  // Return the first web target (should be our WebView)
  const selectedTarget = webTargets[0];
  console.log(`✅ Selected WebView target: ${selectedTarget.url} (${selectedTarget.id})`);
  
  return selectedTarget;
}

/**
 * Get the WebSocket URL for connecting to a specific target
 */
export function getTargetWebSocketUrl(target: CDPTarget): string {
  // The webSocketDebuggerUrl is the specific URL for this target
  return target.webSocketDebuggerUrl;
}

/**
 * Connect Magnitude/Playwright to a specific CDP target
 * Returns the WebSocket URL for the specific target
 */
export async function getWebViewCDPEndpoint(port: string | number): Promise<string | null> {
  try {
    console.log(`📡 getWebViewCDPEndpoint called with port: ${port}`);
    const target = await findWebViewTarget(port);
    if (!target) {
      console.error('❌ Could not find WebView target among CDP targets');
      return null;
    }
    
    // Return the WebSocket URL for this specific target
    const wsUrl = getTargetWebSocketUrl(target);
    console.log(`🔗 WebView CDP WebSocket URL: ${wsUrl}`);
    
    // Verify it's a page-specific URL, not the browser URL
    if (wsUrl && wsUrl.includes('/devtools/browser/')) {
      console.warn('⚠️ WARNING: Got browser endpoint instead of page endpoint!');
      console.log('🔍 Target details:', target);
    }
    
    return wsUrl;
  } catch (error) {
    console.error('Failed to get WebView CDP endpoint:', error);
    return null;
  }
}