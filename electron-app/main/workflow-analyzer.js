/**
 * Workflow Analyzer - Analyzes recording workflows to understand context and patterns
 * for smarter variable detection and naming
 */

class WorkflowAnalyzer {
  constructor() {
    // Common workflow patterns
    this.workflowPatterns = {
      LOGIN: {
        pattern: ['navigate', 'input:email/username', 'input:password', 'click:submit/login'],
        variables: { email: 'EMAIL', password: 'PASSWORD', username: 'USERNAME' }
      },
      REGISTRATION: {
        pattern: ['navigate', 'input:name', 'input:email', 'input:password', 'click:register'],
        variables: { name: 'FULL_NAME', email: 'EMAIL', password: 'PASSWORD' }
      },
      SEARCH: {
        pattern: ['input:search/query', 'click:search/submit', 'navigate:results'],
        variables: { search: 'SEARCH_QUERY' }
      },
      CHECKOUT: {
        pattern: ['click:cart', 'input:address', 'input:card', 'click:pay'],
        variables: { address: 'SHIPPING_ADDRESS', card: 'CARD_NUMBER' }
      },
      ITEM_CREATION: {
        pattern: ['click:new/add', 'input:name/title', 'input:price', 'input:description', 'click:save'],
        variables: { 
          name: 'ITEM_NAME', 
          price: 'PRICE', 
          description: 'DESCRIPTION',
          cost: 'COST_PRICE',
          selling: 'SELLING_PRICE'
        }
      },
      DATA_ENTRY: {
        pattern: ['navigate:form', 'input:multiple', 'click:save/submit'],
        variables: {} // Determined by field context
      }
    };
  }

  /**
   * Analyze the workflow to understand what type of process is being recorded
   * @param {Array} events - Array of recording events
   * @returns {Object} Workflow analysis with type and context
   */
  analyzeWorkflow(events) {
    const actions = this.extractActionSequence(events);
    const urlContext = this.analyzeUrlPatterns(events);
    const formContext = this.analyzeFormStructure(events);
    
    // Identify workflow type
    const workflowType = this.identifyWorkflowType(actions, urlContext);
    
    // Analyze data flow
    const dataFlow = this.analyzeDataFlow(events);
    
    // Determine business context
    const businessContext = this.determineBusinessContext(urlContext, formContext, dataFlow);
    
    return {
      type: workflowType,
      context: businessContext,
      dataFlow: dataFlow,
      suggestedVariables: this.suggestVariables(workflowType, businessContext, dataFlow)
    };
  }

  /**
   * Extract simplified action sequence from events
   */
  extractActionSequence(events) {
    const sequence = [];
    let lastAction = null;
    
    events.forEach(event => {
      if (event.type === 'action' && event.data) {
        const action = event.data;
        const simplified = this.simplifyAction(action);
        
        // Avoid duplicate consecutive actions
        if (simplified !== lastAction) {
          sequence.push(simplified);
          lastAction = simplified;
        }
      }
    });
    
    return sequence;
  }

  /**
   * Simplify action for pattern matching
   */
  simplifyAction(action) {
    const type = action.action || action.type;
    
    switch(type) {
      case 'navigate':
        return 'navigate';
      case 'input':
        const element = action.element || action.elementInfo || {};
        const fieldType = element.type || '';
        const fieldName = (element.name || element.id || '').toLowerCase();
        
        if (fieldType === 'password' || fieldName.includes('password')) {
          return 'input:password';
        } else if (fieldType === 'email' || fieldName.includes('email')) {
          return 'input:email';
        } else if (fieldName.includes('search') || fieldName.includes('query')) {
          return 'input:search';
        } else if (fieldName.includes('name')) {
          return 'input:name';
        } else if (fieldName.includes('price') || fieldName.includes('cost')) {
          return 'input:price';
        }
        return 'input:text';
        
      case 'click':
        const clickElement = action.element || action.elementInfo || {};
        const text = (clickElement.text || '').toLowerCase();
        if (text.includes('login') || text.includes('sign in')) {
          return 'click:login';
        } else if (text.includes('submit') || text.includes('save')) {
          return 'click:submit';
        } else if (text.includes('new') || text.includes('add') || text.includes('create')) {
          return 'click:new';
        }
        return 'click';
        
      default:
        return type;
    }
  }

