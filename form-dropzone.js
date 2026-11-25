const GENERATED_ATTRIBUTE = 'data-form-dropzone-generated';
const ENHANCED_CLASS = 'form-dropzone--enhanced';
const STYLE_ID = 'form-dropzone-styles';
const sharedConfigurations = new WeakMap();
const STRING_ATTRIBUTES = {
	'drop-label': 'dropLabel',
	'separator-label': 'separatorLabel',
	'received-message': 'receivedMessage',
	'rejected-type-message': 'rejectedTypeMessage',
	'rejected-multiple-message': 'rejectedMultipleMessage',
};
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

const DEFAULTS = {
	dropLabel: 'Drop file(s) here',
	separatorLabel: 'or',
	receivedMessage: 'Received: {files}.',
	rejectedTypeMessage:
		'Rejected because the file type is not accepted: {files}.',
	rejectedMultipleMessage:
		'Rejected because only one file is allowed: {files}.',
};

function validateTemplate(name, value) {
	if (typeof value !== 'string' || !value.trim()) {
		throw new TypeError(`${name} must be a nonempty string.`);
	}
	if (
		name.endsWith('-message') &&
		/[{}]/.test(value.replace(/\{(?:files|count)\}/g, ''))
	) {
		throw new TypeError(
			`${name} supports only {files} and {count} tokens.`,
		);
	}
}

function sharedLabels(document) {
	const scripts = document.querySelectorAll('[data-form-dropzone-config]');
	if (scripts.length > 1) {
		throw new TypeError(
			'Only one data-form-dropzone-config script is allowed per document.',
		);
	}
	if (!scripts.length) return {};
	const script = scripts[0];
	if (
		script.localName !== 'script' ||
		script.type.trim().toLowerCase() !== 'application/json' ||
		script.hasAttribute('src') ||
		script.getAttribute('data-form-dropzone-config') !== ''
	) {
		throw new TypeError(
			'Use an inline <script type="application/json" data-form-dropzone-config> without a named scope.',
		);
	}
	const text = script.textContent;
	const cached = sharedConfigurations.get(script);
	if (cached?.text === text) return cached.labels;
	const labels = JSON.parse(text);
	if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
		throw new TypeError('form-dropzone labels must be an object.');
	}
	for (const [name, value] of Object.entries(labels)) {
		if (!Object.hasOwn(STRING_ATTRIBUTES, name)) {
			throw new TypeError(`Unknown form-dropzone label: ${name}.`);
		}
		if (
			name.endsWith('-message') &&
			value &&
			typeof value === 'object' &&
			!Array.isArray(value)
		) {
			validateTemplate(name, value.other);
			for (const [category, template] of Object.entries(value)) {
				if (!PLURAL_CATEGORIES.includes(category)) {
					throw new TypeError(
						`Unknown plural category: ${category}.`,
					);
				}
				validateTemplate(name, template);
			}
		} else {
			validateTemplate(name, value);
		}
	}
	sharedConfigurations.set(script, { text, labels });
	return labels;
}

/**
 * FormDropzoneElement - A file field wrapper that builds a customizable drop zone for users to drag files into a form.
 *
 * @element form-dropzone
 *
 * @attr {string} drop-label - Drop instruction shown before the file label
 * @attr {string} separator-label - Text shown between the drop instruction and file label
 * @attr {string} received-message - Announcement template for accepted files
 * @attr {string} rejected-type-message - Announcement template for files rejected by accept
 * @attr {string} rejected-multiple-message - Announcement template for excess files
 * @attr {boolean} preview-images - Whether accepted images are previewed
 * @fires form-dropzone:drop - Completed file-drop outcome, including rejected files.
 */
export class FormDropzoneElement extends HTMLElement {
	static get observedAttributes() {
		return [
			'drop-label',
			'separator-label',
			'received-message',
			'rejected-type-message',
			'rejected-multiple-message',
			'preview-images',
		];
	}

	static isSupported() {
		if (
			typeof DataTransfer !== 'function' ||
			typeof DragEvent !== 'function'
		) {
			return false;
		}

		try {
			const input = document.createElement('input');
			input.type = 'file';
			const transfer = new DataTransfer();
			input.files = transfer.files;
			return (
				input.files !== null &&
				typeof input.files.length === 'number' &&
				typeof input.files[Symbol.iterator] === 'function'
			);
		} catch {
			return false;
		}
	}

