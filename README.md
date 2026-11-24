# `form-dropzone` Web Component

[![npm version](https://img.shields.io/npm/v/@aarongustafson/form-dropzone.svg)](https://www.npmjs.com/package/@aarongustafson/form-dropzone)
[![CI status](https://img.shields.io/github/actions/workflow/status/aarongustafson/form-dropzone/ci.yml?branch=main&label=CI)](https://github.com/aarongustafson/form-dropzone/actions/workflows/ci.yml)
[![Minified + gzipped size](https://img.shields.io/bundlejs/size/@aarongustafson/form-dropzone?format=minzip&label=min%2Bgzip)](https://bundlejs.com/?q=@aarongustafson/form-dropzone)
[![License](https://img.shields.io/npm/l/@aarongustafson/form-dropzone)](https://github.com/aarongustafson/form-dropzone/blob/main/LICENSE)
[![Type definitions](https://img.shields.io/npm/types/@aarongustafson/form-dropzone)](https://github.com/aarongustafson/form-dropzone/blob/main/form-dropzone.d.ts)

`<form-dropzone>` adds file drag-and-drop, drop-result announcements, and optional image previews to one labeled native file input. The label and picker remain usable without JavaScript.

## Demo

- [Live demo](https://aarongustafson.github.io/form-dropzone/demo/) ([source](./demo/index.html))
- [esm.sh demo](https://aarongustafson.github.io/form-dropzone/demo/esm.html) ([source](./demo/esm.html))
- [unpkg demo](https://aarongustafson.github.io/form-dropzone/demo/unpkg.html) ([source](./demo/unpkg.html))

The main demo includes [label alternatives](https://aarongustafson.github.io/form-dropzone/demo/#basic-picker),
[custom and French messages](https://aarongustafson.github.io/form-dropzone/demo/#custom-messages),
and [picker and preview styling](https://aarongustafson.github.io/form-dropzone/demo/#styled-picker-previews).

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
import { defineFormDropzone } from '@aarongustafson/form-dropzone/define.js';

defineFormDropzone();
```

Importing `define.js` also attempts to register `<form-dropzone>` automatically in browser environments. The helper skips an existing definition and returns `true` when a custom-element registry is available, or `false` otherwise.

## Usage

Supply exactly one `input[type="file"]` and its associated `label` inside the component. Use matching `for`/`id` values, as below, or wrap the input in its label. Both remain in the page’s DOM and provide a native fallback before the component upgrades or when drag-and-drop is unavailable.

```html
<form-dropzone>
  <label for="attachments">Choose files</label>
  <input
    id="attachments"
    name="attachments"
    type="file"
    accept=".pdf,image/*"
    multiple
  />
</form-dropzone>
```

## File selection and events

The native input handles keyboard focus and picker selection. Clicking the drop-zone surface outside a label or other interactive control also opens the picker; the wrapper adds no tab stop.

Dropped files are checked against the input’s comma-separated `accept` tokens, ignoring case:

| Token        | Matches              |
| ------------ | -------------------- |
| `.pdf`       | Filename extension   |
| `text/plain` | Exact file MIME type |
| `image/*`    | MIME group           |

- Without `accept`, any dropped file type is allowed.
- Without `multiple`, the first acceptable file is selected; later acceptable files are rejected.
- A drop with accepted files replaces the existing `FileList`, rather than appending to it. A mixed drop selects the accepted files and announces the rejected files.
- A wholly rejected drop leaves the previous selection unchanged. Choose or drop another file to recover.
- After assigning accepted dropped files, the input dispatches bubbling `input` and `change` events. The component adds no custom events.

Picker selections use native browser behavior; the component’s rejection messages apply to drops. `accept` is not upload validation: validate files on the server too.

## Attributes

Each attribute has a corresponding JavaScript property:

| Attribute                   | Property                  | Default                                                    | Effect                                         |
| --------------------------- | ------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `drop-label`                | `dropLabel`               | `Drop file(s) here`                                        | Prompt before the author’s label.              |
| `separator-label`           | `separatorLabel`          | `or`                                                       | Text between the prompt and label.             |
| `received-message`          | `receivedMessage`         | `Received: {files}.`                                       | Accepted-file announcement.                    |
| `rejected-type-message`     | `rejectedTypeMessage`     | `Rejected because the file type is not accepted: {files}.` | `accept` rejection announcement.               |
| `rejected-multiple-message` | `rejectedMultipleMessage` | `Rejected because only one file is allowed: {files}.`      | Single-file limit announcement.                |
| `preview-images`            | `previewImages`           | absent / `false`                                           | Image previews for picker and drop selections. |

String properties reflect their attributes; setting `null` or `undefined` removes the attribute. Missing or empty string attributes use the defaults. Setting `previewImages` toggles the boolean attribute: its presence enables previews, even when written as `preview-images="false"`.

Prompt and separator changes update the visible text. Message changes apply to subsequent drops, and preview changes update the current selection.

### Localization

Rewrite the prompt, separator, and messages for your application’s vocabulary or language. Translate the native label yourself. Message templates support `{files}` (a comma-separated filename list) and `{count}` (the number of files in that outcome, not the whole drop).

See the [custom announcements and French example](https://aarongustafson.github.io/form-dropzone/demo/#custom-messages) for complete markup.

## Image previews

Add `preview-images` to show selected files whose MIME type starts with `image/`. Non-image files remain selected when allowed but don’t get previews.

```html
<form-dropzone preview-images>
  <label for="photos">Choose photos</label>
  <input id="photos" name="photos" type="file" accept="image/*" multiple />
</form-dropzone>
```

Previews show a cropped image and its filename. They’re visual only and don’t change form submission. The component revokes object URLs whenever previews are replaced, disabled, or disconnected.

## Styling

The component injects low-specificity default styles once. It leaves foreground
and background colors to the author and draws a two-pixel dashed boundary in
`currentColor`. During a file drag, that boundary becomes solid without changing
the colors.

The original file input retains its browser-provided focus indicator. The
wrapper adds neither a focus ring nor a tab stop.

Ordinary author selectors can override the centered layout. When setting a
background, supply its foreground too:

```css
form-dropzone {
  background: Canvas;
  color: CanvasText;
  align-items: start;
  min-block-size: 10rem;
  text-align: start;
}

form-dropzone .form-dropzone__previews {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

These styling hooks are in the page’s DOM; no shadow-root selectors are needed:

| Selector                                                        | Targets                            |
| --------------------------------------------------------------- | ---------------------------------- |
| `.form-dropzone--enhanced`                                      | Enhanced wrapper                   |
| `.form-dropzone--drag-active`                                   | Wrapper during a file drag         |
| `.form-dropzone__prompt`, `.form-dropzone__separator`           | Visible instructions               |
| `.form-dropzone__status`                                        | Visually hidden drop-result status |
| `.form-dropzone__previews`                                      | Preview grid                       |
| `.form-dropzone__preview`                                       | Individual preview                 |
| `.form-dropzone__preview-image`, `.form-dropzone__preview-name` | Cropped image and filename         |

Style the native picker button with `input[type="file"]::file-selector-button`.
The [styling demo](https://aarongustafson.github.io/form-dropzone/demo/#styled-picker-previews)
shows a visible custom picker button and circular previews.

Preview items also expose the filename through `data-file-name`.

The same classes work in forced colors, with automatic color adjustment
enabled. If you add a custom drag background, test its text and border contrast
as well as the resting state. Keep a non-color drag cue and a visible focus
indicator on the native picker. Check preview filenames on the surrounding
surface; images do not provide a dependable text background.

## Accessibility and progressive enhancement

- The author-provided label names the input, which remains the keyboard interaction and retains its native focus indicator.
- The wrapper does not add a duplicate button role or tab stop.
- Drop outcomes are announced through a generated polite, atomic status region.
- Accepted, invalid-type, and excess-file outcomes can be localized independently.
- Without the required drag-and-drop and assignable `FileList` APIs, the component does not mutate its children or add behavior.
- Invalid markup is left unchanged and reported with a console warning.
- On disconnect, the component removes its listeners, generated content, and state classes, revokes preview URLs, and cancels pending announcements. The author’s label, input, and selected files remain; reconnecting enhances valid markup again.

Drop announcements use a visually hidden status region. Provide visible feedback
when people need to review rejection details; the custom-announcement demo shows
one approach. Test your labels, focus cues, drag cues, and feedback with the
assistive technologies your application supports.

## Browser support

The component requires Custom Elements, ES modules, HTML drag-and-drop file APIs, `DataTransfer`, and an assignable file input `files` property. Unsupported environments retain the original label and input.

`FormDropzoneElement.isSupported()` checks the file drag-and-drop APIs and whether a file input accepts an assigned `FileList`. See the [type declarations](./form-dropzone.d.ts) for the public class API.

## Inspiration

The drop-zone layout and interaction were inspired by Nikita Hlopov's article, [“Custom styled input type file”](https://nikitahl.com/custom-styled-input-type-file). Many thanks to Nikita for sharing their approach!

## Development

```bash
npm install
npm run test:run
npm run test:coverage
npm run test:browser
npm run lint
npm run format
```

Browser tests use Playwright’s Chromium, Firefox, and WebKit engines. Install
them with `npx playwright install` before the first run. Automated checks don’t
replace native-picker, operating-system high-contrast, or assistive-technology
testing.

## License

MIT © [Aaron Gustafson](https://www.aaron-gustafson.com/)
