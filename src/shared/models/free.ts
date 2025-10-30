/**
 * Free local model connector (placeholder)
 * This can be extended to use local inference or a mock response
 */

import { BaseModelConnector } from '../model-connector';
import { ApiRequest, ApiResponse, ModelProvider } from '../types';

export class FreeModelConnector extends BaseModelConnector {
	provider: ModelProvider = 'free';

	async sendMessage(request: ApiRequest): Promise<ApiResponse> {
		// Enhanced free model with better context awareness
		// In production, this could connect to a local model or use browser-based inference

		const lastMessage = request.messages[request.messages.length - 1];
		const content = lastMessage.content.toLowerCase();
		const context = request.context;

		let response = '';

		// Handle form filling requests
		if (
			content.includes('fill') &&
			(content.includes('form') || content.includes('field'))
		) {
			if (context?.formFields && context.formFields.length > 0) {
				// Generate random/placeholder data for form fields
				const fieldsToFill: Array<{
					id?: string;
					name?: string;
					label?: string;
					value: string;
				}> = [];

				// Process all form fields (not just first 20)
				let textCount = 0;
				let checkboxCount = 0;
				let radioCount = 0;
				let selectCount = 0;

				context.formFields.forEach((field) => {
					let value = '';

					// Generate appropriate random data based on field type and label
					const labelLower = (field.label || field.name || '').toLowerCase();

					if (field.type === 'text' || field.type === 'textarea') {
						textCount++;
						if (labelLower.includes('name')) {
							value = 'John Doe';
						} else if (labelLower.includes('email')) {
							value = 'john.doe@example.com';
						} else if (labelLower.includes('phone')) {
							value = '+1234567890';
						} else if (labelLower.includes('address')) {
							value = '123 Main Street';
						} else if (labelLower.includes('city')) {
							value = 'New York';
						} else if (
							labelLower.includes('zip') ||
							labelLower.includes('postal')
						) {
							value = '10001';
						} else if (labelLower.includes('country')) {
							value = 'United States';
						} else {
							value = 'Sample text';
						}
					} else if (field.type === 'number') {
						textCount++;
						value = '123';
					} else if (field.type === 'email') {
						textCount++;
						value = 'example@example.com';
					} else if (field.type === 'radio') {
						radioCount++;
						value = 'true'; // Will check the radio button
					} else if (field.type === 'checkbox') {
						checkboxCount++;
						value = 'true'; // Will check the checkbox
					} else if (
						field.type === 'select-one' ||
						field.type === 'select-multiple'
					) {
						selectCount++;
						// For selects, we'll use the first option if available
						value = 'option1'; // Placeholder - actual value would need to come from DOM
					}

					if (value) {
						fieldsToFill.push({
							id: field.id,
							name: field.name,
							label: field.label,
							value,
						});
					}
				});

				if (fieldsToFill.length > 0) {
					// Generate a user-friendly summary
					const parts: string[] = [];
					if (textCount > 0)
						parts.push(`${textCount} text field${textCount === 1 ? '' : 's'}`);
					if (checkboxCount > 0)
						parts.push(
							`${checkboxCount} checkbox${checkboxCount === 1 ? '' : 'es'}`
						);
					if (radioCount > 0)
						parts.push(
							`${radioCount} radio button${radioCount === 1 ? '' : 's'}`
						);
					if (selectCount > 0)
						parts.push(
							`${selectCount} dropdown${selectCount === 1 ? '' : 's'}`
						);

					const fieldTypes = parts.length > 0 ? ` (${parts.join(', ')})` : '';
					response = `I'll fill ${fieldsToFill.length} form field${
						fieldsToFill.length === 1 ? '' : 's'
					}${fieldTypes} with sample data. Click "Confirm" below to proceed.`;

					// Store the action in a hidden comment so the widget can parse it
					// This won't be displayed to the user
					response += `<!--PAGEPILOT_ACTION:FILL_FORM:${JSON.stringify(
						fieldsToFill
					)}-->`;
				} else {
					response =
						"I couldn't determine how to fill the form fields. Please specify what data you'd like to enter.";
				}
			} else {
				response =
					"I don't see any form fields on this page. Make sure you're on a page with a form.";
			}
		}
		// Handle summary requests
		else if (
			content.includes('summary') ||
			content.includes('summarize') ||
			content.includes('what is this page')
		) {
			response = '**Page Summary:**\n\n';

			if (context?.title) {
				response += `**Title:** ${context.title}\n\n`;
			}

			if (context?.headings && context.headings.length > 0) {
				response += `**Main Sections:**\n`;
				// Show top-level headings
				const topHeadings = context.headings
					.filter((h) => h.level <= 2)
					.slice(0, 10);
				topHeadings.forEach((heading) => {
					const indent = '  '.repeat(heading.level - 1);
					response += `${indent}${heading.text}\n`;
				});
				response += '\n';
			}

			if (context?.formFields && context.formFields.length > 0) {
				response += `This page contains a form with ${context.formFields.length} fields. `;
				const textCount = context.formFields.filter(
					(f) => f.type === 'text' || f.type === 'textarea'
				).length;
				const radioCount = context.formFields.filter(
					(f) => f.type === 'radio'
				).length;
				const checkboxCount = context.formFields.filter(
					(f) => f.type === 'checkbox'
				).length;
				if (textCount > 0) response += `${textCount} text inputs, `;
				if (radioCount > 0) response += `${radioCount} radio buttons, `;
				if (checkboxCount > 0) response += `${checkboxCount} checkboxes. `;
			}
		}
		// Handle greeting
		else if (
			content.includes('hello') ||
			content.includes('hi') ||
			content.includes('hey')
		) {
			response = "Hello! I'm your free AI assistant for this page. ";
			if (context) {
				if (context.formFields && context.formFields.length > 0) {
					response += `I can see there's a form with ${context.formFields.length} fields on this page. `;
				}
				if (context.headings && context.headings.length > 0) {
					response += `I can see ${context.headings.length} headings. `;
				}
			}
			response += 'I can help you:\n';
			response += '- Summarize the page content\n';
			response += '- Explain sections\n';
			response += '- Help with form filling (provide guidance)\n';
			response += '- Answer questions about the page\n\n';
			response +=
				'Note: As a free assistant, I provide guidance but cannot directly modify the page. For automated actions, connect an AI provider in the extension options.';
		}
		// Handle explain requests
		else if (
			content.includes('explain') ||
			content.includes('what does') ||
			content.includes('tell me about')
		) {
			if (context?.headings && context.headings.length > 0) {
				response =
					'Based on the page structure, I can see the following sections:\n\n';
				context.headings.slice(0, 10).forEach((heading) => {
					const indent = '  '.repeat(heading.level - 1);
					response += `${indent}${heading.text}\n`;
				});
				response +=
					'\nAsk me about a specific section or topic, and I can provide more details.';
			} else {
				response =
					"I can see this page, but I need more context to explain it. Could you be more specific about what you'd like me to explain?";
			}
		}
		// Default response
		else {
			response =
				"I understand you're asking about: " +
				request.messages[request.messages.length - 1].content +
				'\n\n';

			if (context) {
				response += '**What I can see on this page:**\n';
				if (context.title) response += `- Page title: ${context.title}\n`;
				if (context.headings && context.headings.length > 0) {
					response += `- ${context.headings.length} headings/sections\n`;
				}
				if (context.formFields && context.formFields.length > 0) {
					response += `- ${context.formFields.length} form fields\n`;
				}
				response += '\n';
			}

			response +=
				'As a free assistant, I can provide guidance and answer questions about the page content. ';
			response +=
				'For more advanced features like automated form filling or detailed analysis, please connect an AI provider (OpenAI, Anthropic, etc.) in the extension options.';
		}

		return {
			content: response,
			model: this.provider,
		};
	}
}
