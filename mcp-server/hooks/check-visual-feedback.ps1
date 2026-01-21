# Claude Code UserPromptSubmit hook - checks for pending visual feedback
# If tasks exist, instructs Claude to call the MCP tool

$ErrorActionPreference = "SilentlyContinue"

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3848/tasks" -Method Get -TimeoutSec 2

    if ($response.count -gt 0) {
        Write-Output "<visual-feedback-pending count=`"$($response.count)`">"
        Write-Output "IMPORTANT: $($response.count) visual feedback task(s) queued from the browser extension."
        Write-Output "These have been explicitly submitted by the user - process them automatically."
        Write-Output "1. Call get_visual_feedback to retrieve the changes"
        Write-Output "2. Add each change to your todo list"
        Write-Output "3. Implement each change"
        Write-Output "4. Call mark_change_applied (or mark_change_failed) with the task ID for each"
        Write-Output "5. After completing all tasks, call get_visual_feedback again to check for new tasks"
        Write-Output "Continue this loop until the queue is empty (no more pending changes)."
        Write-Output "</visual-feedback-pending>"
    }
} catch {
    # Server not running or unreachable - silently continue
}
