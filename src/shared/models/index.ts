/**
 * Model connector factory
 */

import { ModelProvider, ApiKeys } from '../types.js';
import { OpenAIConnector } from './openai.js';
import { AnthropicConnector } from './anthropic.js';
import { HuggingFaceConnector } from './huggingface.js';
import { OllamaConnector } from './ollama.js';
import { FreeModelConnector } from './free.js';
import { IModelConnector } from '../model-connector';
import { getApiKeys, getPreferences } from '../storage.js';

/**
 * Create a model connector instance based on provider
 */
export function createConnector(
	provider: ModelProvider,
	apiKeys: ApiKeys,
	preferences?: { ollamaEndpoint?: string; huggingfaceEndpoint?: string }
): IModelConnector {
	switch (provider) {
		case 'openai':
			return new OpenAIConnector(apiKeys.openai || '');
		case 'anthropic':
			return new AnthropicConnector(apiKeys.anthropic || '');
		case 'huggingface':
			return new HuggingFaceConnector();
		case 'ollama':
			return new OllamaConnector(preferences?.ollamaEndpoint);
		case 'free':
			return new FreeModelConnector();
		default:
			return new FreeModelConnector();
	}
}

/**
 * Get available models based on configured API keys
 * Uses static imports to avoid issues in service worker context
 */
export async function getAvailableModels(): Promise<ModelProvider[]> {
	const apiKeys = await getApiKeys();
	const preferences = await getPreferences();

	const available: ModelProvider[] = ['free']; // Free is always available

	// Check for API keys (trimmed to handle whitespace)
	if (apiKeys.openai && apiKeys.openai.trim().length > 0) {
		available.push('openai');
	}
	if (apiKeys.anthropic && apiKeys.anthropic.trim().length > 0) {
		available.push('anthropic');
	}
	if (
		(apiKeys.huggingface && apiKeys.huggingface.trim().length > 0) ||
		preferences.huggingfaceEndpoint
	) {
		available.push('huggingface');
	}
	if (
		preferences.ollamaEndpoint &&
		preferences.ollamaEndpoint.trim().length > 0
	) {
		available.push('ollama');
	}

	return available;
}
