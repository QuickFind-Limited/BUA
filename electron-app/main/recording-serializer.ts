/**
 * Recording Serializer - Converts Playwright actions to human-readable format for Claude analysis
 */

interface PlaywrightAction {
  type: string;
  url?: string;
  timestamp?: number;
  target?: {
    selector?: string;
    text?: string;
    placeholder?: string;
    tagName?: string;
    attributes?: Record<string, string>;
  };
  value?: string;
  htmlContext?: string;
  frameUrl?: string;
  navigationUrl?: string;
}

interface SerializedStep {
  stepNumber: number;
  timestamp: string;
  description: string;
  technical: {
    action: string;
    selector?: string;
    value?: string;
    url?: string;
  };
  context?: {
    elementText?: string;
    placeholder?: string;
    htmlSnippet?: string;
    pageTitle?: string;
  };
}

/**
 * Serializes a Playwright recording into a human-readable format for Claude analysis
 * @param recording Array of Playwright actions
 * @returns Formatted string describing the user actions
 */
export function serializeRecording(recording: any[]): string {
  if (!recording || recording.length === 0) {
    return "No recording data provided.";
  }

  const steps: SerializedStep[] = [];
  let currentUrl = '';
  let stepCounter = 1;

  // Process each action in the recording
  for (const action of recording) {
    const step = processAction(action, stepCounter, currentUrl);
    if (step) {
      steps.push(step);
      stepCounter++;
      
      // Update current URL if navigation occurred
      if (action.type === 'navigate' || action.navigationUrl) {
        currentUrl = action.navigationUrl || action.url || currentUrl;
      }
    }
  }

  return formatSerializedSteps(steps, currentUrl);
}

/**
 * Processes a single Playwright action into a serialized step
 */
function processAction(action: PlaywrightAction, stepNumber: number, currentUrl: string): SerializedStep | null {
  const timestamp = action.timestamp ? new Date(action.timestamp).toISOString() : new Date().toISOString();
  
  switch (action.type) {
    case 'navigate':
      return {
        stepNumber,
        timestamp,
        description: `User navigated to ${action.url}`,
        technical: {
          action: 'navigate',
          url: action.url
        },
        context: {
          pageTitle: extractPageTitle(action)
        }
      };

    case 'click':
      return {
        stepNumber,
        timestamp,
        description: createClickDescription(action),
        technical: {
          action: 'click',
          selector: action.target?.selector,
          url: currentUrl
        },
        context: {
          elementText: action.target?.text,
          htmlSnippet: action.htmlContext
        }
      };

    case 'type':
    case 'fill':
      return {
        stepNumber,
        timestamp,
        description: createTypeDescription(action),
        technical: {
          action: 'type',
          selector: action.target?.selector,
          value: action.value,
          url: currentUrl
        },
        context: {
          placeholder: action.target?.placeholder,
          htmlSnippet: action.htmlContext
        }
      };

    case 'keydown':
    case 'keyup':
      if (action.value === 'Enter' || action.value === 'Tab') {
        return {
          stepNumber,
          timestamp,
          description: `User pressed ${action.value} key`,
          technical: {
            action: 'key',
            value: action.value,
            url: currentUrl
          }
        };
      }
      return null; // Skip other key events

    case 'wait':
      return {
        stepNumber,
        timestamp,
        description: `System waited ${action.value}ms`,
        technical: {
          action: 'wait',
          value: action.value,
          url: currentUrl
        }
      };

    case 'select':
      return {
        stepNumber,
        timestamp,
        description: `User selected "${action.value}" from dropdown`,
        technical: {
          action: 'select',
          selector: action.target?.selector,
          value: action.value,
          url: currentUrl
        },
        context: {
          htmlSnippet: action.htmlContext
        }
      };

    case 'check':
    case 'uncheck':
      return {
        stepNumber,
        timestamp,
        description: `User ${action.type}ed checkbox`,
        technical: {
          action: action.type,
          selector: action.target?.selector,
          url: currentUrl
        },
        context: {
          elementText: action.target?.text,
          htmlSnippet: action.htmlContext
        }
      };

    default:
      // Handle unknown action types
      return {
        stepNumber,
        timestamp,
        description: `User performed ${action.type} action`,
        technical: {
          action: action.type,
          selector: action.target?.selector,
          value: action.value,
          url: currentUrl
        }
      };
  }
}

/**
 * Creates a human-readable description for click actions
 */
