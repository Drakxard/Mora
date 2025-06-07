import { ChatResponse, SummaryResponse } from '../types';

export const chatWithAudio = async (
  model: string,
  transcription: string,
  message: string,
  image?: File | null
): Promise<ChatResponse> => {
  try {
    if (!import.meta.env.VITE_GROQ_API_KEY) {
      throw new Error('API key not found');
    }

    if (!model) {
      throw new Error('No se ha seleccionado un modelo de chat');
    }

    const prompt = `Contexto (transcripción del audio):\n${transcription}\n\nPregunta del usuario: ${message}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente experto en analizar contenido de audio y responder preguntas sobre él. ' +
              'Proporciona respuestas claras y precisas basadas en la transcripción proporcionada.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || response.statusText);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Respuesta inválida del servicio');
    }

    return {
      message: data.choices[0].message.content
    };
  } catch (error: any) {
    console.error('[chatWithAudio] Error:', error);
    return {
      message: '',
      error: error.message || 'No fue posible procesar la consulta. Verifica tu API key de Groq.'
    };
  }
};

export const generateSummary = async (
  model: string,
  files: File[],
  context?: string
): Promise<SummaryResponse> => {
  try {
    if (!import.meta.env.VITE_GROQ_API_KEY) {
      throw new Error('API key not found');
    }

    if (!model) {
      throw new Error('No se ha seleccionado un modelo de chat');
    }

    const transcriptionPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'es');

      const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
        },
        body: formData
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(
          `Error transcribiendo "${file.name}": ${
            errData.error?.message || resp.statusText
          }`
        );
      }

      const json = await resp.json();
      return {
        fileName: file.name,
        transcription: (json.text as string) || ''
      };
    });

    const transcriptions = await Promise.all(transcriptionPromises);

    const prompt = `Por favor, genera un resumen detallado y estructurado de las siguientes transcripciones${
      context ? `. Contexto adicional: ${context}` : ''
    }:\n\n${transcriptions
      .map((t) => `[${t.fileName}]:\n${t.transcription}`)
      .join('\n\n')}`;

    const summaryResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente experto en analizar y resumir información. ' +
              'Genera resúmenes claros, concisos y bien estructurados.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2048
      })
    });

    if (!summaryResp.ok) {
      const errJson = await summaryResp.json().catch(() => ({}));
      throw new Error(
        `Error generando resumen: ${errJson.error?.message || summaryResp.statusText}`
      );
    }

    const summaryData = await summaryResp.json();
    if (!summaryData.choices?.[0]?.message?.content) {
      throw new Error('Respuesta inválida del servicio de resumen');
    }

    return {
      summary: summaryData.choices[0].message.content as string,
      metadata: transcriptions
    };
  } catch (error: any) {
    console.error('[generateSummary] Error:', error);
    throw new Error(`No fue posible generar el resumen: ${error.message}`);
  }
};