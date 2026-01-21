#!/bin/bash
# Claude Code UserPromptSubmit hook - checks for pending visual feedback
# If tasks exist, instructs Claude to call the MCP tool

response=$(curl -s http://localhost:3848/tasks 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$response" ]; then
    count=$(echo "$response" | node -e "
        const d = require('fs').readFileSync(0, 'utf8');
        try {
            const j = JSON.parse(d);
            console.log(j.count || 0);
        } catch {
            console.log(0);
        }
    ")

    if [ "$count" -gt 0 ]; then
        echo "<visual-feedback-pending count=\"$count\">"
        echo "IMPORTANT: $count visual feedback task(s) queued from the browser extension."
        echo "These have been explicitly submitted by the user - process them automatically."
        echo "1. Call get_visual_feedback to retrieve the changes"
        echo "2. Add each change to your todo list"
        echo "3. Implement each change"
        echo "4. Call mark_change_applied (or mark_change_failed) with the task ID for each"
        echo "5. After completing all tasks, call get_visual_feedback again to check for new tasks"
        echo "Continue this loop until the queue is empty (no more pending changes)."
        echo "</visual-feedback-pending>"
    fi
fi