function createClickDescription(action: PlaywrightAction): string {
  const target = action.target;
  
  if (target?.text) {
    // Determine element type from text or attributes
    if (target.text.toLowerCase().includes('button') || target.tagName === 'button') {
      return `User clicked on button "${target.text}"`;
    } else if (target.text.toLowerCase().includes('link') || target.tagName === 'a') {
      return `User clicked on link "${target.text}"`;
    } else {
      return `User clicked on "${target.text}"`;
    }
  }
  
  if (target?.placeholder) {
    return `User clicked on input field with placeholder "${target.placeholder}"`;
  }
  
  if (target?.selector) {
    // Try to infer element type from selector
    if (target.selector.includes('button') || target.selector.includes('btn')) {
      return `User clicked on button (${target.selector})`;
    } else if (target.selector.includes('input') || target.selector.includes('field')) {
      return `User clicked on input field (${target.selector})`;
    } else if (target.selector.includes('link') || target.selector.includes('href')) {
      return `User clicked on link (${target.selector})`;
    }
  }
  
  return `User clicked on element${target?.selector ? ` (${target.selector})` : ''}`;
}

/**
 * Creates a human-readable description for type/fill actions
 */
function createTypeDescription(action: PlaywrightAction): string {
  const target = action.target;
  const value = action.value || '';
  
  // Mask potential passwords
  const displayValue = isPasswordField(target) ? '********' : value;
  
  if (target?.placeholder) {
    return `User typed "${displayValue}" in field with placeholder "${target.placeholder}"`;
  }
  
  if (target?.selector) {
    if (target.selector.includes('password')) {
      return `User typed "********" in password field`;
    } else if (target.selector.includes('email')) {
      return `User typed "${displayValue}" in email field`;
    } else if (target.selector.includes('search')) {
      return `User typed "${displayValue}" in search field`;
    }
  }
  
  return `User typed "${displayValue}"${target?.selector ? ` in field (${target.selector})` : ''}`;
}

/**
 * Determines if a field is likely a password field
 */
function isPasswordField(target: any): boolean {
  if (!target) return false;
  
  const selector = target.selector?.toLowerCase() || '';
  const placeholder = target.placeholder?.toLowerCase() || '';
  const attributes = target.attributes || {};
  
  return selector.includes('password') || 
         placeholder.includes('password') || 
         attributes.type === 'password';
}

/**
 * Extracts page title from action data
 */
function extractPageTitle(action: PlaywrightAction): string | undefined {
  // This would need to be populated by the recording system
  return action.frameUrl || action.url;
}

/**
 * Formats the serialized steps into a human-readable string
 */
function formatSerializedSteps(steps: SerializedStep[], initialUrl: string): string {
  if (steps.length === 0) {
    return "No actions recorded.";
  }

  let output = '';
  
  // Add header with initial URL and timestamp
  const firstStep = steps[0];
  output += `Recording Session Summary\n`;
  output += `Started at: ${firstStep.timestamp}\n`;
  output += `Initial URL: ${initialUrl || 'Unknown'}\n`;
  output += `Total Steps: ${steps.length}\n\n`;
  
  // Add detailed step breakdown
  output += `Detailed Action Sequence:\n`;
  output += `${'='.repeat(50)}\n\n`;
  
  for (const step of steps) {
    output += `${step.stepNumber}. ${step.description}\n`;
    
    // Add technical details
    if (step.technical.selector) {
      output += `   Target: ${step.technical.selector}\n`;
    }
    if (step.technical.value && !step.description.includes('********')) {
      output += `   Value: ${step.technical.value}\n`;
    }
    
    // Add context if available
    if (step.context?.placeholder) {
      output += `   Field Placeholder: ${step.context.placeholder}\n`;
    }
    if (step.context?.elementText && step.context.elementText !== step.technical.value) {
      output += `   Element Text: ${step.context.elementText}\n`;
    }
    
    // Add HTML context if available (truncated)
    if (step.context?.htmlSnippet) {
      const snippet = step.context.htmlSnippet.length > 100 
        ? step.context.htmlSnippet.substring(0, 100) + '...'
        : step.context.htmlSnippet;
      output += `   HTML Context: ${snippet}\n`;
    }
    
    output += `   Timestamp: ${step.timestamp}\n`;
    output += '\n';
  }
  
  // Add summary section
  output += `Summary:\n`;
  output += `${'='.repeat(20)}\n`;
  output += `The user performed ${steps.length} actions in this recording session. `;
  
  // Analyze the flow pattern
  const actionTypes = steps.map(s => s.technical.action);
  const hasNavigation = actionTypes.includes('navigate');
  const hasFormInteraction = actionTypes.includes('type') || actionTypes.includes('click');
  
  if (hasNavigation && hasFormInteraction) {
    output += `This appears to be a form interaction flow that includes navigation and user input.`;
  } else if (hasFormInteraction) {
    output += `This appears to be a form interaction flow with user input.`;
  } else if (hasNavigation) {
    output += `This appears to be a navigation flow.`;
  } else {
    output += `This appears to be a general interaction flow.`;
  }
  
  return output;
}