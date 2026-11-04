#!/usr/bin/env node
// Stamp the exact, reviewed main commit into the bundled Edge Function.
// Local builds retain "unreleased"; protected deployment must stamp a SHA.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const renderReleaseRevision = (sha) => {
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error('release revision must be an exact lowercase Git commit SHA');
  }
  return [
    '// Generated only by the approved source-pinned release workflow.',
    '// Public release attestation; never include credentials in this file.',
    `export const releaseRevision = '${sha}';`,
    '',
  ].join('\n');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('usage: stamp-public-intake-release.mjs 40-char-commit-sha');
  const output = new URL('../supabase/functions/public-intake/release-revision.mjs', import.meta.url);
  writeFileSync(output, renderReleaseRevision(process.argv[2]), { encoding: 'utf8' });
  process.stdout.write('Stamped source-pinned public-intake release revision.\n');
}
