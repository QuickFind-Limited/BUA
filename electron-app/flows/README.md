# Magnitude Flow Runner

A sophisticated browser automation system that combines multiple Claude LLM models with Playwright for intelligent web interaction and data extraction.

## Overview

The Magnitude Flow Runner uses a hybrid approach with two specialized Claude models:
- **ACT Model** (`claude-sonnet-4-20250514`): Handles browser automation actions
- **QUERY Model** (`claude-opus-4-1-20250805`): Performs data extraction and analysis

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Intent Spec   │───▶│  Flow Runner     │───▶│   Flow Result   │
│                 │    │                  │    │                 │
│ • Steps         │    │ ┌──────────────┐ │    │ • Success/Fail  │
│ • Parameters    │    │ │ ACT Model    │ │    │ • Extracted Data│
│ • Success Check │    │ │ (Automation) │ │    │ • Logs          │
└─────────────────┘    │ └──────────────┘ │    │ • Screenshots   │
                       │ ┌──────────────┐ │    └─────────────────┘
                       │ │ QUERY Model  │ │
                       │ │ (Extraction) │ │
                       │ └──────────────┘ │
                       │ ┌──────────────┐ │
                       │ │  Playwright  │ │
                       │ │   Browser    │ │
                       │ └──────────────┘ │
                       └──────────────────┘
```

## Features

### Core Capabilities
- **Intelligent Automation**: LLM-guided browser actions
- **Data Extraction**: Structured data retrieval using AI
- **Variable Substitution**: Dynamic parameter replacement
- **Error Handling**: Comprehensive error categorization and recovery
- **Retry Logic**: Configurable retry strategies
- **Pattern Library**: Pre-built flow patterns for common tasks

### Supported Actions
- Click, type, select, scroll, hover
- Navigation and waiting
- File upload/download
- Screenshot capture
- Custom LLM-generated actions

### Data Extraction Types
- E-commerce products
- Profile information
- Financial data
- News articles
- Real estate listings
- Tabular data

## Quick Start

### 1. Environment Setup

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY="your-api-key-here"

# Install dependencies (if not already installed)
npm install @anthropic-ai/sdk @playwright/test
```

### 2. Basic Usage

```typescript
import { MagnitudeFlowRunner } from './flows';

const runner = new MagnitudeFlowRunner(process.env.ANTHROPIC_API_KEY!);

// Run a simple intent
const result = await runner.runIntentFlow('./intents/exampleNoVars.json');

console.log('Success:', result.success);
console.log('Logs:', result.logs);
```

### 3. With Variables and Data Extraction

```typescript
const result = await runner.runIntentFlow(
  './intents/exampleWithVars.json',
  {
    USERNAME: 'user@example.com',
    PASSWORD: 'secretpassword'
  },
  'Extract user dashboard information including name, email, and recent activity'
);

console.log('Extracted Data:', result.data);
```

## Intent Specification Format

```json
{
  "name": "Login Flow with Variables",
  "startUrl": "https://example.com/login",
  "params": ["USERNAME", "PASSWORD"],
  "steps": [
    {
      "action": "click",
      "target": "#username-field",
      "value": ""
    },
    {
      "action": "type",
      "target": "#username-field",
      "value": "{{USERNAME}}"
    },
    {
      "action": "type",
      "target": "#password-field", 
      "value": "{{PASSWORD}}"
    },
    {
      "action": "click",
      "target": "#login-button",
      "value": ""
    }
  ],
  "successCheck": ".dashboard-welcome"
}
```

## Flow Patterns

Use pre-built patterns for common scenarios:

```typescript
import { FlowPatterns } from './flows';

// Login flow
const loginIntent = FlowPatterns.createLoginFlow(
  'https://app.example.com/login',
  '#email',
  '#password', 
  '.login-btn',
  '.dashboard'
);

// Form filling
const formIntent = FlowPatterns.createFormFlow(
  'https://example.com/contact',
  [
    { selector: '#name', param: 'FULL_NAME' },
    { selector: '#email', param: 'EMAIL' },
    { selector: '#message', param: 'MESSAGE' }
  ],
  '#submit',
  '.success-message'
);

// Search flow
const searchIntent = FlowPatterns.createSearchFlow(
  'https://example.com',
  '#search-input',
  '.search-btn',
  '.search-results'
);
```

