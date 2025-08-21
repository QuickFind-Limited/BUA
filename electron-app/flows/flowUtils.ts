// Import types
interface IntentStep {
  action: string;
  target: string;
  value: string;
}

/**
 * Utility functions for Magnitude Flow Runner
 */

// Common flow patterns and builders
export class FlowPatterns {
  /**
   * Create a login flow pattern
   */
  static createLoginFlow(
    loginUrl: string,
    usernameSelector: string,
    passwordSelector: string,
    submitSelector: string,
    successSelector: string
  ) {
    return {
      name: 'Generated Login Flow',
      startUrl: loginUrl,
      params: ['USERNAME', 'PASSWORD'],
      steps: [
        {
          action: 'click',
          target: usernameSelector,
          value: ''
        },
        {
          action: 'type',
          target: usernameSelector,
          value: '{{USERNAME}}'
        },
        {
          action: 'click',
          target: passwordSelector,
          value: ''
        },
        {
          action: 'type',
          target: passwordSelector,
          value: '{{PASSWORD}}'
        },
        {
          action: 'click',
          target: submitSelector,
          value: ''
        },
        {
          action: 'wait',
          target: '2000',
          value: ''
        }
      ],
      successCheck: successSelector
    };
  }

  /**
   * Create a form filling flow pattern
   */
  static createFormFlow(
    formUrl: string,
    fields: Array<{ selector: string; param: string }>,
    submitSelector: string,
    successSelector: string
  ) {
    const steps: IntentStep[] = [];
    const params: string[] = [];

    fields.forEach(field => {
      steps.push({
        action: 'click',
        target: field.selector,
        value: ''
      });
      steps.push({
        action: 'type',
        target: field.selector,
        value: `{{${field.param}}}`
      });
      params.push(field.param);
    });

    steps.push({
      action: 'click',
      target: submitSelector,
      value: ''
    });

    return {
      name: 'Generated Form Flow',
      startUrl: formUrl,
      params,
      steps,
      successCheck: successSelector
    };
  }

  /**
   * Create a search and extract flow pattern
   */
  static createSearchFlow(
    searchUrl: string,
    searchInputSelector: string,
    searchButtonSelector: string,
    resultsSelector: string
  ) {
    return {
      name: 'Generated Search Flow',
      startUrl: searchUrl,
      params: ['SEARCH_TERM'],
      steps: [
        {
          action: 'click',
          target: searchInputSelector,
          value: ''
        },
        {
          action: 'type',
          target: searchInputSelector,
          value: '{{SEARCH_TERM}}'
        },
        {
          action: 'click',
          target: searchButtonSelector,
          value: ''
        },
        {
          action: 'wait',
          target: '3000',
          value: ''
        }
      ],
      successCheck: resultsSelector
    };
  }
}

/**
 * Validation utilities for Intent Specs
 */
export class IntentValidator {
  /**
   * Validate Intent Specification structure
   */
  static validateIntentSpec(intent: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!intent.name || typeof intent.name !== 'string') {
      errors.push('Intent must have a valid name');
    }

    if (!intent.startUrl || typeof intent.startUrl !== 'string') {
      errors.push('Intent must have a valid startUrl');
    }

    if (!intent.steps || !Array.isArray(intent.steps)) {
      errors.push('Intent must have a steps array');
    } else {
      intent.steps.forEach((step: any, index: number) => {
        if (!step.action || typeof step.action !== 'string') {
          errors.push(`Step ${index + 1}: missing or invalid action`);
        }
        if (!step.target || typeof step.target !== 'string') {
          errors.push(`Step ${index + 1}: missing or invalid target`);
        }
        if (step.value === undefined || typeof step.value !== 'string') {
          errors.push(`Step ${index + 1}: missing or invalid value`);
        }
      });
    }

    if (!intent.successCheck || typeof intent.successCheck !== 'string') {
      errors.push('Intent must have a valid successCheck');
    }

