/**
 * Example of how to use the Playwright recording integration
 * This file demonstrates the usage patterns for the recording functionality
 */

// Example 1: Basic recording usage
async function basicRecordingExample() {
    console.log('Starting basic recording example...');
    
    try {
        // Start recording
        const startResult = await window.electronAPI.startRecording();
        
        if (startResult.success) {
            console.log('Recording started with session ID:', startResult.data.sessionId);
            
            // Simulate some user actions (in a real scenario, user would interact with the page)
            console.log('Recording user actions... (interact with the page now)');
            
            // Wait for some time to let user interact
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Stop recording
            const stopResult = await window.electronAPI.stopRecording();
            
            if (stopResult.success) {
                const session = stopResult.data.session;
                console.log('Recording stopped successfully!');
                console.log('Session:', session);
                console.log(`Captured ${session.actions.length} actions`);
                
                // Generate Playwright code
                const codeResult = await window.electronAPI.generatePlaywrightCode(session);
                if (codeResult.success) {
                    console.log('Generated Playwright code:');
                    console.log(codeResult.data.code);
                }
                
                return session;
            } else {
                console.error('Failed to stop recording:', stopResult.error);
            }
        } else {
            console.error('Failed to start recording:', startResult.error);
        }
    } catch (error) {
        console.error('Error in recording example:', error);
    }
}

// Example 2: Recording with callback
function recordingWithCallbackExample() {
    console.log('Setting up recording with callback...');
    
    // Set up callback for recording completion
    window.electronAPI.onRecordingComplete((session) => {
        console.log('Recording completed callback triggered!');
        console.log('Session data:', session);
        
        // Process the recording data
        processRecordingSession(session);
    });
    
    console.log('Callback set up. Start recording manually using the Record button.');
}

// Example 3: Process recording session
async function processRecordingSession(session) {
    console.log('Processing recording session...');
    
    try {
        // Export session as JSON
        const exportResult = await window.electronAPI.exportRecordingSession(session);
        if (exportResult.success) {
            console.log('Session exported as JSON:');
            console.log(exportResult.data.jsonData);
            
            // You could save this to a file or send to a server
            downloadJSON(exportResult.data.jsonData, `recording-${session.id}.json`);
        }
        
        // Generate Playwright code
        const codeResult = await window.electronAPI.generatePlaywrightCode(session);
        if (codeResult.success) {
            console.log('Generated Playwright test code:');
            console.log(codeResult.data.code);
            
            // You could save this as a .spec.js file
            downloadText(codeResult.data.code, `test-${session.id}.spec.js`);
        }
        
        // Show action breakdown
        showActionBreakdown(session);
        
    } catch (error) {
        console.error('Error processing recording session:', error);
    }
}

// Example 4: Check recording status
async function checkRecordingStatusExample() {
    try {
        const statusResult = await window.electronAPI.getRecordingStatus();
        
        if (statusResult.success) {
            const status = statusResult.data;
            console.log('Recording status:', status);
            
            if (status.isRecording) {
                console.log(`Currently recording session: ${status.sessionId}`);
                console.log(`Actions captured so far: ${status.actionCount || 0}`);
                console.log(`Recording in tab: ${status.tabId}`);
            } else {
                console.log('No recording in progress');
            }
        }
    } catch (error) {
        console.error('Error checking recording status:', error);
    }
}

// Example 5: Import and replay recording
async function importRecordingExample() {
    const jsonData = prompt('Paste the recording JSON data:');
    
    if (jsonData) {
        try {
            const importResult = await window.electronAPI.importRecordingSession(jsonData);
            
            if (importResult.success) {
                const session = importResult.data.session;
                console.log('Recording imported successfully:', session);
                
                // Generate Playwright code for the imported session
                const codeResult = await window.electronAPI.generatePlaywrightCode(session);
                if (codeResult.success) {
                    console.log('Playwright code for imported recording:');
                    console.log(codeResult.data.code);
                }
            } else {
                console.error('Failed to import recording:', importResult.error);
            }
        } catch (error) {
            console.error('Error importing recording:', error);
        }
    }
}

// Helper functions
function showActionBreakdown(session) {
    console.group('Recording Action Breakdown');
    console.log('Session ID:', session.id);
    console.log('Start Time:', new Date(session.startTime).toISOString());
    console.log('End Time:', new Date(session.endTime).toISOString());
    console.log('Duration:', ((session.endTime - session.startTime) / 1000).toFixed(1) + ' seconds');
    console.log('URL:', session.url);
    console.log('Title:', session.title);
    
    // Group actions by type
    const actionsByType = {};
    session.actions.forEach(action => {
        actionsByType[action.type] = (actionsByType[action.type] || 0) + 1;
    });
    
    console.log('Actions by type:', actionsByType);
    
    // Show timeline of actions
    console.log('Action timeline:');
    session.actions.forEach((action, index) => {
        const time = new Date(action.timestamp).toLocaleTimeString();
        const waitTime = action.waitTime ? ` (wait: ${action.waitTime}ms)` : '';
        console.log(`${index + 1}. [${time}] ${action.type}${waitTime}`, action);
    });
    
    console.groupEnd();
}

function downloadJSON(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Downloaded: ${filename}`);
}

function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Downloaded: ${filename}`);
}

// Make functions available globally for testing
window.playwrightRecordingExamples = {
    basicRecording: basicRecordingExample,
    recordingWithCallback: recordingWithCallbackExample,
    processSession: processRecordingSession,
    checkStatus: checkRecordingStatusExample,
    importRecording: importRecordingExample
};

// Auto-setup callback when loaded
if (window.electronAPI) {
    recordingWithCallbackExample();
    console.log('Playwright recording examples loaded. Available functions:');
    console.log('- window.playwrightRecordingExamples.basicRecording()');
    console.log('- window.playwrightRecordingExamples.checkStatus()');
    console.log('- window.playwrightRecordingExamples.importRecording()');
    console.log('Or just click the Record button to test the integrated functionality!');
}