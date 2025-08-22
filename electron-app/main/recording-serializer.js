"use strict";
/**
 * Recording Serializer - Converts Playwright actions to human-readable format for Claude analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeRecording = serializeRecording;
/**
 * Serializes a Playwright recording into a human-readable format for Claude analysis
 * @param recording Array of Playwright actions
 * @returns Formatted string describing the user actions
 */
function serializeRecording(recording) {
    if (!recording || recording.length === 0) {
        return "No recording data provided.";
    }
    var steps = [];
    var currentUrl = '';
    var stepCounter = 1;
    // Process each action in the recording
    for (var _i = 0, recording_1 = recording; _i < recording_1.length; _i++) {
        var action = recording_1[_i];
        var step = processAction(action, stepCounter, currentUrl);
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
function processAction(action, stepNumber, currentUrl) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var timestamp = action.timestamp ? new Date(action.timestamp).toISOString() : new Date().toISOString();
    switch (action.type) {
        case 'navigate':
            return {
                stepNumber: stepNumber,
                timestamp: timestamp,
                description: "User navigated to ".concat(action.url),
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
                stepNumber: stepNumber,
                timestamp: timestamp,
                description: createClickDescription(action),
                technical: {
                    action: 'click',
                    selector: (_a = action.target) === null || _a === void 0 ? void 0 : _a.selector,
                    url: currentUrl
                },
                context: {
                    elementText: (_b = action.target) === null || _b === void 0 ? void 0 : _b.text,
                    htmlSnippet: action.htmlContext
                }
            };
        case 'type':
        case 'fill':
            return {
                stepNumber: stepNumber,
                timestamp: timestamp,
                description: createTypeDescription(action),
                technical: {
                    action: 'type',
                    selector: (_c = action.target) === null || _c === void 0 ? void 0 : _c.selector,
                    value: action.value,
                    url: currentUrl
                },
                context: {
                    placeholder: (_d = action.target) === null || _d === void 0 ? void 0 : _d.placeholder,
                    htmlSnippet: action.htmlContext
                }
            };
        case 'keydown':
        case 'keyup':
            if (action.value === 'Enter' || action.value === 'Tab') {
                return {
                    stepNumber: stepNumber,
                    timestamp: timestamp,
                    description: "User pressed ".concat(action.value, " key"),
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
                stepNumber: stepNumber,
                timestamp: timestamp,
                description: "System waited ".concat(action.value, "ms"),
                technical: {
                    action: 'wait',
                    value: action.value,
                    url: currentUrl
                }
            };
        case 'select':
            return {
                stepNumber: stepNumber,
                timestamp: timestamp,
                description: "User selected \"".concat(action.value, "\" from dropdown"),
                technical: {
                    action: 'select',
                    selector: (_e = action.target) === null || _e === void 0 ? void 0 : _e.selector,
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
                stepNumber: stepNumber,
                timestamp: timestamp,
                description: "User ".concat(action.type, "ed checkbox"),
                technical: {
                    action: action.type,
                    selector: (_f = action.target) === null || _f === void 0 ? void 0 : _f.selector,
                    url: currentUrl
                },
                context: {
                    elementText: (_g = action.target) === null || _g === void 0 ? void 0 : _g.text,
                    htmlSnippet: action.htmlContext
                }
            };
        default:
            // Handle unknown action types
            return {
                stepNumber: stepNumber,
                timestamp: timestamp,
                description: "User performed ".concat(action.type, " action"),
                technical: {
                    action: action.type,
                    selector: (_h = action.target) === null || _h === void 0 ? void 0 : _h.selector,
                    value: action.value,
                    url: currentUrl
                }
            };
    }
}
/**
 * Creates a human-readable description for click actions
 */
function createClickDescription(action) {
    var target = action.target;
    if (target === null || target === void 0 ? void 0 : target.text) {
        // Determine element type from text or attributes
        if (target.text.toLowerCase().includes('button') || target.tagName === 'button') {
            return "User clicked on button \"".concat(target.text, "\"");
        }
        else if (target.text.toLowerCase().includes('link') || target.tagName === 'a') {
            return "User clicked on link \"".concat(target.text, "\"");
        }
        else {
            return "User clicked on \"".concat(target.text, "\"");
        }
    }
    if (target === null || target === void 0 ? void 0 : target.placeholder) {
        return "User clicked on input field with placeholder \"".concat(target.placeholder, "\"");
    }
    if (target === null || target === void 0 ? void 0 : target.selector) {
        // Try to infer element type from selector
        if (target.selector.includes('button') || target.selector.includes('btn')) {
            return "User clicked on button (".concat(target.selector, ")");
        }
        else if (target.selector.includes('input') || target.selector.includes('field')) {
            return "User clicked on input field (".concat(target.selector, ")");
        }
        else if (target.selector.includes('link') || target.selector.includes('href')) {
            return "User clicked on link (".concat(target.selector, ")");
        }
    }
    return "User clicked on element".concat((target === null || target === void 0 ? void 0 : target.selector) ? " (".concat(target.selector, ")") : '');
}
/**
 * Creates a human-readable description for type/fill actions
 */
function createTypeDescription(action) {
    var target = action.target;
    var value = action.value || '';
    // Mask potential passwords
    var displayValue = isPasswordField(target) ? '********' : value;
    if (target === null || target === void 0 ? void 0 : target.placeholder) {
        return "User typed \"".concat(displayValue, "\" in field with placeholder \"").concat(target.placeholder, "\"");
    }
    if (target === null || target === void 0 ? void 0 : target.selector) {
        if (target.selector.includes('password')) {
            return "User typed \"********\" in password field";
        }
        else if (target.selector.includes('email')) {
            return "User typed \"".concat(displayValue, "\" in email field");
        }
        else if (target.selector.includes('search')) {
            return "User typed \"".concat(displayValue, "\" in search field");
        }
    }
    return "User typed \"".concat(displayValue, "\"").concat((target === null || target === void 0 ? void 0 : target.selector) ? " in field (".concat(target.selector, ")") : '');
}
/**
 * Determines if a field is likely a password field
 */
function isPasswordField(target) {
    var _a, _b;
    if (!target)
        return false;
    var selector = ((_a = target.selector) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    var placeholder = ((_b = target.placeholder) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
    var attributes = target.attributes || {};
    return selector.includes('password') ||
        placeholder.includes('password') ||
        attributes.type === 'password';
}
/**
 * Extracts page title from action data
 */
function extractPageTitle(action) {
    // This would need to be populated by the recording system
    return action.frameUrl || action.url;
}
/**
 * Formats the serialized steps into a human-readable string
 */
function formatSerializedSteps(steps, initialUrl) {
    var _a, _b, _c;
    if (steps.length === 0) {
        return "No actions recorded.";
    }
    var output = '';
    // Add header with initial URL and timestamp
    var firstStep = steps[0];
    output += "Recording Session Summary\n";
    output += "Started at: ".concat(firstStep.timestamp, "\n");
    output += "Initial URL: ".concat(initialUrl || 'Unknown', "\n");
    output += "Total Steps: ".concat(steps.length, "\n\n");
    // Add detailed step breakdown
    output += "Detailed Action Sequence:\n";
    output += "".concat('='.repeat(50), "\n\n");
    for (var _i = 0, steps_1 = steps; _i < steps_1.length; _i++) {
        var step = steps_1[_i];
        output += "".concat(step.stepNumber, ". ").concat(step.description, "\n");
        // Add technical details
        if (step.technical.selector) {
            output += "   Target: ".concat(step.technical.selector, "\n");
        }
        if (step.technical.value && !step.description.includes('********')) {
            output += "   Value: ".concat(step.technical.value, "\n");
        }
        // Add context if available
        if ((_a = step.context) === null || _a === void 0 ? void 0 : _a.placeholder) {
            output += "   Field Placeholder: ".concat(step.context.placeholder, "\n");
        }
        if (((_b = step.context) === null || _b === void 0 ? void 0 : _b.elementText) && step.context.elementText !== step.technical.value) {
            output += "   Element Text: ".concat(step.context.elementText, "\n");
        }
        // Add HTML context if available (truncated)
        if ((_c = step.context) === null || _c === void 0 ? void 0 : _c.htmlSnippet) {
            var snippet = step.context.htmlSnippet.length > 100
                ? step.context.htmlSnippet.substring(0, 100) + '...'
                : step.context.htmlSnippet;
            output += "   HTML Context: ".concat(snippet, "\n");
        }
        output += "   Timestamp: ".concat(step.timestamp, "\n");
        output += '\n';
    }
    // Add summary section
    output += "Summary:\n";
    output += "".concat('='.repeat(20), "\n");
    output += "The user performed ".concat(steps.length, " actions in this recording session. ");
    // Analyze the flow pattern
    var actionTypes = steps.map(function (s) { return s.technical.action; });
    var hasNavigation = actionTypes.includes('navigate');
    var hasFormInteraction = actionTypes.includes('type') || actionTypes.includes('click');
    if (hasNavigation && hasFormInteraction) {
        output += "This appears to be a form interaction flow that includes navigation and user input.";
    }
    else if (hasFormInteraction) {
        output += "This appears to be a form interaction flow with user input.";
    }
    else if (hasNavigation) {
        output += "This appears to be a navigation flow.";
    }
    else {
        output += "This appears to be a general interaction flow.";
    }
    return output;
}
