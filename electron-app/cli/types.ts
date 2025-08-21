export interface IntentStep {
  name: string;
  ai_instruction: string;  // AI-based instruction
  snippet: string;          // Playwright code snippet
  prefer: 'ai' | 'snippet'; // Which to try first
  fallback: 'ai' | 'snippet' | 'none'; // Fallback option
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
  description: string;
  url: string;
  params: string[];
  steps: IntentStep[];
  preferences: {
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