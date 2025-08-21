/**
 * Enhanced Intent Spec Prompt Generator
 * Leverages rich captured data including multiple selectors, DOM snapshots, 
 * network patterns, timing, and 40+ event types for resilient automation
 */

/**
 * Generate enhanced prompt that produces Intent Specs optimized for resilient execution
 * using the comprehensive data captured by our enhanced recording system
 */
export function generateEnhancedIntentSpecPrompt(serializedRecording: string): string {
  return `# Advanced Recording Analysis with Rich Context Data

You are analyzing a recording that captures COMPREHENSIVE interaction data including:
- 40+ event types (clicks, double-clicks, drag-drop, clipboard, touch, media, storage)
- Multiple selector strategies per element (8-10 alternatives)
- DOM structure snapshots every 3 seconds
- Network request patterns (main document loads)
- Performance metrics (LCP, CLS, INP)
- Timing intelligence between actions
- Final screenshot capture
- Tab context attribution

## Leverage Rich Data for Maximum Resilience

Use the comprehensive data to create automation that:
1. **Uses multiple selector strategies** - Elements have 8-10 selector alternatives
2. **Understands page flow** - DOM snapshots show state transitions
3. **Handles timing intelligently** - Use actual wait times between actions
4. **Detects patterns** - Network requests reveal navigation patterns
5. **Validates thoroughly** - Performance metrics indicate page readiness

## Input Recording

${serializedRecording}

## Your Primary Task

Generate an Intent Spec with EXECUTABLE Playwright snippets that will work reliably without AI assistance.

## Enhanced Intent Spec Format with Rich Context

Return ONLY valid JSON that leverages all captured data:

\`\`\`json
{
  "name": "descriptive name",
  "description": "what this automation accomplishes",
  "url": "starting URL",
  "params": ["PARAM_NAME"],
  "executionStrategy": {
    "primary": "snippet",
    "aiUsagePercentage": 10,
    "aiTriggers": ["validation", "dynamic_content", "error_recovery"]
  },
  "steps": [
    {
      "name": "human-readable step name",
      "snippet": "await page.goto('url') // ACTUAL Playwright code",
      "executionMethod": "snippet|ai|hybrid",
      "category": "navigation|form|interaction|validation",
      "skipConditions": [
        {
          "type": "url_match|element_exists|text_present",
          "value": "condition to check",
          "skipReason": "Already logged in"
        }
      ],
      "skipNavigationStates": ["dashboard", "app", "home"],
      "preFlightChecks": [
        {
          "selector": "primary CSS selector from recording",
          "required": true,
          "alternativeSelectors": [
            "// USE ALL 8-10 SELECTORS FROM RECORDING DATA",
            "#id-selector if available",
            "[data-testid] if available",
            "[aria-label] if available",
            ":nth-child() position selector",
            "text-based selector",
            "class combination selector",
            "parent > child selector",
            "sibling + selector"
          ]
        }
      ],
      "errorRecovery": {
        "primaryStrategy": "retry|wait|refresh|use_ai",
        "fallbackSnippet": "alternative Playwright code if primary fails",
        "maxRetries": 3
      },
      "continueOnFailure": false,
      "aiInstruction": "ONLY if executionMethod is 'ai': Natural language instruction"
    }
  ],
  "validationSteps": [
    {
      "name": "verify success",
      "snippet": "await expect(page.locator('.success')).toBeVisible()",
      "executionMethod": "snippet"
    }
  ]
}
\`\`\`

## Smart Snippet Generation Using Rich Data

### Generate Snippets That Use Recording Intelligence:
1. **Navigation** (100% reliable):
   \`\`\`javascript
   await page.goto('https://example.com/login')
   \`\`\`

2. **Form Fields** with multiple selector fallbacks:
   \`\`\`javascript
   // Try primary selector first, then alternatives from recording
   const usernameSelectors = [
     '#username',  // from recording data
     '[name="username"]',  // alternative from recording
     'input[placeholder*="user"]',  // text-based from recording
   ];
   for (const selector of usernameSelectors) {
     try {
       await page.fill(selector, '{{USERNAME}}');
       break;
     } catch (e) {
       continue;
     }
   }
   \`\`\`

3. **Clicks** on predictable elements:
   \`\`\`javascript
   await page.click('button[type="submit"]')
   await page.getByRole('button', { name: 'Login' }).click()
   \`\`\`

4. **Waits** for specific conditions:
   \`\`\`javascript
   await page.waitForSelector('.dashboard', { timeout: 10000 })
   await page.waitForLoadState('networkidle')
   \`\`\`

### ONLY Use AI (ai) for:
1. **Content Validation**: "Verify the invoice total matches expected amount"
2. **Dynamic Element Detection**: "Find and click the newest item in the list"
3. **Visual Reasoning**: "Check if the chart shows an upward trend"
4. **Error Recovery**: "Handle unexpected popup or dialog"

### Use Hybrid (hybrid) for:
1. Try snippet first, fall back to AI if it fails
2. Complex multi-step operations that might have variations

## Pre-Flight Checks

For EVERY step that interacts with elements, include preFlightChecks:

\`\`\`json
"preFlightChecks": [
  {
    "selector": "#login-button",
    "required": true,
    "alternativeSelectors": [
      "button[type='submit']",
      "button:has-text('Login')",
      "[data-testid='login-btn']"
    ]
  }
]
\`\`\`

## Skip Conditions

CRITICAL: Add intelligent skip conditions to avoid redundant actions. For login/auth steps, ALWAYS analyze the target application to determine skip patterns:

\`\`\`json
"skipNavigationStates": ["app", "dashboard", "home", "workspace", "account"],
"skipConditions": [
  {
    "type": "url_match",
    "value": "[URL pattern that indicates logged in state]",
    "skipReason": "Already in application"
  },
  {
    "type": "element_exists",
    "value": "[selector for user menu or logout button]",
    "skipReason": "User interface shows authenticated state"
  },
  {
    "type": "text_present",
    "value": "[text that only appears when logged in]",
    "skipReason": "Page content indicates authenticated session"
  }
]
\`\`\`

IMPORTANT: Analyze the actual recording to determine what indicates a logged-in state for that specific application!

## Error Recovery Strategies

For each snippet-based step, define recovery:

\`\`\`json
"errorRecovery": {
  "primaryStrategy": "retry",
  "fallbackSnippet": "await page.getByText('Login').click()",
  "maxRetries": 3,
  "waitBeforeRetry": 2000,
  "useAiAfterFailures": true
}
\`\`\`

## Selector Priority (MOST to LEAST stable)

1. **IDs**: \`#unique-id\`
2. **Data attributes**: \`[data-testid="submit"]\`
3. **ARIA/Role selectors**: \`page.getByRole('button', { name: 'Submit' })\`
4. **Stable classes**: \`.login-submit-button\`
5. **Type + attributes**: \`input[type="email"][name="username"]\`
6. **Text content**: \`page.getByText('Continue')\`
7. **XPath**: AVOID unless absolutely necessary

## Intelligent Variable Detection from Recording

Analyze the recording's typed values and form interactions to detect:
- **Credentials**: Look for password fields, email inputs → {{USERNAME}}, {{PASSWORD}}, {{EMAIL_ADDRESS}}
- **Personal Data**: Analyze form field names/labels → {{FIRST_NAME}}, {{LAST_NAME}}, {{PHONE_NUMBER}}
- **Business Data**: Detect patterns in typed text → {{COMPANY_NAME}}, {{DEPARTMENT}}, {{EMPLOYEE_ID}}
- **Dynamic Values**: Identify changing data → {{SEARCH_QUERY}}, {{DATE}}, {{AMOUNT}}
- **System IDs**: Find unique identifiers → {{ORDER_ID}}, {{TRANSACTION_ID}}, {{SESSION_ID}}

IMPORTANT: Use exact variable names that match UI detection patterns:
- PASSWORD (not PASS or PWD)
- EMAIL_ADDRESS (not EMAIL or MAIL)
- PHONE_NUMBER (not PHONE or TEL)
- FIRST_NAME and LAST_NAME (not NAME)

## Rich Data Quality Checklist

Before returning the Intent Spec, verify:
✅ **Selector Resilience**: Used ALL 8-10 selector alternatives from recording
✅ **Timing Accuracy**: Incorporated actual wait times between actions
✅ **DOM State Awareness**: Used snapshots to understand page transitions
✅ **Network Intelligence**: Identified navigation patterns from requests
✅ **Event Completeness**: Captured all interaction types (not just clicks)
✅ **Performance Readiness**: Used metrics to ensure page stability
✅ **Variable Detection**: Properly identified all dynamic values
✅ **Tab Context**: Maintained proper tab/window attribution
✅ **Final Validation**: Used screenshot data for success verification

## Example High-Quality Step

\`\`\`json
{
  "name": "Click login button",
  "snippet": "await page.click('#login-btn')",
  "executionMethod": "snippet",
  "category": "interaction",
  "preFlightChecks": [{
    "selector": "#login-btn",
    "required": true,
    "alternativeSelectors": [
      "button[type='submit']",
      "button:has-text('Sign In')"
    ]
  }],
  "errorRecovery": {
    "primaryStrategy": "retry",
    "fallbackSnippet": "await page.getByRole('button', { name: /log.?in/i }).click()",
    "maxRetries": 2
  }
}
\`\`\`

## Analyze Recording Structure

The recording contains these rich data points per action:
- **action**: The specific event type (click, dblclick, input, paste, drag, etc.)
- **selectors**: Array of 8-10 alternative selectors
- **elementInfo**: Tag, attributes, text content, position
- **timing**: Timestamp and duration since last action
- **context**: Page URL, title, viewport, tab ID
- **dom_snapshot**: Full page structure at time of action
- **network_activity**: Document loads and API calls
- **performance**: LCP, CLS, INP metrics

Use ALL this data to create the most resilient automation possible.`;
}

