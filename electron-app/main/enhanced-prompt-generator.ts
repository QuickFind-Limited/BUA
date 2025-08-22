/**
 * Enhanced Prompt Generator for Bulletproof Intent Specs
 * Utilizes ALL captured data for robust automation
 */

export interface EnhancedRecordingData {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  url: string;
  events?: any[];  // Some recordings use 'events'
  actions?: any[];  // Some recordings use 'actions'
  domSnapshots?: any[];
  networkRequests?: any[];
  consoleErrors?: any[];
  mutations?: any[];
  viewport?: { width: number; height: number };
  userAgent?: string;
  cookies?: any[];
  localStorage?: any;
  performance?: any;
  tabSessions?: any;
  screenshots?: any[];
}

/**
 * Generate enhanced prompt that uses ALL captured data
 */
export function generateBulletproofIntentSpecPrompt(recording: EnhancedRecordingData): string {
  // Analyze network patterns
  const networkPatterns = analyzeNetworkPatterns(recording.networkRequests || []);
  
  // Analyze DOM mutations for dynamic content
  const dynamicElements = analyzeDynamicElements(recording.mutations || []);
  
  // Analyze console errors for potential issues
  const errorPatterns = analyzeErrorPatterns(recording.consoleErrors || []);
  
  // Analyze timing for wait conditions (use events or actions)
  const timingInsights = analyzeTimingPatterns(recording.events || recording.actions || []);
  
  // Analyze viewport for responsive behavior
  const viewportInsights = analyzeViewport(recording.viewport);
  
  // Analyze tab switches for multi-tab workflows
  const tabPatterns = analyzeTabSessions(recording.tabSessions || {});

  return `You are an expert at creating BULLETPROOF Intent Specifications from comprehensive recording data.

COMPREHENSIVE RECORDING DATA:
==========================
Session: ${recording.sessionId}
Duration: ${recording.duration}ms
Start URL: ${recording.url}
Viewport: ${JSON.stringify(recording.viewport || { width: 1920, height: 1080 })}
User Agent: ${recording.userAgent || 'Not captured'}

RECORDED EVENTS/ACTIONS (${recording.events?.length || recording.actions?.length || 0}):
${summarizeActions(recording.events || recording.actions || [])}

DOM SNAPSHOTS (${recording.domSnapshots?.length || 0}):
${summarizeDomSnapshots(recording.domSnapshots || [])}

NETWORK INSIGHTS:
${networkPatterns}

DYNAMIC ELEMENTS DETECTED:
${dynamicElements}

CONSOLE ERRORS FOUND:
${errorPatterns}

TIMING PATTERNS:
${timingInsights}

VIEWPORT & RESPONSIVE:
${viewportInsights}

TAB NAVIGATION:
${tabPatterns}

CRITICAL RULES FOR BULLETPROOF INTENT SPEC:
==========================================
1. WAIT CONDITIONS:
   - Add explicit waits after navigation (use network patterns)
   - Wait for dynamic content to load (use DOM mutations)
   - Add retry logic for flaky elements

2. SELECTOR STRATEGY:
   - Provide 3+ selectors per element when possible
   - Use data from DOM snapshots for alternative selectors
   - Include aria-label, role, and text selectors

3. ERROR HANDLING:
   - Add skip conditions for optional steps (based on console errors)
   - Include validation steps after critical actions
   - Add recovery steps for common failures

4. TIMING OPTIMIZATION:
   - Use actual timing from recording for realistic delays
   - Add throttling for rapid successive actions
   - Include performance.timing data for page load waits

5. VIEWPORT AWARENESS:
   - Add viewport adjustment steps if needed
   - Include scroll actions for elements below fold
   - Handle responsive layouts

6. MULTI-TAB HANDLING:
   - Track tab switches and window management
   - Include tab synchronization waits
   - Handle popup windows

7. NETWORK AWARENESS:
   - Wait for specific API calls to complete
   - Handle offline/slow network scenarios
   - Include request validation

8. STATE MANAGEMENT:
   - Track authentication state from cookies/localStorage
   - Add conditional flows based on state
   - Include state validation steps

OUTPUT THIS ENHANCED JSON STRUCTURE:
{
  "name": "Descriptive name",
  "description": "What this automation does",
  "url": "${recording.url}",
  "params": ["VARIABLE_NAMES"],
  "environment": {
    "viewport": ${JSON.stringify(recording.viewport || {})},
    "userAgent": "${recording.userAgent || ''}",
    "cookies": ${recording.cookies ? 'true' : 'false'},
    "localStorage": ${recording.localStorage ? 'true' : 'false'}
  },
  "skipNavigationStates": ["authenticated", "dashboard"],
  "steps": [
    {
      "name": "Step name",
      "ai_instruction": "Natural language instruction",
      "snippet": "await page.action();",
      "prefer": "snippet or ai",
      "fallback": "ai, snippet, or retry",
      "selectors": ["primary", "secondary", "text-based", "aria-based"],
      "value": "value or {{VARIABLE}}",
      "waitBefore": {
        "type": "network|element|time",
        "condition": "specific condition",
        "timeout": 5000
      },
      "waitAfter": {
        "type": "network|element|time",
        "condition": "specific condition",
        "timeout": 5000
      },
      "validation": {
        "type": "element|text|url|network",
        "expected": "expected value or pattern"
      },
      "errorHandling": {
        "retry": 3,
        "retryDelay": 1000,
        "skipOnError": false,
        "alternativeAction": "fallback action"
      },
      "performance": {
        "expectedDuration": ${recording.duration || 1000},
        "maxDuration": 30000
      }
    }
  ],
  "validations": [
    {
      "step": "after-login",
      "check": "element|url|cookie",
      "expected": "value"
    }
  ],
  "errorRecovery": {
    "strategies": ["retry", "refresh", "restart"],
    "maxAttempts": 3
  },
  "performance": {
    "totalExpectedDuration": ${recording.duration},
    "criticalPath": ["step1", "step3", "step5"]
  }
}

Analyze the recording and create a BULLETPROOF Intent Spec:`;
}

