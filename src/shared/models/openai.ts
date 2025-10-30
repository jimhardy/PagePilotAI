/**
 * OpenAI ChatGPT connector
 */

import { BaseModelConnector } from '../model-connector';
import { ApiRequest, ApiResponse, ModelProvider } from '../types';

export class OpenAIConnector extends BaseModelConnector {
	provider: ModelProvider = 'openai';
	private apiKey: string;
	private endpoint = 'https://api.openai.com/v1/chat/completions';

	constructor(apiKey: string) {
		super();
		this.apiKey = apiKey;
	}

	isAvailable(): boolean {
		return !!this.apiKey && this.apiKey.length > 0;
	}

	async sendMessage(request: ApiRequest): Promise<ApiResponse> {
		if (!this.isAvailable()) {
			throw new Error('OpenAI API key not configured');
		}

		try {
			const response = await fetch(this.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					model: 'gpt-3.5-turbo',
					messages: request.messages.map((msg) => ({
						role: msg.role,
						content: msg.content,
					})),
					max_tokens: 4096,
					temperature: 0.7,
				}),
			});

			if (!response.ok) {
				const error = await response
					.json()
					.catch(() => ({ error: { message: response.statusText } }));

				const errorMessage = error.error?.message || `HTTP ${response.status}`;
				const errorType = error.error?.type || error.error?.code || '';

				// Handle quota/billing errors with helpful guidance
				if (
					errorMessage.toLowerCase().includes('quota') ||
					errorMessage.toLowerCase().includes('exceeded') ||
					errorType === 'insufficient_quota' ||
					errorType === 'billing_not_active'
				) {
					throw new Error(
						`OpenAI quota/billing error: ${errorMessage}\n\n` +
							`Common causes:\n` +
							`• No payment method added to your OpenAI account\n` +
							`• Account credits exhausted\n` +
							`• API key from expired free tier\n\n` +
							`Fix it: https://platform.openai.com/account/billing`
					);
				}

				throw new Error(errorMessage);
			}

			const data = await response.json();
			const content = data.choices[0]?.message?.content || '';

			return {
				content,
				model: this.provider,
				tokensUsed: data.usage?.total_tokens,
			};
		} catch (error) {
			this.handleError(error);
		}
	}
}
