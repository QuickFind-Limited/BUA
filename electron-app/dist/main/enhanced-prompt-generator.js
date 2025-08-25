"use strict";
/**
 * Enhanced Prompt Generator for Bulletproof Intent Specs
 * Utilizes ALL captured data for robust automation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBulletproofIntentSpecPrompt = generateBulletproofIntentSpecPrompt;
exports.generateValidationSteps = generateValidationSteps;
exports.generatePerformanceExpectations = generatePerformanceExpectations;
/**
 * Generate enhanced prompt that uses ALL captured data
 */
function generateBulletproofIntentSpecPrompt(recording) {
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
    // Determine the actual workflow URL from actions (where user actually interacted)
    let actualWorkflowUrl = recording.url;
    if (recording.actions && recording.actions.length > 0) {
        // Use the URL from the first action as the actual workflow URL
        const firstActionUrl = recording.actions[0].url;
        if (firstActionUrl && firstActionUrl !== recording.url) {
            actualWorkflowUrl = firstActionUrl;
        }
    }
    return `You are an expert at creating BULLETPROOF Intent Specifications from comprehensive recording data.

Your task: Analyze the recording and output a STRICT JSON Intent Spec. NO prose, NO explanations, NO markdown - ONLY valid JSON.

IMPORTANT: Focus on the ACTUAL USER WORKFLOW, not the initial page load. The user's actual workflow is at: ${actualWorkflowUrl}

COMPREHENSIVE RECORDING DATA:
==========================
Session: ${recording.sessionId}
Duration: ${recording.duration}ms
Initial URL: ${recording.url}
Actual Workflow URL: ${actualWorkflowUrl}
Viewport: ${JSON.stringify(recording.viewport || { width: 1920, height: 1080 })}
User Agent: ${recording.userAgent || 'Not captured'}

RECORDED EVENTS/ACTIONS (${recording.events?.length || recording.actions?.length || 0}):
${summarizeActions(recording.events || recording.actions || [])}

${recording.capturedInputs ? `CAPTURED INPUT FIELDS:
${summarizeCapturedInputs(recording.capturedInputs)}
` : ''}
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

CRITICAL: VARIABLE NAME EXTRACTION
===================================
Analyze ALL input fields and create descriptive, semantic variable names:

NAMING PRINCIPLES:
1. Use UPPERCASE with underscores for all variables
2. Be specific and descriptive based on the field's purpose
3. For numeric fields in inventory/commerce contexts:
   - Price fields should specify their type (SELL_PRICE, BUY_PRICE, COST_PRICE)
   - Quantity fields should be specific (STOCK_QUANTITY, ORDER_QUANTITY)
4. For authentication fields:
   - Email/username fields → EMAIL_ADDRESS or USERNAME
   - Password fields → PASSWORD
5. For dropdown/select fields:
   - Treat selections as variables when they represent user choices
   - Use descriptive names (UNIT_TYPE, CATEGORY, STATUS, COUNTRY)
   - Only hardcode if the value is always the same in the workflow
6. Use full words, not abbreviations (PHONE_NUMBER not PHONE or TEL)
7. Include the field's business context in the name

IMPORTANT: Analyze the actual page context and field labels to determine the most appropriate variable name. Don't use generic names like PRICE or QUANTITY when more specific names like SELL_PRICE or STOCK_QUANTITY would be clearer.

MANDATORY: If the recording includes login/authentication actions, the login credentials (LOGIN_ID, PASSWORD, EMAIL_ADDRESS, USERNAME) MUST be included in the "params" array as variables. NEVER hardcode login credentials in the snippet. Always use {{VARIABLE_NAME}} syntax for authentication fields.

CRITICAL RULES FOR BULLETPROOF INTENT SPEC:
==========================================
MANDATORY: Every step MUST include ALL of these elements for maximum resilience:

1. MULTIPLE SELECTORS (minimum 4 per element):
   - ID selector: #element-id
   - Class selector: .element-class
   - Attribute selector: [name="field"], [placeholder*="text"]
   - Text selector: text=Button Text, :has-text("content")
   - ARIA selector: [aria-label="label"], [role="button"]
   - XPath fallback: //button[contains(text(), 'Submit')]

2. COMPREHENSIVE ERROR HANDLING:
   Every step MUST have:
   {
     "errorHandling": {
       "retry": 3,
       "retryDelay": 1000-2000,
       "skipOnError": false (true only for non-critical),
       "alternativeAction": "specific fallback",
       "fallbackSelectors": ["alt1", "alt2", "alt3"]
     }
   }

3. PRE-FLIGHT CHECKS (for interaction steps):
   {
     "preFlightChecks": [
       {
         "selector": "primary selector",
         "required": true,
         "alternativeSelectors": ["backup1", "backup2"],
         "waitFor": "visible|enabled|interactive",
         "timeout": 5000
       }
     ]
   }

4. INTELLIGENT WAIT CONDITIONS:
   - waitBefore: Check element/network state BEFORE action
   - waitAfter: Verify success AFTER action
   - Use specific conditions not generic timeouts

5. VALIDATION AFTER EVERY CRITICAL STEP:
   {
     "validation": {
       "type": "element|text|url|network|screenshot",
       "expected": "specific expectation",
       "screenshot": true (for critical steps),
       "continueOnFailure": false
     }
   }

6. SKIP CONDITIONS (for auth/navigation):
   {
     "skipConditions": [
       {
         "type": "url_match",
         "value": "dashboard|app|home",
         "skipReason": "Already logged in"
       },
       {
         "type": "element_exists", 
         "value": ".user-menu, #logout-btn",
         "skipReason": "User menu visible"
       }
     ]
   }

7. PERFORMANCE MONITORING:
   {
     "performance": {
       "expectedDuration": [actual from recording],
       "maxDuration": [3x expected],
       "alert": "slow|timeout|failed",
       "fallbackToAI": true
     }
   }

OUTPUT THIS ENHANCED JSON STRUCTURE:
{
  "name": "Descriptive name based on the actual workflow at ${actualWorkflowUrl} (NOT 'Google' unless it's actually a Google workflow)",
  "description": "What this automation does",
  "url": "${actualWorkflowUrl}",
  "params": ["LOGIN_ID", "PASSWORD", "OTHER_VARIABLE_NAMES"],
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
      "ai_instruction": "Natural language instruction for AI fallback",
      "snippet": "await page.action();",
      "prefer": "snippet",
      "fallback": "ai",
      "selectors": [
        "#id-selector",
        ".class-selector", 
        "[name='field-name']",
        "[placeholder*='text']",
        "text=Exact Text",
        "[aria-label='label']",
        "[role='button']",
        "//xpath/fallback"
      ],
      "value": "value or {{VARIABLE}}",
      "preFlightChecks": [
        {
          "selector": "#primary-selector",
          "required": true,
          "alternativeSelectors": [".backup1", ".backup2"],
          "waitFor": "visible",
          "timeout": 5000
        }
      ],
      "skipConditions": [
        {
          "type": "element_exists",
          "value": ".already-done",
          "skipReason": "Step already completed"
        }
      ],
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
        "type": "element|text|url|network|screenshot",
        "expected": "expected value or pattern",
        "screenshot": false,
        "continueOnFailure": false
      },
      "errorHandling": {
        "retry": 3,
        "retryDelay": 1500,
        "skipOnError": false,
        "alternativeAction": "refresh_and_retry",
        "fallbackSelectors": ["alt1", "alt2", "alt3"]
      },
      "performance": {
        "expectedDuration": ${recording.duration || 1000},
        "maxDuration": 30000,
        "fallbackToAI": true
      }
    }
  ],
  "preferences": {
    "dynamic_elements": "ai",
    "simple_steps": "snippet",
    "form_interactions": "snippet",
    "validation": "ai"
  },
  "screenshotValidation": {
    "enabled": true,
    "threshold": 80,
    "checkpoints": ["after-login", "after-critical-action", "final"],
    "ignoreRegions": [".timestamp", ".dynamic-content"],
    "compareMode": "structural"
  },
  "validations": [
    {
      "step": "after-login",
      "check": "element|url|cookie",
      "expected": "value"
    },
    {
      "step": "final",
      "check": "screenshot",
      "expected": "matches_recording",
      "threshold": 85
    }
  ],
  "errorRecovery": {
    "strategies": ["retry", "refresh", "restart"],
    "maxAttempts": 3,
    "fallbackToManual": false
  },
  "performance": {
    "totalExpectedDuration": ${recording.duration},
    "criticalPath": ["step1", "step3", "step5"],
    "slowStepThreshold": 10000
  }
}

IMPORTANT: Return ONLY the JSON Intent Spec above with actual values filled in. No explanations, no comments, no markdown - ONLY valid JSON starting with { and ending with }`;
}
/**
 * Analyze network patterns for wait conditions
 */
