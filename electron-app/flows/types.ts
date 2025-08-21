/**
 * Type definitions for Magnitude Flow Runner
 */

// Core Intent Types
export interface IntentParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'date';
  required?: boolean;
  description?: string;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

export interface IntentStep {
  // New fields (optional for backward compatibility)
  name?: string;
  ai_instruction?: string;  // AI-based instruction
  snippet?: string;          // Playwright code snippet
  prefer?: 'ai' | 'snippet'; // Which to try first
  fallback?: 'ai' | 'snippet' | 'none'; // Fallback option
  selector?: string;        // Optional selector for AI
  value?: string;           // Optional value with {{variables}}
  
  // Legacy fields for backward compatibility
  action?: string;
  target?: string;
  description?: string;
  timeout?: number;
  retries?: number;
}

export interface IntentSpec {
  name: string;
  description?: string;  // Made optional for backward compatibility
  url?: string;  // Made optional for backward compatibility
  params: string[];
  steps: IntentStep[];
  preferences?: {  // Made optional for backward compatibility
    dynamic_elements: 'snippet' | 'ai';
    simple_steps: 'snippet' | 'ai';
    [key: string]: 'snippet' | 'ai';
  };
  success_screenshot?: string; // Path to success state screenshot
  recording_spec?: string;     // Path to original recording.spec.ts
  
  // Legacy fields for backward compatibility
  startUrl?: string;
  successCheck?: string;
  failureCheck?: string;
  metadata?: {
    version?: string;
    author?: string;
    tags?: string[];
    category?: string;
  };
}

// Flow Result Types
export interface FlowResult {
  success: boolean;
  data?: any;
  error?: string;
  logs: string[];
  metrics?: FlowMetrics;
  screenshots?: string[];
}

// SDK Decider Result Types
export interface ExecutionResult {
  success: boolean;
  pathUsed: 'ai' | 'snippet';
  fallbackOccurred: boolean;
  error?: string;
  data?: any;
}

export interface StepExecutionResult {
  name: string;
  pathUsed: 'ai' | 'snippet';
  fallbackOccurred: boolean;
  success: boolean;
  error?: string;
  duration?: number;
  screenshot?: string;
}

export interface ExecutionReport {
  executionId?: string;
  steps?: StepExecutionResult[];
  aiUsageCount?: number;
  snippetUsageCount?: number;
  fallbackCount?: number;
  screenshots?: string[];
  overallSuccess?: boolean;
  suggestions?: string[];
  totalDuration?: number;
  successStateMatch?: boolean;
  comparisonSimilarity?: number;
  comparisonStatus?: 'success' | 'partial' | 'mismatch';
  
  // Legacy field for backward compatibility
  results?: Array<{
    step: string;
    pathUsed: 'ai' | 'snippet';
    fallbackOccurred: boolean;
    success: boolean;
    error?: string;
  }>;
}

export interface FlowMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;
  stepsExecuted: number;
  stepsTotal: number;
  retryCount: number;
  browserInteractions: number;
  llmCalls: {
    act: number;
    query: number;
  };
}

// LLM Provider Types
export interface LLMResponse {
  content: string;
  tokens?: {
    input: number;
    output: number;
  };
  model: string;
  timestamp: Date;
}

export interface LLMProviders {
  act: any; // Anthropic instance for actions
  query: any; // Anthropic instance for queries
}

// Configuration Types
export interface FlowRunnerConfig {
  apiKey: string;
  models: {
    act: string;
    query: string;
  };
  browser: {
    headless?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
    timeout?: number;
  };
  retry: {
    maxAttempts: number;
    strategy: 'linear' | 'exponential';
    baseDelay: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    saveScreenshots: boolean;
    savePageContent: boolean;
  };
}

// Error Types
export interface FlowError {
  code: string;
  message: string;
  category: 'browser' | 'selector' | 'network' | 'api' | 'validation' | 'unknown';
  severity: 'low' | 'medium' | 'high';
  retryable: boolean;
  step?: number;
  timestamp: Date;
  context?: any;
}

// Extraction Types
export interface ExtractionConfig {
  goal: string;
  format: 'json' | 'text' | 'structured';
  fields?: string[];
  validation?: {
    required?: string[];
    types?: Record<string, string>;
  };
}

