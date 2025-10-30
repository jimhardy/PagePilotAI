/**
 * Context extraction agent for scanning and summarizing page content
 */

import { ContextData } from './types';

/**
 * Extract context from the current page
 */
export function extractContext(_requireApproval: boolean = true): ContextData {
	const url = window.location.href;
	const title = document.title;

	// Extract visible text (simplified - excludes script/style)
	const visibleText = extractVisibleText();

	// Extract headings
	const headings = extractHeadings();

	// Get selected text if any
	const selectedText = getSelectedText();

	// Extract form fields
	const formFields = extractFormFields();

	// Extract clickable elements (buttons, links, etc.)
	const clickableElements = extractClickableElements();

	return {
		url,
		title,
		visibleText,
		headings,
		selectedText,
		formFields,
		clickableElements,
		metadata: {
			extractedAt: Date.now(),
			wordCount: visibleText.split(/\s+/).filter(Boolean).length,
		},
	};
}

/**
 * Extract visible text from the page (excludes hidden elements)
 */
function extractVisibleText(): string {
	const walker = document.createTreeWalker(
		document.body,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode: (node) => {
				// Skip if parent is script, style, or hidden
				const parent = node.parentElement;
				if (!parent) return NodeFilter.FILTER_REJECT;

				const tagName = parent.tagName.toLowerCase();
				if (['script', 'style', 'noscript', 'meta', 'link'].includes(tagName)) {
					return NodeFilter.FILTER_REJECT;
				}

				// Check if element is visible
				const style = window.getComputedStyle(parent);
				if (
					style.display === 'none' ||
					style.visibility === 'hidden' ||
					style.opacity === '0'
				) {
					return NodeFilter.FILTER_REJECT;
				}

				// Only include if text has meaningful content
				const text = node.textContent?.trim();
				if (!text || text.length < 2) {
					return NodeFilter.FILTER_REJECT;
				}

				return NodeFilter.FILTER_ACCEPT;
			},
		}
	);

	const texts: string[] = [];
	let node;
	while ((node = walker.nextNode())) {
		const text = node.textContent?.trim();
		if (text) {
			texts.push(text);
		}
	}

	// Limit to first 5000 words to avoid context bloat
	const fullText = texts.join(' ');
	const words = fullText.split(/\s+/);
	return words.slice(0, 5000).join(' ');
}

/**
 * Extract headings hierarchy
 */
function extractHeadings(): Array<{ level: number; text: string }> {
	const headings: Array<{ level: number; text: string }> = [];
	const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

	headingElements.forEach((heading) => {
		const level = parseInt(heading.tagName.charAt(1));
		const text = heading.textContent?.trim();
		if (text) {
			headings.push({ level, text });
		}
	});

	return headings;
}

/**
 * Get currently selected text
 */
function getSelectedText(): string | undefined {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return undefined;
	}

	const text = selection.toString().trim();
	return text.length > 0 ? text : undefined;
}

/**
 * Extract form fields from the page
 */
function extractFormFields(): Array<{
	id?: string;
	name?: string;
	type: string;
	label?: string;
	value?: string;
	placeholder?: string;
}> {
	const fields: Array<{
		id?: string;
		name?: string;
		type: string;
		label?: string;
		value?: string;
		placeholder?: string;
	}> = [];

	const inputs = document.querySelectorAll('input, textarea, select');

	inputs.forEach((input) => {
		if (
			input instanceof HTMLInputElement ||
			input instanceof HTMLTextAreaElement ||
			input instanceof HTMLSelectElement
		) {
			// Skip hidden inputs
			if (input.type === 'hidden') return;

			// Try to find associated label
			let label: string | undefined;
			if (input.id) {
				const labelElement = document.querySelector(`label[for="${input.id}"]`);
				label = labelElement?.textContent?.trim();
			}
			if (!label) {
				// Try to find parent label
				const parentLabel = input.closest('label');
				label = parentLabel?.textContent?.trim();
			}

			fields.push({
				id: input.id || undefined,
				name: input.name || undefined,
				type: input.type || input.tagName.toLowerCase(),
				label,
				value: input.value || undefined,
				placeholder: (input as HTMLInputElement).placeholder || undefined,
			});
		}
	});

	return fields;
}

/**
 * Extract clickable elements (buttons, links, etc.)
 */
