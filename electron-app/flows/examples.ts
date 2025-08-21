/**
 * Practical examples demonstrating Magnitude Flow Runner usage
 */

import { MagnitudeFlowRunner } from './exampleFlow';
import { FlowPatterns, ExtractionPatterns } from './flowUtils';
import { IntentSpec } from './types';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Example 1: E-commerce Product Search and Price Monitoring
 */
export async function ecommerceExample() {
  console.log('=== E-commerce Product Search Example ===');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const runner = new MagnitudeFlowRunner(apiKey);

  // Create an e-commerce search intent
  const ecommerceIntent: IntentSpec = {
    name: 'Amazon Product Search',
    startUrl: 'https://amazon.com',
    params: ['PRODUCT_NAME'],
    steps: [
      {
        action: 'click',
        target: '#twotabsearchtextbox',
        value: ''
      },
      {
        action: 'type',
        target: '#twotabsearchtextbox',
        value: '{{PRODUCT_NAME}}'
      },
      {
        action: 'click',
        target: '#nav-search-submit-button',
        value: ''
      },
      {
        action: 'wait',
        target: '3000',
        value: ''
      }
    ],
    successCheck: '[data-component-type="s-search-result"]'
  };

  try {
    const result = await runner.runIntentFlowWithRetry(
      saveIntentToTemp(ecommerceIntent),
      {
        PRODUCT_NAME: 'wireless headphones'
      },
      ExtractionPatterns.productExtraction(),
      2
    );

    console.log('E-commerce search result:', {
      success: result.success,
      productCount: Array.isArray(result.data) ? result.data.length : 0,
      error: result.error
    });

    return result;
  } catch (error) {
    console.error('E-commerce example failed:', error);
    throw error;
  }
}

/**
 * Example 2: Social Media Profile Data Extraction
 */
export async function socialMediaExample() {
  console.log('=== Social Media Profile Example ===');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const runner = new MagnitudeFlowRunner(apiKey);

  // Create a LinkedIn profile viewing intent
  const linkedinIntent: IntentSpec = {
    name: 'LinkedIn Profile Viewer',
    startUrl: 'https://linkedin.com/in/{{PROFILE_USERNAME}}',
    params: ['PROFILE_USERNAME'],
    steps: [
      {
        action: 'wait',
        target: '3000',
        value: ''
      },
      {
        action: 'scroll',
        target: '0,500',
        value: ''
      },
      {
        action: 'wait',
        target: '2000',
        value: ''
      }
    ],
    successCheck: '.pv-text-details__left-panel'
  };

  try {
    const result = await runner.runIntentFlow(
      saveIntentToTemp(linkedinIntent),
      {
        PROFILE_USERNAME: 'example-user'
      },
      ExtractionPatterns.profileExtraction()
    );

    console.log('LinkedIn profile result:', {
      success: result.success,
      hasProfileData: !!result.data,
      error: result.error
    });

    return result;
  } catch (error) {
    console.error('Social media example failed:', error);
    throw error;
  }
}

/**
 * Example 3: News Article Collection and Analysis
 */
export async function newsCollectionExample() {
  console.log('=== News Collection Example ===');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const runner = new MagnitudeFlowRunner(apiKey);

  // Create a news search intent
  const newsIntent: IntentSpec = {
    name: 'News Search and Collection',
    params: [],
    startUrl: 'https://news.ycombinator.com',
    steps: [
      {
        action: 'wait',
        target: '2000',
        value: ''
      },
      {
        action: 'scroll',
        target: '0,1000',
        value: ''
      },
      {
        action: 'wait',
        target: '1000',
        value: ''
      }
    ],
    successCheck: '.athing'
  };

  try {
    const result = await runner.runIntentFlow(
      saveIntentToTemp(newsIntent),
      {},
      `Extract news articles from Hacker News including:
       - Article titles
       - URLs/links
       - Points/scores
       - Number of comments
       - Author usernames
       - Time posted
       Return as JSON array of articles.`
    );

    console.log('News collection result:', {
      success: result.success,
      articleCount: Array.isArray(result.data) ? result.data.length : 0,
      error: result.error
    });

    return result;
  } catch (error) {
    console.error('News collection example failed:', error);
    throw error;
  }
}

/**
 * Example 4: Form Automation for Contact/Lead Generation
 */
export async function formAutomationExample() {
  console.log('=== Form Automation Example ===');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const runner = new MagnitudeFlowRunner(apiKey);

  // Use the FlowPatterns utility to create a form flow
  const contactFormIntent = FlowPatterns.createFormFlow(
    'https://example.com/contact',
    [
      { selector: '#name', param: 'FULL_NAME' },
      { selector: '#email', param: 'EMAIL' },
      { selector: '#company', param: 'COMPANY' },
      { selector: '#message', param: 'MESSAGE' }
    ],
    '#submit-btn',
    '.success-message'
  );

  try {
    const result = await runner.runIntentFlow(
      saveIntentToTemp(contactFormIntent),
      {
        FULL_NAME: 'John Doe',
        EMAIL: 'john.doe@example.com',
        COMPANY: 'Tech Corp',
        MESSAGE: 'Interested in your services for automation solutions.'
      }
    );

    console.log('Form automation result:', {
      success: result.success,
      error: result.error
    });

    return result;
  } catch (error) {
    console.error('Form automation example failed:', error);
    throw error;
  }
}

