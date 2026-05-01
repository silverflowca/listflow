/**
 * ListFlow — Embedded AI Agent
 * Self-contained think-act-observe loop.
 * No dependency on d2flow packages.
 * Supports Anthropic (primary) and Gemini (fallback).
 */
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from './config.js';
import { lf } from '../db/client.js';
import { emitAgentThinking, emitAgentToolCalled, emitAgentDone, emitAgentFailed, } from './ws.js';
import { emitTaskCreated } from './ws.js';
// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are ListFlow's AI assistant. You help users capture and organize information.

When given a speech transcript:
1. Carefully read the transcript to identify all action items, tasks, decisions, and important notes
2. Create tasks for each action item using the create_task tool
3. Use create_page for meeting summaries, notes, or document content
4. Use remember to store important context for future sessions
5. Always call summarize as your final action with a brief summary of what you created

Guidelines:
- Extract concrete, actionable tasks (not vague ideas)
- Assign appropriate priority: urgent for time-sensitive items, high for important, medium as default, low for nice-to-haves
- Be specific with task titles (e.g. "Schedule meeting with John about Q2 budget" not "Schedule meeting")
- Group related tasks logically
- Always end with a summarize call`;
// ── Tool definitions ──────────────────────────────────────────────────────────
const LISTFLOW_TOOLS = [
    {
        name: 'create_task',
        description: 'Create a new task in the workspace. Use for every action item found in the transcript.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Short, specific task title (required)' },
                description: { type: 'string', description: 'Additional context or details (optional)' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority, default medium' },
                due_date: { type: 'string', description: 'ISO date YYYY-MM-DD if mentioned (optional)' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Topic labels (optional)' },
            },
            required: ['title'],
        },
    },
    {
        name: 'update_task',
        description: 'Update an existing task by ID. Use when transcript mentions completing or changing a task.',
        input_schema: {
            type: 'object',
            properties: {
                task_id: { type: 'string', description: 'UUID of the task to update' },
                status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'cancelled'] },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            },
            required: ['task_id'],
        },
    },
    {
        name: 'create_page',
        description: 'Create a new page (document) in the workspace for meeting notes or reference content.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Page title (required)' },
                content: { type: 'string', description: 'Initial text content (optional)' },
            },
            required: ['title'],
        },
    },
    {
        name: 'summarize',
        description: 'Return a summary of all actions taken. ALWAYS call this as your final action.',
        input_schema: {
            type: 'object',
            properties: {
                summary: { type: 'string', description: 'Brief summary of tasks created and actions taken' },
            },
            required: ['summary'],
        },
    },
    {
        name: 'remember',
        description: 'Store a key-value pair in workspace memory for future reference.',
        input_schema: {
            type: 'object',
            properties: {
                key: { type: 'string' },
                value: { type: 'string' },
            },
            required: ['key', 'value'],
        },
    },
    {
        name: 'recall',
        description: 'Retrieve a stored value from workspace memory.',
        input_schema: {
            type: 'object',
            properties: {
                key: { type: 'string' },
            },
            required: ['key'],
        },
    },
];
// ── Tool executor ─────────────────────────────────────────────────────────────
async function executeTool(toolName, input, ctx, tasksCreated) {
    try {
        switch (toolName) {
            case 'create_task': {
                const { data, error } = await lf('tasks').insert({
                    workspace_id: ctx.workspaceId,
                    title: input.title,
                    description: input.description ?? '',
                    priority: input.priority ?? 'medium',
                    due_date: input.due_date ?? null,
                    labels: input.labels ?? [],
                    created_by: ctx.createdBy,
                    status: 'todo',
                }).select().single();
                if (error)
                    return { ok: false, result: { error: error.message } };
                tasksCreated.push(data.id);
                emitTaskCreated(data);
                return { ok: true, result: { taskId: data.id, title: data.title } };
            }
            case 'update_task': {
                const updates = {};
                if (input.status)
                    updates.status = input.status;
                if (input.description)
                    updates.description = input.description;
                if (input.priority)
                    updates.priority = input.priority;
                const { data, error } = await lf('tasks')
                    .update(updates)
                    .eq('id', input.task_id)
                    .select()
                    .single();
                if (error)
                    return { ok: false, result: { error: error.message } };
                return { ok: true, result: { taskId: data.id, status: data.status } };
            }
            case 'create_page': {
                const { data: page, error: pageErr } = await lf('pages').insert({
                    workspace_id: ctx.workspaceId,
                    title: input.title,
                    created_by: ctx.createdBy,
                }).select().single();
                if (pageErr)
                    return { ok: false, result: { error: pageErr.message } };
                if (input.content) {
                    await lf('blocks').insert({
                        page_id: page.id,
                        type: 'text',
                        content: { text: input.content },
                        position: 0,
                    });
                }
                return { ok: true, result: { pageId: page.id, title: page.title } };
            }
            case 'summarize':
                return { ok: true, result: { summary: input.summary } };
            case 'remember': {
                await lf('agent_memory').upsert({ workspace_id: ctx.workspaceId, key: input.key, value: input.value }, { onConflict: 'workspace_id,key' });
                return { ok: true, result: { stored: true } };
            }
            case 'recall': {
                const { data } = await lf('agent_memory')
                    .select('value')
                    .eq('workspace_id', ctx.workspaceId)
                    .eq('key', input.key)
                    .single();
                return { ok: true, result: { value: data?.value ?? null } };
            }
            default:
                return { ok: false, result: { error: `Unknown tool: ${toolName}` } };
        }
    }
    catch (err) {
        return { ok: false, result: { error: String(err) } };
    }
}
// ── Main agent runner ─────────────────────────────────────────────────────────
export async function runAgent(opts) {
    const { runId, workspaceId, prompt, createdBy, transcriptId, maxIterations = 20 } = opts;
    const tasksCreated = [];
    const allToolCalls = [];
    let totalTokens = 0;
    let finalResponse = '';
    // Get API key (runtime config takes priority over env)
    const anthropicKey = await getConfig('ANTHROPIC_API_KEY');
    const geminiKey = await getConfig('GEMINI_API_KEY');
    if (!anthropicKey && !geminiKey) {
        const errMsg = 'No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in Settings.';
        await lf('agent_runs').update({ status: 'failed', response: errMsg, completed_at: new Date().toISOString() }).eq('id', runId);
        emitAgentFailed(runId, errMsg);
        throw new Error(errMsg);
    }
    // Use Gemini if no Anthropic key
    if (!anthropicKey && geminiKey) {
        return runAgentGemini({ runId, workspaceId, prompt, createdBy, transcriptId, maxIterations, geminiKey, tasksCreated, allToolCalls });
    }
    // Anthropic path
    const client = new Anthropic({ apiKey: anthropicKey });
    const messages = [
        { role: 'user', content: prompt },
    ];
    let iteration = 0;
    try {
        for (iteration = 0; iteration < maxIterations; iteration++) {
            const response = await client.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 4096,
                system: SYSTEM_PROMPT,
                messages,
                tools: LISTFLOW_TOOLS,
            });
            totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
            // Extract text for WS emission
            const textContent = response.content.find(b => b.type === 'text');
            if (textContent && textContent.type === 'text') {
                emitAgentThinking(runId, iteration, textContent.text.slice(0, 200));
                finalResponse = textContent.text;
            }
            // Add assistant message to history
            messages.push({ role: 'assistant', content: response.content });
            // Stop if no tool calls
            const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
            if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
                break;
            }
            // Execute tools
            const toolResults = [];
            for (const block of toolUseBlocks) {
                if (block.type !== 'tool_use')
                    continue;
                const start = Date.now();
                const { ok, result } = await executeTool(block.name, block.input, { workspaceId, createdBy, runId }, tasksCreated);
                const durationMs = Date.now() - start;
                allToolCalls.push({ toolName: block.name, input: block.input, ok, result, durationMs });
                emitAgentToolCalled(runId, block.name, ok, result);
                // Check if this was the summarize tool — capture as final response
                if (block.name === 'summarize' && ok) {
                    const r = result;
                    finalResponse = r.summary;
                }
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                });
            }
            // Feed results back
            messages.push({ role: 'user', content: toolResults });
            // Stop after summarize
            const hasSummarize = toolUseBlocks.some(b => b.type === 'tool_use' && b.name === 'summarize');
            if (hasSummarize)
                break;
        }
        // Update agent_run record
        await lf('agent_runs').update({
            status: 'done',
            response: finalResponse,
            tool_calls: allToolCalls,
            tasks_created: tasksCreated,
            iterations: iteration + 1,
            total_tokens: totalTokens,
            completed_at: new Date().toISOString(),
        }).eq('id', runId);
        emitAgentDone(runId, finalResponse, tasksCreated);
        return { response: finalResponse, toolCalls: allToolCalls, iterations: iteration + 1, totalTokens, tasksCreated };
    }
    catch (err) {
        const errMsg = String(err);
        await lf('agent_runs').update({ status: 'failed', response: errMsg, completed_at: new Date().toISOString() }).eq('id', runId);
        emitAgentFailed(runId, errMsg);
        throw err;
    }
}
// ── Gemini fallback ───────────────────────────────────────────────────────────
async function runAgentGemini(opts) {
    const { runId, workspaceId, prompt, createdBy, geminiKey, tasksCreated, allToolCalls } = opts;
    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        // Simple Gemini call with structured prompt (no tool use — just extract JSON)
        const structuredPrompt = `${SYSTEM_PROMPT}

