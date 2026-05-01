import { createClient } from '@deepgram/sdk';
import { getConfig } from './config.js';
export async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
    const apiKey = await getConfig('DEEPGRAM_API_KEY');
    if (!apiKey)
        throw new Error('DEEPGRAM_API_KEY not configured');
    const dg = createClient(apiKey);
    const { result, error } = await dg.listen.prerecorded.transcribeFile(audioBuffer, {
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        words: true,
        language: 'en',
        mimetype: mimeType,
    });
    if (error)
        throw new Error(`Deepgram error: ${String(error)}`);
    if (!result?.results?.channels?.[0]?.alternatives?.[0]) {
        throw new Error('Deepgram returned no transcript');
    }
    const alt = result.results.channels[0].alternatives[0];
    return {
        rawText: alt.transcript ?? '',
        confidenceScore: alt.confidence ?? 0,
        words: (alt.words ?? []).map((w) => ({
            word: w.word,
            start: w.start,
            end: w.end,
            confidence: w.confidence,
        })),
        language: result.metadata?.['language'] ?? 'en',
        durationSeconds: (result.metadata?.duration) ?? 0,
    };
}