    if (intent.params && !Array.isArray(intent.params)) {
      errors.push('Intent params must be an array if provided');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if all required parameters are provided
   */
  static validateParameters(
    intent: any,
    variables: Record<string, string>
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (intent.params && Array.isArray(intent.params)) {
      intent.params.forEach((param: string) => {
        if (!variables[param]) {
          missing.push(param);
        }
      });
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}

/**
 * Retry strategies for flow execution
 */
export class RetryStrategies {
  /**
   * Linear backoff retry strategy
   */
  static async linearBackoff(
    fn: () => Promise<any>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<any> {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }

  /**
   * Exponential backoff retry strategy
   */
  static async exponentialBackoff(
    fn: () => Promise<any>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<any> {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

/**
 * Common extraction patterns for different types of data
 */
export class ExtractionPatterns {
  /**
   * E-commerce product extraction pattern
   */
  static productExtraction(): string {
    return `
Extract product information from the page including:
- Product names
- Prices (with currency)
- Ratings or review scores
- Availability status
- Product images URLs
- Descriptions or key features

Return the data as a JSON array of products.
    `.trim();
  }

  /**
   * Contact/profile information extraction pattern
   */
  static profileExtraction(): string {
    return `
Extract profile or contact information including:
- Name
- Email address
- Phone number
- Address
- Company/organization
- Job title or role
- Social media links

Return the data as a JSON object with the extracted fields.
    `.trim();
  }

  /**
   * Table data extraction pattern
   */
  static tableExtraction(): string {
    return `
Extract tabular data from the page including:
- Column headers
- Row data
- Summary statistics if present
- Pagination information

Return the data as a JSON object with headers and rows arrays.
    `.trim();
  }

  /**
   * News/article extraction pattern
   */
  static articleExtraction(): string {
    return `
Extract article information including:
- Title/headline
- Author
- Publication date
- Article content/summary
- Tags or categories
- Related articles

Return the data as a JSON object with the extracted fields.
    `.trim();
  }

  /**
   * Financial data extraction pattern
   */
  static financialExtraction(): string {
    return `
Extract financial information including:
- Stock prices
- Market data
- Financial ratios
- Charts or trends data
- Company information
- Trading volumes

Return the data as a JSON object with numerical values properly formatted.
    `.trim();
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
  /**
   * Categorize and handle different types of flow errors
   */
  static categorizeError(error: any): {
    category: string;
    severity: 'low' | 'medium' | 'high';
    retryable: boolean;
    suggestion: string;
  } {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';

    // Browser/Playwright errors
    if (errorMessage.includes('Target closed') || errorMessage.includes('Browser')) {
      return {
        category: 'browser',
        severity: 'high',
        retryable: true,
        suggestion: 'Restart browser and retry the flow'
      };
    }

    // Selector/element errors
    if (errorMessage.includes('selector') || errorMessage.includes('element')) {
      return {
        category: 'selector',
        severity: 'medium',
        retryable: true,
        suggestion: 'Check selectors and wait for elements to load'
      };
    }

    // Network/timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return {
        category: 'network',
        severity: 'medium',
        retryable: true,
        suggestion: 'Increase timeout values and check network connection'
      };
    }

    // API/LLM errors
    if (errorMessage.includes('API') || errorMessage.includes('anthropic')) {
      return {
        category: 'api',
        severity: 'high',
        retryable: true,
        suggestion: 'Check API key and rate limits'
      };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('parameter')) {
      return {
        category: 'validation',
        severity: 'high',
        retryable: false,
        suggestion: 'Fix intent specification or provided parameters'
      };
    }

    // Default case
    return {
      category: 'unknown',
      severity: 'medium',
      retryable: true,
      suggestion: 'Review error details and retry with modified parameters'
    };
  }

  /**
   * Generate error recovery suggestions
   */
  static generateRecoveryPlan(error: any, intent: any): string[] {
    const { category, suggestion } = this.categorizeError(error);
    const suggestions = [suggestion];

    switch (category) {
      case 'browser':
        suggestions.push('Ensure Chrome/Chromium is properly installed');
        suggestions.push('Check if other browser processes are interfering');
        break;

      case 'selector':
        suggestions.push('Verify selectors using browser developer tools');
        suggestions.push('Add wait conditions before interacting with elements');
        suggestions.push('Check if the page structure has changed');
        break;

      case 'network':
        suggestions.push('Verify the target website is accessible');
        suggestions.push('Check for CAPTCHA or bot detection');
        suggestions.push('Consider adding longer delays between actions');
        break;

      case 'api':
        suggestions.push('Verify ANTHROPIC_API_KEY is set correctly');
        suggestions.push('Check API usage limits and billing status');
        suggestions.push('Ensure models are available in your region');
        break;

      case 'validation':
        suggestions.push('Review intent specification format');
        suggestions.push('Ensure all required parameters are provided');
        suggestions.push('Validate JSON syntax in intent files');
        break;
    }

    return suggestions;
  }
}

export default {
  FlowPatterns,
  IntentValidator,
  RetryStrategies,
  ExtractionPatterns,
  ErrorHandler
};