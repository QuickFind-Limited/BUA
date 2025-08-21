// Flow Executor for CUA Electron App
// Handles flow execution with variables, progress monitoring, and result display

class FlowExecutor {
    constructor() {
        this.currentExecution = null;
        this.progressCallback = null;
        this.completeCallback = null;
        this.setupIpcListeners();
    }

    setupIpcListeners() {
        if (window.electronAPI) {
            // Listen for flow progress updates
            window.electronAPI.onFlowProgress && window.electronAPI.onFlowProgress((progress) => {
                this.handleProgressUpdate(progress);
            });

            // Listen for flow completion
            window.electronAPI.onFlowComplete && window.electronAPI.onFlowComplete((result) => {
                this.handleExecutionComplete(result);
            });
        }
    }

    /**
     * Execute a flow with the provided variables
     * @param {Object} flowSpec - The flow specification
     * @param {Object} variables - Variable values to substitute
     * @param {Function} progressCallback - Called on progress updates
     * @param {Function} completeCallback - Called on completion
     */
    async executeFlow(flowSpec, variables, progressCallback, completeCallback) {
        this.progressCallback = progressCallback;
        this.completeCallback = completeCallback;

        // Validate inputs
        if (!flowSpec) {
            const error = { success: false, error: 'No flow specification provided' };
            this.handleExecutionComplete(error);
            return;
        }

        // Prepare execution data
        const executionData = {
            id: this.generateExecutionId(),
            flowSpec: flowSpec,
            variables: variables || {},
            startTime: Date.now(),
            status: 'starting'
        };

        this.currentExecution = executionData;

        try {
            // Validate flow specification
            this.validateFlowSpec(flowSpec);

            // Substitute variables in the flow
            const executableFlow = this.prepareExecutableFlow(flowSpec, variables);

            // Send to main process for execution
            if (window.electronAPI && window.electronAPI.executeFlow) {
                const result = await window.electronAPI.executeFlow(executableFlow, variables);
                
                if (!result.success) {
                    throw new Error(result.error || 'Flow execution failed');
                }

                // Handle immediate success (for non-streaming executions)
                if (result.data && result.data.completed) {
                    this.handleExecutionComplete({
                        success: true,
                        executionId: executionData.id,
                        result: result.data
                    });
                }
            } else {
                // Fallback simulation for testing
                this.simulateExecution(executableFlow, variables);
            }

        } catch (error) {
            console.error('Flow execution error:', error);
            this.handleExecutionComplete({
                success: false,
                executionId: executionData.id,
                error: error.message || 'Unknown execution error'
            });
        }
    }

    /**
     * Validate flow specification structure
     */
    validateFlowSpec(flowSpec) {
        if (!flowSpec.steps || !Array.isArray(flowSpec.steps)) {
            throw new Error('Flow must have a valid steps array');
        }

        if (flowSpec.steps.length === 0) {
            throw new Error('Flow must have at least one step');
        }

        // Validate each step
        flowSpec.steps.forEach((step, index) => {
            if (!step.action) {
                throw new Error(`Step ${index + 1} must have an action`);
            }
        });
    }

    /**
     * Prepare flow for execution by substituting variables
     */
    prepareExecutableFlow(flowSpec, variables) {
        // Deep clone the flow to avoid modifying the original
        const executableFlow = JSON.parse(JSON.stringify(flowSpec));

        // Substitute variables in all string properties
        this.substituteVariablesInObject(executableFlow, variables);

        return executableFlow;
    }

    /**
     * Recursively substitute variables in an object
     */
    substituteVariablesInObject(obj, variables) {
        if (typeof obj === 'string') {
            return this.substituteVariables(obj, variables);
        }

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                obj[i] = this.substituteVariablesInObject(obj[i], variables);
            }
        } else if (obj && typeof obj === 'object') {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    obj[key] = this.substituteVariablesInObject(obj[key], variables);
                }
            }
        }

        return obj;
    }

    /**
     * Substitute variables in a string using {{variable}} syntax
     */
    substituteVariables(text, variables) {
        if (typeof text !== 'string') return text;

        let result = text;
        for (const [key, value] of Object.entries(variables || {})) {
            const pattern = new RegExp(`\\{\\{${this.escapeRegex(key)}\\}\\}`, 'g');
            result = result.replace(pattern, String(value || ''));
        }

        return result;
    }

    /**
     * Escape special regex characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Handle progress updates from the main process
     */
    handleProgressUpdate(progress) {
        if (this.currentExecution) {
            this.currentExecution.progress = progress;
        }

        if (this.progressCallback) {
            this.progressCallback(progress);
        }

        console.log('Flow execution progress:', progress);
    }

    /**
     * Handle execution completion
     */
    handleExecutionComplete(result) {
        if (this.currentExecution) {
            this.currentExecution.status = result.success ? 'completed' : 'failed';
            this.currentExecution.endTime = Date.now();
            this.currentExecution.result = result;
        }

        if (this.completeCallback) {
            this.completeCallback(result);
        }

        console.log('Flow execution completed:', result);

        // Clean up
        this.currentExecution = null;
        this.progressCallback = null;
        this.completeCallback = null;
    }

    /**
     * Simulate flow execution for testing/demo purposes
     */
    simulateExecution(flowSpec, variables) {
        const steps = flowSpec.steps || [];
        let currentStep = 0;

        const simulateStep = () => {
            if (currentStep >= steps.length) {
                // Execution complete
                this.handleExecutionComplete({
                    success: true,
                    executionId: this.currentExecution.id,
                    message: `Flow completed successfully! Executed ${steps.length} steps.`,
                    result: {
                        stepsExecuted: steps.length,
                        variables: variables,
                        simulatedExecution: true
                    }
                });
                return;
            }

            const step = steps[currentStep];
            const progress = {
                currentStep: currentStep + 1,
                totalSteps: steps.length,
                stepAction: step.action,
                description: this.getStepDescription(step),
                progress: ((currentStep + 1) / steps.length) * 100
            };

            this.handleProgressUpdate(progress);

            currentStep++;

            // Simulate step execution time
            setTimeout(simulateStep, 800 + Math.random() * 1200);
        };

        // Start simulation
        setTimeout(simulateStep, 500);
    }

    /**
     * Get a human-readable description for a step
     */
    getStepDescription(step) {
        const actionDescriptions = {
            'click': 'Clicking element',
            'type': 'Typing text',
            'navigate': 'Navigating to page',
            'wait': 'Waiting',
            'scroll': 'Scrolling page',
            'hover': 'Hovering over element',
            'select': 'Selecting option',
            'submit': 'Submitting form',
            'screenshot': 'Taking screenshot'
        };

        const baseDescription = actionDescriptions[step.action] || `Executing ${step.action}`;
        
        if (step.target) {
            return `${baseDescription}: ${step.target}`;
        }

        return baseDescription;
    }

    /**
     * Generate a unique execution ID
     */
    generateExecutionId() {
        return 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get current execution status
     */
    getCurrentExecution() {
        return this.currentExecution;
    }

    /**
     * Cancel current execution (if supported)
     */
    cancelExecution() {
        if (this.currentExecution && window.electronAPI && window.electronAPI.cancelFlowExecution) {
            window.electronAPI.cancelFlowExecution(this.currentExecution.id);
        }

        this.handleExecutionComplete({
            success: false,
            executionId: this.currentExecution?.id,
            error: 'Execution cancelled by user'
        });
    }
}

// Create global instance
window.flowExecutor = new FlowExecutor();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlowExecutor;
}