## Extraction Patterns

Built-in extraction patterns for common data types:

```typescript
import { ExtractionPatterns } from './flows';

// E-commerce products
const productData = await runner.runIntentFlow(
  intentPath,
  variables,
  ExtractionPatterns.productExtraction()
);

// Profile information  
const profileData = await runner.runIntentFlow(
  intentPath,
  variables,
  ExtractionPatterns.profileExtraction()
);

// Financial data
const stockData = await runner.runIntentFlow(
  intentPath,
  variables,
  ExtractionPatterns.financialExtraction()
);
```

## Error Handling

The system provides intelligent error categorization:

```typescript
import { ErrorHandler } from './flows';

try {
  const result = await runner.runIntentFlow(intentPath);
} catch (error) {
  const errorInfo = ErrorHandler.categorizeError(error);
  console.log('Error category:', errorInfo.category);
  console.log('Retryable:', errorInfo.retryable);
  console.log('Suggestions:', ErrorHandler.generateRecoveryPlan(error, intent));
}
```

## Configuration

Customize the flow runner behavior:

```typescript
import { DEFAULT_CONFIG } from './flows';

const customConfig = {
  ...DEFAULT_CONFIG,
  browser: {
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  retry: {
    maxAttempts: 5,
    strategy: 'exponential' as const,
    baseDelay: 2000
  },
  logging: {
    level: 'debug' as const,
    saveScreenshots: true,
    savePageContent: true
  }
};
```

## Examples

Run the included examples to see the system in action:

```typescript
import { runAllExamples, ecommerceExample } from './flows';

// Run all examples
const results = await runAllExamples();

// Run specific example
const ecommerceResult = await ecommerceExample();
```

### Available Examples
1. **E-commerce**: Product search and price extraction
2. **Social Media**: Profile data collection
3. **News**: Article aggregation from news sites
4. **Form Automation**: Contact form filling
5. **Real Estate**: Property listing collection
6. **Financial**: Stock price monitoring

## Advanced Usage

### Custom Actions with LLM Generation

```typescript
// The ACT model can generate custom automation code
const customStep = {
  action: 'custom',
  target: '.complex-widget',
  value: 'Extract data from this interactive chart'
};
```

### Retry with Different Strategies

```typescript
import { RetryStrategies } from './flows';

// Exponential backoff
const result = await RetryStrategies.exponentialBackoff(
  () => runner.runIntentFlow(intentPath),
  5, // max attempts
  1000 // base delay
);
```

### Validation

```typescript
import { IntentValidator } from './flows';

const validation = IntentValidator.validateIntentSpec(intent);
if (!validation.valid) {
  console.error('Intent validation errors:', validation.errors);
}

const paramValidation = IntentValidator.validateParameters(intent, variables);
if (!paramValidation.valid) {
  console.error('Missing parameters:', paramValidation.missing);
}
```

## Performance Considerations

- **Model Selection**: ACT model optimized for speed, QUERY model for accuracy
- **Concurrent Execution**: Run multiple flows in parallel when possible
- **Caching**: Browser sessions can be reused for related flows
- **Timeouts**: Configure appropriate timeouts for different sites

## Security Notes

- Never log sensitive parameters (passwords, API keys)
- Use secure credential management
- Be aware of CAPTCHA and bot detection
- Respect robots.txt and rate limiting

## Troubleshooting

### Common Issues

1. **Selector Not Found**
   - Use browser dev tools to verify selectors
   - Add wait conditions before interactions
   - Check if page structure changed

2. **API Rate Limits**
   - Monitor Claude API usage
   - Implement backoff strategies
   - Consider caching LLM responses

3. **Browser Issues**
   - Ensure Chrome/Chromium is installed
   - Check for conflicting browser processes
   - Try headless mode for server environments

4. **Network Timeouts**
   - Increase timeout values
   - Check network connectivity
   - Consider proxy settings

### Debug Mode

Enable debug logging for detailed execution information:

```typescript
const result = await runner.runIntentFlow(
  intentPath,
  variables,
  extractionGoal,
  { logging: { level: 'debug' } }
);
```

## Contributing

When adding new features:
1. Update type definitions in `types.ts`
2. Add utility functions to `flowUtils.ts`
3. Create examples in `examples.ts`
4. Update this documentation

## License

This implementation is part of the CUA (Claude Universal Assistant) project.