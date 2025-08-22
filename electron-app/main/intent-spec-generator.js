"use strict";
/**
 * Intent Spec Generator - Generates Intent Specifications leveraging rich recording data
 * including multiple selectors, DOM snapshots, timing, and 40+ event types
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentSpecGenerator = void 0;
exports.generateIntentSpecFromRecording = generateIntentSpecFromRecording;
exports.generateIntentSpecFromRichRecording = generateIntentSpecFromRichRecording;
var enhanced_intent_spec_prompt_1 = require("./enhanced-intent-spec-prompt");
var fs_1 = require("fs");
var path_1 = require("path");
/**
 * Generates Intent Specifications from Playwright recordings with dual AI/snippet paths
 */
var IntentSpecGenerator = /** @class */ (function () {
    function IntentSpecGenerator() {
    }
    /**
     * Generates an Intent Spec from a Playwright recording file
     * @param recordingPath Path to the recording.spec.ts file
     * @param options Generation options for preferences and fallbacks
     * @returns Complete Intent Spec with both AI and snippet paths
     */
    IntentSpecGenerator.prototype.generateFromRecording = function (recordingPath, options) {
        if (options === void 0) { options = {
            withFallback: true,
            preferSnippetFor: ['dynamic_elements', 'form_interactions'],
            preferAIFor: ['simple_steps', 'navigation'],
            defaultPreference: 'ai'
        }; }
        // Parse the recording file
        var recording = this.parseRecordingFile(recordingPath);
        // Extract basic metadata
        var metadata = this.extractMetadata(recording, recordingPath);
        // Generate steps with both AI and snippet paths
        var steps = this.generateSteps(recording, options);
        // Extract parameters from the steps
        var params = this.extractParameters(steps);
        // Build preferences based on options and step analysis
        var preferences = this.buildPreferences(steps, options);
        // Generate the complete Intent Spec
        var intentSpec = {
            name: metadata.name,
            description: metadata.description,
            url: metadata.url,
            params: params,
            steps: steps,
            preferences: preferences,
            success_screenshot: metadata.successScreenshot,
            recording_spec: recordingPath
        };
        return intentSpec;
    };
    /**
     * Parses a Playwright recording file and extracts the steps
     * @param recordingPath Path to the recording file
     * @returns Array of recording steps
     */
    IntentSpecGenerator.prototype.parseRecordingFile = function (recordingPath) {
        try {
            var content = fs_1.default.readFileSync(recordingPath, 'utf-8');
            // Parse the Playwright test file to extract actions
            var steps_1 = [];
            // Extract page.goto() calls
            var gotoMatches = content.match(/page\.goto\(['"`]([^'"`]+)['"`]\)/g);
            if (gotoMatches) {
                gotoMatches.forEach(function (match, index) {
                    var _a;
                    var url = (_a = match.match(/['"`]([^'"`]+)['"`]/)) === null || _a === void 0 ? void 0 : _a[1];
                    if (url) {
                        steps_1.push({
                            type: 'navigate',
                            url: url,
                            description: "Navigate to ".concat(url)
                        });
                    }
                });
            }
            // Extract page.click() calls
            var clickMatches = content.match(/page\.click\(['"`]([^'"`]+)['"`]\)/g);
            if (clickMatches) {
                clickMatches.forEach(function (match) {
                    var _a;
                    var selector = (_a = match.match(/['"`]([^'"`]+)['"`]/)) === null || _a === void 0 ? void 0 : _a[1];
                    if (selector) {
                        steps_1.push({
                            type: 'click',
                            selector: selector,
                            description: "Click on element with selector ".concat(selector),
                            target: { selector: selector }
                        });
                    }
                });
            }
            // Extract page.fill() calls
            var fillMatches = content.match(/page\.fill\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]*)['"`]\)/g);
            if (fillMatches) {
                fillMatches.forEach(function (match) {
                    var parts = match.match(/page\.fill\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]*)['"`]\)/);
                    if (parts) {
                        var selector = parts[1];
                        var value = parts[2];
                        steps_1.push({
                            type: 'fill',
                            selector: selector,
                            value: value,
                            description: "Fill field ".concat(selector, " with value"),
                            target: { selector: selector }
                        });
                    }
                });
            }
            // Extract page.selectOption() calls
            var selectMatches = content.match(/page\.selectOption\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]*)['"`]\)/g);
            if (selectMatches) {
                selectMatches.forEach(function (match) {
                    var parts = match.match(/page\.selectOption\(['"`]([^'"`]+)['"`],\s*['"`]([^'"`]*)['"`]\)/);
                    if (parts) {
                        var selector = parts[1];
                        var value = parts[2];
                        steps_1.push({
                            type: 'select',
                            selector: selector,
                            value: value,
                            description: "Select option ".concat(value, " from ").concat(selector),
                            target: { selector: selector }
                        });
                    }
                });
            }
            // Extract page.waitForSelector() calls
            var waitMatches = content.match(/page\.waitForSelector\(['"`]([^'"`]+)['"`]\)/g);
            if (waitMatches) {
                waitMatches.forEach(function (match) {
                    var _a;
                    var selector = (_a = match.match(/['"`]([^'"`]+)['"`]/)) === null || _a === void 0 ? void 0 : _a[1];
                    if (selector) {
                        steps_1.push({
                            type: 'wait',
                            selector: selector,
                            description: "Wait for element ".concat(selector, " to appear"),
                            target: { selector: selector }
                        });
                    }
                });
            }
            return steps_1;
        }
        catch (error) {
            console.error('Error parsing recording file:', error);
            return [];
        }
    };
    /**
     * Extracts metadata from the recording
     * @param recording Array of recording steps
     * @param recordingPath Path to the recording file
     * @returns Metadata object
     */
    IntentSpecGenerator.prototype.extractMetadata = function (recording, recordingPath) {
        var filename = path_1.default.basename(recordingPath, '.spec.ts');
        var firstNavigateStep = recording.find(function (step) { return step.type === 'navigate'; });
        return {
            name: this.generateFlowName(recording, filename),
            description: this.generateFlowDescription(recording),
            url: (firstNavigateStep === null || firstNavigateStep === void 0 ? void 0 : firstNavigateStep.url) || 'https://example.com',
            successScreenshot: this.findSuccessScreenshot(recordingPath)
        };
    };
    /**
     * Generates steps with both AI instructions and Playwright snippets
     * @param recording Array of recording steps
     * @param options Generation options
     * @returns Array of Intent Steps with dual paths
     */
    IntentSpecGenerator.prototype.generateSteps = function (recording, options) {
        var _this = this;
        return recording.map(function (step, index) {
            var _a;
            var stepName = "step_".concat(index + 1, "_").concat(step.type);
            var aiInstruction = _this.generateAIInstruction(step);
            var snippet = _this.generatePlaywrightSnippet(step);
            var preference = _this.determineStepPreference(step, options);
            return {
                name: stepName,
                ai_instruction: aiInstruction,
                snippet: snippet,
                prefer: preference,
                fallback: options.withFallback ? (preference === 'ai' ? 'snippet' : 'ai') : 'none',
                selector: step.selector || ((_a = step.target) === null || _a === void 0 ? void 0 : _a.selector),
                value: _this.parameterizeValue(step.value),
                // Legacy fields for backward compatibility
                action: step.type,
                description: step.description
            };
        });
    };
    /**
     * Generates AI instruction from a recording step
     * @param step Recording step
     * @returns Human-readable AI instruction
     */
    IntentSpecGenerator.prototype.generateAIInstruction = function (step) {
        var _a, _b;
        switch (step.type) {
            case 'navigate':
                return "Navigate to the URL: ".concat(step.url);
            case 'click':
                if ((_a = step.target) === null || _a === void 0 ? void 0 : _a.text) {
                    return "Click on the element containing text \"".concat(step.target.text, "\"");
                }
                return "Click on the element located by selector \"".concat(step.selector, "\"");
            case 'fill':
                if ((_b = step.target) === null || _b === void 0 ? void 0 : _b.placeholder) {
                    return "Fill the input field with placeholder \"".concat(step.target.placeholder, "\" with the value");
                }
                return "Enter text into the input field located by selector \"".concat(step.selector, "\"");
            case 'select':
                return "Select the option \"".concat(step.value, "\" from the dropdown located by selector \"").concat(step.selector, "\"");
            case 'wait':
                return "Wait for the element with selector \"".concat(step.selector, "\" to become visible");
            default:
                return "Perform ".concat(step.type, " action on element with selector \"").concat(step.selector, "\"");
        }
    };
    /**
     * Generates Playwright code snippet from a recording step
     * @param step Recording step
     * @returns Playwright code snippet
     */
    IntentSpecGenerator.prototype.generatePlaywrightSnippet = function (step) {
        switch (step.type) {
            case 'navigate':
                return "await page.goto('".concat(step.url, "');");
            case 'click':
                return "await page.click('".concat(step.selector, "');");
            case 'fill':
                var value = this.parameterizeValue(step.value);
                return "await page.fill('".concat(step.selector, "', '").concat(value, "');");
            case 'select':
                return "await page.selectOption('".concat(step.selector, "', '").concat(step.value, "');");
            case 'wait':
                return "await page.waitForSelector('".concat(step.selector, "');");
            default:
                return "await page.".concat(step.type, "('").concat(step.selector, "');");
        }
    };
    /**
     * Determines whether to prefer AI or snippet for a specific step
     * @param step Recording step
     * @param options Generation options
     * @returns Preference setting
     */
    IntentSpecGenerator.prototype.determineStepPreference = function (step, options) {
        var _a, _b;
        // Check if step type is in explicit preference lists
        if (options.preferSnippetFor.includes(step.type)) {
            return 'snippet';
        }
        if (options.preferAIFor.includes(step.type)) {
            return 'ai';
        }
        // Apply heuristics based on step characteristics
        switch (step.type) {
            case 'navigate':
                return 'snippet'; // URLs are deterministic
            case 'click':
                // Prefer AI for dynamic elements with text, snippet for stable selectors
                if (((_a = step.target) === null || _a === void 0 ? void 0 : _a.text) && !((_b = step.selector) === null || _b === void 0 ? void 0 : _b.includes('#'))) {
                    return 'ai';
                }
                return 'snippet';
            case 'fill':
                // Prefer snippet for form fields with stable selectors
                return 'snippet';
            case 'select':
                return 'snippet';
            case 'wait':
                return 'snippet';
            default:
                return options.defaultPreference;
        }
    };
    /**
     * Extracts parameters from step values
     * @param steps Array of Intent Steps
     * @returns Array of parameter names
     */
    IntentSpecGenerator.prototype.extractParameters = function (steps) {
        var params = new Set();
        var paramRegex = /\{\{([^}]+)\}\}/g;
        steps.forEach(function (step) {
            if (step.value) {
                var match = void 0;
                while ((match = paramRegex.exec(step.value)) !== null) {
                    params.add(match[1].trim());
                }
            }
        });
        return Array.from(params);
    };
    /**
     * Parameterizes step values using UI-compatible variable names
     * @param value Original value
     * @param fieldContext Additional context about the field
     * @returns Parameterized value with {{VARIABLE}} syntax
     */
    IntentSpecGenerator.prototype.parameterizeValue = function (value, fieldContext) {
        if (!value)
            return '';
        // Check field context for hints (if available)
        if (fieldContext) {
            var fieldName = (fieldContext.name || fieldContext.id || '').toLowerCase();
            var fieldType = (fieldContext.type || '').toLowerCase();
            var placeholder = (fieldContext.placeholder || '').toLowerCase();
            // Password fields
            if (fieldType === 'password' || fieldName.includes('password') || fieldName.includes('pass')) {
                return '{{PASSWORD}}';
            }
            // Email fields
            if (fieldType === 'email' || fieldName.includes('email') || placeholder.includes('email')) {
                return '{{EMAIL_ADDRESS}}';
            }
            // Username fields
            if (fieldName.includes('username') || fieldName.includes('user') || placeholder.includes('username')) {
                return '{{USERNAME}}';
            }
            // Phone fields
            if (fieldType === 'tel' || fieldName.includes('phone') || fieldName.includes('tel')) {
                return '{{PHONE_NUMBER}}';
            }
            // Name fields
            if (fieldName.includes('firstname') || fieldName.includes('first_name')) {
                return '{{FIRST_NAME}}';
            }
            if (fieldName.includes('lastname') || fieldName.includes('last_name')) {
                return '{{LAST_NAME}}';
            }
            // Company fields
            if (fieldName.includes('company') || fieldName.includes('organization')) {
                return '{{COMPANY_NAME}}';
            }
            // Department fields
            if (fieldName.includes('department') || fieldName.includes('dept')) {
                return '{{DEPARTMENT}}';
            }
            // Search fields
            if (fieldName.includes('search') || fieldName.includes('query')) {
                return '{{SEARCH_QUERY}}';
            }
        }
        // Pattern-based detection for UI-compatible variable names
        var patterns = {
            '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$': '{{EMAIL_ADDRESS}}',
            '^[\\w\\s]{2,50}$': '{{USERNAME}}',
            '^.{8,}$': '{{PASSWORD}}', // Only if looks like password
            '^\\d{10,15}$': '{{PHONE_NUMBER}}',
            '^\\d{4}-\\d{2}-\\d{2}$': '{{DATE}}',
            '^\\d+\\.?\\d*$': '{{AMOUNT}}',
            '^\\d{5,10}$': '{{EMPLOYEE_ID}}',
            '^[A-Z]{2,}-\\d{4,}$': '{{ORDER_ID}}',
            '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$': '{{TRANSACTION_ID}}'
        };
        for (var _i = 0, _a = Object.entries(patterns); _i < _a.length; _i++) {
            var _b = _a[_i], pattern = _b[0], variable = _b[1];
            if (new RegExp(pattern).test(value)) {
                return variable;
            }
        }
        // If value looks like it should be parameterized but doesn't match patterns
        if (value.length > 3 && !/^(submit|login|search|ok|cancel|yes|no|continue|next|back)$/i.test(value)) {
            // Generate UI-compatible variable name
            var varName = value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
            return "{{".concat(varName, "}}");
        }
        return value;
    };
    /**
     * Builds preferences object based on step analysis and options
     * @param steps Array of Intent Steps
     * @param options Generation options
     * @returns Preferences object
     */
    IntentSpecGenerator.prototype.buildPreferences = function (steps, options) {
        // Analyze steps to determine preferences
        var hasDynamicElements = steps.some(function (step) {
            return step.prefer === 'ai' && step.ai_instruction.includes('text');
        });
        var hasSimpleSteps = steps.some(function (step) {
            return ['navigate', 'wait'].includes(step.action || '');
        });
        return {
            dynamic_elements: hasDynamicElements ? 'ai' : 'snippet',
            simple_steps: hasSimpleSteps ? 'snippet' : 'ai'
        };
    };
    /**
     * Generates a descriptive name for the flow
     * @param recording Array of recording steps
     * @param filename Original filename
     * @returns Generated flow name
     */
    IntentSpecGenerator.prototype.generateFlowName = function (recording, filename) {
        var actions = recording.map(function (step) { return step.type; });
        if (actions.includes('fill') && actions.includes('click')) {
            return "".concat(filename, " Form Submission Flow");
        }
        else if (actions.includes('navigate')) {
            return "".concat(filename, " Navigation Flow");
        }
        else {
            return "".concat(filename, " Interaction Flow");
        }
    };
    /**
     * Generates a description for the flow
     * @param recording Array of recording steps
     * @returns Generated flow description
     */
    IntentSpecGenerator.prototype.generateFlowDescription = function (recording) {
        var stepTypes = __spreadArray([], new Set(recording.map(function (step) { return step.type; })), true);
        var actionCount = recording.length;
        return "Automated flow with ".concat(actionCount, " steps including: ").concat(stepTypes.join(', '), ". ") +
            "This flow captures user interactions and provides both AI-guided and snippet-based execution paths.";
    };
    /**
     * Finds associated success screenshot file
     * @param recordingPath Path to the recording file
     * @returns Path to success screenshot if found
     */
    IntentSpecGenerator.prototype.findSuccessScreenshot = function (recordingPath) {
        var dir = path_1.default.dirname(recordingPath);
        var basename = path_1.default.basename(recordingPath, '.spec.ts');
        var possibleScreenshots = [
            path_1.default.join(dir, "".concat(basename, "-success.png")),
            path_1.default.join(dir, "".concat(basename, "-final.png")),
            path_1.default.join(dir, 'screenshots', "".concat(basename, "-success.png"))
        ];
        for (var _i = 0, possibleScreenshots_1 = possibleScreenshots; _i < possibleScreenshots_1.length; _i++) {
            var screenshot = possibleScreenshots_1[_i];
            if (fs_1.default.existsSync(screenshot)) {
                return screenshot;
            }
        }
        return undefined;
    };
    /**
     * Process rich recording data with multiple selectors and DOM snapshots
     * @param recordingData Rich recording data from enhanced system
     * @returns Processed recording with resilient selectors
     */
    IntentSpecGenerator.prototype.processRichRecordingData = function (recordingData) {
        var _a, _b, _c;
        var processedSteps = [];
        // Handle both 'actions' and 'events' structure
        var actions = recordingData.actions || [];
        if (actions.length === 0 && recordingData.events) {
            // Extract actions from events structure
            actions = recordingData.events
                .filter(function(e) { return e.type === 'action'; })
                .map(function(e) { return e.data; });
        }
        for (var _i = 0, _d = actions; _i < _d.length; _i++) {
            var action = _d[_i];
            var step = {
                type: action.action || action.type,
                timestamp: action.timestamp,
                url: action.url,
                tabId: action.tabId
            };
            // Extract multiple selectors if available
            if (action.selectors && Array.isArray(action.selectors)) {
                step.selector = action.selectors[0]; // Primary selector
                step.alternativeSelectors = action.selectors.slice(1); // All alternatives
            }
            else if (action.selector) {
                step.selector = action.selector;
            }
            // Extract element info for context
            if (action.elementInfo) {
                step.target = {
                    selector: step.selector,
                    text: action.elementInfo.text,
                    placeholder: action.elementInfo.placeholder,
                    tagName: action.elementInfo.tag,
                    attributes: action.elementInfo.attributes || {},
                    name: (_a = action.elementInfo.attributes) === null || _a === void 0 ? void 0 : _a.name,
                    id: (_b = action.elementInfo.attributes) === null || _b === void 0 ? void 0 : _b.id,
                    type: (_c = action.elementInfo.attributes) === null || _c === void 0 ? void 0 : _c.type
                };
            }
            // Extract typed values for parameterization
            if (action.value !== undefined) {
                step.value = action.value;
            }
            // Add timing information
            if (action.timeSinceLastAction) {
                step.waitBefore = Math.min(action.timeSinceLastAction, 5000); // Cap at 5 seconds
            }
            // Store DOM snapshot reference
            if (action.dom_snapshot) {
                step.domSnapshotAvailable = true;
            }
            processedSteps.push(step);
        }
        return {
            steps: processedSteps,
            metadata: recordingData.metadata || {},
            domSnapshots: recordingData.domSnapshots || [],
            performanceMetrics: recordingData.performanceMetrics || {}
        };
    };
    return IntentSpecGenerator;
}());
exports.IntentSpecGenerator = IntentSpecGenerator;
/**
 * Convenience function to generate Intent Spec from recording
 * @param recordingPath Path to recording file
 * @param options Generation options
 * @returns Generated Intent Spec
 */
function generateIntentSpecFromRecording(recordingPath, options) {
    var generator = new IntentSpecGenerator();
    var fullOptions = __assign({ withFallback: true, preferSnippetFor: ['dynamic_elements', 'form_interactions'], preferAIFor: ['simple_steps', 'navigation'], defaultPreference: 'ai' }, options);
    return generator.generateFromRecording(recordingPath, fullOptions);
}
/**
 * Generate Intent Spec from rich recording data (enhanced system)
 * @param recordingData Rich recording data with multiple selectors
 * @param options Generation options
 * @returns Generated Intent Spec with resilient automation
 */
function generateIntentSpecFromRichRecording(recordingData, options) {
    var _a;
    var generator = new IntentSpecGenerator();
    // Process the rich recording data
    var processed = generator['processRichRecordingData'](recordingData);
    // Use enhanced prompt for generation
    var serialized = JSON.stringify(processed, null, 2);
    var enhancedPrompt = (0, enhanced_intent_spec_prompt_1.generateEnhancedIntentSpecPrompt)(serialized);
    // Generate the Intent Spec (would normally call Claude here)
    console.log('Enhanced prompt generated for rich recording data');
    // For now, return a structured Intent Spec based on the data
    var steps = generator['generateSteps'](processed.steps, __assign({ withFallback: true, preferSnippetFor: ['form_interactions'], preferAIFor: ['validation'], defaultPreference: 'snippet' }, options));
    var params = generator['extractParameters'](steps);
    // Try to get URL from first navigation or action
    var startUrl = ((_a = processed.steps[0]) === null || _a === void 0 ? void 0 : _a.url) || '';
    if (!startUrl && recordingData.events) {
        // Find first URL from events
        var firstUrlEvent = recordingData.events.find(function(e) { 
            return e.data && e.data.url; 
        });
        if (firstUrlEvent) {
            startUrl = firstUrlEvent.data.url;
        }
    }
    return {
        name: recordingData.name || 'Enhanced Recording Flow',
        description: 'Generated from rich recording with multiple selectors and DOM snapshots',
        url: startUrl,
        params: params,
        steps: steps,
        preferences: {
            dynamic_elements: 'snippet',
            simple_steps: 'snippet'
        }
    };
}
