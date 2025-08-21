/**
 * Intent Spec Prompt Generator - Creates detailed prompts for Claude to analyze recordings
 */

/**
 * Generates a comprehensive prompt for Claude to analyze a recording and produce an Intent Spec
 * @param serializedRecording Human-readable recording format
 * @returns Detailed prompt for Claude analysis
 */
export function generateIntentSpecPrompt(serializedRecording: string): string {
  return `# Recording Analysis Task

You are an expert at analyzing user interface interactions to extract reusable automation patterns. Your task is to analyze the provided recording and convert it into a structured Intent Specification (Intent Spec) that can be used for browser automation.

## Input Recording

${serializedRecording}

## Your Task

Analyze this recording and generate an Intent Spec JSON that captures the user's intent and creates a reusable automation pattern. Focus on:

1. **Understanding the User's Goal**: What was the user trying to accomplish?
2. **Identifying Reusable Patterns**: Which parts should be parameterized for reuse?
3. **Extracting Variables**: What values might change between different executions?
4. **Determining Success Criteria**: How do we know the automation succeeded?

## Intent Spec Format

Return ONLY valid JSON matching this exact schema:

\`\`\`json
{
  "name": "descriptive name for this automation flow",
  "description": "clear explanation of what this automation accomplishes",
  "url": "the URL where this automation should begin",
  "params": ["VARIABLE_NAME_1", "VARIABLE_NAME_2"],
  "steps": [
    {
      "action": "navigate|click|type|wait|select|check|uncheck",
      "selector": "CSS selector or element identifier",
      "value": "static value or {{VARIABLE_NAME}} for dynamic values",
      "description": "human-readable description of this step"
    }
  ],
  "successCheck": "CSS selector or condition that indicates success",
  "failureConditions": ["selector or condition that indicates failure"],
  "assertions": [
    {
      "type": "element_visible|element_text|url_contains|page_title",
      "selector": "selector or value to check",
      "expected": "expected value or pattern",
      "description": "what this assertion validates"
    }
  ]
}
\`\`\`

## Variable Extraction Guidelines

Replace values with variables ({{VARIABLE_NAME}}) when they are likely to change between executions:

- **User Credentials**: {{USERNAME}}, {{PASSWORD}}, {{EMAIL}}
- **Personal Data**: {{FIRST_NAME}}, {{LAST_NAME}}, {{PHONE_NUMBER}}
- **Dynamic IDs**: {{ORDER_ID}}, {{TRANSACTION_ID}}, {{SESSION_ID}}
- **Dates**: {{START_DATE}}, {{END_DATE}}, {{CURRENT_DATE}}
- **Search Terms**: {{SEARCH_QUERY}}, {{PRODUCT_NAME}}
- **Amounts**: {{AMOUNT}}, {{QUANTITY}}, {{PRICE}}
- **Configurable Values**: {{DEPARTMENT}}, {{CATEGORY}}, {{PRIORITY}}

Keep static values that are unlikely to change:
- Navigation button text ("Login", "Submit", "Next")
- Standard form labels and placeholders
- Fixed dropdown options for standard selections

## Action Type Mapping

Map the recorded actions to these standardized action types:

- **navigate**: Direct URL navigation
- **click**: Click buttons, links, or interactive elements
- **type**: Enter text into input fields
- **select**: Choose options from dropdowns or select elements
- **check/uncheck**: Toggle checkboxes or radio buttons
- **wait**: Explicit waits for page loads or element appearance

## Selector Optimization

Create robust selectors that are:
- **Stable**: Use IDs or stable class names when available
- **Readable**: Prefer semantic selectors over generated ones
- **Maintainable**: Avoid overly specific selectors that might break easily

Priority order for selectors:
1. Unique IDs (#element-id)
2. Stable class names (.login-button)
3. Data attributes ([data-testid="submit"])
4. Semantic combinations (form input[type="email"])
5. Text content (button:contains("Submit"))

## Success and Failure Detection

Define clear criteria for:
- **Success**: How to confirm the automation achieved its goal
- **Failure**: How to detect when something went wrong
- **Assertions**: Intermediate validations throughout the flow

## Example Intent Spec

Here's an example of a well-structured Intent Spec:

\`\`\`json
{
  "name": "User Login Flow",
  "description": "Authenticates a user by entering credentials and logging into the application",
  "url": "https://app.example.com/login",
  "params": ["USERNAME", "PASSWORD"],
  "steps": [
    {
      "action": "click",
      "selector": "#username-field",
      "value": "",
      "description": "Focus on the username input field"
    },
    {
      "action": "type",
      "selector": "#username-field",
      "value": "{{USERNAME}}",
      "description": "Enter the username"
    },
    {
      "action": "click",
      "selector": "#password-field",
      "value": "",
      "description": "Focus on the password input field"
    },
    {
      "action": "type",
      "selector": "#password-field",
      "value": "{{PASSWORD}}",
      "description": "Enter the password"
    },
    {
      "action": "click",
      "selector": "#login-button",
      "value": "",
      "description": "Click the login button to submit credentials"
    },
    {
      "action": "wait",
      "selector": "3000",
      "value": "",
      "description": "Wait for navigation to complete"
    }
  ],
  "successCheck": ".dashboard-welcome",
  "failureConditions": [".error-message", ".login-failed"],
  "assertions": [
    {
      "type": "url_contains",
      "selector": "/dashboard",
      "expected": "/dashboard",
      "description": "Verify successful navigation to dashboard"
    },
    {
      "type": "element_visible",
      "selector": ".user-profile",
      "expected": "visible",
      "description": "Confirm user profile section is visible"
    }
  ]
}
\`\`\`

## Analysis Instructions

1. **Start by identifying the core user goal** from the recording
2. **Analyze each step** to understand its purpose in achieving that goal
3. **Look for patterns** that suggest where variables should be extracted
4. **Consider edge cases** and how the automation should handle them
5. **Think about reusability** - what would make this useful for other similar scenarios?

## Output Requirements

- Return ONLY the JSON specification, no additional text or explanations
- Ensure all JSON is valid and properly formatted
- Include all required fields from the schema
- Make variable names descriptive and follow UPPER_CASE convention
- Provide clear, actionable step descriptions
- Include comprehensive success/failure detection

Now analyze the provided recording and generate the Intent Spec JSON:`;
}