function analyzeNetworkPatterns(requests) {
    if (!requests.length)
        return 'No network data captured';
    const apiCalls = requests.filter((r) => r.url?.includes('/api/'));
    const resources = requests.filter((r) => r.url?.match(/\.(js|css|png|jpg|svg)$/));
    return `
- API Calls: ${apiCalls.length} (wait for these to complete)
- Resource loads: ${resources.length}
- Critical endpoints: ${apiCalls.slice(0, 3).map((r) => r.url).join(', ')}
- Average response time: ${calculateAverage(requests.map((r) => r.timing?.end - r.timing?.start || 0))}ms`;
}
/**
 * Analyze DOM mutations for dynamic content
 */
function analyzeDynamicElements(mutations) {
    if (!mutations.length)
        return 'No mutations captured';
    const addedNodes = mutations.filter((m) => m.type === 'childList' && m.addedNodes?.length);
    const attributeChanges = mutations.filter((m) => m.type === 'attributes');
    return `
- Nodes added: ${addedNodes.length} (indicates dynamic content)
- Attribute changes: ${attributeChanges.length} (indicates state changes)
- Dynamic selectors to avoid: ${extractDynamicSelectors(mutations).join(', ')}`;
}
/**
 * Analyze console errors
 */
function analyzeErrorPatterns(errors) {
    if (!errors.length)
        return 'No console errors detected';
    return `
- Total errors: ${errors.length}
- Common patterns: ${extractErrorPatterns(errors).join(', ')}
- Error sources: ${[...new Set(errors.map((e) => e.source))].join(', ')}
- Add error handling for these scenarios`;
}
/**
 * Analyze timing patterns
 */
