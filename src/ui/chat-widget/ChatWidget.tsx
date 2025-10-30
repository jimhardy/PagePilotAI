/**
 * Main chat widget component
 * Floating, draggable chat interface
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ModelProvider, ContextData } from '@/shared/types';
import { MODEL_CONFIGS } from '@/shared/constants';
import { containsDangerousCode, sanitizeResponse } from '@/shared/safety';

interface ChatWidgetProps {
	onClose: () => void;
	tabId: number;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
	onClose,
	tabId: _tabId,
}) => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [currentModel, setCurrentModel] = useState<ModelProvider>('free');
	const [availableModels, setAvailableModels] = useState<ModelProvider[]>([
		'free',
	]);
	const [context, setContext] = useState<ContextData | null>(null);
	const [showPrivacyBanner, setShowPrivacyBanner] = useState(false);
	const [pendingFormAction, setPendingFormAction] = useState<{
		fields: Array<{
			id?: string;
			name?: string;
			label?: string;
			value: string;
		}>;
	} | null>(null);
	const [pendingClickAction, setPendingClickAction] = useState<{
		id?: string;
		name?: string;
		text?: string;
	} | null>(null);
	const [pendingHighlightAction, setPendingHighlightAction] = useState<{
		id?: string;
		name?: string;
		text?: string;
	} | null>(null);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const widgetRef = useRef<HTMLDivElement>(null);

	// Load chat history and available models
	useEffect(() => {
		loadChatHistory();
		loadAvailableModels();
		extractPageContext();

		// Listen for messages from content script (form filling and click results)
		const handleMessage = (event: MessageEvent) => {
			// Trigger context refresh when the content script detects navigation/major DOM changes
			if (event.data.type === 'CONTEXT_UPDATE_NEEDED') {
				extractPageContext();
				return;
			}
			if (event.data.type === 'FILL_FORM_RESULT') {
				const { success, filled, failed, error } = event.data;
				if (success) {
					const resultMessage: ChatMessage = {
						id: `result-${Date.now()}`,
						role: 'assistant',
						content: `✅ Form filled successfully! ${filled} field(s) filled, ${failed} failed.`,
						timestamp: Date.now(),
					};
					setMessages((prev) => [...prev, resultMessage]);
				} else {
					const errorMessage: ChatMessage = {
						id: `error-${Date.now()}`,
						role: 'assistant',
						content: `❌ Failed to fill form: ${error || 'Unknown error'}`,
						timestamp: Date.now(),
					};
					setMessages((prev) => [...prev, errorMessage]);
				}
				setPendingFormAction(null);
			} else if (event.data.type === 'CLICK_RESULT') {
				const { success, error, elementText } = event.data;
				if (success) {
					const resultMessage: ChatMessage = {
						id: `result-${Date.now()}`,
						role: 'assistant',
						content: `✅ Successfully clicked: ${elementText || 'element'}`,
						timestamp: Date.now(),
					};
					setMessages((prev) => [...prev, resultMessage]);
				} else {
					const errorMessage: ChatMessage = {
						id: `error-${Date.now()}`,
						role: 'assistant',
						content: `❌ Failed to click element: ${error || 'Unknown error'}`,
						timestamp: Date.now(),
					};
					setMessages((prev) => [...prev, errorMessage]);
				}
				setPendingClickAction(null);
			} else if (event.data.type === 'HIGHLIGHT_RESULT') {
				const { success, error, elementText } = event.data;
				if (success) {
					const resultMessage: ChatMessage = {
						id: `result-${Date.now()}`,
						role: 'assistant',
						content: `🔎 Highlighted: ${elementText || 'element'}`,
						timestamp: Date.now(),
					};
					setMessages((prev) => [...prev, resultMessage]);
				} else {
					const errorMessage: ChatMessage = {
						id: `error-${Date.now()}`,
						role: 'assistant',
						content: `❌ Failed to highlight element: ${error || 'Unknown error'}`,
						timestamp: Date.now(),
					};
					setMessages((prev) => [...prev, errorMessage]);
				}
				setPendingHighlightAction(null);
			}
		};

		window.addEventListener('message', handleMessage);

		// Listen for storage changes (when API keys are saved in options page)
		const handleStorageChange = (
			changes: { [key: string]: chrome.storage.StorageChange },
			_areaName: string
		) => {
			// Check if API keys or preferences changed (using actual storage keys)
			if (changes['pagepilot_api_keys'] || changes['pagepilot_preferences']) {
				console.log(
					'PagePilot: Storage changed, reloading available models...'
				);
				// Reload available models when keys are updated
				loadAvailableModels();
			}
		};

		chrome.storage.onChanged.addListener(handleStorageChange);

		return () => {
			window.removeEventListener('message', handleMessage);
			chrome.storage.onChanged.removeListener(handleStorageChange);
		};
	}, []);

	// Scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const loadChatHistory = async () => {
		try {
			const response = await chrome.runtime.sendMessage({
				type: 'GET_CHAT_HISTORY',
			});
			if (response?.history) {
				setMessages(response.history);
			}
		} catch (error) {
			console.error('Failed to load chat history:', error);
		}
	};

	const loadAvailableModels = async () => {
		try {
			const response = await chrome.runtime.sendMessage({
				type: 'GET_AVAILABLE_MODELS',
			});
			if (response?.models) {
				console.log('PagePilot: Available models loaded:', response.models);
				setAvailableModels(response.models);

				// Default to first paid model if available, otherwise free
				// Priority: openai > anthropic > ollama > huggingface > free
				const priorityOrder: ModelProvider[] = [
					'openai',
					'anthropic',
					'ollama',
					'huggingface',
					'free',
				];
				const preferredModel =
					priorityOrder.find((model) => response.models.includes(model)) ||
					response.models[0] ||
					'free';

				setCurrentModel((prevModel) => {
					// If current model is no longer available, switch to preferred
					if (!response.models.includes(prevModel)) {
						return preferredModel;
					}
					// If current is free but paid models are available, upgrade to preferred
					if (prevModel === 'free' && preferredModel !== 'free') {
						return preferredModel;
					}
					return prevModel;
				});
			} else {
				console.warn('PagePilot: No models in response:', response);
			}
		} catch (error) {
			console.error('Failed to load models:', error);
		}
	};

	const extractPageContext = async () => {
		// Request context extraction from content script (which has access to the actual page)
		if (!window.parent) return; // Not in iframe

		try {
			// Send message to parent (content script) to extract context
			window.parent.postMessage({ type: 'EXTRACT_CONTEXT' }, '*');

			// Listen for context response
			const handleMessage = (event: MessageEvent) => {
				if (event.data.type === 'CONTEXT_EXTRACTED') {
					if (event.data.error) {
						console.error(
							'PagePilot: Context extraction error:',
							event.data.error
						);
						setContext(null);
					} else {
						setContext(event.data.context);
					}
					window.removeEventListener('message', handleMessage);
				}
			};

			window.addEventListener('message', handleMessage);

			// Timeout after 5 seconds
			setTimeout(() => {
				window.removeEventListener('message', handleMessage);
			}, 5000);
		} catch (error) {
			console.error('PagePilot: Failed to request context:', error);
		}
	};

	const handleSend = async () => {
		if (!input.trim() || isLoading) return;

		const userMessage: ChatMessage = {
			id: `user-${Date.now()}`,
			role: 'user',
			content: input,
			timestamp: Date.now(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput('');

		// Local command: handle without sending to model, but preserve user message
		const local = parseLocalCommand(userMessage.content.trim());
		if (local && local.type === 'HIGHLIGHT' && local.target) {
			setPendingHighlightAction(local.target);
			return;
		}
		setIsLoading(true);
		setShowPrivacyBanner(false);

		// Check if this is an external model
		const isExternal = currentModel !== 'free' && currentModel !== 'ollama';
		if (isExternal) {
			setShowPrivacyBanner(true);
		}

		try {
			const response = await chrome.runtime.sendMessage({
				type: 'SEND_MESSAGE',
				payload: {
					message: input,
					model: currentModel,
					context: context || undefined,
					includeContext: true,
				},
			});

			if (response.error) {
				throw new Error(response.error);
			}

			// Safety check - sanitize response
			let safeContent = response.content;
			if (containsDangerousCode(response.content)) {
				safeContent = sanitizeResponse(response.content);
				console.warn(
					'Potentially dangerous code detected in AI response, sanitized'
				);
			}

			// Parse for form filling actions
			const fillFormMatch = safeContent.match(
				/<!--PAGEPILOT_ACTION:FILL_FORM:([\s\S]*?)-->/
			);
			if (fillFormMatch) {
				try {
					const fields = JSON.parse(fillFormMatch[1]);
					if (Array.isArray(fields) && fields.length > 0) {
						setPendingFormAction({ fields });
						console.log(
							`PagePilot: Parsed ${fields.length} fields for form filling`
						);
					}
					// Remove the action marker from displayed content
					safeContent = safeContent.replace(
						/<!--PAGEPILOT_ACTION:FILL_FORM:.*?-->/gs,
						''
					);
				} catch (e) {
					console.error('Failed to parse form action:', e);
					console.error('Action content:', fillFormMatch[1].substring(0, 500));
				}
			}

			// Parse for click actions
			const clickMatch = safeContent.match(
				/<!--PAGEPILOT_ACTION:CLICK:({[\s\S]*?})-->/
			);
			if (clickMatch) {
				try {
					const clickTarget = JSON.parse(clickMatch[1]);
					if (clickTarget.id || clickTarget.name || clickTarget.text) {
						setPendingClickAction(clickTarget);
						console.log('PagePilot: Parsed click action:', clickTarget);
					}
					// Remove the action marker from displayed content
					safeContent = safeContent.replace(
						/<!--PAGEPILOT_ACTION:CLICK:.*?-->/gs,
						''
					);
				} catch (e) {
					console.error('Failed to parse click action:', e);
				}
			}

			// Parse for highlight actions
			const highlightMatch = safeContent.match(
				/<!--PAGEPILOT_ACTION:HIGHLIGHT:({[\s\S]*?})-->/
			);
			if (highlightMatch) {
				try {
					const highlightTarget = JSON.parse(highlightMatch[1]);
					if (highlightTarget.id || highlightTarget.name || highlightTarget.text) {
						setPendingHighlightAction(highlightTarget);
						console.log('PagePilot: Parsed highlight action:', highlightTarget);
					}
					// Remove the action marker from displayed content
					safeContent = safeContent.replace(
						/<!--PAGEPILOT_ACTION:HIGHLIGHT:.*?-->/gs,
						''
					);
				} catch (e) {
					console.error('Failed to parse highlight action:', e);
				}
			}

			const assistantMessage: ChatMessage = {
				id: `assistant-${Date.now()}`,
				role: 'assistant',
				content: safeContent,
				timestamp: Date.now(),
				metadata: {
					model: currentModel,
				},
			};

			setMessages((prev) => [...prev, assistantMessage]);
			await loadChatHistory(); // Reload to sync with storage
		} catch (error: any) {
			const errorMessage: ChatMessage = {
				id: `error-${Date.now()}`,
				role: 'assistant',
				content: `Error: ${error.message || 'Failed to get response'}`,
				timestamp: Date.now(),
			};
			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	};

	function parseLocalCommand(raw: string):
		| { type: 'HIGHLIGHT'; target: { id?: string; name?: string; text?: string } }
		| null {
		// Normalize variants like "highlight:" and "scroll to:"
		const normalized = raw.replace(/^\s*(highlight|scroll(?:\s+to)?)\s*:\s*/i, (_m, g1) => {
			return g1.toLowerCase();
		});

		// highlight "..."
		const mDoubleQuoted = normalized.match(/^\s*highlight\s+"([\s\S]+?)"\s*$/i);
		if (mDoubleQuoted) {
			return { type: 'HIGHLIGHT', target: { text: mDoubleQuoted[1].trim() } };
		}
		// highlight '...'
		const mSingleQuoted = normalized.match(/^\s*highlight\s+'([\s\S]+?)'\s*$/i);
		if (mSingleQuoted) {
			return { type: 'HIGHLIGHT', target: { text: mSingleQuoted[1].trim() } };
		}
		// scroll to "..." | scroll "..."
		const mScrollDouble = normalized.match(/^\s*scroll(?:\s+to)?\s+"([\s\S]+?)"\s*$/i);
		if (mScrollDouble) {
			return { type: 'HIGHLIGHT', target: { text: mScrollDouble[1].trim() } };
		}
		const mScrollSingle = normalized.match(/^\s*scroll(?:\s+to)?\s+'([\s\S]+?)'\s*$/i);
		if (mScrollSingle) {
			return { type: 'HIGHLIGHT', target: { text: mScrollSingle[1].trim() } };
		}
		// scroll to text without quotes
		const mScrollBare = normalized.match(/^\s*scroll(?:\s+to)?\s+([\s\S]+?)\s*$/i);
		if (mScrollBare) {
			return { type: 'HIGHLIGHT', target: { text: mScrollBare[1].trim() } };
		}
		// highlight text without quotes
		const mHighlightBare = normalized.match(/^\s*highlight\s+([\s\S]+?)\s*$/i);
		if (mHighlightBare) {
			// also allow id= or name= syntax here; if not present, treat as text
			const maybeId = mHighlightBare[1].match(/^id=(\S+)$/i);
			if (maybeId) {
				return { type: 'HIGHLIGHT', target: { id: maybeId[1] } };
			}
			const maybeName = mHighlightBare[1].match(/^name=(\S+)$/i);
			if (maybeName) {
				return { type: 'HIGHLIGHT', target: { name: maybeName[1] } };
			}
			return { type: 'HIGHLIGHT', target: { text: mHighlightBare[1].trim() } };
		}
		const mId = normalized.match(/^\s*highlight\s+id=(\S+)\s*$/i);
		if (mId) {
			return { type: 'HIGHLIGHT', target: { id: mId[1] } };
		}
		const mName = normalized.match(/^\s*highlight\s+name=(\S+)\s*$/i);
		if (mName) {
			return { type: 'HIGHLIGHT', target: { name: mName[1] } };
		}
		return null;
	}

	// Drag handling disabled - widget fills iframe completely
	// The iframe itself can be repositioned by the content script if needed

	return (
		<div
			ref={widgetRef}
			className="absolute inset-0 w-full h-full bg-white dark:bg-gray-900 flex flex-col font-sans"
		>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 select-none bg-gradient-to-r from-primary-500 to-primary-600 text-white">
				<div className="flex items-center gap-2">
					<h2 className="text-lg font-semibold">PagePilot</h2>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={async () => {
							// Clear chat history
							try {
								await chrome.runtime.sendMessage({
									type: 'CLEAR_CHAT_HISTORY',
								});
								setMessages([]);
								setPendingFormAction(null);
								setPendingClickAction(null);
								console.log('PagePilot: Chat history cleared');
							} catch (error) {
								console.error('Failed to clear chat history:', error);
							}
						}}
						className="text-white hover:bg-white/20 rounded px-2 py-1 text-sm transition-colors"
						title="New Chat"
					>
						New Chat
					</button>
					<select
						value={currentModel}
						onChange={(e) => setCurrentModel(e.target.value as ModelProvider)}
						className="bg-white/20 text-white text-sm px-2 py-1 rounded border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
						onClick={(e) => e.stopPropagation()}
					>
						{availableModels.map((model) => (
							<option key={model} value={model} className="text-gray-900">
								{MODEL_CONFIGS[model].name}
							</option>
						))}
					</select>
					<button
						onClick={onClose}
						className="text-white hover:bg-white/20 rounded p-1 transition-colors"
						title="Close"
					>
						✕
					</button>
				</div>
			</div>

			{/* Privacy Banner */}
			{showPrivacyBanner && (
				<div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-200">
					⚠️ Data will be sent to {MODEL_CONFIGS[currentModel].name}
				</div>
			)}

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
				{messages.length === 0 && (
					<div className="text-center text-gray-500 dark:text-gray-400 mt-8">
						<p className="text-sm">Ask me anything about this page!</p>
						<p className="text-xs mt-2">
							I can summarize, explain, or help with forms.
						</p>
					</div>
				)}

				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex ${
							msg.role === 'user' ? 'justify-end' : 'justify-start'
						}`}
					>
						<div
							className={`max-w-[80%] rounded-lg px-3 py-2 ${
								msg.role === 'user'
									? 'bg-primary-500 text-white'
									: 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
							}`}
						>
							<p className="text-sm whitespace-pre-wrap break-words">
								{msg.content}
							</p>
							{msg.metadata?.model && (
								<p className="text-xs opacity-70 mt-1">
									{MODEL_CONFIGS[msg.metadata.model].name}
								</p>
							)}
						</div>
					</div>
				))}

				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-white dark:bg-gray-700 rounded-lg px-3 py-2">
							<div className="flex gap-1">
								<div
									className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
									style={{ animationDelay: '0ms' }}
								/>
								<div
									className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
									style={{ animationDelay: '150ms' }}
								/>
								<div
									className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
									style={{ animationDelay: '300ms' }}
								/>
							</div>
						</div>
					</div>
				)}

				{/* Click action confirmation */}
				{pendingClickAction && (
					<div className="flex justify-start">
						<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 max-w-[80%]">
							<p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
								Ready to click element
							</p>
							<div className="text-xs text-green-800 dark:text-green-200 mb-3 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
								{pendingClickAction.id && `ID: ${pendingClickAction.id}`}
								{pendingClickAction.name && `Name: ${pendingClickAction.name}`}
								{pendingClickAction.text &&
									`Text: "${pendingClickAction.text}"`}
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => {
										if (window.parent) {
											window.parent.postMessage(
												{
													type: 'CLICK_ELEMENT',
													target: pendingClickAction,
													confirm: true,
												},
												'*'
											);
										}
									}}
									className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
								>
									Confirm
								</button>
								<button
									onClick={() => setPendingClickAction(null)}
									className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Highlight action confirmation */}
				{pendingHighlightAction && (
					<div className="flex justify-start">
						<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 max-w-[80%]">
							<p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
								Scroll to and highlight element
							</p>
							<div className="text-xs text-yellow-800 dark:text-yellow-200 mb-3 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
								{pendingHighlightAction.id && `ID: ${pendingHighlightAction.id}`}
								{pendingHighlightAction.name && `Name: ${pendingHighlightAction.name}`}
								{pendingHighlightAction.text &&
									`Text: "${pendingHighlightAction.text}"`}
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => {
										if (window.parent) {
											window.parent.postMessage(
												{
													type: 'HIGHLIGHT_ELEMENT',
													target: pendingHighlightAction,
												},
												'*'
											);
										}
									}}
									className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
								>
									Scroll & Highlight
								</button>
								<button
									onClick={() => setPendingHighlightAction(null)}
									className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Form filling confirmation */}
				{pendingFormAction && (
					<div className="flex justify-start">
						<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-[80%]">
							<p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
								Ready to fill {pendingFormAction.fields.length} form field
								{pendingFormAction.fields.length !== 1 ? 's' : ''}
							</p>
							<div className="max-h-64 overflow-y-auto mb-3 space-y-1">
								{pendingFormAction.fields.slice(0, 20).map((field, index) => (
									<div
										key={index}
										className="text-xs text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded"
									>
										<span className="font-medium">
											{field.label ||
												field.name ||
												field.id ||
												`Field ${index + 1}`}
											:
										</span>{' '}
										<span className="text-blue-700 dark:text-blue-300">
											{field.value.length > 100
												? `${field.value.substring(0, 100)}...`
												: field.value}
										</span>
									</div>
								))}
								{pendingFormAction.fields.length > 20 && (
									<p className="text-xs text-blue-700 dark:text-blue-300 italic pt-1">
										...and {pendingFormAction.fields.length - 20} more field
										{pendingFormAction.fields.length - 20 !== 1 ? 's' : ''}
									</p>
								)}
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => {
										if (window.parent) {
											window.parent.postMessage(
												{
													type: 'FILL_FORM',
													fields: pendingFormAction.fields,
													confirm: true,
												},
												'*'
											);
										}
									}}
									className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
								>
									Confirm
								</button>
								<button
									onClick={() => setPendingFormAction(null)}
									className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
				<div className="flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyPress={(e) => e.key === 'Enter' && handleSend()}
						placeholder="Ask about this page..."
						className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white text-sm"
						disabled={isLoading}
					/>
					<button
						onClick={handleSend}
						disabled={!input.trim() || isLoading}
						className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
					>
						Send
					</button>
				</div>
				<p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
					{context
						? `${context.metadata.wordCount} words available`
						: 'Extracting context...'}
				</p>
			</div>
		</div>
	);
};
