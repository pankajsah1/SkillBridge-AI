/**
 * Secure local file storage for portfolio documents.
 *
 * WHY THIS FILE EXISTS INSTEAD OF MULTER. The npm registry is unreachable from
 * the build environment, so no upload library could be installed. Rather than
 * block Step 6, this implements the narrow slice actually needed — one file per
 * request, five allowed types, a hard size cap — on top of Node built-ins. It is
 * not a general-purpose upload library and should not grow into one.
 *
 * THE THREAT MODEL, and what answers each part of it:
 *
 *   A student uploads a 2 GB file to fill the disk.
 *     -> `readLimitedBody` counts bytes as they arrive and destroys the socket
 *        the moment the cap is passed. Nothing is written to disk until the whole
 *        body has been accepted, so a rejected upload costs memory briefly and
 *        disk never.
 *
 *   A student uploads `evil.exe` with `Content-Type: application/pdf`.
 *     -> The declared type is checked against the allowlist, and then the file's
 *        own leading bytes are checked against that type's magic number. The
 *        header is a claim; the signature is evidence.
 *
 *   A student sends `originalName: "../../../server/src/app.js"`.
 *     -> The original name never reaches the filesystem. Storage names are
 *        generated server-side as `<24-hex-owner>-<timestamp>-<random><ext>`.
 *        `originalName` is stored as display text only.
 *
 *   A student requests `GET /portfolio/documents/..%2f..%2fconfig%2fenv.js`.
 *     -> `resolveStoredFilePath` validates the name against a strict pattern AND
 *        verifies the resolved absolute path still sits inside the uploads root.
 *        Two independent checks, because a single regex is one clever encoding
 *        away from being wrong.
 *
 *   Student A requests student B's file by guessing the name.
 *     -> Not defended here. It is defended structurally one layer up: the
 *        service only ever resolves a `fileName` it just read out of the
 *        caller's own profile document, so a name that is not in your profile is
 *        a 404 regardless of whether the file exists. There is deliberately no
 *        static middleware serving this directory.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DOCUMENT_TYPE_VALUES,
  UPLOAD_LIMITS,
} from '../constants/portfolio.js';
import AppError from '../utils/AppError.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * `server/uploads/` — already listed in `.gitignore`, so documents are never
 * committed. Resolved once at module load so every later containment check
 * compares against the same absolute, symlink-free-enough root.
 */
export const UPLOADS_ROOT = path.resolve(currentDir, '../../uploads');

/**
 * The extensions this module is capable of generating, derived from the mime
 * allowlist rather than typed out again.
 *
 * Deriving it matters: a hardcoded list would drift the moment a type is added or
 * removed from the allowlist, and the drift would be silent — either a legitimate
 * download starts 404ing, or the pattern keeps accepting an extension the server
 * can no longer produce.
 */
const STORABLE_EXTENSIONS = Object.freeze([
  ...new Set(
    Object.values(ALLOWED_DOCUMENT_MIME_TYPES).map((entry) => entry.extension.replace(/^\./, '')),
  ),
]);

/**
 * Exactly the shape `buildStoredFileName` produces, and nothing else.
 *
 * No dots except the extension, no slashes, no `..`. Written as a whitelist of
 * permitted characters rather than a blacklist of dangerous ones — a blacklist
 * has to anticipate every encoding trick, a whitelist does not.
 *
 * The extension is pinned to the allowlist instead of a loose `[a-z0-9]{2,5}`.
 * The loose version accepted `....js`, `....sh` and every other short extension,
 * which was not a live hole — nothing can create such a file here, and downloads
 * additionally require the name to already appear in the caller's own profile —
 * but "not currently reachable" is a weaker guarantee than "not expressible", and
 * this layer is supposed to be the strict one.
 */
const STORED_FILE_NAME_PATTERN = new RegExp(
  `^[a-f0-9]{24}-\\d{13}-[a-f0-9]{16}\\.(?:${STORABLE_EXTENSIONS.join('|')})$`,
);

/** Creates the uploads directory on first use. Idempotent. */
export const ensureUploadsRoot = async () => {
  await fs.mkdir(UPLOADS_ROOT, { recursive: true });
  return UPLOADS_ROOT;
};

