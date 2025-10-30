/**
 * Safety utilities for handling AI responses and preventing malicious code execution
 */

/**
 * Sanitize AI response to prevent XSS
 * Works in both DOM and service worker contexts
 */
export function sanitizeResponse(content: string): string {
	// Always use string-based sanitization to avoid DOM dependency
	// This works in both DOM and service worker contexts
	let sanitized = content
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g, '&#x2F;');

	// Remove script tags even after escaping
	sanitized = sanitized.replace(
		/&lt;script[\s\S]*?&gt;[\s\S]*?&lt;\/script&gt;/gi,
		''
	);

	return sanitized;
}

/**
 * Check if response contains potentially dangerous code
 */
export function containsDangerousCode(content: string): boolean {
	const dangerousPatterns = [
		/<script[\s\S]*?>[\s\S]*?<\/script>/gi,
		/javascript:/gi,
		/on\w+\s*=/gi, // Event handlers like onclick=
		/eval\s*\(/gi,
		/Function\s*\(/gi,
		/document\.(write|writeln)/gi,
		/innerHTML\s*=/gi,
		/outerHTML\s*=/gi,
	];

	return dangerousPatterns.some((pattern) => pattern.test(content));
}

/**
 * Extract actionable commands from AI response
 * Returns null if no safe commands found
 */
export function extractCommands(content: string): Array<{
	type: 'fill_form' | 'click' | 'scroll' | 'highlight' | null;
	target?: string;
	value?: string;
}> {
	// Very conservative command extraction
	// Only allows explicit, safe commands
	const commands: Array<{
		type: 'fill_form' | 'click' | 'scroll' | 'highlight' | null;
		target?: string;
		value?: string;
	}> = [];

	// Look for explicit command markers (user must confirm anyway)
	const commandMatches = content.match(/\[COMMAND:(\w+)(?:\(([^)]+)\))?\]/g);

	if (commandMatches) {
		commandMatches.forEach((match) => {
			const parsed = match.match(/\[COMMAND:(\w+)(?:\(([^)]+)\))?\]/);
			if (parsed) {
				const [, type, params] = parsed;
				const command: any = { type: null };

				if (type === 'FILL_FORM' && params) {
					const [target, value] = params.split(',').map((s) => s.trim());
					command.type = 'fill_form';
					command.target = target;
					command.value = value;
				} else if (type === 'CLICK' && params) {
					command.type = 'click';
					command.target = params.trim();
				} else if (type === 'SCROLL') {
					command.type = 'scroll';
				} else if (type === 'HIGHLIGHT' && params) {
					command.type = 'highlight';
					command.target = params.trim();
				}

				if (command.type) {
					commands.push(command);
				}
			}
		});
	}

	return commands;
}

/**
 * Require user confirmation before executing any command
 * Note: Only works in DOM context. In service workers, always returns false.
 */
export async function requireConfirmation(
	message: string,
	details?: string
): Promise<boolean> {
	// Check if we're in a DOM context
	if (typeof confirm !== 'undefined') {
		return new Promise((resolve) => {
			const confirmed = confirm(
				`${message}\n\n${details || ''}\n\nDo you want to proceed?`
			);
			resolve(confirmed);
		});
	} else {
		// Service worker context - cannot show confirmation dialog
		// This function should not be called from service worker
		console.warn('requireConfirmation called in non-DOM context');
		return false;
	}
}
