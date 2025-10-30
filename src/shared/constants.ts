/**
 * Constants used across the extension
 */

import { ModelConfig, ModelProvider } from './types';

export const DEFAULT_MODEL: ModelProvider = 'openai';

export const MODEL_CONFIGS: Record<ModelProvider, ModelConfig> = {
	openai: {
		provider: 'openai',
		name: 'ChatGPT',
		requiresApiKey: true,
		maxTokens: 4096,
		temperature: 0.7,
	},
	anthropic: {
		provider: 'anthropic',
		name: 'Claude',
		requiresApiKey: true,
		maxTokens: 4096,
		temperature: 0.7,
	},
	huggingface: {
		provider: 'huggingface',
		name: 'HuggingFace',
		requiresApiKey: false,
		maxTokens: 2048,
		temperature: 0.7,
	},
	ollama: {
		provider: 'ollama',
		name: 'Ollama (Local)',
		requiresApiKey: false,
		endpoint: 'http://localhost:11434',
		maxTokens: 2048,
		temperature: 0.7,
	},
	free: {
		provider: 'free',
		name: 'Free Model',
		requiresApiKey: false,
		maxTokens: 1024,
		temperature: 0.7,
	},
};

export const STORAGE_KEYS = {
	API_KEYS: 'pagepilot_api_keys',
	PREFERENCES: 'pagepilot_preferences',
	CHAT_HISTORY: 'pagepilot_chat_history',
	EXTENSION_STATE: 'pagepilot_extension_state',
} as const;

export const PRIVACY_BANNER_MESSAGE = {
	external: 'Data will be sent to an external AI service',
	local: 'Processing locally - no data will be sent externally',
} as const;
