// Fallback handler for magnitude executor
export class FallbackHandler {
  async handleFallback(error: any, context: any): Promise<any> {
    console.log('Handling fallback for error:', error.message);
    
    // Simple fallback logic
    return {
      success: false,
      fallbackAttempted: true,
      error: error.message,
      suggestion: 'Consider using enhanced recording with CDP for better results'
    };
  }
  
  async canRecover(error: any): Promise<boolean> {
    // Check if error is recoverable
    const recoverableErrors = [
      'Element not found',
      'Timeout',
      'Navigation failed'
    ];
    
    return recoverableErrors.some(e => error.message?.includes(e));
  }
}