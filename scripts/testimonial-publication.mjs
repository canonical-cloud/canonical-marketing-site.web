// Fail-closed testimonial pre-publication gate. Does not validate the truth of
// an endorsement: independent human evidence/permission review is still required.
import { lstat, readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EXPECTED_COMPANIES = Object.freeze([
  ['channelmeter', 'ChannelMeter'],
  ['vultr', 'Vultr'],
  ['trinity-labs', 'Trinity Labs'],
  ['interos-ai', 'Interos.ai'],
  ['luma-health', 'Luma Health'],
  ['benefactor-cc', 'Benefactor.cc'],
  ['polka', 'Polka'],
  ['bose-audio', 'Bose Audio'],
]);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MAX_BYTES = 256 * 1024;
const EVIDENCE_FIELDS = ['quote', 'attribution', 'logoUseConsent', 'relationshipEvidence', 'publicationConsent'];

export class TestimonialPublicationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'TestimonialPublicationError';
    this.code = code;
  }
}
const requireValid = (condition, code) => {
  if (!condition) throw new TestimonialPublicationError(code);
};
const textPresent = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;

export const isLocalLogoPath = (id, path) =>
  typeof path === 'string' &&
  new RegExp('^/brand/testimonials/' + id + '\\.(svg|png|webp)$').test(path);

function allowedSource(url) {
  if (url === null) return true;
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0 &&
      parsed.username === '' && parsed.password === '' && parsed.hash === '';
  } catch {
    return false;
  }
}

export function validateCandidates(candidates) {
  requireValid(Array.isArray(candidates) && candidates.length === EXPECTED_COMPANIES.length,
    'EXPECTED_EIGHT_COMPANIES');
  for (const [index, [id, company]] of EXPECTED_COMPANIES.entries()) {
    const item = candidates[index];
    requireValid(item !== null && typeof item === 'object' && !Array.isArray(item) &&
      item.id === id && item.company === company, 'WRONG_COMPANY_OR_ORDER');
    requireValid(typeof item.approvedForPublication === 'boolean', 'INVALID_APPROVAL_FLAG');
    requireValid(allowedSource(item.logoSourceUrl), 'INVALID_LOGO_SOURCE_URL');
    requireValid(item.logoAssetPath === null || isLocalLogoPath(id, item.logoAssetPath),
      'INVALID_LOGO_ASSET_PATH');
    for (const field of EVIDENCE_FIELDS) {
      requireValid(item[field] === null || textPresent(item[field]),
        'INVALID_TESTIMONIAL_FIELD');
    }
  }

  const approved = candidates.filter((item) => item.approvedForPublication === true);
  requireValid(approved.length === 0 || approved.length === EXPECTED_COMPANIES.length,
    'PARTIAL_APPROVAL_BLOCKED');
  if (approved.length === EXPECTED_COMPANIES.length) {
    for (const item of approved) {
      requireValid(EVIDENCE_FIELDS.every((field) => textPresent(item[field])),
        'MISSING_PUBLICATION_EVIDENCE');
      requireValid(isLocalLogoPath(item.id, item.logoAssetPath),
        'MISSING_APPROVED_LOGO_PATH');
    }
  }
  return approved;
}

