import { HttpError } from '../utils/httpError.js';

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  if (err?.code === '23505') return res.status(409).json({ error: 'Record already exists' });
  if (err?.code === '22P02') return res.status(400).json({ error: 'Invalid identifier' });

  console.error(err);
  // Never leak internals to clients.
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
