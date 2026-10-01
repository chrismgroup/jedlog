const raw = process.env.EXPO_PUBLIC_API_URL ?? 'https://jedlog.onrender.com';

// Release builds must only ever talk to the API over TLS.
if (!__DEV__ && !raw.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_URL must use https:// in production builds');
}

export const API_URL = raw.replace(/\/+$/, '') + '/api';
