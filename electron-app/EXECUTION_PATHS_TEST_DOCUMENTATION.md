# Execution Paths Testing Documentation

This document describes the comprehensive test suite for validating AI and snippet execution paths in the ExecutionOrchestrator system.

## Test Overview

The test suite consists of 5 comprehensive test files that verify:

1. **AI-first execution** - Testing AI preference and fallback behavior
2. **Snippet-first execution** - Testing snippet preference and fallback behavior  
3. **Mixed execution** - Testing workflows with both AI and snippet preferences
4. **Execution reporting** - Validating accurate metrics and reporting
5. **SDK Decider logic** - Verifying decision-making logic and integration

## Test Files Structure

### 1. `execution-paths-ai-first.spec.ts`
Tests AI-first execution scenarios:
- ✅ All steps with `prefer="ai"` execute via AI path
- ✅ Fallback to snippets when AI fails
- ✅ No fallback when disabled
- ✅ Event emission during execution

**Key Validations:**
- `aiUsageCount` accurately reflects AI step executions
- `pathUsed` is correctly set to 'ai' for AI executions
- `fallbackOccurred` tracking works correctly
- Event flow: execution-started → step-started → step-completed → execution-completed

### 2. `execution-paths-snippet-first.spec.ts`
Tests snippet-first execution scenarios:
- ✅ All steps with `prefer="snippet"` execute via snippet path
- ✅ Fallback to AI when snippets fail
- ✅ Variable substitution in snippets ({{VARIABLE}} replacement)
- ✅ Complex snippet execution patterns
- ✅ No fallback when disabled

**Key Validations:**
- `snippetUsageCount` accurately reflects snippet step executions
- `pathUsed` is correctly set to 'snippet' for snippet executions
- Variable substitution works correctly in snippet code
- Playwright executor integration functions properly

### 3. `execution-paths-mixed.spec.ts`
Tests mixed execution scenarios:
- ✅ Steps with mixed AI and snippet preferences execute correctly
- ✅ Fallback behavior works in mixed scenarios
- ✅ Complex workflows with dynamic preferences
- ✅ Preference inheritance and override patterns

**Key Validations:**
- Each step uses its specified preference correctly
- Mixed AI/snippet workflows execute in correct order
- Global preferences vs step-level preferences work correctly
- Fallback occurs from the initially preferred path

### 4. `execution-reporting.spec.ts`
Tests execution reporting accuracy:
- ✅ `aiUsageCount` and `snippetUsageCount` are accurate
- ✅ `fallbackCount` tracks fallback occurrences correctly
- ✅ `pathUsed` reporting for each step is accurate
- ✅ Duration tracking and timing accuracy
- ✅ Complete execution report structure validation

**Key Validations:**
- All metrics match actual execution paths taken
- Report structure contains all required fields
- Timing data is reasonable and accurate
- Execution ID format is correct

### 5. `sdk-decider-verification.spec.ts`
Tests SDK Decider logic:
- ✅ Step-level prefer settings are respected
- ✅ `choosePath` API works correctly
- ✅ Integration with ExecutionOrchestrator
- ✅ OpusDecider fallback decision logic
- ✅ Signal combination handling
- ✅ Decision response parsing

**Key Validations:**
- Decision logic follows preference hierarchy correctly
- Fallback decisions use appropriate heuristics
- Response parsing handles various input formats
- Integration between Decider and Orchestrator works

## Execution Path Verification

### AI-First Path
```
Intent Spec with prefer="ai" → Decider.choosePath() → AI Execution (MagnitudeExecutor)
                                                    ↓ (if fails and fallback enabled)
                                                  Snippet Execution (PlaywrightExecutor)
```

### Snippet-First Path  
```
Intent Spec with prefer="snippet" → Decider.choosePath() → Snippet Execution (PlaywrightExecutor)
                                                        ↓ (if fails and fallback enabled)
                                                      AI Execution (MagnitudeExecutor)
```