/**
 * Generates a simplified prompt for basic Intent Spec extraction (fallback)
 * @param serializedRecording Human-readable recording format
 * @returns Simplified prompt for Claude analysis
 */
export function generateSimpleIntentSpecPrompt(serializedRecording: string): string {
  return `Convert this user recording into an Intent Spec JSON. Extract variables for values that might change (usernames, passwords, search terms, etc.) using {{VARIABLE}} format.

Recording:
${serializedRecording}

Return ONLY valid JSON matching this schema:
{
  "name": "flow name",
  "description": "what this accomplishes", 
  "url": "starting URL",
  "params": ["VARIABLE_NAMES"],
  "steps": [
    {
      "action": "click|type|navigate|wait|select|check|uncheck",
      "selector": "CSS selector or identifier",
      "value": "static value or {{VARIABLE}}",
      "description": "step description"
    }
  ],
  "successCheck": "success indicator selector",
  "assertions": [
    {
      "type": "element_visible|url_contains|element_text",
      "selector": "what to check",
      "expected": "expected result",
      "description": "validation purpose"
    }
  ]
}

Variables to extract:
- User credentials: {{USERNAME}}, {{PASSWORD}}, {{EMAIL}}
- Personal data: {{FIRST_NAME}}, {{LAST_NAME}}
- Dynamic values: {{SEARCH_TERM}}, {{AMOUNT}}, {{DATE}}
- IDs: {{ORDER_ID}}, {{PRODUCT_ID}}

Keep static: button text, labels, standard navigation elements.`;
}

/**
 * Generates a validation prompt to check Intent Spec quality
 * @param intentSpec The generated Intent Spec JSON
 * @returns Prompt for validating the Intent Spec
 */
export function generateValidationPrompt(intentSpec: string): string {
  return `Review this Intent Spec for quality and completeness. Check for:

1. **JSON Validity**: Is the JSON properly formatted?
2. **Required Fields**: Are all required fields present?
3. **Variable Extraction**: Are variables appropriately identified?
4. **Selector Quality**: Are selectors robust and maintainable?
5. **Step Logic**: Do the steps form a coherent automation flow?
6. **Success Criteria**: Is success/failure detection adequate?

Intent Spec to Review:
${intentSpec}

Return JSON with your assessment:
{
  "isValid": true/false,
  "score": 0-100,
  "issues": ["list of problems found"],
  "suggestions": ["list of improvements"],
  "summary": "brief quality assessment"
}`;
}

/**
 * Generates a prompt for extracting metadata from a recording
 * @param serializedRecording Human-readable recording format
 * @returns Prompt for extracting recording metadata
 */
export function generateMetadataExtractionPrompt(serializedRecording: string): string {
  return `Analyze this recording and extract key metadata that will help with Intent Spec generation:

Recording:
${serializedRecording}

Return JSON with metadata:
{
  "flowType": "login|form_submission|navigation|search|ecommerce|other",
  "complexity": "simple|moderate|complex",
  "estimatedSteps": number,
  "likelyVariables": ["list of probable variables"],
  "primaryActions": ["main action types used"],
  "domainContext": "brief description of the application domain",
  "userGoal": "what the user was trying to accomplish",
  "riskFactors": ["potential automation challenges"]
}

Focus on understanding the user's intent and identifying patterns that suggest automation complexity.`;
}