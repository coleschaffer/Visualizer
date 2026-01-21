# Visual Feedback Request

**Task ID:** `{{TASK_ID}}`

## User Feedback
"{{FEEDBACK}}"

## Target Element
- **Tag:** <{{ELEMENT_TAG}}>
- **Selector:** {{SELECTOR}}
{{ELEMENT_ID}}
{{ELEMENT_CLASSES}}
{{DOM_PATH}}

{{COMPUTED_STYLES}}

{{PAGE_URL}}

{{BEAD_CONTEXT}}

## Instructions
1. Use Language Server Protocol (LSP) features to efficiently navigate the codebase:
   - Use "Go to Definition" to find where components/elements are defined
   - Use "Find References" to locate all usages
   - Use symbol search to quickly find relevant files
2. Find the source file containing this element using the selector, classes, and DOM path as hints
3. Make the requested change
4. **Important:** After attempting the change, report the result:
   - If successful: call `mark_change_applied` with the Task ID
   - If failed: call `mark_change_failed` with the Task ID and reason for failure
