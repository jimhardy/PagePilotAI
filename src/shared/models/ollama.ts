/**
 * Ollama local model connector
 */

import { BaseModelConnector } from '../model-connector';
import { ApiRequest, ApiResponse, ModelProvider } from '../types';

export class OllamaConnector extends BaseModelConnector {
	provider: ModelProvider = 'ollama';
	private endpoint: string;

	constructor(endpoint?: string) {
		super();
		this.endpoint = endpoint || 'http://localhost:11434';
	}

	async sendMessage(request: ApiRequest): Promise<ApiResponse> {
		try {
			// Convert messages to Ollama format
			const prompt =
				request.messages
					.map((msg) => {
						const role = msg.role === 'assistant' ? 'Assistant' : 'User';
						return `${role}: ${msg.content}`;
					})
					.join('\n') + '\nAssistant:';

			const response = await fetch(`${this.endpoint}/api/generate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: 'llama2', // Default model, can be configured
					prompt,
					stream: false,
				}),
			});

			if (!response.ok) {
				if (response.status === 404 || response.status === 0) {
					throw new Error(
						"Ollama server not running. Please start Ollama and ensure it's accessible."
					);
				}
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			const content = data.response || '';

			return {
				content,
				model: this.provider,
			};
		} catch (error) {
			if (error instanceof TypeError && error.message.includes('fetch')) {
				throw new Error(
					'Cannot connect to Ollama. Make sure Ollama is running on ' +
						this.endpoint
				);
			}
			this.handleError(error);
		}
	}
}
