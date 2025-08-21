# Execution System Fallback Testing Guide

This guide documents the testing approach for the execution system's fallback mechanisms, including forced failure scenarios and recovery behavior verification.

## Overview

The ExecutionOrchestrator implements a robust fallback system that automatically switches between AI-driven and snippet-based execution when failures occur. This ensures maximum reliability and adaptability in automated task execution.

## Fallback Mechanisms

### 1. AI to Snippet Fallback (Primary)

**Default Behavior**: The system attempts AI execution first, then falls back to snippet execution if AI fails.

```typescript
// Test Scenario: AI execution fails, snippet succeeds
const testSpec = {
  steps: [{
    action: "click",
    target: "#button",
    description: "Will fallback from AI to snippet"
  }]
};

// Expected Result:
// - pathUsed: 'snippet'
// - fallbackOccurred: true
// - fallbackCount: 1
```

### 2. Snippet to AI Fallback (Configurable)

**Custom Behavior**: When `prefer: 'snippet'` is set, the system tries snippet first, then AI.

```typescript
// Test Scenario: Snippet execution fails, AI succeeds
const testSpec = {
  steps: [{
    prefer: "snippet",
    fallback: "ai",
    snippet: "await page.click('#dynamic-element');",
    action: "click",
    target: "#dynamic-element"
  }]
};
```

### 3. No Fallback Mode

**Strict Behavior**: When `fallback: 'none'` or `enableFallback: false`, execution stops on first failure.

```typescript
// Test Scenario: No fallback allowed
const orchestrator = new ExecutionOrchestrator({
  enableFallback: false
});

// Expected Result:
// - Execution stops on first failure
// - fallbackCount: 0
// - overallSuccess: false
```

## Test Categories

### Core Fallback Tests

#### 1. AI to Snippet Fallback
- **Purpose**: Verify successful fallback from AI to snippet execution
- **Trigger**: Mock AI execution to throw error
- **Verification**: 
  - `fallbackOccurred: true`
  - `pathUsed: 'snippet'`
  - `fallbackCount` incremented
  - Fallback events emitted

#### 2. Snippet to AI Fallback  
- **Purpose**: Test reverse fallback scenario
- **Trigger**: Mock snippet execution to fail
- **Verification**: 
  - Successful AI execution after snippet failure
  - Proper error handling of snippet syntax errors

#### 3. No Fallback Scenarios
- **Purpose**: Ensure execution stops when fallback is disabled
- **Trigger**: Disable fallback + force failure
- **Verification**:
  - Execution stops immediately
  - No fallback attempts made
  - Subsequent steps not executed

### Advanced Fallback Tests

#### 4. Recovery and Continuation
- **Purpose**: Verify execution continues after successful fallback
- **Scenario**: Multiple steps with mixed success/failure patterns
- **Verification**:
  - All steps attempted regardless of individual failures
  - Correct accumulation of statistics
  - Proper step-by-step execution flow

#### 5. Error Handling and Reporting
- **Purpose**: Test comprehensive error reporting during fallback
- **Coverage**:
  - Detailed error messages from both AI and snippet failures
  - Duration tracking during fallback attempts
  - Proper cleanup after failures

#### 6. Variable Substitution
- **Purpose**: Ensure variables are properly handled in fallback scenarios
- **Verification**:
  - Variables substituted correctly for both AI and snippet execution
  - No variable corruption during fallback transitions

## Test Implementation Details

### Mock Strategy

The tests use Jest mocks to simulate failure conditions:

```typescript
// Force AI execution to fail
(orchestrator as any).executeStepWithAI = jest.fn().mockRejectedValue(
  new Error("Simulated AI execution failure")
);

// Mock snippet execution to succeed
(orchestrator as any).executeStepWithSnippet = jest.fn().mockResolvedValue({
  success: true,
  screenshot: null
});
```

### Event Verification

Tests monitor fallback events to ensure proper orchestration:

```typescript
orchestrator.on('fallback-started', (event) => {
  fallbackEvents.push({ type: 'fallback-started', ...event });
});

orchestrator.on('fallback-completed', (event) => {
  fallbackEvents.push({ type: 'fallback-completed', ...event });
});
```

### Statistics Validation

Each test verifies execution statistics:

```typescript
expect(report.fallbackCount).toBe(expectedFallbacks);
expect(report.aiUsageCount).toBe(expectedAiUsage);
expect(report.snippetUsageCount).toBe(expectedSnippetUsage);
expect(report.overallSuccess).toBe(expectedSuccess);
```

