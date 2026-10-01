import { Expo } from 'expo-server-sdk';
import { config } from '../config.js';
import { query } from '../db/pool.js';

const expo = new Expo({ accessToken: config.expoAccessToken });

/** Store an in-app notification and send a push to every registered device. Never throws. */
export async function notifyUsers(userIds, { title, body, orderId }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  try {
    await query(
      `INSERT INTO notifications (user_id, order_id, title, body)
       SELECT unnest($1::uuid[]), $2, $3, $4`,
      [ids, orderId || null, title, body],
    );

    const { rows } = await query('SELECT token FROM push_tokens WHERE user_id = ANY($1::uuid[])', [ids]);
    const messages = rows
      .filter((r) => Expo.isExpoPushToken(r.token))
      .map((r) => ({ to: r.token, sound: 'default', title, body, data: { orderId } }));

    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((t, i) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
          query('DELETE FROM push_tokens WHERE token = $1', [chunk[i].to]).catch(() => {});
        }
      });
    }
  } catch (err) {
    console.error('Notification failure:', err.message);
  }
}

export async function staffIds(roles) {
  const { rows } = await query('SELECT id FROM users WHERE role = ANY($1::text[]) AND active', [roles]);
  return rows.map((r) => r.id);
}
