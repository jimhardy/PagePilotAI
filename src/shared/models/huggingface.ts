/**
 * HuggingFace free model connector
 * Uses free inference API endpoints
 */

import { BaseModelConnector } from '../model-connector';
import { ApiRequest, ApiResponse, ModelProvider } from '../types';

export class HuggingFaceConnector extends BaseModelConnector {
	provider: ModelProvider = 'huggingface';
	private endpoint =
		'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium';

	async sendMessage(request: ApiRequest): Promise<ApiResponse> {
		try {
			// Get the last user message
			const lastUserMessage = [...request.messages]
				.reverse()
				.find((msg) => msg.role === 'user');
			if (!lastUserMessage) {
				throw new Error('No user message found');
			}

			// HuggingFace DialoGPT format - simplified for free tier
			const response = await fetch(this.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					inputs: {
						past_user_inputs: [],
						generated_responses: [],
						text: lastUserMessage.content,
					},
				}),
			});

			if (!response.ok) {
				// For free tier, might need to wait for model to load
				if (response.status === 503) {
					throw new Error('Model is loading, please try again in a moment');
				}
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			const content =
				data.generated_text ||
				data[0]?.generated_text ||
				'Unable to generate response';

			return {
				content,
				model: this.provider,
			};
		} catch (error) {
			this.handleError(error);
		}
	}
}
