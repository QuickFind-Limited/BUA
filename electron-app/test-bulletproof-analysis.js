#!/usr/bin/env node

/**
 * Test bulletproof Intent Spec generation with comprehensive recording data
 */

const fs = require('fs').promises;
const path = require('path');
const { analyzeRecording } = require('./dist/main/llm.js');

// Create comprehensive recording with ALL data types
const comprehensiveRecording = {
  sessionId: 'comprehensive-' + Date.now(),
  startTime: Date.now() - 120000,
  endTime: Date.now(),
  duration: 120000,
  url: 'https://app.example.com/login',
  
  // Standard events
  events: [
    {
      type: 'action',
      timestamp: Date.now() - 115000,
      data: {
        action: 'navigate',
        url: 'https://app.example.com/login',
        timestamp: Date.now() - 115000
      }
    },
    {
      type: 'action',
      timestamp: Date.now() - 110000,
      data: {
        action: 'input',
        selector: 'input[type="email"]',
        value: 'user@example.com',
        url: 'https://app.example.com/login',
        timestamp: Date.now() - 110000,
        element: {
          tagName: 'INPUT',
          attributes: {
            type: 'email',
            name: 'email',
            id: 'login-email',
            placeholder: 'Enter your email',
            'aria-label': 'Email address'
          }
        }
      }
    },
    {
      type: 'action',
      timestamp: Date.now() - 105000,
      data: {
        action: 'input',
        selector: 'input[type="password"]',
        value: 'SecurePassword123!',
        url: 'https://app.example.com/login',
        timestamp: Date.now() - 105000,
        element: {
          tagName: 'INPUT',
          attributes: {
            type: 'password',
            name: 'password',
            id: 'login-password',
            placeholder: 'Enter password',
            'aria-label': 'Password'
          }
        }
      }
    },
    {
      type: 'action',
      timestamp: Date.now() - 100000,
      data: {
        action: 'click',
        selector: 'button[type="submit"]',
        url: 'https://app.example.com/login',
        timestamp: Date.now() - 100000,
        element: {
          tagName: 'BUTTON',
          textContent: 'Sign In',
          attributes: {
            type: 'submit',
            class: 'btn btn-primary login-button',
            'data-testid': 'login-submit'
          }
        }
      }
    },
    {
      type: 'action',
      timestamp: Date.now() - 95000,
      data: {
        action: 'wait',
        duration: 3000,
        reason: 'page-load',
        timestamp: Date.now() - 95000
      }
    },
    {
      type: 'action',
      timestamp: Date.now() - 90000,
      data: {
        action: 'click',
        selector: 'a[href="/products"]',
        url: 'https://app.example.com/dashboard',
        timestamp: Date.now() - 90000,
        element: {
          tagName: 'A',
          textContent: 'Products',
          attributes: {
            href: '/products',
            class: 'nav-link'
          }
        }
      }
    }
  ],
  
  // DOM Snapshots showing page structure
  domSnapshots: [
    {
      timestamp: Date.now() - 108000,
      url: 'https://app.example.com/login',
      title: 'Login - Example App',
      visibleElements: [
        { selector: '#login-email', tagName: 'INPUT', isVisible: true, isInteractable: true },
        { selector: '#login-password', tagName: 'INPUT', isVisible: true, isInteractable: true },
        { selector: '.login-button', tagName: 'BUTTON', isVisible: true, isInteractable: true }
      ],
      viewport: { width: 1920, height: 1080 }
    },
    {
      timestamp: Date.now() - 88000,
      url: 'https://app.example.com/dashboard',
      title: 'Dashboard - Example App',
      visibleElements: [
        { selector: '.nav-link', tagName: 'A', isVisible: true, isInteractable: true },
        { selector: '.user-menu', tagName: 'DIV', isVisible: true, isInteractable: true }
      ],
      viewport: { width: 1920, height: 1080 }
    }
  ],
  
  // Network requests for wait conditions
  networkRequests: [
    {
      url: 'https://app.example.com/api/auth/login',
      method: 'POST',
      statusCode: 200,
      timestamp: Date.now() - 99000,
      responseSize: 1024,
      timing: { start: Date.now() - 99000, end: Date.now() - 98500 }
    },
    {
      url: 'https://app.example.com/api/user/profile',
      method: 'GET',
      statusCode: 200,
      timestamp: Date.now() - 94000,
      responseSize: 2048,
      timing: { start: Date.now() - 94000, end: Date.now() - 93800 }
    },
    {
      url: 'https://app.example.com/api/products',
      method: 'GET',
      statusCode: 200,
      timestamp: Date.now() - 87000,
      responseSize: 8192,
      timing: { start: Date.now() - 87000, end: Date.now() - 86500 }
    }
  ],
  
  // Console errors for error handling
  consoleErrors: [
    {
      message: 'Failed to load resource: 404',
      source: 'network',
      timestamp: Date.now() - 85000,
      stackTrace: 'at loadResource (app.js:123)'
    }
  ],
  
  // DOM mutations for dynamic content
  mutations: [
    {
      type: 'childList',
      timestamp: Date.now() - 93000,
      target: { id: 'user-menu-dropdown' },
      addedNodes: ['<li>Profile</li>', '<li>Settings</li>']
    },
    {
      type: 'attributes',
      timestamp: Date.now() - 92000,
      target: { id: 'loading-spinner' },
      attributeName: 'style',
      oldValue: 'display: block',
      newValue: 'display: none'
    }
  ],
  
  // Viewport and environment
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  
  // Cookies for state management
  cookies: [
    { name: 'session_id', value: 'abc123', domain: 'app.example.com', secure: true },
    { name: 'user_pref', value: 'dark_mode', domain: 'app.example.com' }
  ],
  
  // Local storage
  localStorage: {
    'auth_token': 'jwt_token_here',
    'user_id': '12345',
    'theme': 'dark'
  },
  
  // Performance metrics
  performance: {
    timing: {
      navigationStart: Date.now() - 120000,
      domContentLoaded: Date.now() - 118000,
      loadEventEnd: Date.now() - 116000
    },
    memory: {
      usedJSHeapSize: 10485760,
      totalJSHeapSize: 20971520
    }
  },
  
  // Tab sessions for multi-tab workflows
  tabSessions: {
    'tab-1': {
      id: 'tab-1',
      url: 'https://app.example.com/login',
      title: 'Login',
      active: false
    },
    'tab-2': {
      id: 'tab-2',
      url: 'https://app.example.com/dashboard',
      title: 'Dashboard',
      active: true
    }
  }
};