/**
 * Generate a prompt specifically for analyzing complex interactions
 * like drag-drop, clipboard operations, and media playback
 */
export function generateComplexInteractionPrompt(recording: string): string {
  return `# Analyze Complex User Interactions

This recording contains advanced interaction types. Generate automation that handles:

1. **Drag and Drop Operations**:
   - Source and target element selectors
   - File information if files were dropped
   - Coordinate-based movements

2. **Clipboard Operations**:
   - Copy/Paste/Cut events with actual content
   - Cross-application data transfer
   - Format preservation

3. **Media Interactions**:
   - Play/Pause/Seek operations
   - Volume and playback rate changes
   - Fullscreen transitions

4. **Touch/Mobile Events**:
   - Swipe gestures
   - Pinch/zoom operations
   - Long press interactions

5. **Storage Events**:
   - LocalStorage/SessionStorage changes
   - Cookie modifications
   - IndexedDB operations

Recording:
${recording}

Generate snippets that accurately reproduce these complex interactions.`;
}

/**
 * Generate a prompt for creating flow understanding from DOM snapshots
 */
export function generateFlowAnalysisPrompt(domSnapshots: any[]): string {
  return `# Analyze Application Flow from DOM Snapshots

You have DOM snapshots taken every 3 seconds during the recording. Use these to:

1. **Identify Page States**:
   - Login screens vs authenticated states
   - Form states (empty, partial, complete)
   - Loading vs loaded states
   - Error vs success states

2. **Detect Dynamic Content**:
   - Elements that appear/disappear
   - Content that changes between snapshots
   - AJAX-loaded sections
   - Progressive disclosure patterns

3. **Find Validation Points**:
   - Success messages
   - Error indicators
   - Progress indicators
   - State confirmations

4. **Map Navigation Flow**:
   - URL changes
   - Single-page app transitions
   - Modal/dialog sequences
   - Tab/accordion expansions

DOM Snapshots:
${JSON.stringify(domSnapshots, null, 2)}

Return a flow analysis with key transition points and validation selectors.`;
}

