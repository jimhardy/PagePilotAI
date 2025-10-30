/**
 * Anthropic Claude connector
 */

import { BaseModelConnector } from '../model-connector';
import { ApiRequest, ApiResponse, ModelProvider } from '../types';

export class AnthropicConnector extends BaseModelConnector {
	provider: ModelProvider = 'anthropic';
	private apiKey: string;
	private endpoint = 'https://api.anthropic.com/v1/messages';

	constructor(apiKey: string) {
		super();
		this.apiKey = apiKey;
	}

	isAvailable(): boolean {
		return !!this.apiKey && this.apiKey.length > 0;
	}

	async sendMessage(request: ApiRequest): Promise<ApiResponse> {
		if (!this.isAvailable()) {
			throw new Error('Anthropic API key not configured');
		}

		try {
			// Convert messages to Anthropic format
			const messages = request.messages
				.filter((msg) => msg.role !== 'system')
				.map((msg) => ({
					role: msg.role === 'assistant' ? 'assistant' : 'user',
					content: msg.content,
				}));

			// Extract system message if present
			const systemMessage = request.messages.find(
				(msg) => msg.role === 'system'
			)?.content;

			const response = await fetch(this.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify({
					model: 'claude-3-haiku-20240307',
					max_tokens: 4096,
					messages,
					...(systemMessage && { system: systemMessage }),
				}),
			});

			if (!response.ok) {
				const error = await response
					.json()
					.catch(() => ({ error: { message: response.statusText } }));
				throw new Error(error.error?.message || `HTTP ${response.status}`);
			}

			const data = await response.json();
			const content = data.content[0]?.text || '';

			return {
				content,
				model: this.provider,
				tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
			};
		} catch (error) {
			this.handleError(error);
		}
	}
}
