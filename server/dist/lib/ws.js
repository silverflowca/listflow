import { WebSocketServer, WebSocket } from 'ws';
let _wss = null;
export function initWss(server) {
    _wss = new WebSocketServer({ server, path: '/ws' });
    _wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'connected', payload: { service: 'listflow' }, timestamp: new Date().toISOString() }));
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'ping', payload: {}, timestamp: new Date().toISOString() }));
                }
            }
            catch { /* ignore */ }
        });
    });
    console.log('[ws] WebSocket server attached to HTTP server at /ws');
    return _wss;
}
export function broadcast(event) {
    if (!_wss)
        return;
    const msg = JSON.stringify(event);
    for (const client of _wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    }
}
function emit(type, payload) {
    broadcast({ type, payload, timestamp: new Date().toISOString() });
}
export const emitTaskCreated = (task) => emit('task.created', { task });
export const emitTaskUpdated = (task) => emit('task.updated', { task });
export const emitTaskNotification = (task, updatedBy) => emit('task.notification', { task, updatedBy });
export const emitAgentThinking = (runId, iteration, thought) => emit('agent.thinking', { runId, iteration, thought });
export const emitAgentToolCalled = (runId, toolName, ok, result) => emit('agent.tool_called', { runId, toolName, ok, result });
export const emitAgentDone = (runId, response, tasksCreated) => emit('agent.done', { runId, response, tasksCreated });
export const emitAgentFailed = (runId, error) => emit('agent.failed', { runId, error });
export const emitTranscriptReady = (recordingId, transcriptId, rawText) => emit('transcript.ready', { recordingId, transcriptId, rawText });
export const emitChatMessage = (msg) => emit('chat.message', { message: msg });
export const emitChatMessageUpdated = (msg) => emit('chat.message.updated', { message: msg });
export const emitChatMessageDeleted = (messageId, channelId, scope, userId) => emit('chat.message.deleted', { messageId, channelId, scope, userId });
export const emitChatTyping = (channelId, userId, name) => emit('chat.typing', { channelId, userId, name });
