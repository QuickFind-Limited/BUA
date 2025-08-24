# Intent Spec Recovery Logic & Fallback Mechanisms

## Overview
The current Intent Spec system implements a multi-layered recovery strategy to ensure robust automation execution even when page structures change or unexpected conditions occur.

## Test Configuration
- **Test Values Saved**: `intents/test-zoho-inventory.json`
- **Username**: admin@quickfindai.com
- **Password**: #QuickFind2024
- **Item Name**: Test Box 3676
- **Selling Price**: 400
- **Cost Price**: 300
- **Test Button**: Added to UI toolbar - "Test Zoho" button loads these values automatically

## Recovery Layers

### 1. Pre-Flight Checks
Before executing each step, the system performs pre-flight analysis:
- **Element Detection**: Checks if required selectors exist on the page
- **Alternative Selectors**: Falls back to alternative selectors if primary fails
- **Wait Conditions**: Waits for elements to be visible/enabled before interaction
- **Timeout**: Each check has configurable timeout (default 5000ms)

### 2. Skip Conditions
Smart detection to skip unnecessary steps:
- **URL Matching**: Skips login if already on `inventory.zoho.com/app/`
- **Element Detection**: Skips login if user menu or logout button visible
- **State Detection**: Recognizes "authenticated" or "dashboard" states
- **Skip Reasons**: Logs why steps were skipped for debugging

### 3. Execution Strategies

#### Primary: Snippet Execution
```javascript
"prefer": "snippet"  // Uses pre-recorded Playwright code
"snippet": "await page.fill('#LOGIN_ID', '{{LOGIN_ID}}');"
```

#### Fallback: AI Execution
```javascript
"fallback": "ai"  // Falls back to AI if snippet fails
"ai_instruction": "Enter the login email in the email field"
```

### 4. Error Handling

Each step includes comprehensive error handling:
```javascript
"errorHandling": {
    "retry": 3,                    // Retry failed steps 3 times
    "retryDelay": 2000,            // Wait 2 seconds between retries
    "skipOnError": false,          // Don't skip critical steps
    "alternativeAction": "refresh_and_retry",  // Recovery action
    "fallbackSelectors": [...]     // Alternative selectors to try
}
```

### 5. Selector Hierarchy

Multiple selector strategies for each element:
1. **ID Selectors**: `#LOGIN_ID`, `#ab6b5c71b`
2. **Name Attributes**: `[name='LOGIN_ID']`
3. **Type Selectors**: `[type='email']`, `[type='password']`
4. **Placeholder Matching**: `[placeholder*='email']`
5. **Class Names**: `.login-field`, `.email-input`
6. **Aria Labels**: `[aria-label='Email']`
7. **XPath**: `//input[contains(@placeholder, 'email')]`
8. **Text Content**: `text=Login`, `text=Sign In`

### 6. Wait Strategies

Different wait conditions for different scenarios:
```javascript
"waitBefore": {
    "type": "element|time|network",
    "condition": "visible|enabled|idle|page_load",
    "timeout": 5000
}
```

### 7. Validation

Post-execution validation to ensure success:
```javascript
"validation": {
    "type": "element|url",
    "expected": "field has value|inventory.zoho.com/app",
    "screenshot": true,         // Capture screenshot for debugging
    "continueOnFailure": false  // Stop if validation fails
}
```

### 8. Performance Optimization

```javascript
"performance": {
    "expectedDuration": 3000,   // Expected time for step
    "maxDuration": 15000,       // Maximum allowed time
    "fallbackToAI": true        // Use AI if taking too long
}
```

## Recovery Flow Example

1. **Navigate to Login Page**
   - Check if already logged in (skip condition)
   - If yes → Skip to step 5
   - If no → Continue

2. **Enter Credentials**
   - Try primary selector `#LOGIN_ID`
   - If fails → Try `[name='LOGIN_ID']`
   - If fails → Try `[type='email']`
   - If all fail → Use AI to find email field
   - Retry up to 3 times with 2-second delays

3. **Click Login**
   - Wait for button to be enabled
   - Try multiple selectors
   - If fails → Try pressing Enter on password field
   - Validate by checking URL change

4. **Handle Unexpected States**
   - If navigation fails → Refresh and retry
   - If element not found → Use AI to locate
   - If timeout → Fall back to AI execution

5. **Navigate to Items**
   - Skip if already on items page
   - Use direct navigation or click menu

6. **Create Item**
   - Fill fields with dynamic IDs
   - Use placeholder text as fallback
   - Validate each field has value

## AI Fallback Details

When snippet execution fails, the system uses Claude AI to:
1. **Analyze Page Content**: Extract current page state
2. **Find Elements**: Use natural language to locate elements
3. **Execute Actions**: Perform actions based on instructions
4. **Handle Popups**: Intelligently dismiss or interact with unexpected dialogs
5. **Navigate**: Find alternative navigation paths

## Current Issues & Limitations

1. **Execution Context Destruction**: Page navigations sometimes destroy context during analysis
2. **Zod Schema Errors**: Bug in Magnitude library with schema conversion
3. **Dynamic Element IDs**: Zoho uses dynamic IDs that change between sessions
4. **Session Persistence**: Already logged-in state not always detected properly

## Testing the Recovery System

1. Click the **"Test Zoho"** button in the UI
2. Values will auto-populate:
   - Username: admin@quickfindai.com
   - Password: #QuickFind2024
   - Item: Test Box 3676
   - Prices: 400/300
3. Click **"Start Automation"** to execute
4. Monitor console for recovery attempts

## Troubleshooting Commands

```javascript
// Check if recovery is working
console.log(window.lastIntentSpec);

// Manually trigger test flow
window.runTestFlow();

// Check recording data
console.log(window.lastRecordingSession);

// View current Intent Spec
console.log(JSON.stringify(window.lastIntentSpec, null, 2));
```

## Files Involved

- **Intent Spec**: `intent-spec-1755985558961.json`
- **Test Config**: `intents/test-zoho-inventory.json`
- **Flow Executor**: `dist/main/enhanced-flow-executor.js`
- **Magnitude Controller**: `dist/main/enhanced-magnitude-controller.js`
- **Pre-flight Analyzer**: `dist/main/preflight-analyzer.js`
- **UI Components**: `ui/tabbar.js`, `ui/vars-panel.js`

## Recovery Priority

1. **Skip unnecessary steps** (already logged in)
2. **Use exact selectors** (IDs, names)
3. **Try alternative selectors** (classes, types)
4. **Retry with delays** (handle timing issues)
5. **Use AI for element location** (when selectors fail)
6. **Full AI execution** (when all else fails)

This multi-layered approach ensures maximum resilience in automation execution.