/**
 * Reads the request body into memory, refusing to exceed `maxBytes`.
 *
 * Two independent limits. The Content-Length header is checked first as a cheap
 * early rejection, but it is only a claim — a chunked upload can omit it or lie —
 * so the running byte count is the real enforcement.
 *
 * On overflow the socket is destroyed rather than politely ended: continuing to
 * read a body we have already decided to reject is exactly the resource waste
 * the limit exists to prevent.
 *
 * @param {import('express').Request} req
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
export const readLimitedBody = (req, maxBytes = UPLOAD_LIMITS.maxFileBytes) =>
  new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      reject(
        AppError.badRequest(
          `That file is larger than the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
        ),
      );
      return;
    }

    const chunks = [];
    let received = 0;
    let settled = false;

    const finish = (error, buffer) => {
      if (settled) return;
      settled = true;
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      if (error) reject(error);
      else resolve(buffer);
    };

    function onData(chunk) {
      received += chunk.length;

      if (received > maxBytes) {
        // Stop the transfer outright; do not keep buffering a doomed upload.
        req.destroy();
        finish(
          AppError.badRequest(
            `That file is larger than the ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
          ),
        );
        return;
      }

      chunks.push(chunk);
    }

    function onEnd() {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        finish(AppError.badRequest('No file data was received.'));
        return;
      }
      finish(null, buffer);
    }

    function onError() {
      finish(AppError.badRequest('The upload did not complete. Please try again.'));
    }

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });

/**
 * Confirms the bytes are what the request said they were.
 *
 * `text/plain` has no reliable magic number, so it is accepted on the declared
 * type alone — a text file cannot smuggle an executable past anything that only
 * ever offers it back as a download with a fixed Content-Type.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType already known to be in the allowlist
 * @returns {boolean}
 */
export const matchesFileSignature = (buffer, mimeType) => {
  const { signatures } = ALLOWED_DOCUMENT_MIME_TYPES[mimeType] ?? {};
  if (!signatures) return true;

  return signatures.some(
    (signature) =>
      buffer.length >= signature.length &&
      signature.every((byte, index) => buffer[index] === byte),
  );
};

/**
 * Generates the name the file will actually be stored under.
 *
 * `<ownerId>-<timestamp>-<random>.<ext>`:
 *   - ownerId  makes ownership visible during debugging without a database read
 *   - timestamp keeps a directory listing chronological
 *   - 8 random bytes make the name unguessable, so knowing a student's id is not
 *     enough to construct a valid path
 *   - the extension comes from the ALLOWLIST, never from the uploaded name
 *
 * The student's filename contributes nothing to this string. That is the whole
 * point: there is no input to sanitise because there is no input.
 *
 * @param {{ownerId: string, mimeType: string}} params
 * @returns {string}
 */
export const buildStoredFileName = ({ ownerId, mimeType }) => {
  const { extension } = ALLOWED_DOCUMENT_MIME_TYPES[mimeType] ?? {};
  if (!extension) throw AppError.badRequest('That file type is not accepted.');

  const owner = String(ownerId).toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(owner)) {
    // Only reachable from a programming error — the caller passes req.user.id.
    throw AppError.internal('Cannot store a document without a valid owner id.');
  }

  const random = crypto.randomBytes(8).toString('hex');
  return `${owner}-${Date.now()}-${random}${extension}`;
};

/**
 * Turns a stored file name into an absolute path, or throws.
 *
 * BOTH checks matter and neither is redundant:
 *   1. the name must match the generated-name pattern exactly, and
 *   2. the resolved path must still be inside UPLOADS_ROOT.
 *
 * (1) alone would rely on the regex being airtight against every encoding; (2)
 * alone would allow oddly-named files that only a bug could have created. The
 * `startsWith` comparison appends a separator so `/uploads-evil/x` cannot pass as
 * a child of `/uploads`.
 *
 * @param {string} fileName
 * @returns {string} absolute path
 */
export const resolveStoredFilePath = (fileName) => {
  if (typeof fileName !== 'string' || !STORED_FILE_NAME_PATTERN.test(fileName)) {
    throw AppError.notFound('Document not found.');
  }

  const resolved = path.resolve(UPLOADS_ROOT, fileName);

  if (resolved !== path.join(UPLOADS_ROOT, fileName)) {
    throw AppError.notFound('Document not found.');
  }

  if (!resolved.startsWith(UPLOADS_ROOT + path.sep)) {
    throw AppError.notFound('Document not found.');
  }

  return resolved;
};

