// Error Recovery Settings JavaScript
class ErrorRecoverySettingsManager {
    constructor() {
        this.settings = {
            enabled: true,
            complexityThreshold: 5,
            retryLimit: 3,
            timeout: 30000,
            enableAuditLog: true,
            autoExportSettings: false
        };
        
        this.statistics = {
            totalAttempts: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0,
            averageResponseTime: 0
        };
        
        this.auditLogs = [];
        this.loading = false;
        
        this.initialize();
    }
    
    async initialize() {
        try {
            this.setupEventListeners();
            await this.loadSettings();
            await this.loadStatistics();
            await this.loadAuditLogs();
            this.updateUI();
            console.log('Error Recovery Settings initialized');
        } catch (error) {
            console.error('Failed to initialize settings:', error);
            this.showMessage('error', 'Failed to initialize settings');
        }
    }
    
    setupEventListeners() {
        // Complexity threshold slider
        const complexitySlider = document.getElementById('complexityThreshold');
        const complexityValue = document.getElementById('complexityValue');
        const complexityText = document.getElementById('complexityText');
        
        complexitySlider.addEventListener('input', (e) => {
            const value = e.target.value;
            complexityValue.textContent = value;
            complexityText.textContent = value;
            this.settings.complexityThreshold = parseInt(value);
        });
        
        // Other input listeners
        document.getElementById('enabled').addEventListener('change', (e) => {
            this.settings.enabled = e.target.checked;
            this.updateInputStates();
        });
        
        document.getElementById('retryLimit').addEventListener('change', (e) => {
            this.settings.retryLimit = parseInt(e.target.value);
        });
        
        document.getElementById('timeout').addEventListener('change', (e) => {
            this.settings.timeout = parseInt(e.target.value);
        });
        
        document.getElementById('enableAuditLog').addEventListener('change', (e) => {
            this.settings.enableAuditLog = e.target.checked;
            this.updateAuditLogVisibility();
        });
        
        document.getElementById('autoExportSettings').addEventListener('change', (e) => {
            this.settings.autoExportSettings = e.target.checked;
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveSettings();
            }
        });
    }
    
    async loadSettings() {
        try {
            if (window.electronAPI && window.electronAPI.settings) {
                const result = await window.electronAPI.settings.get();
                if (result.success) {
                    this.settings = { ...this.settings, ...result.data };
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showMessage('error', 'Failed to load settings');
        }
    }
    
    async loadStatistics() {
        try {
            if (window.electronAPI && window.electronAPI.settings) {
                const result = await window.electronAPI.settings.getStatistics();
                if (result.success) {
                    this.statistics = { ...this.statistics, ...result.data };
                }
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }
    
    async loadAuditLogs() {
        try {
            if (window.electronAPI && window.electronAPI.settings) {
                const result = await window.electronAPI.settings.getAuditLogs();
                if (result.success) {
                    this.auditLogs = result.data || [];
                }
            }
        } catch (error) {
            console.error('Error loading audit logs:', error);
        }
    }
    
    updateUI() {
        // Update form inputs
        document.getElementById('enabled').checked = this.settings.enabled;
        document.getElementById('complexityThreshold').value = this.settings.complexityThreshold;
        document.getElementById('complexityValue').textContent = this.settings.complexityThreshold;
        document.getElementById('complexityText').textContent = this.settings.complexityThreshold;
        document.getElementById('retryLimit').value = this.settings.retryLimit;
        document.getElementById('timeout').value = this.settings.timeout;
        document.getElementById('enableAuditLog').checked = this.settings.enableAuditLog;
        document.getElementById('autoExportSettings').checked = this.settings.autoExportSettings;
        
        // Update statistics
        document.getElementById('totalAttempts').textContent = this.statistics.totalAttempts;
        document.getElementById('successfulRecoveries').textContent = this.statistics.successfulRecoveries;
        document.getElementById('failedRecoveries').textContent = this.statistics.failedRecoveries;
        
        const successRate = this.statistics.totalAttempts > 0 
            ? ((this.statistics.successfulRecoveries / this.statistics.totalAttempts) * 100).toFixed(1)
            : '0';
        document.getElementById('successRate').textContent = successRate + '%';
        document.getElementById('averageResponseTime').textContent = this.statistics.averageResponseTime + 'ms';
        
        if (this.statistics.lastRecoveryTime) {
            const lastRecoveryCard = document.getElementById('lastRecoveryCard');
            const lastRecoveryTime = document.getElementById('lastRecoveryTime');
            lastRecoveryCard.style.display = 'block';
            lastRecoveryTime.textContent = new Date(this.statistics.lastRecoveryTime).toLocaleDateString();
        }
        
        // Update input states
        this.updateInputStates();
        
        // Update audit log visibility
        this.updateAuditLogVisibility();
        
        // Update audit logs
        this.updateAuditLogsDisplay();
    }
    
    updateInputStates() {
        const enabled = this.settings.enabled;
        const elements = [
            'complexityThreshold',
            'retryLimit', 
            'timeout'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = !enabled;
            }
        });
    }
    
    updateAuditLogVisibility() {
        const auditLogsSection = document.getElementById('auditLogsSection');
        auditLogsSection.style.display = this.settings.enableAuditLog ? 'block' : 'none';
    }
    
    updateAuditLogsDisplay() {
        const noLogs = document.getElementById('noLogs');
        const logsContainer = document.getElementById('logsContainer');
        
        if (this.auditLogs.length === 0) {
            noLogs.style.display = 'block';
            logsContainer.style.display = 'none';
        } else {
            noLogs.style.display = 'none';
            logsContainer.style.display = 'block';
            
            // Display last 50 logs, newest first
            const recentLogs = this.auditLogs.slice(-50).reverse();
            logsContainer.innerHTML = recentLogs.map(log => {
                const date = new Date(log.timestamp);
                return `
                    <div class="log-entry ${log.success ? 'success' : 'error'}">
                        <div class="log-timestamp">${date.toLocaleString()}</div>
                        <div class="log-action">${this.escapeHtml(log.action)}</div>
                        <div class="log-details">${this.escapeHtml(log.details)}</div>
                    </div>
                `;
            }).join('');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setLoading(loading) {
        this.loading = loading;
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = loading ? 'flex' : 'none';
        
        // Disable buttons during loading
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => {
            btn.disabled = loading;
        });
    }
    
    showMessage(type, text) {
        const container = document.getElementById('message-container');
        const message = document.getElementById('message');
        
        message.className = `message message-${type}`;
        message.textContent = text;
        container.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    }
    
    async saveSettings() {
        try {
            this.setLoading(true);
            
            if (window.electronAPI && window.electronAPI.settings) {
                const result = await window.electronAPI.settings.save(this.settings);
                if (result.success) {
                    this.showMessage('success', 'Settings saved successfully');
                } else {
                    this.showMessage('error', result.error || 'Failed to save settings');
                }
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('error', 'Failed to save settings');
        } finally {
            this.setLoading(false);
        }
    }
    
    async clearCache() {
        try {
            this.setLoading(true);
            
            if (window.electronAPI && window.electronAPI.settings) {
                const result = await window.electronAPI.settings.clearCache();
                if (result.success) {
                    this.showMessage('success', 'Solution cache cleared successfully');
                } else {
                    this.showMessage('error', result.error || 'Failed to clear cache');
                }
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showMessage('error', 'Failed to clear cache');
        } finally {
            this.setLoading(false);
        }
    }
    
    async exportSettings() {
        try {
            this.setLoading(true);
            
            if (window.electronAPI && window.electronAPI.settings) {
                const result = await window.electronAPI.settings.export();
                if (result.success) {
                    this.showMessage('success', `Settings exported to ${result.filePath}`);
                } else {
                    this.showMessage('error', result.error || 'Failed to export settings');
                }
            }
        } catch (error) {
            console.error('Error exporting settings:', error);
            this.showMessage('error', 'Failed to export settings');
        } finally {
            this.setLoading(false);
        }
    }
    
    async importSettings() {
        try {
            this.setLoading(true);
            
            if (window.electronAPI && window.electronAPI.settings) {
                const result = await window.electronAPI.settings.import();
                if (result.success) {
                    this.settings = { ...this.settings, ...result.data };
                    this.updateUI();
                    this.showMessage('success', 'Settings imported successfully');
                } else {
                    this.showMessage('error', result.error || 'Failed to import settings');
                }
            }
        } catch (error) {
            console.error('Error importing settings:', error);
            this.showMessage('error', 'Failed to import settings');
        } finally {
            this.setLoading(false);
        }
    }
    
    async clearAuditLogs() {
        try {
            this.setLoading(true);
            
            if (window.electronAPI && window.electronAPI.settings) {
                const result = await window.electronAPI.settings.clearAuditLogs();
                if (result.success) {
                    this.auditLogs = [];
                    this.updateAuditLogsDisplay();
                    this.showMessage('success', 'Audit logs cleared successfully');
                } else {
                    this.showMessage('error', result.error || 'Failed to clear audit logs');
                }
            }
        } catch (error) {
            console.error('Error clearing audit logs:', error);
            this.showMessage('error', 'Failed to clear audit logs');
        } finally {
            this.setLoading(false);
        }
    }
}

// Global functions for HTML onclick handlers
function toggleAdvancedSettings() {
    const settings = document.getElementById('advancedSettings');
    const chevron = document.getElementById('advancedChevron');
    
    if (settings.style.display === 'none') {
        settings.style.display = 'block';
        chevron.textContent = '▼';
        chevron.classList.add('expanded');
    } else {
        settings.style.display = 'none';
        chevron.textContent = '▶';
        chevron.classList.remove('expanded');
    }
}

function saveSettings() {
    if (window.settingsManager) {
        window.settingsManager.saveSettings();
    }
}

function clearCache() {
    if (window.settingsManager) {
        window.settingsManager.clearCache();
    }
}

function exportSettings() {
    if (window.settingsManager) {
        window.settingsManager.exportSettings();
    }
}

function importSettings() {
    if (window.settingsManager) {
        window.settingsManager.importSettings();
    }
}

function clearAuditLogs() {
    if (window.settingsManager) {
        window.settingsManager.clearAuditLogs();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new ErrorRecoverySettingsManager();
    console.log('Error Recovery Settings page loaded');
});

// Export for external use
window.ErrorRecoverySettingsManager = ErrorRecoverySettingsManager;