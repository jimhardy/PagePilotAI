/**
 * Shared types and interfaces for PagePilot extension
 */

export type ModelProvider =
	| 'openai'
	| 'anthropic'
	| 'huggingface'
	| 'ollama'
	| 'free';

export interface ApiKeys {
	openai?: string;
	anthropic?: string;
	huggingface?: string;
	ollama?: string;
}

export interface UserPreferences {
	defaultModel: ModelProvider;
	ollamaEndpoint?: string;
	huggingfaceEndpoint?: string;
	privacyMode: boolean; // Require approval before sending data
	autoContextExtraction: boolean;
	theme: 'light' | 'dark' | 'auto';
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: number;
	metadata?: {
		model?: ModelProvider;
		tokensUsed?: number;
		contextExtracted?: boolean;
	};
}

export interface ContextData {
	url: string;
	title: string;
	visibleText: string;
	headings: Array<{ level: number; text: string }>;
	selectedText?: string;
	formFields?: Array<{
		id?: string;
		name?: string;
		type: string;
		label?: string;
		value?: string;
		placeholder?: string;
	}>;
	clickableElements?: Array<{
		id?: string;
		name?: string;
		tagName: string;
		text?: string;
		type?: string;
		role?: string;
		href?: string;
	}>;
	metadata: {
		extractedAt: number;
		wordCount: number;
	};
}

export interface ModelConfig {
	provider: ModelProvider;
	name: string;
	requiresApiKey: boolean;
	endpoint?: string;
	maxTokens?: number;
	temperature?: number;
}

export interface ApiRequest {
	messages: ChatMessage[];
	context?: ContextData;
	model: ModelProvider;
	stream?: boolean;
}

export interface ApiResponse {
	content: string;
	model: ModelProvider;
	tokensUsed?: number;
	error?: string;
}

export interface ExtensionState {
	isOpen: boolean;
	position: { x: number; y: number };
	isDragging: boolean;
	currentModel: ModelProvider;
}