async function testBulletproofAnalysis() {
  console.log('🚀 Testing Bulletproof Intent Spec Generation');
  console.log('============================================\n');
  
  console.log('📊 Comprehensive Recording Summary:');
  console.log(`  - Duration: ${comprehensiveRecording.duration / 1000}s`);
  console.log(`  - Events: ${comprehensiveRecording.events.length}`);
  console.log(`  - DOM Snapshots: ${comprehensiveRecording.domSnapshots.length}`);
  console.log(`  - Network Requests: ${comprehensiveRecording.networkRequests.length}`);
  console.log(`  - Console Errors: ${comprehensiveRecording.consoleErrors.length}`);
  console.log(`  - DOM Mutations: ${comprehensiveRecording.mutations.length}`);
  console.log(`  - Tab Sessions: ${Object.keys(comprehensiveRecording.tabSessions).length}`);
  console.log(`  - Has Cookies: ${comprehensiveRecording.cookies ? 'Yes' : 'No'}`);
  console.log(`  - Has LocalStorage: ${comprehensiveRecording.localStorage ? 'Yes' : 'No'}`);
  console.log(`  - Has Performance Data: ${comprehensiveRecording.performance ? 'Yes' : 'No'}`);
  
  console.log('\n🤖 Calling Claude Opus 4.1 with enhanced bulletproof prompt...\n');
  
  try {
    const startTime = Date.now();
    const intentSpec = await analyzeRecording(comprehensiveRecording);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Bulletproof Analysis Complete (${(duration / 1000).toFixed(1)}s)\n`);
    
    console.log('📋 Generated Bulletproof Intent Spec:');
    console.log(`  - Name: ${intentSpec.name}`);
    console.log(`  - Description: ${intentSpec.description}`);
    console.log(`  - Steps: ${intentSpec.steps?.length || 0}`);
    console.log(`  - Variables: ${intentSpec.params?.length || 0}`);
    
    // Check for enhanced features
    console.log('\n🛡️ Bulletproof Features:');
    const hasMultipleSelectors = intentSpec.steps?.some(s => 
      Array.isArray(s.selectors) && s.selectors.length > 1);
    const hasWaitConditions = intentSpec.steps?.some(s => 
      s.waitBefore || s.waitAfter);
    const hasValidations = intentSpec.steps?.some(s => s.validation) || 
      intentSpec.validations?.length > 0;
    const hasErrorHandling = intentSpec.steps?.some(s => s.errorHandling) || 
      intentSpec.errorRecovery;
    const hasPerformanceMetrics = intentSpec.steps?.some(s => s.performance) || 
      intentSpec.performance;
    const hasEnvironmentConfig = intentSpec.environment;
    
    console.log(`  ✓ Multiple selectors: ${hasMultipleSelectors ? 'YES' : 'NO'}`);
    console.log(`  ✓ Wait conditions: ${hasWaitConditions ? 'YES' : 'NO'}`);
    console.log(`  ✓ Validations: ${hasValidations ? 'YES' : 'NO'}`);
    console.log(`  ✓ Error handling: ${hasErrorHandling ? 'YES' : 'NO'}`);
    console.log(`  ✓ Performance metrics: ${hasPerformanceMetrics ? 'YES' : 'NO'}`);
    console.log(`  ✓ Environment config: ${hasEnvironmentConfig ? 'YES' : 'NO'}`);
    
    // Check specific enhancements
    if (intentSpec.steps && intentSpec.steps.length > 0) {
      console.log('\n📝 Step Enhancements:');
      intentSpec.steps.forEach((step, i) => {
        const enhancements = [];
        if (Array.isArray(step.selectors) && step.selectors.length > 1) {
          enhancements.push(`${step.selectors.length} selectors`);
        }
        if (step.waitBefore) enhancements.push('wait before');
        if (step.waitAfter) enhancements.push('wait after');
        if (step.validation) enhancements.push('validation');
        if (step.errorHandling) enhancements.push('error handling');
        if (step.performance) enhancements.push('performance');
        
        if (enhancements.length > 0) {
          console.log(`  ${i + 1}. ${step.name}: [${enhancements.join(', ')}]`);
        }
      });
    }
    
    // Save the result
    const outputPath = path.join(__dirname, 'test-bulletproof-result.json');
    await fs.writeFile(outputPath, JSON.stringify({
      recording: comprehensiveRecording,
      intentSpec: intentSpec,
      analysisTime: duration,
      bulletproofFeatures: {
        hasMultipleSelectors,
        hasWaitConditions,
        hasValidations,
        hasErrorHandling,
        hasPerformanceMetrics,
        hasEnvironmentConfig
      }
    }, null, 2));
    
    console.log(`\n💾 Full results saved to: test-bulletproof-result.json`);
    
    const bulletproofScore = [
      hasMultipleSelectors,
      hasWaitConditions,
      hasValidations,
      hasErrorHandling,
      hasPerformanceMetrics,
      hasEnvironmentConfig
    ].filter(Boolean).length;
    
    console.log(`\n🏆 Bulletproof Score: ${bulletproofScore}/6`);
    
    if (bulletproofScore >= 4) {
      console.log('✅ EXCELLENT: Intent Spec is highly bulletproof!');
    } else if (bulletproofScore >= 2) {
      console.log('⚠️ GOOD: Intent Spec has some bulletproof features');
    } else {
      console.log('❌ NEEDS IMPROVEMENT: Intent Spec lacks bulletproof features');
    }
    
  } catch (error) {
    console.error('\n❌ Bulletproof Analysis Failed:', error.message);
    console.error('\nError details:', error);
  }
}

// Run the test
testBulletproofAnalysis().catch(console.error);