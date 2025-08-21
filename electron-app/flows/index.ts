/**
 * Magnitude Flow Runner - Main Export Module
 * 
 * This module provides a complete solution for browser automation using
 * multiple LLM providers (Claude models) integrated with Playwright.
 */

// Core Flow Runner
export { MagnitudeFlowRunner, exampleUsage } from './exampleFlow';

// Utility Functions and Patterns
export { 
  FlowPatterns, 
  IntentValidator, 
  RetryStrategies, 
  ExtractionPatterns,
  ErrorHandler 
} from './flowUtils';

// Type Definitions
export {
  IntentStep,
  IntentSpec,
  FlowResult,
  LLMProviders,
  FlowRunnerConfig,
  FlowError,
  ExtractionConfig,
  ExtractionResult,
  ActionType,
  ActionContext,
  ValidationResult,
  ParameterValidation,
  FlowPattern,
  FlowAnalytics,
  BrowserState,
  ElementInfo,
  LogLevel,
  LogEntry,
  RetryStrategy,
  CLAUDE_MODELS,
  DEFAULT_CONFIG,
  isIntentSpec,
  isIntentStep,
  isFlowResult
} from './types';

// Practical Examples
export {
  ecommerceExample,
  socialMediaExample,
  newsCollectionExample,
  formAutomationExample,
  realEstateExample,
  financialDataExample,
  runAllExamples
} from './examples';

// Re-export default for convenience
export { default as FlowUtils } from './flowUtils';
export { default as Examples } from './examples';
export { default as Types } from './types';

/**
 * Quick Start Guide:
 * 
 * 1. Set up environment:
 *    ```bash
 *    export ANTHROPIC_API_KEY="your-key-here"
 *    ```
 * 
 * 2. Basic usage:
 *    ```typescript
 *    import { MagnitudeFlowRunner } from './flows';
 *    
 *    const runner = new MagnitudeFlowRunner(process.env.ANTHROPIC_API_KEY!);
 *    const result = await runner.runIntentFlow(
 *      './intents/exampleNoVars.json'
 *    );
 *    ```
 * 
 * 3. With variables and data extraction:
 *    ```typescript
 *    const result = await runner.runIntentFlow(
 *      './intents/exampleWithVars.json',
 *      { USERNAME: 'user', PASSWORD: 'pass' },
 *      'Extract user profile information'
 *    );
 *    ```
 * 
 * 4. Using patterns for common flows:
 *    ```typescript
 *    import { FlowPatterns } from './flows';
 *    
 *    const loginFlow = FlowPatterns.createLoginFlow(
 *      'https://example.com/login',
 *      '#username',
 *      '#password',
 *      '#submit',
 *      '.dashboard'
 *    );
 *    ```
 * 
 * 5. Running examples:
 *    ```typescript
 *    import { runAllExamples } from './flows';
 *    
 *    const results = await runAllExamples();
 *    ```
 */