  /**
   * Analyze URL patterns to understand application context
   */
  analyzeUrlPatterns(events) {
    const urls = new Set();
    const urlKeywords = [];
    
    events.forEach(event => {
      if (event.data && event.data.url) {
        const url = event.data.url;
        urls.add(url);
        
        // Extract keywords from URL
        const keywords = this.extractUrlKeywords(url);
        urlKeywords.push(...keywords);
      }
    });
    
    // Determine primary context from URLs
    const context = this.determineUrlContext(urlKeywords);
    
    return {
      urls: Array.from(urls),
      keywords: urlKeywords,
      context: context
    };
  }

  /**
   * Extract meaningful keywords from URL
   */
  extractUrlKeywords(url) {
    const keywords = [];
    const parts = url.split(/[/?#&=]/);
    
    parts.forEach(part => {
      if (part && !part.includes('.') && part.length > 2) {
        // Common business-related keywords
        if (['inventory', 'product', 'item', 'order', 'customer', 'invoice', 
             'payment', 'shipping', 'cart', 'checkout', 'account', 'profile',
             'dashboard', 'admin', 'settings', 'new', 'edit', 'create'].includes(part.toLowerCase())) {
          keywords.push(part.toLowerCase());
        }
      }
    });
    
    return keywords;
  }

  /**
   * Determine context from URL keywords
   */
  determineUrlContext(keywords) {
    const contexts = {
      ecommerce: ['product', 'item', 'cart', 'checkout', 'order', 'shipping'],
      inventory: ['inventory', 'stock', 'warehouse', 'item'],
      crm: ['customer', 'contact', 'lead', 'account'],
      finance: ['invoice', 'payment', 'billing', 'transaction'],
      auth: ['login', 'signin', 'signup', 'register', 'auth']
    };
    
    for (const [context, contextKeywords] of Object.entries(contexts)) {
      if (contextKeywords.some(kw => keywords.includes(kw))) {
        return context;
      }
    }
    
    return 'general';
  }

  /**
   * Analyze form structure to understand data being entered
   */
  analyzeFormStructure(events) {
    const formFields = [];
    const inputSequence = [];
    
    events.forEach(event => {
      if (event.type === 'action' && event.data) {
        const action = event.data;
        if (action.action === 'input') {
          const element = action.element || action.elementInfo || {};
          formFields.push({
            name: element.name || element.id,
            type: element.type,
            placeholder: element.placeholder,
            value: action.value,
            url: action.url
          });
          inputSequence.push(element.name || element.id || 'unknown');
        }
      }
    });
    
    return {
      fields: formFields,
      sequence: inputSequence,
      formType: this.identifyFormType(formFields)
    };
  }

  /**
   * Identify type of form based on fields
   */
  identifyFormType(fields) {
    const fieldNames = fields.map(f => (f.name || '').toLowerCase());
    const fieldTypes = fields.map(f => f.type);
    
    if (fieldTypes.includes('password') && (fieldTypes.includes('email') || fieldNames.some(n => n.includes('user')))) {
      return 'login';
    } else if (fieldNames.some(n => n.includes('price') || n.includes('cost'))) {
      return 'product_entry';
    } else if (fieldNames.some(n => n.includes('address') || n.includes('shipping'))) {
      return 'checkout';
    } else if (fieldNames.some(n => n.includes('search') || n.includes('query'))) {
      return 'search';
    }
    
    return 'data_entry';
  }

  /**
   * Analyze data flow through the workflow
   */
  analyzeDataFlow(events) {
    const dataFlow = {
      inputs: [],
      selections: [],
      navigations: [],
      submissions: []
    };
    
    let currentForm = null;
    
    events.forEach(event => {
      if (event.type === 'action' && event.data) {
        const action = event.data;
        
        switch(action.action || action.type) {
          case 'input':
            dataFlow.inputs.push({
              field: action.selector,
              value: action.value,
              context: currentForm
            });
            break;
            
          case 'click':
            const element = action.element || action.elementInfo || {};
            const text = (element.text || '').toLowerCase();
            if (text.includes('submit') || text.includes('save') || text.includes('create')) {
              dataFlow.submissions.push({
                form: currentForm,
                inputs: dataFlow.inputs.filter(i => i.context === currentForm)
              });
              currentForm = null;
            }
            break;
            
          case 'navigate':
            dataFlow.navigations.push(action.url);
            currentForm = action.url;
            break;
        }
      }
    });
    
    return dataFlow;
  }

  /**
   * Identify workflow type based on action sequence and context
   */
  identifyWorkflowType(sequence, urlContext) {
    // Check for known patterns
    for (const [type, config] of Object.entries(this.workflowPatterns)) {
      if (this.matchesPattern(sequence, config.pattern)) {
        return type;
      }
    }
    
    // Use URL context as fallback
    if (urlContext.context === 'auth') {
      return 'LOGIN';
    } else if (urlContext.context === 'inventory' || urlContext.context === 'ecommerce') {
      // Check if creating new item
      if (sequence.includes('click:new') || sequence.includes('click:add')) {
        return 'ITEM_CREATION';
      }
    }
    
    return 'DATA_ENTRY';
  }

  /**
   * Check if sequence matches a pattern
   */
  matchesPattern(sequence, pattern) {
    let patternIndex = 0;
    
    for (const action of sequence) {
      if (patternIndex >= pattern.length) break;
      
      const expectedPattern = pattern[patternIndex];
      if (action.includes(expectedPattern) || 
          expectedPattern.split('/').some(p => action.includes(p))) {
        patternIndex++;
      }
    }
    
    return patternIndex === pattern.length;
  }

  /**
   * Determine business context from all available information
   */
  determineBusinessContext(urlContext, formContext, dataFlow) {
    const context = {
      domain: urlContext.context,
      processType: formContext.formType,
      dataTypes: this.identifyDataTypes(dataFlow),
      isMultiStep: dataFlow.submissions.length > 1,
      hasAuthentication: formContext.formType === 'login'
    };
    
    return context;
  }

  /**
   * Identify types of data being processed
   */
  identifyDataTypes(dataFlow) {
    const types = new Set();
    
    dataFlow.inputs.forEach(input => {
      const value = input.value;
      if (/^\d+(\.\d+)?$/.test(value)) {
        types.add('numeric');
      } else if (/^[^@]+@[^@]+\.[^@]+$/.test(value)) {
        types.add('email');
      } else if (value.length > 20) {
        types.add('text_long');
      } else {
        types.add('text_short');
      }
    });
    
    return Array.from(types);
  }

  /**
   * Suggest variables based on workflow analysis
   */
  suggestVariables(workflowType, businessContext, dataFlow) {
    const suggestions = {};
    
    // Get base suggestions from workflow type
    const workflowConfig = this.workflowPatterns[workflowType];
    if (workflowConfig && workflowConfig.variables) {
      Object.assign(suggestions, workflowConfig.variables);
    }
    
    // Enhance with business context
    if (businessContext.domain === 'inventory' || businessContext.domain === 'ecommerce') {
      // Add inventory-specific variables
      dataFlow.inputs.forEach(input => {
        const value = input.value;
        if (/^\d+(\.\d+)?$/.test(value)) {
          // Numeric values in inventory context
          if (!suggestions.selling_price) {
            suggestions.selling_price = 'SELLING_PRICE';
          } else if (!suggestions.cost_price) {
            suggestions.cost_price = 'COST_PRICE';
          } else if (!suggestions.quantity) {
            suggestions.quantity = 'QUANTITY';
          }
        }
      });
    }
    
    return suggestions;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WorkflowAnalyzer };
}