/**
 * Generate a validation prompt to verify Intent Spec quality
 */
export function generateSnippetValidationPrompt(intentSpec: any): string {
  return `# Intent Spec Validation

Validate this Intent Spec for snippet-first execution strategy:

${JSON.stringify(intentSpec, null, 2)}

## Validation Criteria

Check and report on:

1. **Snippet Coverage**: What percentage of steps use "snippet" vs "ai"?
2. **Snippet Validity**: Are all snippets valid, executable Playwright code?
3. **Selector Stability**: Do selectors follow the stability priority order?
4. **Pre-Flight Coverage**: Do interactive steps have preFlightChecks?
5. **Skip Logic**: Are skip conditions properly defined?
6. **Error Recovery**: Is recovery strategy defined for critical steps?
7. **AI Usage**: Is AI only used for appropriate complex tasks?

## Return Format

\`\`\`json
{
  "isValid": true/false,
  "snippetCoverage": "92%",
  "issues": [
    {
      "stepIndex": 3,
      "issue": "Missing preFlightChecks",
      "severity": "medium",
      "suggestion": "Add selector verification"
    }
  ],
  "improvements": [
    "Consider adding alternativeSelectors for step 5",
    "Step 7 could use snippet instead of AI"
  ],
  "score": 85
}
\`\`\`
`;
}