function extractClickableElements(): Array<{
	id?: string;
	name?: string;
	tagName: string;
	text?: string;
	type?: string;
	role?: string;
	href?: string;
}> {
	const clickables: Array<{
		id?: string;
		name?: string;
		tagName: string;
		text?: string;
		type?: string;
		role?: string;
		href?: string;
	}> = [];

	// Find buttons
	const buttons = document.querySelectorAll(
		'button, input[type="button"], input[type="submit"], input[type="reset"]'
	);
	buttons.forEach((btn) => {
		if (btn instanceof HTMLElement) {
			const style = window.getComputedStyle(btn);
			if (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				style.opacity !== '0'
			) {
				const text =
					btn.textContent?.trim() || (btn as HTMLInputElement).value?.trim();
				if (text) {
					clickables.push({
						id: btn.id || undefined,
						name: (btn as HTMLInputElement).name || undefined,
						tagName: btn.tagName.toLowerCase(),
						text: text.substring(0, 100), // Limit text length
						type: (btn as HTMLInputElement).type || undefined,
						role: btn.getAttribute('role') || undefined,
					});
				}
			}
		}
	});

	// Find links (but skip navigation links, focus on action links)
	const links = document.querySelectorAll(
		'a[href]:not([href^="#"]):not([href^="javascript:"])'
	);
	links.forEach((link) => {
		if (link instanceof HTMLAnchorElement) {
			const style = window.getComputedStyle(link);
			if (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				style.opacity !== '0'
			) {
				const text = link.textContent?.trim();
				// Focus on actionable links (buttons styled as links, CTA buttons, etc.)
				const isActionLink =
					link.classList.contains('button') ||
					link.classList.contains('btn') ||
					link.getAttribute('role') === 'button' ||
					text
						?.toLowerCase()
						.match(/(submit|save|continue|next|proceed|confirm|apply)/);

				if (text && (isActionLink || text.length < 50)) {
					// Short links are likely CTAs
					clickables.push({
						id: link.id || undefined,
						tagName: 'a',
						text: text.substring(0, 100),
						href: link.href || undefined,
						role: link.getAttribute('role') || undefined,
					});
				}
			}
		}
	});

	// Remove duplicates based on text content
	const uniqueClickables = clickables.filter(
		(clickable, index, self) =>
			index ===
			self.findIndex(
				(c) =>
					c.text === clickable.text &&
					c.id === clickable.id &&
					c.tagName === clickable.tagName
			)
	);

	return uniqueClickables.slice(0, 50); // Limit to 50 most relevant clickable elements
}

/**
 * Format context for AI prompt
 */
export function formatContextForPrompt(context: ContextData): string {
	let prompt = `Page Context:\n`;
	prompt += `URL: ${context.url}\n`;
	prompt += `Title: ${context.title}\n\n`;

	if (context.headings.length > 0) {
		prompt += `Headings:\n`;
		context.headings.forEach((h) => {
			prompt += `${'  '.repeat(h.level - 1)}${h.text}\n`;
		});
		prompt += `\n`;
	}

	if (context.selectedText) {
		prompt += `Selected Text: ${context.selectedText}\n\n`;
	}

	if (context.formFields && context.formFields.length > 0) {
		prompt += `Form Fields:\n`;
		context.formFields.forEach((field) => {
			prompt += `- ${field.label || field.name || field.id || 'Unlabeled'}: ${
				field.type
			}${field.placeholder ? ` (${field.placeholder})` : ''}\n`;
		});
		prompt += `\n`;
	}

	if (context.clickableElements && context.clickableElements.length > 0) {
		prompt += `Clickable Elements (buttons, links):\n`;
		context.clickableElements.forEach((elem) => {
			const identifier = elem.id || elem.name || elem.text || 'Unlabeled';
			prompt += `- ${identifier} (${elem.tagName}${
				elem.type ? `, type=${elem.type}` : ''
			}${elem.href ? `, href=${elem.href}` : ''})\n`;
		});
		prompt += `\n`;
	}

	// Include a summary of visible text (truncated)
	if (context.visibleText) {
		const preview = context.visibleText.split(/\s+/).slice(0, 200).join(' ');
		prompt += `Page Content Preview: ${preview}${
			context.metadata.wordCount > 200 ? '...' : ''
		}\n`;
	}

	return prompt;
}
