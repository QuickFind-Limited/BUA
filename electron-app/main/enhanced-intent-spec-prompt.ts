/**
 * Enhanced Intent Spec Prompt Generator
 * Emphasizes snippet-first strategy with AI fallback
 */

/**
 * Generate enhanced prompt that produces Intent Specs optimized for snippet-first execution
 */
export function generateEnhancedIntentSpecPrompt(serializedRecording: string): string {
  return `# Recording Analysis Task - Snippet-First Strategy

You are an expert at analyzing UI interactions to create HIGHLY RELIABLE automation patterns that prioritize Playwright code snippets over AI interpretation.

## Critical Execution Strategy

Your Intent Spec will be executed using this priority:
1. **90% Snippet-First**: Direct Playwright code for predictable actions
2. **10% AI Fallback**: Only for complex reasoning, validation, or error recovery

## Input Recording

${serializedRecording}

## Your Primary Task

Generate an Intent Spec with EXECUTABLE Playwright snippets that will work reliably without AI assistance.

## Enhanced Intent Spec Format

Return ONLY valid JSON matching this schema:

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
          "selector": "CSS selector to verify exists",
          "required": true,
          "alternativeSelectors": ["backup selector 1", "backup selector 2"]
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

## Snippet Generation Rules

### MUST Use Snippets (snippet) for:
1. **Navigation** (100% reliable):
   \`\`\`javascript
   await page.goto('https://example.com/login')
   \`\`\`

2. **Form Fields** with stable selectors:
   \`\`\`javascript
   await page.fill('#username', '{{USERNAME}}')
   await page.fill('#password', '{{PASSWORD}}')
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

## Variable Replacement

Use {{VARIABLE}} syntax for dynamic values:
- Credentials: {{USERNAME}}, {{PASSWORD}}
- Data: {{SEARCH_TERM}}, {{AMOUNT}}
- IDs: {{ORDER_ID}}, {{CUSTOMER_ID}}

## Quality Checklist

Before returning the Intent Spec, verify:
✅ 90%+ steps use "snippet" executionMethod
✅ Every snippet is valid, executable Playwright code
✅ Alternative selectors provided for critical elements
✅ Skip conditions prevent redundant actions
✅ Error recovery defined for critical paths
✅ AI only used for complex reasoning tasks
✅ No unnecessary AI usage for simple clicks/navigation

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

Remember: The goal is MAXIMUM RELIABILITY through snippet-first execution. Only use AI when absolutely necessary.`;
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