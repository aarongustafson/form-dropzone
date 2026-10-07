# `form-dropzone` Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/form-dropzone.svg)](https://www.npmjs.com/package/@aarongustafson/form-dropzone) [![Build Status](https://img.shields.io/github/actions/workflow/status/aarongustafson/form-dropzone/ci.yml?branch=main)](https://github.com/aarongustafson/form-dropzone/actions)

A progressively enhanced file-field wrapper that adds a responsive drag-and-drop surface, accessible status announcements, and optional image previews.

## Demo

- [Live demo](https://aarongustafson.github.io/form-dropzone/demo/) ([source](./demo/index.html))
- [esm.sh demo](https://aarongustafson.github.io/form-dropzone/demo/esm.html) ([source](./demo/esm.html))
- [unpkg demo](https://aarongustafson.github.io/form-dropzone/demo/unpkg.html) ([source](./demo/unpkg.html))

## Installation

```bash
npm install @aarongustafson/form-dropzone
```

Import the class and register it:

```javascript
import { FormDropzoneElement } from '@aarongustafson/form-dropzone';

customElements.define('form-dropzone', FormDropzoneElement);
```

Or use the guarded definition helper:

```javascript
import {
  defineFormDropzone,
} from '@aarongustafson/form-dropzone/define.js';

defineFormDropzone();
```

Importing `define.js` also attempts to register `<form-dropzone>` automatically in browser environments.

## Usage

Supply one `input[type="file"]` and its associated `label`. Both remain in Light DOM and provide a native fallback before the component upgrades or when drag-and-drop is unavailable.

```html
<form-dropzone>
  <label for="attachments">Choose files</label>
  <input
    id="attachments"
    name="attachments"
    type="file"
    accept=".pdf,image/*"
    multiple
  >
</form-dropzone>
```

Clicking the non-interactive drop-zone surface opens the native picker. Dropped files are filtered using the input's comma-separated `accept` value, including file extensions, exact MIME types, and wildcard MIME groups. If `multiple` is absent, the first acceptable file is selected and later acceptable files are rejected. Mixed drops keep acceptable files and announce the rejected files.

A successful drop replaces the input's existing `FileList`, then dispatches bubbling `input` and `change` events.

## Attributes

| Attribute | Type | Default | Description |
|---|---|---|---|
| `drop-label` | string | `Drop file(s) here` | Prompt inserted before the author label. |
| `separator-label` | string | `or` | Text inserted between the prompt and label. |
| `received-message` | string | `Received: {files}.` | Accepted-file announcement template. |
| `rejected-type-message` | string | `Rejected because the file type is not accepted: {files}.` | `accept` rejection template. |
| `rejected-multiple-message` | string | `Rejected because only one file is allowed: {files}.` | Single-file limit rejection template. |
| `preview-images` | boolean | absent | Adds image previews for picker and drop selections. |

Message templates support `{files}` (a comma-separated filename list) and `{count}`.

```html
<form-dropzone
  drop-label="Déposez les fichiers ici"
  separator-label="ou"
  received-message="{count} fichier(s) reçu(s) : {files}."
  rejected-type-message="Type de fichier refusé : {files}."
  rejected-multiple-message="Un seul fichier est autorisé. Refusé : {files}."
>
  <label for="document">Choisir un fichier</label>
  <input id="document" name="document" type="file" accept=".pdf">
</form-dropzone>
```

Each attribute has a camel-cased JavaScript property: `dropLabel`, `separatorLabel`, `receivedMessage`, `rejectedTypeMessage`, `rejectedMultipleMessage`, and `previewImages`.

## Image previews

Add `preview-images` to preview selected image MIME types. Accepted non-image files remain selected but are not rendered.

```html
<form-dropzone preview-images>
  <label for="photos">Choose photos</label>
  <input id="photos" name="photos" type="file" accept="image/*" multiple>
</form-dropzone>
```

Object URLs are revoked whenever previews are replaced, disabled, or disconnected. Previews are visual only and do not change form submission.

## Styling

The component injects low-specificity default styles once. Ordinary author selectors can override the centered layout:

```css
form-dropzone {
  align-items: start;
  min-block-size: 10rem;
  text-align: start;
}

form-dropzone .form-dropzone__previews {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

Stable Light DOM classes:

- `.form-dropzone--enhanced`
- `.form-dropzone--drag-active`
- `.form-dropzone__prompt`
- `.form-dropzone__separator`
- `.form-dropzone__status`
- `.form-dropzone__previews`
- `.form-dropzone__preview`
- `.form-dropzone__preview-image`
- `.form-dropzone__preview-name`

Preview items also expose the filename through `data-file-name`.

## Accessibility and progressive enhancement

- The author-provided label and file input remain the keyboard interaction.
- The wrapper does not add a duplicate button role or tab stop.
- Drop outcomes are announced through a generated polite, atomic status region.
- Accepted, invalid-type, and excess-file outcomes can be localized independently.
- Without the required drag-and-drop and assignable `FileList` APIs, the component does not mutate its children or add behavior.
- Invalid markup is left unchanged and reported with a console warning.

## Browser support

The component requires Custom Elements, ES modules, HTML drag-and-drop file APIs, `DataTransfer`, and an assignable file input `files` property. Unsupported environments retain the original label and input.

## Inspiration

The drop-zone layout and interaction were inspired by Nikita Hlopov's article, [“Custom styled input type file”](https://nikitahl.com/custom-styled-input-type-file). Many thanks to Nikita for sharing their approach!

## Development

```bash
npm install
npm run test:run
npm run test:coverage
npm run lint
npm run format
```

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