/**
 * Analyze network patterns for wait conditions
 */
function analyzeNetworkPatterns(requests: any[]): string {
  if (!requests.length) return 'No network data captured';
  
  const apiCalls = requests.filter((r: any) => r.url?.includes('/api/'));
  const resources = requests.filter((r: any) => 
    r.url?.match(/\.(js|css|png|jpg|svg)$/));
  
  return `
- API Calls: ${apiCalls.length} (wait for these to complete)
- Resource loads: ${resources.length}
- Critical endpoints: ${apiCalls.slice(0, 3).map((r: any) => r.url).join(', ')}
- Average response time: ${calculateAverage(requests.map((r: any) => r.timing?.end - r.timing?.start || 0))}ms`;
}

/**
 * Analyze DOM mutations for dynamic content
 */
function analyzeDynamicElements(mutations: any[]): string {
  if (!mutations.length) return 'No mutations captured';
  
  const addedNodes = mutations.filter((m: any) => m.type === 'childList' && m.addedNodes?.length);
  const attributeChanges = mutations.filter((m: any) => m.type === 'attributes');
  
  return `
- Nodes added: ${addedNodes.length} (indicates dynamic content)
- Attribute changes: ${attributeChanges.length} (indicates state changes)
- Dynamic selectors to avoid: ${extractDynamicSelectors(mutations).join(', ')}`;
}

/**
 * Analyze console errors
 */
function analyzeErrorPatterns(errors: any[]): string {
  if (!errors.length) return 'No console errors detected';
  
  return `
- Total errors: ${errors.length}
- Common patterns: ${extractErrorPatterns(errors).join(', ')}
- Error sources: ${[...new Set(errors.map((e: any) => e.source))].join(', ')}
- Add error handling for these scenarios`;
}

/**
 * Analyze timing patterns
 */
function analyzeTimingPatterns(events: any[]): string {
  if (!events.length) return 'No timing data';
  
  const delays: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const delay = (events[i].timestamp || 0) - (events[i-1].timestamp || 0);
    if (delay > 0) delays.push(delay);
  }
  
  return `
- Average action delay: ${calculateAverage(delays)}ms
- Max delay: ${Math.max(...delays)}ms (indicates user thinking time)
- Min delay: ${Math.min(...delays)}ms (indicates rapid actions)
- Add throttling for actions < 100ms apart`;
}

/**
 * Analyze viewport for responsive handling
 */
function analyzeViewport(viewport: any): string {
  if (!viewport) return 'No viewport data';
  
  const isMobile = viewport.width < 768;
  const isTablet = viewport.width >= 768 && viewport.width < 1024;
  const isDesktop = viewport.width >= 1024;
  
  return `
- Device type: ${isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
- Viewport: ${viewport.width}x${viewport.height}
- May need scroll for elements below ${viewport.height}px
- Consider responsive selectors for ${isMobile ? 'mobile' : 'desktop'} layout`;
}

/**
 * Analyze tab sessions
 */
function analyzeTabSessions(tabSessions: any): string {
  const tabCount = Object.keys(tabSessions).length;
  if (tabCount === 0) return 'Single tab workflow';
  
  return `
- Tabs used: ${tabCount}
- Tab switches detected: Add synchronization
- Popup handling may be needed`;
}

// Helper functions
function calculateAverage(numbers: number[]): number {
  if (!numbers.length) return 0;
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}

function extractDynamicSelectors(mutations: any[]): string[] {
  // Extract selectors that change frequently
  const selectors = new Set<string>();
  mutations.forEach((m: any) => {
    if (m.target?.id && m.target.id.match(/\d+/)) {
      selectors.add(`#${m.target.id} (contains numbers)`);
    }
  });
  return Array.from(selectors).slice(0, 5);
}

function extractErrorPatterns(errors: any[]): string[] {
  const patterns = new Set<string>();
  errors.forEach((e: any) => {
    if (e.message?.includes('404')) patterns.add('404 Not Found');
    if (e.message?.includes('undefined')) patterns.add('Undefined reference');
    if (e.message?.includes('timeout')) patterns.add('Timeout');
    if (e.message?.includes('network')) patterns.add('Network error');
  });
  return Array.from(patterns);
}