/**
 * Generate a prompt for extracting variables with proper naming from recording
 */
export function generateVariableExtractionPrompt(recording: string): string {
  return `# Extract Variables with UI-Compatible Names

Analyze this recording and identify all dynamic values that should become variables.

CRITICAL: Use these exact variable names for UI compatibility:
- PASSWORD (for password fields)
- EMAIL_ADDRESS (for email inputs)  
- USERNAME (for username/login fields)
- FIRST_NAME (for first name fields)
- LAST_NAME (for last name fields)
- PHONE_NUMBER (for phone inputs)
- COMPANY_NAME (for company/organization)
- DEPARTMENT (for department/division)
- EMPLOYEE_ID (for employee identifiers)
- ORDER_ID (for order numbers)
- TRANSACTION_ID (for transaction references)
- SEARCH_QUERY (for search inputs)
- DATE (for date inputs)
- AMOUNT (for monetary values)
- QUANTITY (for numeric quantities)

Recording:
${recording}

Return JSON with detected variables:
{
  "variables": [
    {
      "name": "EMAIL_ADDRESS",
      "detectedValue": "user@example.com",
      "fieldSelector": "#email-input",
      "fieldType": "email",
      "isRequired": true,
      "description": "User's email address for login"
    }
  ],
  "flowContext": "Login flow with email and password authentication",
  "suggestedDefaults": {
    "EMAIL_ADDRESS": "test@example.com",
    "PASSWORD": "SecurePass123"
  }
}`;
}

/**
 * Generate a prompt for runtime decision making (skip/retry/fallback)
 */
export function generateRuntimeDecisionPrompt(
  step: any,
  error: string,
  pageState: any
): string {
  return `# Runtime Execution Decision

## Current Situation
Step: ${step.name}
Snippet: ${step.snippet}
Error: ${error}

## Page State
URL: ${pageState.url}
Title: ${pageState.title}
Ready State: ${pageState.readyState}

## Decision Required

Based on the error and page state, recommend the best action:

1. **retry**: Simple retry with same snippet
2. **wait_retry**: Wait 5 seconds then retry
3. **use_alternative**: Try alternative selector
4. **use_ai**: Switch to AI execution
5. **skip**: Skip this step (if optional)
6. **refresh_retry**: Refresh page and retry
7. **navigate_back**: Go back and try different path

Return ONLY JSON:
\`\`\`json
{
  "action": "retry|wait_retry|use_alternative|use_ai|skip|refresh_retry|navigate_back",
  "confidence": 0.85,
  "reason": "Brief explanation",
  "implementation": "Specific code or instruction if applicable"
}
\`\`\`
`;
}