/**
 * Progressively enhances an associated label and file input with a Light DOM
 * drag-and-drop surface, accessible announcements, and optional image previews.
 *
 * @element form-dropzone
 */
export class FormDropzoneElement extends HTMLElement {
	static readonly observedAttributes: string[];

	/**
	 * Returns whether the browser supports the drag-and-drop file APIs required
	 * by the component.
	 */
	static isSupported(): boolean;

	constructor();
	connectedCallback(): void;
	disconnectedCallback(): void;
	attributeChangedCallback(
		name: string,
		oldValue: string | null,
		newValue: string | null,
	): void;

	get dropLabel(): string;
	set dropLabel(value: string | null | undefined);

	get separatorLabel(): string;
	set separatorLabel(value: string | null | undefined);

	get receivedMessage(): string;
	set receivedMessage(value: string | null | undefined);

	get rejectedTypeMessage(): string;
	set rejectedTypeMessage(value: string | null | undefined);

	get rejectedMultipleMessage(): string;
	set rejectedMultipleMessage(value: string | null | undefined);

	get previewImages(): boolean;
	set previewImages(value: boolean);

	/** Whether the native file input currently has dropzone enhancement. */
	get enhanced(): boolean;

	/**
	 * Reload shared labels and update prompt text in place, preserving selection,
	 * previews, and focus. Logs errors and returns false without losing valid text.
	 * Does not initialize unsupported/disconnected markup or scan replacement inputs.
	 */
	refresh(): boolean;

	addEventListener<K extends keyof FormDropzoneEventMap>(
		type: K,
		listener: (
			this: FormDropzoneElement,
			event: FormDropzoneEventMap[K],
		) => void,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener<K extends keyof FormDropzoneEventMap>(
		type: K,
		listener: (
			this: FormDropzoneElement,
			event: FormDropzoneEventMap[K],
		) => void,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	): void;
}

export interface FormDropzonePluralMessage {
	zero?: string;
	one?: string;
	two?: string;
	few?: string;
	many?: string;
	other: string;
}

/** Partial, page-level authored defaults; no built-in locale catalog or scopes. */
export interface FormDropzoneLabels {
	'drop-label'?: string;
	'separator-label'?: string;
	'received-message'?: string | FormDropzonePluralMessage;
	'rejected-type-message'?: string | FormDropzonePluralMessage;
	'rejected-multiple-message'?: string | FormDropzonePluralMessage;
}

export interface FormDropzoneDropDetail {
	readonly input: HTMLInputElement;
	readonly accepted: readonly File[];
	readonly rejectedType: readonly File[];
	readonly rejectedMultiple: readonly File[];
}

export type FormDropzoneDropEvent = CustomEvent<FormDropzoneDropDetail>;

export interface FormDropzoneEventMap extends HTMLElementEventMap {
	'form-dropzone:drop': FormDropzoneDropEvent;
}

declare global {
	interface HTMLElementTagNameMap {
		'form-dropzone': FormDropzoneElement;
	}
}
