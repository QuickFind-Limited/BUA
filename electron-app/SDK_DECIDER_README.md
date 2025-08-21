# SDK Decider Implementation

This directory contains the implementation of the SDK Decider logic exactly as specified in the architecture requirements.

## Overview

The SDK Decider system provides intelligent path selection between AI and snippet execution with automatic fallback handling.

## Core Components

### 1. Decider Class (`lib/decider.ts`)

The main decider class that implements the exact API specified:

```typescript
class Decider {
  async choosePath(options: {
    step: IntentStep;
    prefer: string;
    fallbackSnippet: string;
  }): Promise<'ai' | 'snippet'>

  async executeWithFallback(options: {
    step: IntentStep;
    context: any;
    variables: Record<string, string>;
  }): Promise<ExecutionResult>
}
```

### 2. ExecutionEngine Class (`main/execution-engine.ts`)

Orchestrates the execution of Intent Specs using the decider:

```typescript
class ExecutionEngine {
  async executeIntentSpec(
    spec: IntentSpec,
    variables: Record<string, string>
  ): Promise<ExecutionReport>
}
```

### 3. FallbackHandler Class (`main/fallback-handler.ts`)

Handles the actual execution with automatic fallback:

```typescript
class FallbackHandler {
  async executeWithFallback(
    step: IntentStep,
    variables: Record<string, string>
  ): Promise<{
    success: boolean;
    pathUsed: 'ai' | 'snippet';
    fallbackOccurred: boolean;
    error?: string;
  }>
}
```

## Key Features

### 1. Path Selection
- Uses Intent Spec preferences for each step
- Falls back to step-level preferences
- Returns 'ai' or 'snippet' path choice

### 2. Automatic Fallback
- Tries preferred path first
- Automatically switches to fallback if primary fails
- Tracks which path was actually used
- Reports if fallback occurred

### 3. Variable Substitution
- Replaces `{{VARIABLE}}` placeholders in both AI instructions and snippets
- Supports all common variable patterns

### 4. Error Handling
- Comprehensive error reporting
- Distinguishes between primary and fallback failures
- Provides detailed error context

## Intent Spec Format

The new Intent Spec format supports SDK Decider fields:

```json
{
  "name": "Example Intent",
  "url": "https://example.com",
  "preferences": {
    "step_name": "ai",
    "another_step": "snippet"
  },
  "steps": [
    {
      "name": "step_name",
      "action": "click",
      "selector": "#button",
      "prefer": "ai",
      "fallback": "snippet",
      "ai_instruction": "Click the submit button",
      "snippet": "await page.click('#button');"
    }
  ]
}
```

### Required Fields for SDK Decider:
- `name`: Step identifier
- `prefer`: Primary path ('ai' or 'snippet')
- `fallback`: Fallback path ('ai', 'snippet', or 'none')
- `ai_instruction`: Instructions for AI execution
- `snippet`: Code snippet for snippet execution

## Usage Example

```typescript
import { ExecutionEngine } from './main/execution-engine';

// Create executors
const aiExecutor = new MyAIExecutor();
const snippetExecutor = new MySnippetExecutor();

// Create execution engine
const engine = new ExecutionEngine(aiExecutor, snippetExecutor);

// Execute intent spec
const report = await engine.executeIntentSpec(intentSpec, variables);

// Check results
console.log('Overall Success:', report.overallSuccess);
report.results.forEach(result => {
  console.log(`${result.step}: ${result.pathUsed} (fallback: ${result.fallbackOccurred})`);
});
```

## Decision Logic

The decider follows this logic:

1. **Path Selection**: Check Intent Spec preferences, then step preferences
2. **Primary Execution**: Try the preferred path first
3. **Fallback Handling**: If primary fails and fallback is configured, try fallback path
4. **Result Tracking**: Report which path was used and if fallback occurred

## Files Created/Modified

### New Files:
- `main/execution-engine.ts` - Main execution orchestrator
- `main/fallback-handler.ts` - Fallback execution logic
- `intents/exampleWithDecider.json` - Example Intent Spec with SDK Decider fields
- `examples/sdk-decider-example.ts` - Usage demonstration

### Modified Files:
- `lib/decider.ts` - Added new Decider class with exact API
- `flows/types.ts` - Extended IntentStep and IntentSpec interfaces, added ExecutionResult/ExecutionReport types
- `lib/index.ts` - Added exports for new Decider class
- `main/index.ts` - Added exports for ExecutionEngine and FallbackHandler

## Testing

See `examples/sdk-decider-example.ts` for a complete working example that demonstrates:
- Path selection based on preferences
- Automatic fallback handling
- Variable substitution
- Execution reporting

The implementation provides the exact API specified in the architecture while maintaining backward compatibility with existing code.