### Mixed Path
```
Step 1: prefer="snippet" → Snippet Execution
Step 2: prefer="ai"      → AI Execution  
Step 3: prefer="snippet" → Snippet Execution
Step 4: prefer="ai"      → AI Execution
```

## Usage Counting Verification

The tests verify that usage counters are accurate:

```typescript
report.aiUsageCount === steps.filter(s => s.pathUsed === 'ai').length
report.snippetUsageCount === steps.filter(s => s.pathUsed === 'snippet').length
report.fallbackCount === steps.filter(s => s.fallbackOccurred).length
```

## Test Data Examples

### AI-First Intent Spec
```json
{
  "name": "AI-First Test Flow",
  "steps": [
    {
      "name": "step1",
      "ai_instruction": "Click the button",
      "snippet": "await page.click('#button');",
      "prefer": "ai",
      "fallback": "snippet"
    }
  ]
}
```

### Snippet-First Intent Spec
```json
{
  "name": "Snippet-First Test Flow", 
  "steps": [
    {
      "name": "step1",
      "ai_instruction": "Fill the form",
      "snippet": "await page.fill('#input', '{{VALUE}}');",
      "prefer": "snippet",
      "fallback": "ai"
    }
  ]
}
```

### Mixed Execution Intent Spec
```json
{
  "name": "Mixed Execution Flow",
  "steps": [
    {
      "name": "navigate",
      "prefer": "snippet",
      "snippet": "await page.goto('https://example.com');"
    },
    {
      "name": "analyze",
      "prefer": "ai", 
      "ai_instruction": "Analyze the page layout"
    }
  ]
}
```

## Running the Tests

### Individual Test Files
```bash
npx playwright test tests/execution-paths-ai-first.spec.ts
npx playwright test tests/execution-paths-snippet-first.spec.ts  
npx playwright test tests/execution-paths-mixed.spec.ts
npx playwright test tests/execution-reporting.spec.ts
npx playwright test tests/sdk-decider-verification.spec.ts
```

### All Execution Path Tests
```bash
npx playwright test tests/execution-paths-*.spec.ts tests/execution-reporting.spec.ts tests/sdk-decider-verification.spec.ts
```

## Expected Test Results

### Success Criteria
- ✅ All AI-first tests pass with correct `aiUsageCount`
- ✅ All snippet-first tests pass with correct `snippetUsageCount`  
- ✅ Mixed execution follows specified preferences
- ✅ Fallback behavior works as expected
- ✅ Usage counters are accurate across all scenarios
- ✅ SDK Decider integration works correctly
- ✅ Execution reports contain all required fields

### Key Metrics Validated
1. **Path Selection**: Steps execute with their preferred path
2. **Fallback Handling**: Failed preferred paths fall back correctly
3. **Usage Counting**: Counters match actual execution paths
4. **Timing**: Duration tracking works and is reasonable
5. **Decision Logic**: SDK Decider chooses paths correctly

## Mock Strategy

The tests use mock executors to avoid actual browser automation and AI API calls:

- **MockMagnitudeExecutor**: Simulates AI execution with configurable success/failure
- **MockPlaywrightExecutor**: Simulates snippet execution with configurable results
- **Configurable Results**: Tests can set specific steps to succeed or fail
- **Timing Simulation**: Realistic delays for AI (100ms+) vs snippets (50ms+)

## Integration Testing

Beyond unit tests, the test suite validates:

1. **ExecutionOrchestrator Integration**: Full workflow execution
2. **Decider Integration**: Decision logic affects execution paths  
3. **Report Generation**: Accurate metrics collection
4. **Event System**: Proper event emission during execution
5. **Error Handling**: Graceful failure and recovery

## Test Coverage

The test suite covers:
- ✅ Happy path scenarios (all executions succeed)
- ✅ Failure scenarios (primary path fails, fallback succeeds)  
- ✅ No-fallback scenarios (execution stops on failure)
- ✅ Mixed success/failure patterns
- ✅ Variable substitution
- ✅ Complex workflows
- ✅ Edge cases and error conditions

This comprehensive test suite ensures the execution path logic works correctly and provides accurate reporting for AI vs snippet usage patterns.