/**
 * Example 5: Real Estate Listing Data Collection
 */
export async function realEstateExample() {
  console.log('=== Real Estate Data Collection Example ===');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const runner = new MagnitudeFlowRunner(apiKey);

  // Create a real estate search intent
  const realEstateIntent: IntentSpec = {
    name: 'Real Estate Search',
    startUrl: 'https://zillow.com/{{CITY}}-{{STATE}}',
    params: ['CITY', 'STATE', 'MAX_PRICE'],
    steps: [
      {
        action: 'wait',
        target: '3000',
        value: ''
      },
      {
        action: 'click',
        target: '[data-testid="price-filter-button"]',
        value: ''
      },
      {
        action: 'type',
        target: '[data-testid="price-max-input"]',
        value: '{{MAX_PRICE}}'
      },
      {
        action: 'click',
        target: '[data-testid="apply-filter"]',
        value: ''
      },
      {
        action: 'wait',
        target: '5000',
        value: ''
      }
    ],
    successCheck: '[data-testid="property-card"]'
  };

  try {
    const result = await runner.runIntentFlow(
      saveIntentToTemp(realEstateIntent),
      {
        CITY: 'austin',
        STATE: 'tx',
        MAX_PRICE: '500000'
      },
      `Extract real estate listings including:
       - Property addresses
       - Prices
       - Bedrooms/bathrooms
       - Square footage
       - Property type
       - Listing photos
       - Days on market
       Return as JSON array of properties.`
    );

    console.log('Real estate result:', {
      success: result.success,
      propertyCount: Array.isArray(result.data) ? result.data.length : 0,
      error: result.error
    });

    return result;
  } catch (error) {
    console.error('Real estate example failed:', error);
    throw error;
  }
}

/**
 * Example 6: Financial Data Monitoring
 */
export async function financialDataExample() {
  console.log('=== Financial Data Monitoring Example ===');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const runner = new MagnitudeFlowRunner(apiKey);

  // Create a stock monitoring intent
  const stockIntent: IntentSpec = {
    name: 'Stock Price Monitor',
    startUrl: 'https://finance.yahoo.com/quote/{{SYMBOL}}',
    params: ['SYMBOL'],
    steps: [
      {
        action: 'wait',
        target: '3000',
        value: ''
      },
      {
        action: 'scroll',
        target: '0,500',
        value: ''
      },
      {
        action: 'wait',
        target: '2000',
        value: ''
      }
    ],
    successCheck: '[data-testid="qsp-price"]'
  };

  try {
    const result = await runner.runIntentFlow(
      saveIntentToTemp(stockIntent),
      {
        SYMBOL: 'AAPL'
      },
      ExtractionPatterns.financialExtraction()
    );

    console.log('Financial data result:', {
      success: result.success,
      hasStockData: !!result.data,
      error: result.error
    });

    return result;
  } catch (error) {
    console.error('Financial data example failed:', error);
    throw error;
  }
}

/**
 * Utility function to save intent to temporary file
 */
function saveIntentToTemp(intent: IntentSpec): string {
  const tempDir = join(__dirname, '../temp');
  
  try {
    mkdirSync(tempDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  const filename = `temp-${intent.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
  const filepath = join(tempDir, filename);
  
  writeFileSync(filepath, JSON.stringify(intent, null, 2));
  
  return filepath;
}

/**
 * Run all examples in sequence
 */
export async function runAllExamples() {
  console.log('Starting Magnitude Flow Runner Examples...\n');

  const examples = [
    { name: 'E-commerce', fn: ecommerceExample },
    { name: 'Social Media', fn: socialMediaExample },
    { name: 'News Collection', fn: newsCollectionExample },
    { name: 'Form Automation', fn: formAutomationExample },
    { name: 'Real Estate', fn: realEstateExample },
    { name: 'Financial Data', fn: financialDataExample }
  ];

  const results = [];

  for (const example of examples) {
    try {
      console.log(`\n--- Running ${example.name} Example ---`);
      const result = await example.fn();
      results.push({
        name: example.name,
        success: result.success,
        error: result.error
      });
    } catch (error) {
      console.error(`${example.name} example failed with error:`, error);
      results.push({
        name: example.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  console.log('\n=== Example Results Summary ===');
  results.forEach(result => {
    console.log(`${result.name}: ${result.success ? '✅ Success' : '❌ Failed'}`);
    if (!result.success && result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });

  return results;
}

// Export individual examples for selective testing
export default {
  ecommerceExample,
  socialMediaExample,
  newsCollectionExample,
  formAutomationExample,
  realEstateExample,
  financialDataExample,
  runAllExamples
};