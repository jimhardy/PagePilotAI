/**
 * Base interface for AI model connectors
 */

import { ApiRequest, ApiResponse, ModelProvider } from './types';

export interface IModelConnector {
	provider: ModelProvider;
	sendMessage(request: ApiRequest): Promise<ApiResponse>;
	isAvailable(apiKey?: string): boolean;
}

/**
 * Base connector with common error handling
 */
export abstract class BaseModelConnector implements IModelConnector {
	abstract provider: ModelProvider;

	abstract sendMessage(request: ApiRequest): Promise<ApiResponse>;

	isAvailable(_apiKey?: string): boolean {
		return true; // Override in subclasses that require API keys
	}

	protected handleError(error: unknown): never {
		if (error instanceof Error) {
			throw new Error(`API Error (${this.provider}): ${error.message}`);
		}
		throw new Error(`Unknown error from ${this.provider}`);
	}
}
