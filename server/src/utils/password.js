import { HttpError } from './httpError.js';

export const PASSWORD_RULES =
  'At least 10 characters, with an uppercase letter, a lowercase letter and a number.';

export function isStrongPassword(pw) {
  return (
    typeof pw === 'string' &&
    pw.length >= 10 &&
    pw.length <= 128 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw)
  );
}

export function assertStrongPassword(pw) {
  if (!isStrongPassword(pw)) throw new HttpError(400, `Weak password. ${PASSWORD_RULES}`);
}