function analyzeTimingPatterns(events) {
    if (!events.length)
        return 'No timing data';
    const delays = [];
    for (let i = 1; i < events.length; i++) {
        const delay = (events[i].timestamp || 0) - (events[i - 1].timestamp || 0);
        if (delay > 0)
            delays.push(delay);
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
function analyzeViewport(viewport) {
    if (!viewport)
        return 'No viewport data';
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
function analyzeTabSessions(tabSessions) {
    const tabCount = Object.keys(tabSessions).length;
    if (tabCount === 0)
        return 'Single tab workflow';
    return `
- Tabs used: ${tabCount}
- Tab switches detected: Add synchronization
- Popup handling may be needed`;
}
// Helper functions
function calculateAverage(numbers) {
    if (!numbers.length)
        return 0;
    return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}
function extractDynamicSelectors(mutations) {
    // Extract selectors that change frequently
    const selectors = new Set();
    mutations.forEach((m) => {
        if (m.target?.id && m.target.id.match(/\d+/)) {
            selectors.add(`#${m.target.id} (contains numbers)`);
        }
    });
    return Array.from(selectors).slice(0, 5);
}
function extractErrorPatterns(errors) {
    const patterns = new Set();
    errors.forEach((e) => {
        if (e.message?.includes('404'))
            patterns.add('404 Not Found');
        if (e.message?.includes('undefined'))
            patterns.add('Undefined reference');
        if (e.message?.includes('timeout'))
            patterns.add('Timeout');
        if (e.message?.includes('network'))
            patterns.add('Network error');
    });
    return Array.from(patterns);
}
/**
 * Generate validation steps from recording data
 */
function generateValidationSteps(recording) {
    const validations = [];
    // Add URL validation after navigation
    if (recording.events?.some((e) => e.action === 'navigation')) {
        validations.push({
            step: 'after-navigation',
            check: 'url',
            expected: 'contains expected path'
        });
    }
    // Add login validation
    if (recording.events?.some((e) => e.selector?.includes('password') || e.selector?.includes('login'))) {
        validations.push({
            step: 'after-login',
            check: 'cookie',
            expected: 'session cookie exists'
        });
    }
    // Add form submission validation
    if (recording.events?.some((e) => e.action === 'submit')) {
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
function generatePerformanceExpectations(recording) {
    const criticalSteps = [];
    // Identify critical path
    recording.events?.forEach((event, index) => {
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
 * Summarize captured inputs with explicit variable mapping
 */
function summarizeCapturedInputs(capturedInputs) {
    if (!capturedInputs || Object.keys(capturedInputs).length === 0) {
        return 'No captured inputs';
    }
    let summary = 'Fields with captured values (analyze context to determine appropriate variable names):\n';
    Object.entries(capturedInputs).forEach(([field, data]) => {
        const value = data.value || '';
        const type = data.type || 'text';
        const placeholder = data.placeholder || '';
        const label = data.label || '';
        // Provide contextual information to help with variable naming
        summary += `  - Field: ${field}\n`;
        summary += `    Type: ${type}\n`;
        summary += `    Value: "${value}"\n`;
        if (placeholder)
            summary += `    Placeholder: "${placeholder}"\n`;
        if (label)
            summary += `    Label: "${label}"\n`;
        summary += '\n';
    });
    summary += 'Remember: Use descriptive variable names based on the field\'s purpose and context.\n';
    return summary;
}
/**
 * Summarize actions to avoid huge prompts
 */
function summarizeActions(actions) {
    if (!actions || !actions.length)
        return 'No actions captured';
    // Group actions by type
    const actionGroups = {};
    const inputFields = {};
    actions.forEach(action => {
        const type = action.type || 'unknown';
        if (!actionGroups[type])
            actionGroups[type] = [];
        // For input actions, track the field and value
        if (type === 'input' && action.target) {
            const fieldId = action.target.id || action.target.name || action.target.placeholder || 'field';
            inputFields[fieldId] = action.value || action.target.value || '';
        }
        else if (type === 'click' || type === 'submit') {
            // Keep important actions
            actionGroups[type].push({
                selector: action.target?.selector || action.selector,
                text: action.target?.text,
                url: action.url
            });
        }
    });
    let summary = `Action Summary (${actions.length} total):\n`;
    // Show input fields detected
    if (Object.keys(inputFields).length > 0) {
        summary += '\nInput Fields Detected (create descriptive variable names based on context):\n';
        Object.entries(inputFields).forEach(([field, value]) => {
            summary += `  - ${field}: "${value}"\n`;
        });
        summary += 'Note: Use the field context and page purpose to determine appropriate variable names.\n';
    }
    // Show click/submit actions
    if (actionGroups.click) {
        summary += `\nClicks (${actionGroups.click.length}):\n`;
        actionGroups.click.slice(0, 5).forEach((a) => {
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
function summarizeDomSnapshots(snapshots) {
    if (!snapshots || !snapshots.length)
        return 'No DOM snapshots captured';
    let summary = `DOM Snapshot Summary (${snapshots.length} total):\n`;
    // With event-driven captures, each snapshot is meaningful
    // Group snapshots by URL to identify page transitions
    const pageGroups = {};
    snapshots.forEach(snapshot => {
        const url = snapshot.url || 'unknown';
        if (!pageGroups[url])
            pageGroups[url] = [];
        pageGroups[url].push(snapshot);
    });
    // Show page flow
    summary += `\nPage Flow (${Object.keys(pageGroups).length} unique pages):\n`;
    Object.entries(pageGroups).forEach(([url, snaps]) => {
        summary += `  - ${url} (${snaps.length} snapshots)\n`;
    });
    // Analyze snapshots triggered by different events
    const eventSnapshots = snapshots.filter(s => s.reason);
    if (eventSnapshots.length > 0) {
        summary += `\nEvent-Triggered Snapshots:\n`;
        const eventCounts = {};
        eventSnapshots.forEach(s => {
            eventCounts[s.reason] = (eventCounts[s.reason] || 0) + 1;
        });
        Object.entries(eventCounts).forEach(([event, count]) => {
            summary += `  - ${event}: ${count}\n`;
        });
    }
    // Analyze first and last snapshot for each unique page
    Object.entries(pageGroups).forEach(([url, snaps]) => {
        const first = snaps[0];
        const last = snaps[snaps.length - 1];
        summary += `\n${url.substring(url.lastIndexOf('/') + 1) || 'Page'}:\n`;
        summary += `  - Title: ${last.title || 'unknown'}\n`;
        // Compare first and last to show state changes
        if (first.interactables && last.interactables) {
            const firstInputs = first.interactables.filter((el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
            const lastInputs = last.interactables.filter((el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
            // Show fields that have values in last snapshot (were filled)
            const filledFields = lastInputs.filter((input) => input.value);
            if (filledFields.length > 0) {
                summary += `  - Filled fields: ${filledFields.length}\n`;
                filledFields.slice(0, 5).forEach((input) => {
                    summary += `    • ${input.id || input.name}: "${input.value}"\n`;
                });
            }
            // Show available buttons for actions
            const buttons = last.interactables.filter((el) => el.tagName === 'BUTTON' || el.role === 'button');
            if (buttons.length > 0) {
                summary += `  - Available actions: ${buttons.slice(0, 3).map((b) => b.text || b.value || 'button').join(', ')}\n`;
            }
        }
        if (last.forms && last.forms.length > 0) {
            summary += `  - Forms on page: ${last.forms.length}\n`;
        }
    });
    return summary;
}
//# sourceMappingURL=enhanced-prompt-generator.js.map