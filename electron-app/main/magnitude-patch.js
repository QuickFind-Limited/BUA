/**
 * Magnitude Patch for WebView Isolation
 * This patches Magnitude to only control WebView pages, not the entire Electron UI
 */

const fs = require('fs');
const path = require('path');

function patchMagnitude() {
  const magnitudePath = path.join(__dirname, '..', 'node_modules', 'magnitude-core', 'dist', 'index.cjs');
  
  if (!fs.existsSync(magnitudePath)) {
    console.error('Magnitude index.cjs not found at:', magnitudePath);
    return false;
  }

  let content = fs.readFileSync(magnitudePath, 'utf8');
  
  // Check if already patched
  if (content.includes('WEBVIEW_ISOLATION_PATCH')) {
    console.log('✅ Magnitude already patched for WebView isolation');
    return true;
  }

  console.log('🔧 Patching Magnitude for WebView isolation...');

  // Patch 1: Filter pages in initializeExistingPages
  content = content.replace(
    'async initializeExistingPages() {\n    const pages = this.context.pages();',
    `async initializeExistingPages() {
    // WEBVIEW_ISOLATION_PATCH: Filter for WebView pages only
    const allPages = this.context.pages();
    const pages = allPages.filter(page => {
      const url = page.url();
      // Only use pages with http/https URLs (WebView content)
      const isWebView = url.startsWith('http://') || url.startsWith('https://');
      if (!isWebView) {
        console.log('🚫 Magnitude: Ignoring non-WebView page:', url);
      }
      return isWebView;
    });`
  );

  // Patch 2: Filter pages in onPageCreated
  content = content.replace(
    'async onPageCreated(page) {\n    logger.debug(`onPageCreated called for: ${page.url()}`);',
    `async onPageCreated(page) {
    logger.debug(\`onPageCreated called for: \${page.url()}\`);
    // WEBVIEW_ISOLATION_PATCH: Ignore non-WebView pages
    const url = page.url();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.log('🚫 Magnitude: Ignoring non-WebView page creation:', url);
      return;
    }`
  );

  // Patch 3: Filter pages in activity polling
  content = content.replace(
    'startActivityPolling() {\n    this.pollInterval = setInterval(async () => {\n      const pages = this.context.pages();',
    `startActivityPolling() {
    this.pollInterval = setInterval(async () => {
      // WEBVIEW_ISOLATION_PATCH: Only poll WebView pages
      const allPages = this.context.pages();
      const pages = allPages.filter(page => {
        const url = page.url();
        return url.startsWith('http://') || url.startsWith('https://');
      });`
  );

  // Patch 4: Filter in getPages
  content = content.replace(
    'getPages() {\n    return this.context.pages();',
    `getPages() {
    // WEBVIEW_ISOLATION_PATCH: Return only WebView pages
    return this.context.pages().filter(page => {
      const url = page.url();
      return url.startsWith('http://') || url.startsWith('https://');
    });`
  );

  // Patch 5: Filter in switchTab
  content = content.replace(
    'async switchTab(index) {\n    const pages = this.context.pages();',
    `async switchTab(index) {
    // WEBVIEW_ISOLATION_PATCH: Only switch between WebView pages
    const allPages = this.context.pages();
    const pages = allPages.filter(page => {
      const url = page.url();
      return url.startsWith('http://') || url.startsWith('https://');
    });`
  );

  // Patch 6: Filter in retrieveState
  content = content.replace(
    'async retrieveState() {\n    let activeIndex = -1;\n    let tabs = [];\n    for (const [i, page] of this.context.pages().entries()) {',
    `async retrieveState() {
    let activeIndex = -1;
    let tabs = [];
    // WEBVIEW_ISOLATION_PATCH: Only track WebView pages
    const webViewPages = this.context.pages().filter(page => {
      const url = page.url();
      return url.startsWith('http://') || url.startsWith('https://');
    });
    for (const [i, page] of webViewPages.entries()) {`
  );

  // Patch 7: Filter in start method
  content = content.replace(
    'async start() {\n    await this.tabs.initialize();\n    if (this.context.pages().length > 0) {\n      this.tabs.setActivePage(this.context.pages()[0]);',
    `async start() {
    await this.tabs.initialize();
    // WEBVIEW_ISOLATION_PATCH: Only use WebView pages
    const webViewPages = this.context.pages().filter(page => {
      const url = page.url();
      return url.startsWith('http://') || url.startsWith('https://');
    });
    if (webViewPages.length > 0) {
      this.tabs.setActivePage(webViewPages[0]);`
  );

  // Write the patched file
  fs.writeFileSync(magnitudePath, content, 'utf8');
  console.log('✅ Magnitude patched successfully for WebView isolation!');
  
  return true;
}

// Export for use in other modules
module.exports = { patchMagnitude };

// Run if called directly
if (require.main === module) {
  patchMagnitude();
}