/**
 * Writes the buffer under a freshly generated name and returns the metadata to
 * embed in the profile.
 *
 * `flag: 'wx'` fails if the name somehow already exists rather than overwriting —
 * with 8 random bytes plus a millisecond timestamp a collision is not realistic,
 * but silently destroying another student's document is bad enough to be worth
 * one flag.
 *
 * @param {{buffer: Buffer, mimeType: string, originalName: string,
 *          documentType: string, ownerId: string, apiPrefix: string}} params
 * @returns {Promise<object>} metadata matching documentMetadataSchema
 */
export const storeDocument = async ({
  buffer,
  mimeType,
  originalName,
  documentType,
  ownerId,
  apiPrefix = '/api/v1',
}) => {
  if (!ALLOWED_DOCUMENT_MIME_TYPES[mimeType]) {
    throw AppError.badRequest('That file type is not accepted.');
  }

  if (!DOCUMENT_TYPE_VALUES.includes(documentType)) {
    throw AppError.badRequest('That document type is not recognised.');
  }

  if (!matchesFileSignature(buffer, mimeType)) {
    throw AppError.badRequest(
      `The file contents do not look like a ${mimeType} file. Please upload the original file.`,
    );
  }

  await ensureUploadsRoot();

  const fileName = buildStoredFileName({ ownerId, mimeType });
  const absolutePath = resolveStoredFilePath(fileName);

  await fs.writeFile(absolutePath, buffer, { flag: 'wx' });

  return {
    fileName,
    // Display text only. Trimmed and length-capped so it cannot bloat the
    // document; never interpreted as a path anywhere.
    originalName: sanitiseDisplayName(originalName),
    fileUrl: `${apiPrefix}/students/portfolio/documents/${fileName}`,
    mimeType,
    // The real byte count, not the claimed Content-Length.
    size: buffer.length,
    documentType,
    uploadedAt: new Date(),
  };
};

/**
 * Cleans a client-supplied filename for DISPLAY.
 *
 * This is not path sanitisation — the result never touches the filesystem. It
 * strips directory components and control characters so the name cannot be used
 * to mislead (a name containing `\r\n` could otherwise look like two lines in a
 * UI) and falls back to a neutral label if nothing usable survives.
 *
 * @param {unknown} name
 * @returns {string}
 */
export const sanitiseDisplayName = (name) => {
  if (typeof name !== 'string') return 'document';

  const withoutPath = name.split(/[\\/]/).pop() ?? '';

  // Codepoint filter rather than a character-class regex: writing a control
  // range as literal characters in source is how real control bytes end up in
  // the file. Comparing charCodeAt keeps this source plain ASCII.
  const printable = [...withoutPath]
    .filter((character) => {
      const code = character.codePointAt(0);
      const isC0Control = code < 0x20;
      const isDeleteOrC1 = code >= 0x7f && code <= 0x9f;
      return !isC0Control && !isDeleteOrC1;
    })
    .join('');

  const cleaned = printable.replace(/\s+/g, ' ').trim();

  if (!cleaned) return 'document';
  return cleaned.slice(0, UPLOAD_LIMITS.maxFileNameLength);
};

/**
 * Deletes a stored file, tolerating its absence.
 *
 * A missing file is not an error here: it means the disk and the database already
 * disagree, and refusing to remove the database row would keep a broken link on
 * the student's portfolio forever. The metadata deletion is what the student
 * asked for; removing the bytes is best-effort cleanup.
 *
 * @param {string} fileName
 * @returns {Promise<boolean>} true if a file was actually removed
 */
export const deleteStoredDocument = async (fileName) => {
  let absolutePath;

  try {
    absolutePath = resolveStoredFilePath(fileName);
  } catch {
    // An unparseable name cannot correspond to a file we wrote.
    return false;
  }

  try {
    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

/**
 * Reads a stored file for an authenticated download.
 *
 * Returns null on ENOENT instead of throwing, so the caller can answer "the
 * record exists but its file is gone" distinctly from "no such record" — the
 * graceful missing-file handling the spec asks for.
 *
 * @param {string} fileName
 * @returns {Promise<Buffer|null>}
 */
export const readStoredDocument = async (fileName) => {
  const absolutePath = resolveStoredFilePath(fileName);

  try {
    return await fs.readFile(absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

export default {
  UPLOADS_ROOT,
  ensureUploadsRoot,
  readLimitedBody,
  matchesFileSignature,
  buildStoredFileName,
  resolveStoredFilePath,
  storeDocument,
  sanitiseDisplayName,
  deleteStoredDocument,
  readStoredDocument,
};
