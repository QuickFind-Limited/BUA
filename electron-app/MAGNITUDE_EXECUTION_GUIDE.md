# Magnitude Execution System Guide

This guide explains how to use the newly implemented Magnitude execution system with hybrid model approach.

## Overview

The Magnitude execution system automates browser workflows using a hybrid approach:
- **Sonnet 4**: Used for 'act' operations (reasoning about what actions to take)
- **Opus 4.1**: Used for 'query' operations (extracting data from pages)
- **Playwright**: Handles actual browser automation

## Key Components

### 1. MagnitudeExecutor (`main/magnitude-executor.ts`)
Main orchestration class that:
- Executes Intent Specs step by step
- Manages variable substitution
- Coordinates LLM calls and browser actions
- Handles progress reporting and error recovery
- Saves execution results and history

### 2. PlaywrightExecutor (`main/playwright-executor.ts`)
Browser automation engine that:
- Initializes and manages browser instances
- Executes actions (click, type, navigate, wait, etc.)
- Takes screenshots and captures page content
- Handles dynamic waits and element detection

### 3. FlowStorage (`main/flow-storage.ts`)
Persistence layer that:
- Saves executed flows for reuse
- Stores execution history and metrics
- Provides search and filtering capabilities
- Handles import/export of flows

### 4. Enhanced LLM Integration (`main/llm.ts`)
Updated with two new functions:
- `executeMagnitudeAct(context, action)`: Uses Sonnet 4 for action reasoning
- `executeMagnitudeQuery(html, query)`: Uses Opus 4.1 for data extraction

## Usage Examples

### Basic Flow Execution

```typescript
import { MagnitudeExecutor } from './main/magnitude-executor';
import { IntentSpec } from './flows/types';

// Define your flow
const loginFlow: IntentSpec = {
  name: "Login Example",
  startUrl: "https://example.com/login",
  params: ["username", "password"],
  steps: [
    {
      action: "type",
      target: "#username",
      value: "{{username}}",
      description: "Enter username"
    },
    {
      action: "type",
      target: "#password", 
      value: "{{password}}",
      description: "Enter password"
    },
    {
      action: "click",
      target: "#login-button",
      value: "",
      description: "Click login"
    }
  ],
  successCheck: "Dashboard loaded"
};

// Execute the flow
const executor = new MagnitudeExecutor({
  headless: false,
  saveScreenshots: true,
  saveFlow: true
});

const result = await executor.executeFlow(loginFlow, {
  username: "demo@example.com",
  password: "password123"
});

console.log('Flow result:', result);
```

### Flow with Data Extraction

```typescript
const searchFlow: IntentSpec = {
  name: "Product Search",
  startUrl: "https://example-store.com",
  steps: [
    {
      action: "type",
      target: "#search",
      value: "{{searchTerm}}",
      description: "Enter search term"
    },
    {
      action: "click",
      target: "#search-button",
      value: "",
      description: "Execute search"
    },
    {
      action: "wait",
      target: ".search-results",
      value: "5000",
      description: "Wait for results",
      // Data extraction using Opus 4.1
      extract: "Extract product names, prices, and ratings from search results"
    } as any
  ],
  successCheck: "Search results displayed"
};

const result = await executor.executeFlow(searchFlow, {
  searchTerm: "wireless headphones"
});

// Access extracted data
console.log('Extracted products:', result.data);
```

### Progress Monitoring

```typescript
const executor = new MagnitudeExecutor();

// Listen for progress events
executor.on('progress', (progress) => {
  console.log(`Step ${progress.stepIndex + 1}/${progress.totalSteps}`);
  console.log(`Status: ${progress.status}`);
  
  if (progress.extractedData) {
    console.log('Data extracted:', progress.extractedData);
  }
  
  if (progress.screenshot) {
    console.log('Screenshot saved:', progress.screenshot);
  }
});

await executor.executeFlow(myFlow, variables);
```

### Flow Management

```typescript
import { FlowStorage } from './main/flow-storage';

const storage = new FlowStorage();

// List saved flows
const savedFlows = await storage.listFlows();

// Filter flows by tags
const taggedFlows = await storage.listFlows({
  tags: ["e-commerce", "automation"]
});

// Get flow statistics
const stats = await storage.getFlowStats(flowId);
console.log(`Success rate: ${stats.successRate}%`);
console.log(`Average duration: ${stats.averageDuration}ms`);

// Export flow for sharing
const exportData = await storage.exportFlow(flowId);

// Import flow
const importedFlowId = await storage.importFlow(exportData);
```