export interface ExtractionResult {
  data: any;
  confidence: number;
  format: string;
  timestamp: Date;
  source: 'page_content' | 'visible_text' | 'structured_data';
}

// Action Types
export type ActionType = 
  | 'click'
  | 'type'
  | 'select'
  | 'wait'
  | 'navigate'
  | 'scroll'
  | 'hover'
  | 'drag'
  | 'drop'
  | 'upload'
  | 'download'
  | 'screenshot'
  | 'extract'
  | 'custom';

export interface ActionContext {
  pageTitle: string;
  pageUrl: string;
  viewport: {
    width: number;
    height: number;
  };
  timestamp: Date;
  stepNumber: number;
}

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IntentSpecValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details?: {
    name?: string[];
    url?: string[];
    params?: string[];
    steps?: Array<{
      index: number;
      errors: string[];
    }>;
  };
}

export interface ParameterValidation {
  valid: boolean;
  missing: string[];
  invalid: string[];
}

// Flow Pattern Types
export interface FlowPattern {
  name: string;
  description: string;
  template: Partial<IntentSpec>;
  requiredParams: string[];
  optionalParams?: string[];
  examples?: Array<{
    name: string;
    variables: Record<string, string>;
    description: string;
  }>;
}

// Monitoring and Analytics Types
export interface FlowAnalytics {
  totalRuns: number;
  successRate: number;
  averageDuration: number;
  commonErrors: Array<{
    error: string;
    count: number;
    lastOccurrence: Date;
  }>;
  stepPerformance: Array<{
    stepIndex: number;
    action: string;
    averageDuration: number;
    failureRate: number;
  }>;
}

// Browser Automation Types
export interface BrowserState {
  url: string;
  title: string;
  readyState: string;
  viewport: {
    width: number;
    height: number;
  };
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface ElementInfo {
  selector: string;
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
  enabled: boolean;
}

// Utility Types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
  step?: number;
}

export interface RetryStrategy {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
}

// Constants
export const CLAUDE_MODELS = {
  ACT: 'claude-sonnet-4-20250514',
  QUERY: 'claude-opus-4-1-20250805'
} as const;

export const DEFAULT_CONFIG: FlowRunnerConfig = {
  apiKey: '',
  models: {
    act: CLAUDE_MODELS.ACT,
    query: CLAUDE_MODELS.QUERY
  },
  browser: {
    headless: false,
    viewport: {
      width: 1920,
      height: 1080
    },
    timeout: 30000
  },
  retry: {
    maxAttempts: 3,
    strategy: 'exponential',
    baseDelay: 1000
  },
  logging: {
    level: 'info',
    saveScreenshots: true,
    savePageContent: false
  }
};

// Helper type guards
export function isIntentSpec(obj: any): obj is IntentSpec {
  return (
    obj &&
    typeof obj.name === 'string' &&
    (typeof obj.url === 'string' || typeof obj.startUrl === 'string') &&
    Array.isArray(obj.steps)
  );
}

export function isIntentStep(obj: any): obj is IntentStep {
  return (
    obj &&
    typeof obj.action === 'string' &&
    (typeof obj.selector === 'string' || typeof obj.target === 'string')
  );
}

export function isIntentParam(obj: any): obj is IntentParam {
  return (
    obj &&
    typeof obj.name === 'string' &&
    typeof obj.type === 'string'
  );
}

export function isFlowResult(obj: any): obj is FlowResult {
  return (
    obj &&
    typeof obj.success === 'boolean' &&
    Array.isArray(obj.logs)
  );
}

// Execution Orchestrator Types - Duplicate removed, merged with earlier definition

// Duplicate removed - using the one defined earlier

export interface ScreenshotComparison {
  match: boolean;
  similarity: number;
  suggestions: string[];
  differences?: any[];
}

export interface ExecutionOrchestratorOptions {
  enableFallback?: boolean;
  screenshotComparison?: boolean;
  saveScreenshots?: boolean;
  timeout?: number;
}

// Export all types
export default {
  CLAUDE_MODELS,
  DEFAULT_CONFIG,
  isIntentSpec,
  isIntentStep,
  isFlowResult
};