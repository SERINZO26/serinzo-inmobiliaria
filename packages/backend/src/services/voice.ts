/**
 * voice.ts — Servicio de voz: Text-to-Speech (ElevenLabs) y Speech-to-Text (Deepgram).
 * Usado por el agente Sofía para canales de llamada de voz.
 *
 * Deepgram: usamos la REST API directamente (POST /v1/listen) porque el SDK v5
 * (Fern-generated) no expone la transcripción de audio prerecordado en el cliente principal.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getElevenLabsKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY no configurada');
  return key;
}

function getElevenLabsVoiceId(): string {
  const id = process.env.ELEVENLABS_VOICE_ID;
  if (!id) throw new Error('ELEVENLABS_VOICE_ID no configurada');
  return id;
}

function getDeepgramKey(): string {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error('DEEPGRAM_API_KEY no configurada');
  return key;
}

/**
 * Divide texto largo en oraciones para no superar el límite de ElevenLabs.
 * Corta por punto, signo de exclamación o pregunta seguido de espacio.
 */
function splitIntoSentences(text: string, maxChars = 500): string[] {
  if (text.length <= maxChars) return [text];

  const sentences: string[] = [];
  // Divide por delimitadores naturales del español
  const parts = text.split(/(?<=[.!?¿¡])\s+/);
  let current = '';

  for (const part of parts) {
    if ((current + ' ' + part).trim().length > maxChars) {
      if (current.trim()) sentences.push(current.trim());
      current = part;
    } else {
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current.trim()) sentences.push(current.trim());

  return sentences.length > 0 ? sentences : [text.slice(0, maxChars)];
}

// ─── textToSpeech ─────────────────────────────────────────────────────────────

/**
 * Convierte texto a audio MP3 usando ElevenLabs.
 *
 * - Modelo: eleven_multilingual_v2 (óptimo para español colombiano)
 * - Voz: definida por ELEVENLABS_VOICE_ID (Marcela por defecto)
 * - Si el texto supera 500 chars, lo procesa por oraciones y concatena los buffers
 *
 * @returns Buffer con audio en formato MP3
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  const apiKey  = getElevenLabsKey();
  const voiceId = getElevenLabsVoiceId();

  const voiceSettings = {
    stability:        0.5,
    similarity_boost: 0.75,
    style:            0.3,
    use_speaker_boost: true,
  };

  const segments = splitIntoSentences(text, 500);
  const buffers: Buffer[] = [];

  for (const segment of segments) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'xi-api-key':   apiKey,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text:           segment,
        // eleven_turbo_v2_5: más rápido para tiempo real, multilingüe, requiere plan Creator+
        // eleven_multilingual_v2: mejor calidad, mismo requisito de plan
        model_id:       'eleven_turbo_v2_5',
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS error ${response.status}: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }

  // Concatenar todos los segmentos en un solo buffer MP3
  const result = Buffer.concat(buffers);
  console.log(`[voice] TTS generado: ${text.length} chars → ${result.length} bytes MP3`);
  return result;
}

// ─── speechToText ─────────────────────────────────────────────────────────────

/**
 * Transcribe audio a texto usando Deepgram.
 *
 * - Modelo: nova-2 (mayor precisión para español)
 * - Idioma: es (español)
 * - Smart format para puntuación y números naturales
 *
 * @param audioBuffer  Buffer con el audio (MP3, WAV, OGG, etc.)
 * @param mimeType     Tipo MIME del audio: 'audio/mpeg', 'audio/wav', 'audio/ogg'
 * @returns            Transcript como string. Cadena vacía si no hay audio detectado.
 */
export async function speechToText(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = getDeepgramKey();

  // Usamos la REST API directamente: POST /v1/listen
  // El SDK v5 (Fern-generated) no expone transcripción de audio prerecordado en el cliente principal
  const params = new URLSearchParams({
    model:        'nova-2',
    language:     'es',
    smart_format: 'true',
    punctuate:    'true',
    diarize:      'false',   // una sola voz en llamadas 1:1
  });

  const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method:  'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type':  mimeType,
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram STT error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string; confidence?: number }>;
      }>;
    };
  };

  // Extraer el transcript del primer canal, primera alternativa
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence ?? 0;

  console.log(
    `[voice] STT transcrito: "${transcript.slice(0, 60)}${transcript.length > 60 ? '…' : ''}" ` +
    `(confianza: ${(confidence * 100).toFixed(1)}%)`,
  );

  return transcript;
}