## Configuration Options

### MagnitudeExecutor Options

```typescript
const executor = new MagnitudeExecutor({
  headless: false,           // Run browser in headed mode
  timeout: 30000,           // Default timeout in milliseconds
  retries: 2,               // Number of retries for failed steps
  saveScreenshots: true,    // Save screenshots at each step
  saveFlow: true           // Save flow execution to storage
});
```

### PlaywrightExecutor Options

```typescript
const playwrightConfig = {
  browser: 'chromium',      // 'chromium', 'firefox', 'webkit'
  headless: false,
  viewport: {
    width: 1920,
    height: 1080
  },
  timeout: 30000,
  saveScreenshots: true,
  screenshotPath: './screenshots'
};
```

## Supported Actions

The system supports the following browser actions:

- **click**: Click on an element
- **type**: Type text into an input field
- **select**: Select option from dropdown
- **wait**: Wait for element or timeout
- **navigate**: Navigate to URL
- **scroll**: Scroll page or to element
- **hover**: Hover over element
- **drag**: Drag and drop operation
- **upload**: Upload file to input
- **screenshot**: Take manual screenshot

## Variable Substitution

Use `{{variableName}}` syntax in:
- Start URLs
- Step targets (selectors)
- Step values
- Success/failure conditions

Variables are replaced at runtime with provided values.

## Error Handling

The system provides robust error handling:

```typescript
try {
  const result = await executor.executeFlow(flow, variables, {
    retries: 3  // Retry failed steps
  });
  
  if (!result.success) {
    console.log('Flow failed:', result.error);
    console.log('Logs:', result.logs);
  }
} catch (error) {
  console.log('Execution error:', error);
  
  // Access execution logs for debugging
  const logs = executor.getLogs();
  const metrics = executor.getMetrics();
}
```

## File Structure

```
main/
├── magnitude-executor.ts     # Main execution orchestrator
├── playwright-executor.ts    # Browser automation
├── flow-storage.ts          # Flow persistence
├── llm.ts                   # Enhanced LLM integration
└── magnitude-example.ts     # Usage examples

flows/
├── saved/                   # Saved flow storage
│   ├── flows/              # Individual flow files
│   └── history/            # Daily execution history
└── types.ts                # Type definitions

tests/
└── magnitude-execution.spec.ts  # Comprehensive test suite
```

## Model Usage (Hybrid Approach)

### Sonnet 4 (Action Reasoning)
- **When**: For every step execution (`executeMagnitudeAct`)
- **Purpose**: Reason about how to execute browser actions effectively
- **Input**: Page context + action details
- **Output**: Guidance for action execution

### Opus 4.1 (Data Extraction)
- **When**: When `extract` property is present in step
- **Purpose**: Extract structured data from page content
- **Input**: Page HTML + extraction query
- **Output**: Structured extracted data

This ensures optimal model usage: Sonnet 4 for fast action reasoning, Opus 4.1 for complex data extraction.

## Testing

Run the test suite:

```bash
npm test
```

The test suite includes:
- Unit tests for each component
- Integration tests with real browser automation
- Flow storage and management tests
- Error handling scenarios

## Best Practices

1. **Use descriptive step descriptions** for better LLM reasoning
2. **Add timeouts** for steps that might take longer
3. **Use specific selectors** when possible
4. **Test flows** with different variable values
5. **Monitor execution logs** for debugging
6. **Save important flows** for reuse
7. **Use tags** to organize flows by category
8. **Clean up history** periodically to manage storage

## Troubleshooting

### Common Issues

1. **Element not found**: Use more specific selectors or add wait steps
2. **Timeout errors**: Increase timeout values or add explicit waits
3. **Variable substitution**: Ensure variable names match exactly
4. **API errors**: Check ANTHROPIC_API_KEY environment variable
5. **Browser crashes**: Reduce concurrency or increase memory limits

### Debug Mode

Enable detailed logging:

```typescript
const executor = new MagnitudeExecutor({
  // ... other options
});

// Access detailed logs
const logs = executor.getLogs();
logs.forEach(log => {
  console.log(`[${log.level}] ${log.message}`, log.context);
});
```

This comprehensive system provides a powerful foundation for automating complex browser workflows with intelligent reasoning and data extraction capabilities.