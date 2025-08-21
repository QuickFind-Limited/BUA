// Execution Report UI Component
// Displays comprehensive execution reports with fallback indicators, 
// usage statistics, and improvement suggestions

class ExecutionReportUI {
    constructor() {
        this.currentReport = null;
        this.reportContainer = null;
        this.setupReportContainer();
    }

    /**
     * Setup the report container in the DOM
     */
    setupReportContainer() {
        // Create report container if it doesn't exist
        let container = document.getElementById('report-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'report-container';
            container.className = 'execution-report-container';
            document.body.appendChild(container);
        }
        this.reportContainer = container;
    }

    /**
     * Display execution report with comprehensive analysis
     */
    displayExecutionReport(report) {
        this.currentReport = report;
        
        if (!this.reportContainer) {
            console.error('Report container not found');
            return;
        }

        const reportHTML = this.generateReportHTML(report);
        this.reportContainer.innerHTML = reportHTML;
        
        // Add event listeners
        this.attachEventListeners();
        
        // Scroll to report
        this.reportContainer.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Generate complete HTML for execution report
     */
    generateReportHTML(report) {
        return `
            <div class="execution-report">
                ${this.generateHeader(report)}
                ${this.generateSummary(report)}
                ${this.generateSteps(report)}
                ${this.generateAnalysis(report)}
                ${this.generateScreenshots(report)}
                ${this.generateSuggestions(report)}
                ${this.generateActions(report)}
            </div>
        `;
    }

    /**
     * Generate report header
     */
    generateHeader(report) {
        const statusClass = report.overallSuccess ? 'success' : 'failed';
        const statusText = report.overallSuccess ? 'COMPLETED SUCCESSFULLY' : 'EXECUTION FAILED';
        const statusIcon = report.overallSuccess ? '✓' : '✗';

        return `
            <div class="report-header ${statusClass}">
                <div class="status-badge">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-text">${statusText}</span>
                </div>
                <div class="report-meta">
                    <div class="execution-id">ID: ${report.executionId}</div>
                    <div class="duration">Duration: ${this.formatDuration(report.totalDuration)}</div>
                </div>
            </div>
        `;
    }

    /**
     * Generate execution summary
     */
    generateSummary(report) {
        const successfulSteps = report.steps.filter(s => s.success).length;
        const successRate = report.steps.length > 0 
            ? Math.round((successfulSteps / report.steps.length) * 100) 
            : 0;

        return `
            <div class="report-summary">
                <h3>Execution Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="label">Total Steps</span>
                        <span class="value">${report.steps.length}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Success Rate</span>
                        <span class="value ${successRate >= 100 ? 'success' : successRate >= 80 ? 'warning' : 'error'}">${successRate}%</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">AI Used</span>
                        <span class="value ai-count">${report.aiUsageCount}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Snippets Used</span>
                        <span class="value snippet-count">${report.snippetUsageCount}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Fallbacks</span>
                        <span class="value fallback-count ${report.fallbackCount > 0 ? 'warning' : ''}">${report.fallbackCount}</span>
                    </div>
                </div>
                ${this.generateUsageChart(report)}
            </div>
        `;
    }

    /**
     * Generate usage chart
     */
    generateUsageChart(report) {
        const total = report.steps.length;
        if (total === 0) return '';

        const aiPercentage = (report.aiUsageCount / total) * 100;
        const snippetPercentage = (report.snippetUsageCount / total) * 100;

        return `
            <div class="usage-chart">
                <h4>Execution Path Distribution</h4>
                <div class="chart-bar">
                    <div class="ai-bar" style="width: ${aiPercentage}%" title="AI: ${report.aiUsageCount} steps (${Math.round(aiPercentage)}%)"></div>
                    <div class="snippet-bar" style="width: ${snippetPercentage}%" title="Snippets: ${report.snippetUsageCount} steps (${Math.round(snippetPercentage)}%)"></div>
                </div>
                <div class="chart-legend">
                    <span class="legend-item ai">AI Execution (${Math.round(aiPercentage)}%)</span>
                    <span class="legend-item snippet">Snippet Execution (${Math.round(snippetPercentage)}%)</span>
                </div>
            </div>
        `;
    }

    /**
     * Generate step details
     */
    generateSteps(report) {
        const stepsHTML = report.steps.map((step, index) => {
            const statusClass = step.success ? 'success' : 'failed';
            const statusIcon = step.success ? '✓' : '✗';
            const pathIcon = step.pathUsed === 'ai' ? '🤖' : '📋';
            const fallbackBadge = step.fallbackOccurred ? '<span class="fallback-badge">FALLBACK</span>' : '';

            return `
                <div class="step-item ${statusClass} ${step.fallbackOccurred ? 'fallback' : ''}">
                    <div class="step-header">
                        <span class="step-number">${index + 1}</span>
                        <span class="step-name">${step.name}</span>
                        <div class="step-badges">
                            <span class="path-badge ${step.pathUsed}" title="${step.pathUsed.toUpperCase()} execution">
                                ${pathIcon} ${step.pathUsed.toUpperCase()}
                            </span>
                            ${fallbackBadge}
                            <span class="status-badge ${statusClass}">${statusIcon}</span>
                        </div>
                    </div>
                    <div class="step-details">
                        <div class="step-meta">
                            <span class="duration">Duration: ${this.formatDuration(step.duration)}</span>
                            <span class="timestamp">${this.formatTimestamp(step.timestamp)}</span>
                        </div>
                        ${step.error ? `<div class="step-error">Error: ${step.error}</div>` : ''}
                        ${step.screenshot ? `<div class="step-screenshot">
                            <button class="screenshot-button" onclick="executionReportUI.showScreenshot('${step.screenshot}')">
                                View Screenshot
                            </button>
                        </div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="report-steps">
                <h3>Step Details</h3>
                <div class="steps-container">
                    ${stepsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Generate analysis section
     */
    generateAnalysis(report) {
        const analysisItems = [];

        // Fallback analysis
        if (report.fallbackCount > 0) {
            const fallbackRate = Math.round((report.fallbackCount / report.steps.length) * 100);
            analysisItems.push({
                type: 'warning',
                title: 'Fallback Usage Detected',
                content: `${report.fallbackCount} step(s) required fallback execution (${fallbackRate}%). This suggests opportunities for AI optimization.`
            });
        }

        // Success state analysis
        if (report.successStateMatch !== undefined) {
            if (report.successStateMatch) {
                analysisItems.push({
                    type: 'success',
                    title: 'Success State Verified',
                    content: 'Final execution state matches the expected success screenshot.'
                });
            } else {
                analysisItems.push({
                    type: 'error',
                    title: 'Success State Mismatch',
                    content: 'Final state does not match expected success screenshot. Consider reviewing the Intent Spec.'
                });
            }
        }

        // Performance analysis
        if (report.totalDuration > 60000) {
            analysisItems.push({
                type: 'info',
                title: 'Long Execution Time',
                content: `Execution took ${this.formatDuration(report.totalDuration)}. Consider optimizing selectors or wait conditions.`
            });
        }

        if (analysisItems.length === 0) {
            analysisItems.push({
                type: 'success',
                title: 'Optimal Performance',
                content: 'Execution completed efficiently with no issues detected.'
            });
        }

        const analysisHTML = analysisItems.map(item => `
            <div class="analysis-item ${item.type}">
                <div class="analysis-icon">${this.getAnalysisIcon(item.type)}</div>
                <div class="analysis-content">
                    <h4>${item.title}</h4>
                    <p>${item.content}</p>
                </div>
            </div>
        `).join('');

        return `
            <div class="report-analysis">
                <h3>Analysis</h3>
                <div class="analysis-container">
                    ${analysisHTML}
                </div>
            </div>
        `;
    }

    /**
     * Generate screenshots section
     */
    generateScreenshots(report) {
        if (!report.screenshots || report.screenshots.length === 0) {
            return '';
        }

        const screenshotsHTML = report.screenshots.map((screenshot, index) => `
            <div class="screenshot-item">
                <button class="screenshot-thumbnail" onclick="executionReportUI.showScreenshot('${screenshot}')">
                    <img src="${screenshot}" alt="Screenshot ${index + 1}" onerror="this.style.display='none'">
                    <span class="screenshot-label">Screenshot ${index + 1}</span>
                </button>
            </div>
        `).join('');

        return `
            <div class="report-screenshots">
                <h3>Screenshots</h3>
                <div class="screenshots-grid">
                    ${screenshotsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Generate suggestions section
     */
    generateSuggestions(report) {
        if (!report.suggestions || report.suggestions.length === 0) {
            return '';
        }

        const suggestionsHTML = report.suggestions.map(suggestion => `
            <li class="suggestion-item">${suggestion}</li>
        `).join('');

        return `
            <div class="report-suggestions">
                <h3>Suggestions for Improvement</h3>
                <ul class="suggestions-list">
                    ${suggestionsHTML}
                </ul>
            </div>
        `;
    }

    /**
     * Generate action buttons
     */
    generateActions(report) {
        return `
            <div class="report-actions">
                <button class="action-button primary" onclick="executionReportUI.exportReport('json')">
                    Export JSON
                </button>
                <button class="action-button secondary" onclick="executionReportUI.exportReport('csv')">
                    Export CSV
                </button>
                <button class="action-button secondary" onclick="executionReportUI.saveReport()">
                    Save Report
                </button>
                <button class="action-button secondary" onclick="executionReportUI.shareReport()">
                    Share Report
                </button>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Add click handlers for expandable sections
        const expandableHeaders = this.reportContainer.querySelectorAll('.expandable-header');
        expandableHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const content = e.target.nextElementSibling;
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
        });
    }

    /**
     * Show screenshot in modal
     */
    showScreenshot(screenshotPath) {
        const modal = document.createElement('div');
        modal.className = 'screenshot-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
                <img src="${screenshotPath}" alt="Screenshot" class="modal-screenshot">
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    }

    /**
     * Export report in specified format
     */
    exportReport(format) {
        if (!this.currentReport) {
            console.error('No report to export');
            return;
        }

        let content = '';
        let filename = '';
        let mimeType = '';

        switch (format) {
            case 'json':
                content = JSON.stringify(this.currentReport, null, 2);
                filename = `execution-report-${this.currentReport.executionId}.json`;
                mimeType = 'application/json';
                break;
            case 'csv':
                content = this.generateCSV(this.currentReport);
                filename = `execution-report-${this.currentReport.executionId}.csv`;
                mimeType = 'text/csv';
                break;
            default:
                console.error('Unsupported export format:', format);
                return;
        }

        this.downloadFile(content, filename, mimeType);
    }

    /**
     * Generate CSV content
     */
    generateCSV(report) {
        const headers = ['Step', 'Name', 'Path', 'Fallback', 'Success', 'Duration', 'Error'];
        const rows = report.steps.map(step => [
            step.stepIndex + 1,
            `"${step.name}"`,
            step.pathUsed,
            step.fallbackOccurred,
            step.success,
            step.duration,
            step.error ? `"${step.error}"` : ''
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    /**
     * Download file
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Save report to local storage or send to backend
     */
    saveReport() {
        if (!this.currentReport) return;

        // Save to localStorage for now
        const savedReports = JSON.parse(localStorage.getItem('executionReports') || '[]');
        savedReports.push({
            ...this.currentReport,
            savedAt: new Date().toISOString()
        });
        localStorage.setItem('executionReports', JSON.stringify(savedReports));

        // Show success message
        this.showMessage('Report saved successfully!', 'success');
    }

    /**
     * Share report (copy link or send via API)
     */
    shareReport() {
        if (!this.currentReport) return;

        const reportData = {
            executionId: this.currentReport.executionId,
            timestamp: new Date().toISOString(),
            summary: {
                steps: this.currentReport.steps.length,
                success: this.currentReport.overallSuccess,
                aiUsage: this.currentReport.aiUsageCount,
                fallbacks: this.currentReport.fallbackCount
            }
        };

        // Copy to clipboard
        navigator.clipboard.writeText(JSON.stringify(reportData, null, 2))
            .then(() => this.showMessage('Report summary copied to clipboard!', 'success'))
            .catch(() => this.showMessage('Failed to copy report summary', 'error'));
    }

    /**
     * Show temporary message
     */
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `report-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 4px;
            color: white;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(messageEl);
        setTimeout(() => messageEl.remove(), 3000);
    }

    /**
     * Utility functions
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    getAnalysisIcon(type) {
        const icons = {
            success: '✓',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    /**
     * Clear current report
     */
    clearReport() {
        this.currentReport = null;
        if (this.reportContainer) {
            this.reportContainer.innerHTML = '';
        }
    }

    /**
     * Get current report
     */
    getCurrentReport() {
        return this.currentReport;
    }
}

// Create global instance
window.executionReportUI = new ExecutionReportUI();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExecutionReportUI;
}