	static injectStyles() {
		if (document.getElementById(STYLE_ID)) {
			return;
		}

		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			:where(form-dropzone.form-dropzone--enhanced) {
				align-items: center;
				border: 2px dashed currentColor;
				box-sizing: border-box;
				cursor: pointer;
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
				inline-size: 100%;
				justify-content: center;
				max-inline-size: 100%;
				min-block-size: min(12rem, 50vh);
				padding: clamp(1rem, 4vw, 2rem);
				text-align: center;
			}

			:where(form-dropzone.form-dropzone--enhanced[hidden]) {
				display: none;
			}

			:where(.form-dropzone__prompt) {
				font-size: 1.25em;
				font-weight: bold;
			}

			:where(form-dropzone.form-dropzone--drag-active) {
				border-style: solid;
			}

			:where(.form-dropzone__status) {
				block-size: 1px;
				clip: rect(0 0 0 0);
				clip-path: inset(50%);
				inline-size: 1px;
				overflow: hidden;
				position: absolute;
				white-space: nowrap;
			}

			:where(.form-dropzone__previews) {
				display: grid;
				gap: 1rem;
				grid-template-columns: repeat(auto-fit, minmax(min(8rem, 100%), 1fr));
				inline-size: 100%;
				list-style: none;
				margin: 0;
				padding: 0;
			}

			:where(.form-dropzone__preview) {
				display: grid;
				gap: 0.5rem;
				min-inline-size: 0;
			}

			:where(.form-dropzone__preview-image) {
				aspect-ratio: 1;
				block-size: auto;
				inline-size: 100%;
				object-fit: cover;
			}

			:where(.form-dropzone__preview-name) {
				overflow-wrap: anywhere;
			}
		`;
		document.head.appendChild(style);
	}

	constructor() {
		super();
		this._input = null;
		this._label = null;
		this._prompt = null;
		this._separator = null;
		this._status = null;
		this._previews = null;
		this._previewUrls = [];
		this._enhanced = false;
		this._dragDepth = 0;
		this._announcementToken = 0;
		this._sharedLabels = {};
		this._pluralLanguage = null;
		this._pluralRules = null;
		this._resetRoot = null;
		this._resetTimer = null;
		this._pendingResets = [];
		this._dropGeneration = 0;
		this._handleClick = this._handleClick.bind(this);
		this._handleDragEnter = this._handleDragEnter.bind(this);
		this._handleDragLeave = this._handleDragLeave.bind(this);
		this._handleDragOver = FormDropzoneElement._handleDragOver;
		this._handleDrop = this._handleDrop.bind(this);
		this._handleInputChange = this._handleInputChange.bind(this);
		this._handleReset = this._handleReset.bind(this);
	}

	connectedCallback() {
		for (const property of [
			'dropLabel',
			'separatorLabel',
			'receivedMessage',
			'rejectedTypeMessage',
			'rejectedMultipleMessage',
			'previewImages',
		]) {
			this._upgradeProperty(property);
		}

		if (!FormDropzoneElement.isSupported()) {
			return;
		}

		const inputs = this.querySelectorAll('input[type="file"]');
		if (inputs.length !== 1) {
			this._reportInvalidMarkup(
				'Expected exactly one input[type="file"].',
			);
			return;
		}

		const input = inputs[0];
		const label = Array.from(this.querySelectorAll('label')).find(
			(candidate) =>
				candidate.contains(input) ||
				(Boolean(input.id) && candidate.htmlFor === input.id),
		);

		if (!label) {
			this._reportInvalidMarkup(
				'Expected a label associated with the file input.',
			);
			return;
		}

		this._input = input;
		this._label = label;
		this._loadSharedLabels();
		this._enhance();
	}

	disconnectedCallback() {
		this._teardown();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue || !this._enhanced) {
			return;
		}

		if (name === 'drop-label' && this._prompt) {
			this._prompt.textContent = this.dropLabel;
		}
		if (name === 'separator-label' && this._separator) {
			this._separator.textContent = this.separatorLabel;
		}
		if (name === 'preview-images') {
			this._syncPreviews();
		}
	}

	get dropLabel() {
		return this._stringValue('drop-label');
	}

	set dropLabel(value) {
		this._setStringAttribute('drop-label', value);
	}

	get separatorLabel() {
		return this._stringValue('separator-label');
	}

	set separatorLabel(value) {
		this._setStringAttribute('separator-label', value);
	}

	get receivedMessage() {
		return this._stringValue('received-message');
	}

	set receivedMessage(value) {
		this._setStringAttribute('received-message', value);
	}

	get rejectedTypeMessage() {
		return this._stringValue('rejected-type-message');
	}

	set rejectedTypeMessage(value) {
		this._setStringAttribute('rejected-type-message', value);
	}

	get rejectedMultipleMessage() {
		return this._stringValue('rejected-multiple-message');
	}

	set rejectedMultipleMessage(value) {
		this._setStringAttribute('rejected-multiple-message', value);
	}

	get previewImages() {
		return this.hasAttribute('preview-images');
	}

	set previewImages(value) {
		this.toggleAttribute('preview-images', Boolean(value));
	}

	get enhanced() {
		return this._enhanced;
	}

	refresh() {
		if (!this.isConnected || !this._enhanced) {
			console.warn(
				'form-dropzone: refresh() requires a connected, enhanced element.',
				this,
			);
			return false;
		}
		if (!this._loadSharedLabels()) return false;
		this._prompt.textContent = this.dropLabel;
		this._separator.textContent = this.separatorLabel;
		return true;
	}

	_loadSharedLabels() {
		try {
			this._sharedLabels = sharedLabels(this.ownerDocument);
			return true;
		} catch (error) {
			console.error('form-dropzone: label configuration failed.', error);
			return false;
		}
	}

	_stringValue(name) {
		const shared = this._sharedLabels[name];
		return (
			this.getAttribute(name) ||
			(typeof shared === 'string' ? shared : shared?.other) ||
			DEFAULTS[STRING_ATTRIBUTES[name]]
		);
	}

	_messageTemplate(name, count) {
		const shared = this._sharedLabels[name];
		if (this.getAttribute(name) || !shared || typeof shared === 'string') {
			return this._stringValue(name);
		}
		let scope = this;
		let language;
		while (scope) {
			const ancestor = scope.closest('[lang]');
			if (ancestor) {
				language = ancestor.getAttribute('lang') || undefined;
				break;
			}
			const root = scope.getRootNode();
			scope = root instanceof ShadowRoot ? root.host : null;
		}
		if (language !== this._pluralLanguage) {
			this._pluralLanguage = language;
			this._pluralRules = null;
			try {
				this._pluralRules = new Intl.PluralRules(language);
			} catch (error) {
				console.error(
					'form-dropzone: invalid plural language; using the authored other message.',
					error,
				);
			}
		}
		return (
			shared[this._pluralRules?.select(count) || 'other'] || shared.other
		);
	}

	_enhance() {
		if (this._enhanced) {
			return;
		}

		FormDropzoneElement.injectStyles();

		this._prompt = FormDropzoneElement._createGeneratedElement(
			'span',
			'form-dropzone__prompt',
		);
		this._prompt.textContent = this.dropLabel;
		this._separator = FormDropzoneElement._createGeneratedElement(
			'span',
			'form-dropzone__separator',
		);
		this._separator.textContent = this.separatorLabel;
		this._status = FormDropzoneElement._createGeneratedElement(
			'span',
			'form-dropzone__status',
		);
		this._status.setAttribute('role', 'status');
		this._status.setAttribute('aria-live', 'polite');
		this._status.setAttribute('aria-atomic', 'true');

		this._label.before(this._prompt, this._separator);
		this.appendChild(this._status);
		this.classList.add(ENHANCED_CLASS);
		this.addEventListener('click', this._handleClick);
		this.addEventListener('dragenter', this._handleDragEnter);
		this.addEventListener('dragleave', this._handleDragLeave);
		this.addEventListener('dragover', this._handleDragOver);
		this.addEventListener('drop', this._handleDrop);
		this._input.addEventListener('change', this._handleInputChange);
		this._resetRoot = this.getRootNode();
		this._resetRoot.addEventListener('reset', this._handleReset, true);
		this._enhanced = true;
		this._syncPreviews();
	}

	_teardown() {
		this.removeEventListener('click', this._handleClick);
		this.removeEventListener('dragenter', this._handleDragEnter);
		this.removeEventListener('dragleave', this._handleDragLeave);
		this.removeEventListener('dragover', this._handleDragOver);
		this.removeEventListener('drop', this._handleDrop);
		this._input?.removeEventListener('change', this._handleInputChange);
		this._resetRoot?.removeEventListener('reset', this._handleReset, true);
		this._resetRoot = null;
		clearTimeout(this._resetTimer);
		this._resetTimer = null;
		this._pendingResets = [];
		this._removePreviews();
		for (const element of this.querySelectorAll(
			`[${GENERATED_ATTRIBUTE}]`,
		)) {
			element.remove();
		}
		this.classList.remove(ENHANCED_CLASS, 'form-dropzone--drag-active');
		this._input = null;
		this._label = null;
		this._prompt = null;
		this._separator = null;
		this._status = null;
		this._previews = null;
		this._enhanced = false;
		this._dragDepth = 0;
		this._announcementToken += 1;
	}

	_handleInputChange() {
		this._announcementToken += 1;
		this._status.textContent = '';
		this._syncPreviews();
	}

	_handleReset(event) {
		if (event.target !== this._input.form) return;
		this._pendingResets.push({ event, generation: this._dropGeneration });
		if (this._resetTimer !== null) return;
		const input = this._input;
		const status = this._status;
		// Chromium and WebKit can run microtasks before the reset default action.
		this._resetTimer = setTimeout(() => {
			this._resetTimer = null;
			const reset = this._pendingResets.findLast(
				(pending) => !pending.event.defaultPrevented,
			);
			this._pendingResets = [];
			if (
				!reset ||
				!this._enhanced ||
				this._input !== input ||
				this._status !== status
			)
				return;
			if (this._dropGeneration === reset.generation) {
				this._announcementToken += 1;
				status.textContent = '';
			}
			this._dragDepth = 0;
			this.classList.remove('form-dropzone--drag-active');
			this._syncPreviews();
		}, 0);
	}

	_handleClick(event) {
		if (
			event.defaultPrevented ||
			!(event.target instanceof Element) ||
			event.target.closest(
				'input, label, button, a, select, textarea, [contenteditable]',
			)
		) {
			return;
		}

		this._input.click();
	}

	_handleDragEnter(event) {
		if (!FormDropzoneElement._hasFiles(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		this._dragDepth += 1;
		this.classList.add('form-dropzone--drag-active');
	}

	_handleDragLeave(event) {
		if (!FormDropzoneElement._hasFiles(event.dataTransfer)) {
			return;
		}

		this._dragDepth = Math.max(0, this._dragDepth - 1);
		if (this._dragDepth === 0) {
			this.classList.remove('form-dropzone--drag-active');
		}
	}

	static _handleDragOver(event) {
		if (FormDropzoneElement._hasFiles(event.dataTransfer)) {
			event.preventDefault();
		}
	}

	_handleDrop(event) {
		if (!FormDropzoneElement._hasFiles(event.dataTransfer)) {
			return;
		}

		event.preventDefault();
		this._dragDepth = 0;
		this.classList.remove('form-dropzone--drag-active');

		const accepted = [];
		const rejectedType = [];
		const rejectedMultiple = [];

		for (const file of event.dataTransfer.files) {
			if (!this._matchesAccept(file)) {
				rejectedType.push(file);
			} else if (!this._input.multiple && accepted.length > 0) {
				rejectedMultiple.push(file);
			} else {
				accepted.push(file);
			}
		}

		if (accepted.length === 0) {
			this._dropGeneration += 1;
			this._finishDrop(accepted, rejectedType, rejectedMultiple);
			return;
		}

		const transfer = new DataTransfer();
		for (const file of accepted) {
			transfer.items.add(file);
		}

		try {
			this._input.files = transfer.files;
		} catch (error) {
			console.error(
				'form-dropzone: Unable to assign dropped files to the input.',
				error,
			);
			return;
		}

		const input = this._input;
		const status = this._status;
		this._dropGeneration += 1;
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
		if (this._input === input && this._status === status) {
			this._finishDrop(accepted, rejectedType, rejectedMultiple);
		}
	}

	_finishDrop(accepted, rejectedType, rejectedMultiple) {
		this._announceDrop({ accepted, rejectedType, rejectedMultiple });
		this.dispatchEvent(
			new CustomEvent('form-dropzone:drop', {
				bubbles: true,
				composed: true,
				detail: Object.freeze({
					input: this._input,
					accepted: Object.freeze(accepted),
					rejectedType: Object.freeze(rejectedType),
					rejectedMultiple: Object.freeze(rejectedMultiple),
				}),
			}),
		);
	}

	static _hasFiles(dataTransfer) {
		if (!dataTransfer) {
			return false;
		}

		return (
			Array.from(dataTransfer.types || []).includes('Files') ||
			dataTransfer.files.length > 0
		);
	}

	_matchesAccept(file) {
		const accept = this._input.accept.trim();
		if (!accept) {
			return true;
		}

		const fileName = file.name.toLowerCase();
		const fileType = file.type.toLowerCase();
		return accept
			.split(',')
			.map((token) => token.trim().toLowerCase())
			.filter(Boolean)
			.some((token) => {
				if (token.startsWith('.')) {
					return fileName.endsWith(token);
				}
				if (token.endsWith('/*')) {
					return fileType.startsWith(token.slice(0, -1));
				}
				return fileType === token;
			});
	}

	_announceDrop({ accepted, rejectedType, rejectedMultiple }) {
		const messages = [];
		for (const [files, name] of [
			[accepted, 'received-message'],
			[rejectedType, 'rejected-type-message'],
			[rejectedMultiple, 'rejected-multiple-message'],
		]) {
			if (files.length > 0) {
				messages.push(
					FormDropzoneElement._formatMessage(
						this._messageTemplate(name, files.length),
						files,
					),
				);
			}
		}

		const status = this._status;
		const announcementToken = ++this._announcementToken;
		status.textContent = '';
		queueMicrotask(() => {
			if (
				this._enhanced &&
				this._status === status &&
				this._announcementToken === announcementToken
			) {
				status.textContent = messages.join(' ');
			}
		});
	}

	static _formatMessage(template, files) {
		const names = files.map((file) => file.name).join(', ');
		return template.replace(/\{(count|files)\}/g, (_, token) =>
			token === 'count' ? String(files.length) : names,
		);
	}

	_syncPreviews() {
		if (!this.previewImages) {
			this._removePreviews();
			return;
		}

		if (!this._previews) {
			this._previews = FormDropzoneElement._createGeneratedElement(
				'ul',
				'form-dropzone__previews',
			);
			this._status.before(this._previews);
		}

		this._revokePreviewUrls();
		this._previews.replaceChildren();

		for (const file of this._input.files) {
			if (!file.type.toLowerCase().startsWith('image/')) {
				continue;
			}

			const url = URL.createObjectURL(file);
			this._previewUrls.push(url);

			const item = document.createElement('li');
			item.className = 'form-dropzone__preview';
			item.dataset.fileName = file.name;

			const image = document.createElement('img');
			image.className = 'form-dropzone__preview-image';
			image.src = url;
			image.alt = '';

			const name = document.createElement('span');
			name.className = 'form-dropzone__preview-name';
			name.textContent = file.name;

			item.append(image, name);
			this._previews.appendChild(item);
		}
	}

	_removePreviews() {
		this._revokePreviewUrls();
		this._previews?.remove();
		this._previews = null;
	}

	_revokePreviewUrls() {
		for (const url of this._previewUrls) {
			URL.revokeObjectURL(url);
		}
		this._previewUrls = [];
	}

	static _createGeneratedElement(tagName, className) {
		const element = document.createElement(tagName);
		element.className = className;
		element.setAttribute(GENERATED_ATTRIBUTE, '');
		return element;
	}

	_setStringAttribute(name, value) {
		if (value === null || value === undefined) {
			this.removeAttribute(name);
		} else {
			this.setAttribute(name, String(value));
		}
	}

	_upgradeProperty(property) {
		if (!Object.prototype.hasOwnProperty.call(this, property)) {
			return;
		}

		const value = this[property];
		delete this[property];
		this[property] = value;
	}

	_reportInvalidMarkup(message) {
		console.warn(`form-dropzone: ${message}`, this);
	}
}