// Conservative static SVG screening. This is NOT a general-purpose XML
// sanitizer; reviewers must still inspect the source and preferably use a
// vetted raster export when a logo uses unsupported SVG functionality.
export function inspectLogoBytes(bytes, extension) {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  requireValid(data.length > 32 && data.length <= MAX_BYTES, 'INVALID_LOGO_SIZE');

  if (extension === 'png') {
    requireValid(
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      data.toString('ascii', 12, 16) === 'IHDR' &&
      data.readUInt32BE(8) === 13, 'INVALID_PNG_HEADER');
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    requireValid(width > 0 && height > 0 && width <= 4096 && height <= 4096 &&
      width * height <= 16_000_000, 'INVALID_LOGO_DIMENSIONS');
    return { format: extension, bytes: data.length };
  }

  if (extension === 'webp') {
    requireValid(data.toString('ascii', 0, 4) === 'RIFF' &&
      data.toString('ascii', 8, 12) === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(data.toString('ascii', 12, 16)) &&
      data.readUInt32LE(4) + 8 === data.length, 'INVALID_WEBP_HEADER');
    return { format: extension, bytes: data.length };
  }

  requireValid(extension === 'svg', 'UNSUPPORTED_LOGO_FORMAT');
  const svg = data.toString('utf8').trim();
  requireValid(!svg.includes('\uFFFD') && /^<svg\b/i.test(svg) &&
    /<\/svg>\s*$/i.test(svg), 'INVALID_SVG_ROOT');
  requireValid(!/(?:<!|<\?|&|on[a-z]+\s*=|(?:xlink:)?href\s*=|style\s*=|url\s*\(|@import|javascript:|data:|file:)/i.test(svg),
    'UNSAFE_SVG_FEATURE');
  const withoutXmlns = svg.replace(/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/gi, '');
  requireValid(!/(?:https?:|\/\/|<\s*\/?\s*style\b)/i.test(withoutXmlns),
    'SVG_EXTERNAL_REFERENCE');
  const tags = svg.match(/<[^>]*>/g) ?? [];
  requireValid(tags.length > 1 && svg.replace(/<[^>]*>/g, '').trim() === '',
    'UNPARSED_SVG_CONTENT');
  const safeTags = new Set([
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line',
    'polyline', 'polygon', 'defs', 'clippath', 'lineargradient',
    'radialgradient', 'stop',
  ]);
  for (const tag of tags) {
    const name = /^<\/?\s*([a-z][a-z0-9:-]*)\b/i.exec(tag)?.[1]?.toLowerCase();
    requireValid(name && safeTags.has(name), 'UNSAFE_SVG_ELEMENT');
  }
  return { format: extension, bytes: data.length };
}

export async function verifyTestimonialPublication(candidates, options = {}) {
  const approved = validateCandidates(candidates);
  if (approved.length === 0) {
    return Object.freeze({ status: 'HIDDEN', companies: candidates.length, assetsChecked: 0 });
  }

  const root = options.root ?? ROOT;
  const readAsset = options.readAsset ?? readFile;
  const statAsset = options.statAsset ?? lstat;
  const canonicalPath = options.canonicalPath ?? realpath;
  const assetRoot = resolve(root, 'public', 'brand', 'testimonials');
  for (const item of approved) {
    const extension = item.logoAssetPath.split('.').at(-1);
    const assetPath = resolve(assetRoot, item.id + '.' + extension);
    requireValid(isLocalLogoPath(item.id, item.logoAssetPath), 'INVALID_LOGO_ASSET_PATH');
    let stat;
    try { stat = await statAsset(assetPath); }
    catch { throw new TestimonialPublicationError('LOGO_FILE_MISSING'); }
    requireValid(stat.isFile() && !stat.isSymbolicLink() &&
      stat.size > 32 && stat.size <= MAX_BYTES, 'INVALID_LOGO_FILE');
    let resolved;
    try { resolved = await canonicalPath(assetPath); }
    catch { throw new TestimonialPublicationError('LOGO_REALPATH_FAILED'); }
    requireValid(resolved.startsWith(assetRoot + sep), 'LOGO_PATH_ESCAPES_ROOT');
    let bytes;
    try { bytes = await readAsset(assetPath); }
    catch { throw new TestimonialPublicationError('LOGO_FILE_UNREADABLE'); }
    inspectLogoBytes(bytes, extension);
  }
  return Object.freeze({ status: 'READY', companies: approved.length, assetsChecked: approved.length });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const raw = await readFile(new URL('../src/data/testimonial-candidates.json', import.meta.url));
    const result = await verifyTestimonialPublication(JSON.parse(raw.toString('utf8')));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({
      status: 'FAIL',
      code: error instanceof TestimonialPublicationError ? error.code : 'PUBLICATION_CHECK_FAILED',
    }));
    process.exitCode = 1;
  }
}