/**
 * Generate validation steps from recording data
 */
export function generateValidationSteps(recording: EnhancedRecordingData): any[] {
  const validations: any[] = [];
  
  // Add URL validation after navigation
  if (recording.events?.some((e: any) => e.action === 'navigation')) {
    validations.push({
      step: 'after-navigation',
      check: 'url',
      expected: 'contains expected path'
    });
  }
  
  // Add login validation
  if (recording.events?.some((e: any) => 
    e.selector?.includes('password') || e.selector?.includes('login'))) {
    validations.push({
      step: 'after-login',
      check: 'cookie',
      expected: 'session cookie exists'
    });
  }
  
  // Add form submission validation
  if (recording.events?.some((e: any) => e.action === 'submit')) {
    validations.push({
      step: 'after-submit',
      check: 'element',
      expected: 'success message or redirect'
    });
  }
  
  return validations;
}

/**
 * Generate performance expectations
 */
export function generatePerformanceExpectations(recording: EnhancedRecordingData): any {
  const criticalSteps: string[] = [];
  
  // Identify critical path
  recording.events?.forEach((event: any, index: number) => {
    if (event.action === 'click' && event.selector?.includes('submit')) {
      criticalSteps.push(`step${index}`);
    }
    if (event.action === 'navigation') {
      criticalSteps.push(`step${index}`);
    }
  });
  
  return {
    totalExpectedDuration: recording.duration,
    averageStepDuration: recording.duration / (recording.events?.length || 1),
    criticalPath: criticalSteps,
    maxAcceptableDuration: recording.duration * 2 // 2x buffer
  };
}

/**
 * Summarize actions to avoid huge prompts
 */
function summarizeActions(actions: any[]): string {
  if (!actions || !actions.length) return 'No actions captured';
  
  // Group actions by type
  const actionGroups: Record<string, any[]> = {};
  const inputFields: Record<string, string> = {};
  
  actions.forEach(action => {
    const type = action.type || 'unknown';
    if (!actionGroups[type]) actionGroups[type] = [];
    
    // For input actions, track the field and value
    if (type === 'input' && action.target) {
      const fieldId = action.target.id || action.target.name || action.target.placeholder || 'field';
      inputFields[fieldId] = action.value || action.target.value || '';
    } else if (type === 'click' || type === 'submit') {
      // Keep important actions
      actionGroups[type].push({
        selector: action.target?.selector || action.selector,
        text: action.target?.text,
        url: action.url
      });
    }
  });
  
  let summary = `Action Summary (${actions.length} total):\n`;
  
  // Show input fields
  if (Object.keys(inputFields).length > 0) {
    summary += '\nInput Fields Detected:\n';
    Object.entries(inputFields).forEach(([field, value]) => {
      summary += `  - ${field}: "${value}"\n`;
    });
  }
  
  // Show click/submit actions
  if (actionGroups.click) {
    summary += `\nClicks (${actionGroups.click.length}):\n`;
    actionGroups.click.slice(0, 5).forEach((a: any) => {
      summary += `  - ${a.selector || 'unknown'}\n`;
    });
  }
  
  // Show action type counts
  summary += '\nAction Type Counts:\n';
  Object.entries(actionGroups).forEach(([type, items]) => {
    summary += `  - ${type}: ${items.length}\n`;
  });
  
  return summary;
}

/**
 * Summarize DOM snapshots to avoid huge prompts
 */
function summarizeDomSnapshots(snapshots: any[]): string {
  if (!snapshots || !snapshots.length) return 'No DOM snapshots captured';
  
  let summary = `DOM Snapshot Summary (${snapshots.length} total):\n`;
  
  // Analyze first, middle, and last snapshots
  const keySnapshots = [
    snapshots[0],
    snapshots[Math.floor(snapshots.length / 2)],
    snapshots[snapshots.length - 1]
  ].filter(Boolean);
  
  keySnapshots.forEach((snapshot, i) => {
    if (!snapshot) return;
    
    const label = i === 0 ? 'First' : i === 1 ? 'Middle' : 'Last';
    summary += `\n${label} Snapshot:\n`;
    summary += `  - URL: ${snapshot.url || 'unknown'}\n`;
    summary += `  - Title: ${snapshot.title || 'unknown'}\n`;
    
    // Find form elements
    if (snapshot.interactables) {
      const inputs = snapshot.interactables.filter((el: any) => 
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
      );
      const buttons = snapshot.interactables.filter((el: any) => 
        el.tagName === 'BUTTON'
      );
      
      if (inputs.length > 0) {
        summary += `  - Input fields: ${inputs.length}\n`;
        inputs.slice(0, 3).forEach((input: any) => {
          summary += `    • ${input.id || input.name || input.placeholder || 'unnamed'}\n`;
        });
      }
      
      if (buttons.length > 0) {
        summary += `  - Buttons: ${buttons.length}\n`;
      }
    }
    
    if (snapshot.forms && snapshot.forms.length > 0) {
      summary += `  - Forms detected: ${snapshot.forms.length}\n`;
    }
  });
  
  return summary;
}