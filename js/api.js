/**
 * API Service for Streaming Chat Completions
 * Supports Groq, Gemini, OpenAI, Custom endpoints, and Backend Proxy.
 */

export const PROVIDERS = {
  groq: {
    name: 'Groq (Ultra-Fast Inference)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-20b',
    models: [
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Fast)' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Smart)' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' },
      { id: 'allam-2-7b', name: 'Allam 2 7B' },
    ]
  },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Smart)' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ]
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Smart)' },
      { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  },
  custom: {
    name: 'Custom / OpenRouter / Ollama',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3-8b-instruct',
    models: [
      { id: 'custom-model', name: 'Custom Specified Model' }
    ]
  },
  backend: {
    name: 'Salman Chat Bot Backend Proxy (/api/chat)',
    baseUrl: '/api',
    defaultModel: 'openai/gpt-oss-20b',
    models: [
      { id: 'openai/gpt-oss-20b', name: 'Server Configured Model' }
    ]
  }
};

export class ChatAPI {
  constructor(settings) {
    this.updateSettings(settings);
    this.abortController = null;
  }

  updateSettings(settings) {
    this.settings = settings;
  }

  getEffectiveKey() {
    const s = this.settings;
    if (s.provider === 'groq') return s.groqKey || s.apiKey || '';
    if (s.provider === 'gemini') return s.geminiKey || s.apiKey || '';
    if (s.provider === 'openai') return s.openaiKey || s.apiKey || '';
    if (s.provider === 'custom') return s.customKey || s.apiKey || '';
    return s.apiKey || '';
  }

  getEffectiveBaseUrl() {
    const s = this.settings;
    if (s.provider === 'backend') return '/api';
    if (s.provider === 'gemini') return PROVIDERS.gemini.baseUrl;
    if (s.baseUrl && s.baseUrl.trim()) return s.baseUrl.trim().replace(/\/+$/, '');
    const prov = PROVIDERS[s.provider];
    return prov ? prov.baseUrl : 'https://api.groq.com/openai/v1';
  }

  stopStreaming() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async testConnection() {
    const s = this.settings;
    const provider = s.provider || 'groq';

    if (provider !== 'backend') {
      const key = this.getEffectiveKey();
      if (!key) {
        return { success: false, message: 'Please enter an API key for ' + (PROVIDERS[provider]?.name || provider) };
      }
    }

    try {
      if (provider === 'gemini') {
        const key = this.getEffectiveKey();
        const model = s.model || 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          return { success: false, message: `Error ${res.status}: ${errJson.error?.message || res.statusText}` };
        }
        return { success: true, message: `Connected to Google Gemini (${model})!` };
      }

      const baseUrl = this.getEffectiveBaseUrl();
      const endpoint = `${baseUrl}/chat/completions`;
      const key = this.getEffectiveKey();
      let model = s.model || (PROVIDERS[provider] ? PROVIDERS[provider].defaultModel : 'openai/gpt-oss-20b');
      if (provider === 'groq' && (!model || model.includes('llama'))) {
        model = 'openai/gpt-oss-20b';
      }

      const headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = `Bearer ${key}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 15,
          temperature: 0.2
        })
      });

      if (!res.ok) {
        let errDetail = '';
        try {
          const errJson = await res.json();
          errDetail = errJson.error?.message || JSON.stringify(errJson);
        } catch (e) {
          errDetail = res.statusText || `HTTP ${res.status}`;
        }
        return { success: false, message: `Error ${res.status}: ${errDetail}` };
      }

      return { success: true, message: `Connected to ${PROVIDERS[provider]?.name || provider} (${model})!` };
    } catch (err) {
      return { success: false, message: `Network error: ${err.message}` };
    }
  }

  async sendMessage({ messages, onChunk, onComplete, onError }) {
    this.stopStreaming();
    this.abortController = new AbortController();

    const s = this.settings;
    const provider = s.provider || 'groq';

    if (provider !== 'backend' && !this.getEffectiveKey()) {
      onError(new Error(`API key missing for ${PROVIDERS[provider]?.name || provider}. Configure in Settings.`));
      return;
    }

    try {
      // ---- GEMINI branch ----
      if (provider === 'gemini') {
        await this._sendGemini({ messages, onChunk, onComplete, onError });
        return;
      }

      // ---- OpenAI-compatible branch (Groq, OpenAI, Custom, Backend) ----
      const baseUrl = this.getEffectiveBaseUrl();
      const endpoint = `${baseUrl}/chat/completions`;
      const key = this.getEffectiveKey();

      const payloadMessages = [];
      if (s.systemPrompt && s.systemPrompt.trim()) {
        payloadMessages.push({ role: 'system', content: s.systemPrompt.trim() });
      }
      messages.forEach(m => {
        payloadMessages.push({ role: m.role, content: m.content });
      });

      let model = s.model || (PROVIDERS[provider] ? PROVIDERS[provider].defaultModel : 'openai/gpt-oss-20b');
      if (provider === 'groq' && (!model || model.includes('llama'))) {
        model = 'openai/gpt-oss-20b';
      }
      const stream = s.stream !== false;

      const headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = `Bearer ${key}`;

      const body = {
        model,
        messages: payloadMessages,
        temperature: parseFloat(s.temperature ?? 0.7),
        max_tokens: parseInt(s.maxTokens ?? 4096, 10),
        stream
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        let errorMsg = `Server returned status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error?.message) errorMsg = errData.error.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      if (!stream) {
        const data = await response.json();
        const choice = data.choices?.[0]?.message || {};
        const text = choice.content || '';
        onChunk(text, text, '');
        onComplete(text, false, '');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let fullReasoning = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta || {};
              const deltaContent = delta.content || '';
              const deltaReasoning = delta.reasoning || '';

              if (deltaReasoning) {
                fullReasoning += deltaReasoning;
                onChunk(deltaReasoning, fullText, fullReasoning);
              }
              if (deltaContent) {
                fullText += deltaContent;
                onChunk(deltaContent, fullText, fullReasoning);
              }
            } catch (err) {
              // partial JSON — ignore
            }
          }
        }
      }

      onComplete(fullText, false, fullReasoning);
    } catch (err) {
      if (err.name === 'AbortError') {
        onComplete(null, true);
      } else {
        onError(err);
      }
    } finally {
      this.abortController = null;
    }
  }

  async _sendGemini({ messages, onChunk, onComplete, onError }) {
    const s = this.settings;
    const key = this.getEffectiveKey();
    const model = s.model || 'gemini-2.0-flash';

    // Build Gemini contents format
    const contents = [];
    if (s.systemPrompt && s.systemPrompt.trim()) {
      contents.push({ role: 'user', parts: [{ text: `[System]: ${s.systemPrompt.trim()}` }] });
      contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
    }
    messages.forEach(m => {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      });
    });

    const stream = s.stream !== false;
    const endpoint = stream
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const body = {
      contents,
      generationConfig: {
        temperature: parseFloat(s.temperature ?? 0.7),
        maxOutputTokens: parseInt(s.maxTokens ?? 4096, 10),
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        let errorMsg = `Gemini API error ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error?.message) errorMsg = errData.error.message;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      if (!stream) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        onChunk(text, text, '');
        onComplete(text, false, '');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (chunk) {
                fullText += chunk;
                onChunk(chunk, fullText, '');
              }
            } catch (_) {}
          }
        }
      }

      onComplete(fullText, false, '');
    } catch (err) {
      if (err.name === 'AbortError') {
        onComplete(null, true);
      } else {
        onError(err);
      }
    }
  }
}
