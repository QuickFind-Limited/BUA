/**
 * Recording Data Reducer
 * Reduces large recording data to essential information for Claude analysis
 */

/**
 * Reduces recording data to manageable size for Claude
 * @param {Object} recording - Full recording data
 * @returns {Object} Reduced recording data
 */
function reduceRecordingData(recording) {
    console.log('📊 Reducing recording data from', JSON.stringify(recording).length, 'bytes');
    
    const reduced = {
        sessionId: recording.sessionId,
        duration: recording.duration,
        url: recording.url,
        title: recording.title,
        viewport: recording.viewport,
        userAgent: recording.userAgent,
        
        // Extract key login/input fields
        capturedInputs: extractImportantInputs(recording),
        
        // Summarize actions instead of including all
        actionSummary: summarizeActions(recording.actions || []),
        
        // Extract key navigation points
        navigationFlow: extractNavigationFlow(recording),
        
        // Include only final DOM snapshot for validation
        finalDOM: recording.domSnapshots?.length > 0 
            ? extractKeyElements(recording.domSnapshots[recording.domSnapshots.length - 1])
            : null,
        
        // Extract critical network requests only
        keyRequests: extractKeyRequests(recording.network || {}),
        
        // Include error messages if any
        errors: extractErrors(recording.console || {}),
        
        // Tab information
        tabsUsed: recording.tabsUsed || [],
        
        // Screenshot indicators
        hasScreenshots: !!recording.screenshots?.length,
        screenshotCount: recording.screenshots?.length || 0
    };
    
    console.log('✅ Reduced to', JSON.stringify(reduced).length, 'bytes');
    return reduced;
}

/**
 * Extract important input fields (login, passwords, form data)
 */
function extractImportantInputs(recording) {
    const inputs = {};
    
    // From console logs with [RECORDER-DATA]
    if (recording.console) {
        Object.values(recording.console).flat().forEach(log => {
            if (log.args) {
                log.args.forEach(arg => {
                    const text = String(arg.value || '');
                    if (text.includes('[RECORDER-DATA]')) {
                        try {
                            const jsonStr = text.substring(text.indexOf('[RECORDER-DATA]') + 15);
                            const data = JSON.parse(jsonStr);
                            if (data.field) {
                                inputs[data.field] = {
                                    value: data.value,
                                    type: data.inputType || data.type,
                                    isLoginField: data.isLoginField,
                                    url: data.url
                                };
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                });
            }
        });
    }
    
    // From capturedInputs
    if (recording.capturedInputs) {
        Object.entries(recording.capturedInputs).forEach(([key, data]) => {
            inputs[key] = {
                field: data.field,
                value: data.value,
                type: data.type || data.inputType,
                isLoginField: data.isLoginField,
                url: data.url
            };
        });
    }
    
    // From actions
    if (recording.actions) {
        recording.actions.forEach(action => {
            if (action.type === 'input' && action.target) {
                const fieldId = action.target.id || action.target.name || 'field_' + Date.now();
                if (action.value || action.target.value) {
                    inputs[fieldId] = {
                        value: action.value || action.target.value,
                        type: action.target.type || 'text',
                        selector: action.target.selector
                    };
                }
            }
        });
    }
    
    return inputs;
}

/**
 * Summarize actions into categories and counts
 */
function summarizeActions(actions) {
    const summary = {
        totalActions: actions.length,
        actionTypes: {},
        keyActions: []
    };
    
    actions.forEach(action => {
        const type = action.type || 'unknown';
        summary.actionTypes[type] = (summary.actionTypes[type] || 0) + 1;
        
        // Keep important actions
        if (type === 'click' || type === 'submit' || type === 'navigate') {
            summary.keyActions.push({
                type: type,
                selector: action.target?.selector,
                text: action.target?.text,
                url: action.url,
                timestamp: action.timestamp
            });
        }
    });
    
    // Limit key actions to prevent bloat
    summary.keyActions = summary.keyActions.slice(0, 20);
    
    return summary;
}

/**
 * Extract navigation flow
 */
function extractNavigationFlow(recording) {
    const flow = [];
    const seenUrls = new Set();
    
    if (recording.actions) {
        recording.actions.forEach(action => {
            if (action.url && !seenUrls.has(action.url)) {
                seenUrls.add(action.url);
                flow.push({
                    url: action.url,
                    timestamp: action.timestamp
                });
            }
        });
    }
    
    // Add network navigation
    if (recording.network) {
        Object.entries(recording.network).forEach(([url, requests]) => {
            if (!seenUrls.has(url)) {
                seenUrls.add(url);
                flow.push({ url });
            }
        });
    }
    
    return flow;
}

/**
 * Extract key elements from DOM snapshot
 */
function extractKeyElements(snapshot) {
    if (!snapshot) return null;
    
    return {
        title: snapshot.title,
        url: snapshot.url,
        hasLoginForm: snapshot.html?.includes('password') || snapshot.html?.includes('login'),
        formCount: (snapshot.html?.match(/<form/g) || []).length,
        inputCount: (snapshot.html?.match(/<input/g) || []).length,
        buttonCount: (snapshot.html?.match(/<button/g) || []).length,
        // Extract visible text (first 500 chars)
        visibleText: snapshot.html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 500)
    };
}

/**
 * Extract only important network requests
 */
function extractKeyRequests(network) {
    const keyRequests = [];
    
    Object.entries(network).forEach(([url, requests]) => {
        // Keep login/auth requests
        if (url.includes('login') || url.includes('auth') || url.includes('signin')) {
            keyRequests.push({
                url: url,
                count: requests.length,
                methods: [...new Set(requests.map(r => r.method))]
            });
        }
        // Keep API calls
        else if (url.includes('/api/') || url.includes('/v1/') || url.includes('/v2/')) {
            keyRequests.push({
                url: url,
                count: requests.length,
                methods: [...new Set(requests.map(r => r.method))]
            });
        }
    });
    
    return keyRequests.slice(0, 10); // Limit to 10 key requests
}

/**
 * Extract error messages
 */
function extractErrors(consoleLogs) {
    const errors = [];
    
    Object.values(consoleLogs).flat().forEach(log => {
        if (log.level === 'error' || log.level === 'warning') {
            errors.push({
                level: log.level,
                message: log.text?.substring(0, 200) // Limit message length
            });
        }
    });
    
    return errors.slice(0, 5); // Limit to 5 errors
}

module.exports = {
    reduceRecordingData
};