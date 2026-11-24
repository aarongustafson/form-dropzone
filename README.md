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
- After assigning accepted dropped files, the input dispatches bubbling `input` and `change` events. A completed file drop also emits `form-dropzone:drop` on the wrapper, including when every file was rejected.

Picker selections use native browser behavior; the component’s rejection messages apply to drops. `accept` is not upload validation: validate files on the server too.

### Drop outcomes

Use the custom event for visible rejection feedback or application integration,
not as a replacement for the input’s native selection events:

```javascript
const zone = document.querySelector('form-dropzone');
zone.addEventListener('form-dropzone:drop', ({ detail }) => {
  const { input, accepted, rejectedType, rejectedMultiple } = detail;
  console.log(input.files, accepted, rejectedType, rejectedMultiple);
});
```

The detail contains the native `input` and three arrays of `File` objects:
files accepted by this drop, files rejected by `accept`, and excess acceptable
files rejected by the single-file limit. These are outcome snapshots, not the
current selection: an all-rejected drop has an empty `accepted` array while
`input.files` retains the previous selection. The detail and arrays are frozen;
the input and File objects are not.

The event bubbles, crosses shadow boundaries, and cannot be canceled. It fires
after any native selection events and preview synchronization, before the queued
live-region text update. Picker changes, resets, text-only drops, assignment
failures, and disconnection during native callbacks do not emit it. Assignment
failures are logged rather than reported as successful drops.

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

String properties reflect their attributes; setting `null` or `undefined` removes the attribute. Missing or empty string attributes use shared defaults when provided, then the defaults above. Setting `previewImages` toggles the boolean attribute: its presence enables previews, even when written as `preview-images="false"`.

Prompt and separator changes update the visible text. Message changes apply to subsequent drops, and preview changes update the current selection.

### Localization

Rewrite the prompt, separator, and messages for your application’s vocabulary or language. Translate the native label yourself. Message templates support `{files}` (a comma-separated filename list) and `{count}` (the number of files in that outcome, not the whole drop).

See the [custom announcements and French example](https://aarongustafson.github.io/form-dropzone/demo/#custom-messages) for complete markup.

### Shared messages and plural wording

For repeated instances, supply one inline JSON script anywhere in the document
before the components connect:

```html
<script type="application/json" data-form-dropzone-config>
  {
    "drop-label": "Drop documents here",
    "received-message": {
      "one": "Received one file: {files}.",
      "other": "Received {count} files: {files}."
    }
  }
</script>
```

The script accepts any subset of the five string attributes listed above.
An instance attribute/property wins per key, then shared configuration, then the
component default. Shared values never write instance attributes. Existing
string attributes and properties remain complete, plain-string overrides;
they do not accept JSON. Message getters return the effective string, using
`other` when the shared value has plural forms.

Shared labels must be nonempty strings. Shared messages accept either a
nonempty string or a plural object with a required `other` string and optional
`zero`, `one`, `two`, `few`, and `many` strings. `Intl.PluralRules` selects the
category using the nearest inherited `lang`; a missing category uses that
message’s `other` phrase. Without `lang`, browser locale resolution applies.
An invalid language is logged and uses the authored `other` phrase. Language
changes affect the next drop; the component ships no translation catalog or
language-selection registry.

Both tokens can repeat, move, or be omitted. `{count}` remains the decimal
count for that outcome; `{files}` remains the comma-separated filename list.
Substituted names, braces, replacement metacharacters, and markup stay literal
text. Shared templates reject unknown or malformed tokens. Existing instance
strings retain their permissive token behavior for compatibility.

Configuration must be a flat object with known keys, not a locale catalog.
Duplicate scripts, named markers, external `src`, malformed JSON, empty values,
unknown keys/categories, and invalid templates are logged. Initial errors keep
the native picker and enhancement usable with instance/default text. A failed
refresh retains the last valid shared configuration.

### State and refreshing shared text

`enhanced` is a read-only boolean: `true` while the labeled input has dropzone
enhancement, and `false` before setup, in unsupported/invalid markup, or after
disconnect. Native `files`, `accept`, `multiple`, `disabled`, and form ownership
remain on the file input.

`refresh(): boolean` reloads the document’s shared configuration and updates the
existing prompt and separator. Call it on each affected instance after editing
or removing the JSON script. It does not replace controls, previews, selected
files, or focus, and does not replay a previous announcement or emit an event.
Configuration is cached by script/text; getters do not reparse it.

Refresh returns `false` and logs the problem for invalid configuration or an
instance that is not connected and enhanced. It does not rescan replacement
markup or initialize an unsupported element. Correct the JSON and call it again
to recover; adding a previously missing input/label requires reconnection.

## Image previews

Add `preview-images` to show selected files whose MIME type starts with `image/`. Non-image files remain selected when allowed but don’t get previews.

```html
<form-dropzone preview-images>
  <label for="photos">Choose photos</label>
  <input id="photos" name="photos" type="file" accept="image/*" multiple />
</form-dropzone>
```

Previews show a cropped image and its filename. They’re visual only and don’t change form submission. The component revokes object URLs whenever previews are replaced, disabled, reset, or disconnected.

A non-canceled reset of the input’s current form clears stale previews, drag
state, and drop feedback after the browser resets the native selection. This
also works with an external `form` owner. Picker changes clear previous drop
feedback without manufacturing a drop event; a canceled reset leaves it intact.

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
npm run test:types
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
