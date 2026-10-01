import { HttpError } from '../utils/httpError.js';

export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      throw new HttpError(400, details[0]?.message || 'Invalid input', details);
    }
    req.valid = { ...(req.valid || {}), [source]: result.data };
    next();
  };
