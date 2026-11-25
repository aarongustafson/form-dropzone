import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { it, expect } from 'vitest';

it('trims block-edge margins inside demo sections', () => {
	const styles = readFileSync('demo/demo-shell.css', 'utf8');
	expect(styles).toMatch(
		/\.demo-section(?:,\s*\.api-reference)?\s*\{[^}]*\bmargin-trim:\s*block;/,
	);
});

it('publishes the reflected configuration, read-only enhancement state, refresh, and drop outcome contract', () => {
	const manifest = JSON.parse(readFileSync('custom-elements.json', 'utf8'));
	const declaration = manifest.modules.find(
		(module) => module.path === 'form-dropzone.js',
	).declarations[0];
	for (const attribute of [
		'drop-label',
		'separator-label',
		'received-message',
		'rejected-type-message',
		'rejected-multiple-message',
		'preview-images',
	]) {
		expect(
			declaration.members.find((member) => member.attribute === attribute)
				?.reflects,
		).toBe(true);
	}
	expect(
		declaration.members.find((member) => member.name === 'enhanced'),
	).toMatchObject({
		readonly: true,
		type: { text: 'boolean' },
	});
	expect(
		declaration.members.find((member) => member.name === 'refresh')?.return
			.type.text,
	).toBe('boolean');
	expect(
		declaration.members.find((member) => member.name === 'isSupported')
			?.static,
	).toBe(true);
	expect(declaration.events).toMatchObject([
		{
			name: 'form-dropzone:drop',
			bubbles: true,
			composed: true,
			cancelable: false,
		},
	]);
});

it('preserves release scripts and updates both displayed and executed CDN pins', () => {
	const source = join(dirname(fileURLToPath(import.meta.url)), '..');
	const root = mkdtempSync(join(tmpdir(), 'form-dropzone-version-'));
	try {
		mkdirSync(join(root, 'scripts'));
		mkdirSync(join(root, 'demo'));
		const packageJSON = JSON.parse(
			readFileSync(join(source, 'package.json'), 'utf8'),
		);
		expect(packageJSON.scripts.version).toBe(
			'node scripts/update-demo-versions.js && git add demo/esm.html',
		);
		expect(packageJSON.scripts.postversion).toBe('git push --follow-tags');
		packageJSON.version = '9.8.7';
		writeFileSync(join(root, 'package.json'), JSON.stringify(packageJSON));
		copyFileSync(
			join(source, 'scripts/update-demo-versions.js'),
			join(root, 'scripts/update-demo-versions.js'),
		);
		copyFileSync(
			join(source, 'demo/esm.html'),
			join(root, 'demo/esm.html'),
		);
		execFileSync(process.execPath, ['scripts/update-demo-versions.js'], {
			cwd: root,
		});
		const demo = readFileSync(join(root, 'demo/esm.html'), 'utf8');
		expect(demo.match(/form-dropzone@9\.8\.7\//g)).toHaveLength(2);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
