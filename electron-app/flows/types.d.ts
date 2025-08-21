/**
 * Type definitions for Magnitude Flow Runner
 */
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
    name: string;
    ai_instruction: string;
    snippet: string;
    prefer: 'ai' | 'snippet';
    fallback: 'ai' | 'snippet' | 'none';
    selector?: string;
    value?: string;
    action?: string;
    target?: string;
    description?: string;
    timeout?: number;
    retries?: number;
}
export interface IntentSpec {
    name: string;
    description: string;
    url: string;
    params: string[];
    steps: IntentStep[];
    preferences: {
        dynamic_elements: 'snippet' | 'ai';
        simple_steps: 'snippet' | 'ai';
        [key: string]: 'snippet' | 'ai';
    };
    success_screenshot?: string;
    recording_spec?: string;
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
export interface FlowResult {
    success: boolean;
    data?: any;
    error?: string;
    logs: string[];
    metrics?: FlowMetrics;
    screenshots?: string[];
}
export interface ExecutionResult {
    success: boolean;
    pathUsed: 'ai' | 'snippet';
    fallbackOccurred: boolean;
    error?: string;
    data?: any;
}
export interface ExecutionReport {
    results: Array<{
        step: string;
        pathUsed: 'ai' | 'snippet';
        fallbackOccurred: boolean;
        success: boolean;
        error?: string;
    }>;
    overallSuccess: boolean;
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
    act: any;
    query: any;
}
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
export type ActionType = 'click' | 'type' | 'select' | 'wait' | 'navigate' | 'scroll' | 'hover' | 'drag' | 'drop' | 'upload' | 'download' | 'screenshot' | 'extract' | 'custom';
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
export declare const CLAUDE_MODELS: {
    readonly ACT: "claude-sonnet-4-20250514";
    readonly QUERY: "claude-opus-4-1-20250805";
};
export declare const DEFAULT_CONFIG: FlowRunnerConfig;
export declare function isIntentSpec(obj: any): obj is IntentSpec;
export declare function isIntentStep(obj: any): obj is IntentStep;
export declare function isIntentParam(obj: any): obj is IntentParam;
export declare function isFlowResult(obj: any): obj is FlowResult;
export interface StepExecutionResult {
    stepIndex: number;
    name: string;
    pathUsed: 'ai' | 'snippet';
    fallbackOccurred: boolean;
    success: boolean;
    error?: string;
    duration: number;
    screenshot?: string;
    timestamp: Date;
}
export interface ExecutionReport {
    steps: StepExecutionResult[];
    aiUsageCount: number;
    snippetUsageCount: number;
    fallbackCount: number;
    screenshots: string[];
    overallSuccess: boolean;
    successStateMatch?: boolean;
    suggestions: string[];
    totalDuration: number;
    executionId: string;
}
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
declare const _default: {
    CLAUDE_MODELS: {
        readonly ACT: "claude-sonnet-4-20250514";
        readonly QUERY: "claude-opus-4-1-20250805";
    };
    DEFAULT_CONFIG: FlowRunnerConfig;
    isIntentSpec: typeof isIntentSpec;
    isIntentStep: typeof isIntentStep;
    isFlowResult: typeof isFlowResult;
};
export default _default;
//# sourceMappingURL=types.d.ts.map