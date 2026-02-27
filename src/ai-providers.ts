export type AIProvider = 'gemini' | 'zai' | 'openai' | 'deepseek' | 'custom';

export interface AISettings {
    provider: AIProvider;
    apiKey: string;
    model: string;
    customBaseUrl: string;
}

export interface ProviderInfo {
    id: AIProvider;
    name: string;
    defaultModel: string;
    models: string[];
    baseUrl: string;
    placeholder: string;
}

export const PROVIDERS: ProviderInfo[] = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        defaultModel: 'gemini-2.5-flash',
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
        baseUrl: '',
        placeholder: 'AIza...',
    },
    {
        id: 'zai',
        name: 'Z AI (智谱)',
        defaultModel: 'glm-5',
        models: ['glm-5', 'glm-4.7', 'glm-4.5'],
        baseUrl: 'https://api.z.ai/api/paas/v4',
        placeholder: 'Your Z AI API Key',
    },
    {
        id: 'openai',
        name: 'OpenAI',
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
        baseUrl: 'https://api.openai.com/v1',
        placeholder: 'sk-...',
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        defaultModel: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        baseUrl: 'https://api.deepseek.com/v1',
        placeholder: 'sk-...',
    },
    {
        id: 'custom',
        name: 'Custom (OpenAI Compatible)',
        defaultModel: '',
        models: [],
        baseUrl: '',
        placeholder: 'Your API Key',
    },
];

const AI_SETTINGS_KEY = 'agentic_ai_settings';

export function getAISettings(): AISettings {
    try {
        const data = localStorage.getItem(AI_SETTINGS_KEY);
        if (data) return JSON.parse(data);
    } catch { }
    return {
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-2.5-flash',
        customBaseUrl: '',
    };
}

export function saveAISettings(settings: AISettings): void {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}

export function getProviderInfo(id: AIProvider): ProviderInfo {
    return PROVIDERS.find(p => p.id === id) || PROVIDERS[0];
}

interface ChatMessage {
    role: 'user' | 'model' | 'assistant' | 'system';
    content: string;
}

export async function generateAIResponse(
    settings: AISettings,
    messages: ChatMessage[],
    systemInstruction: string
): Promise<string> {
    if (!settings.apiKey) {
        return '⚠️ Please set your API key in Settings (gear icon in the header).';
    }

    if (settings.provider === 'gemini') {
        return generateGeminiResponse(settings, messages, systemInstruction);
    } else {
        return generateOpenAICompatibleResponse(settings, messages, systemInstruction);
    }
}

// ─── Gemini (uses @google/genai SDK) ─────────────────────────

async function generateGeminiResponse(
    settings: AISettings,
    messages: ChatMessage[],
    systemInstruction: string
): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: settings.apiKey });

    const contents = messages.map(m => ({
        role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
        model: settings.model || 'gemini-2.5-flash',
        contents,
        config: { systemInstruction },
    });

    return response.text || "I'm sorry, I couldn't process that.";
}

// ─── OpenAI-compatible (Z AI, OpenAI, DeepSeek, Custom) ─────

async function generateOpenAICompatibleResponse(
    settings: AISettings,
    messages: ChatMessage[],
    systemInstruction: string
): Promise<string> {
    const provider = getProviderInfo(settings.provider);
    const baseUrl = settings.provider === 'custom'
        ? settings.customBaseUrl.replace(/\/+$/, '')
        : provider.baseUrl;

    if (!baseUrl) {
        return '⚠️ Please set the API base URL for your custom provider.';
    }

    const openaiMessages = [
        { role: 'system' as const, content: systemInstruction },
        ...messages.map(m => ({
            role: (m.role === 'model' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
            content: m.content,
        })),
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
            model: settings.model || provider.defaultModel,
            messages: openaiMessages,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('AI API Error:', err);
        return `⚠️ API Error (${response.status}): ${err.substring(0, 200)}`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that.";
}
