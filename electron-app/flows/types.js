"use strict";
/**
 * Type definitions for Magnitude Flow Runner
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.CLAUDE_MODELS = void 0;
exports.isIntentSpec = isIntentSpec;
exports.isIntentStep = isIntentStep;
exports.isIntentParam = isIntentParam;
exports.isFlowResult = isFlowResult;
// Constants
exports.CLAUDE_MODELS = {
    ACT: 'claude-sonnet-4-20250514',
    QUERY: 'claude-opus-4-1-20250805'
};
exports.DEFAULT_CONFIG = {
    apiKey: '',
    models: {
        act: exports.CLAUDE_MODELS.ACT,
        query: exports.CLAUDE_MODELS.QUERY
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
function isIntentSpec(obj) {
    return (obj &&
        typeof obj.name === 'string' &&
        (typeof obj.url === 'string' || typeof obj.startUrl === 'string') &&
        Array.isArray(obj.steps));
}
function isIntentStep(obj) {
    return (obj &&
        typeof obj.action === 'string' &&
        (typeof obj.selector === 'string' || typeof obj.target === 'string'));
}
function isIntentParam(obj) {
    return (obj &&
        typeof obj.name === 'string' &&
        typeof obj.type === 'string');
}
function isFlowResult(obj) {
    return (obj &&
        typeof obj.success === 'boolean' &&
        Array.isArray(obj.logs));
}
// Export all types
exports.default = {
    CLAUDE_MODELS: exports.CLAUDE_MODELS,
    DEFAULT_CONFIG: exports.DEFAULT_CONFIG,
    isIntentSpec: isIntentSpec,
    isIntentStep: isIntentStep,
    isFlowResult: isFlowResult
};