User prompt: ${prompt}

Respond with a JSON object in this exact format (no markdown):
{
  "tasks": [{"title": "...", "description": "...", "priority": "low|medium|high|urgent"}],
  "pages": [{"title": "...", "content": "..."}],
  "summary": "..."
}
`;
        const result = await model.generateContent(structuredPrompt);
        const text = result.response.text().trim();
        // Parse JSON response
        let parsed;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        }
        catch {
            parsed = { summary: text };
        }
        // Create tasks
        for (const task of parsed.tasks ?? []) {
            const { data, error } = await lf('tasks').insert({
                workspace_id: workspaceId,
                title: task.title,
                description: task.description ?? '',
                priority: task.priority ?? 'medium',
                created_by: createdBy,
                status: 'todo',
            }).select().single();
            if (!error && data) {
                tasksCreated.push(data.id);
                emitTaskCreated(data);
                allToolCalls.push({ toolName: 'create_task', input: task, ok: true, result: { taskId: data.id }, durationMs: 0 });
            }
        }
        // Create pages
        for (const page of parsed.pages ?? []) {
            const { data } = await lf('pages').insert({
                workspace_id: workspaceId,
                title: page.title,
                created_by: createdBy,
            }).select().single();
            if (data && page.content) {
                await lf('blocks').insert({ page_id: data.id, type: 'text', content: { text: page.content }, position: 0 });
            }
        }
        const finalResponse = parsed.summary ?? 'Done.';
        await lf('agent_runs').update({
            status: 'done',
            response: finalResponse,
            tool_calls: allToolCalls,
            tasks_created: tasksCreated,
            iterations: 1,
            total_tokens: 0,
            completed_at: new Date().toISOString(),
        }).eq('id', runId);
        emitAgentDone(runId, finalResponse, tasksCreated);
        return { response: finalResponse, toolCalls: allToolCalls, iterations: 1, totalTokens: 0, tasksCreated };
    }
    catch (err) {
        const errMsg = String(err);
        await lf('agent_runs').update({ status: 'failed', response: errMsg, completed_at: new Date().toISOString() }).eq('id', runId);
        emitAgentFailed(runId, errMsg);
        throw err;
    }
}
