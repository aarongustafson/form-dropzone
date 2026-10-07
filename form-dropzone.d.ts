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
}