## Running Fallback Tests

### Execute All Fallback Tests
```bash
npm test -- execution-fallback.spec.ts
```

### Run Specific Test Category
```bash
npm test -- execution-fallback.spec.ts --grep "AI to Snippet Fallback"
```

### Debug Mode
```bash
npm test -- execution-fallback.spec.ts --grep "should fallback from AI to snippet" --debug
```

## Test Scenarios Matrix

| Scenario | AI Result | Snippet Result | Expected Outcome | Fallback Count |
|----------|-----------|----------------|------------------|----------------|
| AI Success | ✅ Success | N/A | AI Used | 0 |
| AI Fail → Snippet Success | ❌ Error | ✅ Success | Snippet Used | 1 |
| Both Fail | ❌ Error | ❌ Error | Failure | 1 |
| No Fallback + AI Fail | ❌ Error | N/A | Immediate Failure | 0 |
| Mixed Steps | Varies | Varies | Partial Success | Varies |

## Expected Test Results

### Successful Fallback Example
```json
{
  "executionId": "exec_1234567890_abcdefghi",
  "steps": [{
    "name": "test_step",
    "pathUsed": "snippet",
    "fallbackOccurred": true,
    "success": true,
    "duration": 1250
  }],
  "aiUsageCount": 0,
  "snippetUsageCount": 1,
  "fallbackCount": 1,
  "overallSuccess": true,
  "totalDuration": 1500
}
```

### Failed Execution Example
```json
{
  "executionId": "exec_1234567890_abcdefghi",
  "steps": [{
    "name": "failing_step",
    "pathUsed": "snippet",
    "fallbackOccurred": true,
    "success": false,
    "error": "AI failed: Element not found. Fallback failed: Selector timeout",
    "duration": 2100
  }],
  "aiUsageCount": 0,
  "snippetUsageCount": 0,
  "fallbackCount": 1,
  "overallSuccess": false,
  "totalDuration": 2300
}
```

## Error Simulation Patterns

### Common AI Failure Scenarios
- Model timeout errors
- Element not found by AI reasoning
- Network connectivity issues
- Rate limiting responses

### Common Snippet Failure Scenarios  
- Selector timeout errors
- Syntax errors in snippet code
- Browser state conflicts
- Element interaction failures

### Mock Error Examples
```typescript
// AI timeout simulation
mockAI.mockRejectedValue(new Error("AI model timeout after 30 seconds"));

// Snippet selector error simulation  
mockSnippet.mockRejectedValue(new Error("TimeoutError: Selector '#button' not found"));

// Syntax error simulation
mockSnippet.mockRejectedValue(new SyntaxError("Unexpected token '}'"));
```

## Debugging Fallback Issues

### Enable Detailed Logging
```typescript
const orchestrator = new ExecutionOrchestrator({
  enableFallback: true,
  saveScreenshots: true, // Capture state during failures
  timeout: 60000 // Extended timeout for debugging
});
```

### Event Monitoring
```typescript
orchestrator.on('fallback-started', (event) => {
  console.log('Fallback initiated:', event);
});

orchestrator.on('fallback-completed', (event) => {
  console.log('Fallback result:', event);
});

orchestrator.on('step-completed', (result) => {
  console.log('Step completed:', result);
});
```

### Test Data Validation
```typescript
function validateFallbackReport(report: ExecutionReport): void {
  // Verify required fields
  assert(report.fallbackCount !== undefined, 'fallbackCount missing');
  assert(report.steps?.length > 0, 'No steps in report');
  
  // Verify logical consistency
  const fallbackSteps = report.steps.filter(s => s.fallbackOccurred);
  assert(fallbackSteps.length === report.fallbackCount, 'Fallback count mismatch');
  
  // Verify duration tracking
  assert(report.totalDuration > 0, 'Invalid total duration');
  assert(report.steps.every(s => s.duration >= 0), 'Invalid step duration');
}
```

## Continuous Integration

### Test Requirements
- All fallback tests must pass in CI/CD pipeline
- Performance benchmarks for fallback scenarios
- Coverage reports for error handling paths

### Quality Gates
- Fallback success rate > 95%
- Average fallback time < 2 seconds  
- No memory leaks during repeated fallback scenarios
- Proper cleanup after all failure modes

This comprehensive testing approach ensures the fallback system provides reliable automation capabilities even when individual execution methods encounter issues.