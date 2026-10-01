import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';
import { STATUS, STATUS_LABEL, LOGISTICS_FLOW, NEGOTIABLE } from '../services/orderStatus.js';
import { notifyUsers, staffIds } from '../services/notify.js';

const router = Router();
const STAFF = ['manager', 'admin'];
const PROCUREMENT_VISIBLE = [...LOGISTICS_FLOW, STATUS.PICKED_UP];

const naira = (n) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(n));
const money = z.coerce
  .number()
  .positive('Amount must be greater than 0')
  .max(1e10)
  .transform((n) => Math.round(n * 100) / 100);
const qty = z.coerce.number().int('Quantity must be a whole number').min(1).max(100000);
const note = z.string().trim().max(1000).optional();
const idParam = z.object({ id: z.uuid() });
const offerParams = z.object({ id: z.uuid(), offerId: z.uuid() });

const CUSTOMER_MESSAGES = {
  ORDER_PLACED: (o) => `We've placed your order for ${o.item_name} with our supplier in China.`,
  SHIPPED_FROM_CHINA: (o) => `Your ${o.item_name} has been shipped from China.`,
  ARRIVED_NIGERIA: (o) => `Your ${o.item_name} has arrived in Nigeria and is going through customs.`,
  CUSTOMS_CLEARED: (o) => `Your ${o.item_name} has been cleared by customs and is heading to your warehouse.`,
  READY_FOR_PICKUP: (o) => `Your ${o.item_name} is ready for pickup. Open the app to see your pickup code.`,
};

function serialize(o, user) {
  const isOwner = user.role === 'customer' && o.customer_id === user.id;
  return {
    id: o.id,
    reference: o.reference,
    itemName: o.item_name,
    description: o.description,
    productUrl: o.product_url,
    requestedQuantity: o.requested_quantity,
    targetUnitPrice: o.target_unit_price && Number(o.target_unit_price),
    currency: o.currency,
    status: o.status,
    statusLabel: STATUS_LABEL[o.status],
    finalUnitPrice: o.final_unit_price && Number(o.final_unit_price),
    finalQuantity: o.final_quantity,
    finalTotal: o.final_total && Number(o.final_total),
    supplierReference: user.role === 'customer' ? undefined : o.supplier_reference,
    trackingNumber: o.tracking_number,
    pickupCode: isOwner && o.status === STATUS.READY_FOR_PICKUP ? o.pickup_code : undefined,
    customer: o.customer_name ? { id: o.customer_id, name: o.customer_name, phone: user.role === 'customer' ? undefined : o.customer_phone } : undefined,
    warehouse: o.warehouse_name
      ? { id: o.warehouse_id, name: o.warehouse_name, address: o.warehouse_address, city: o.warehouse_city, state: o.warehouse_state }
      : undefined,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

const ORDER_SELECT = `
  SELECT o.*, c.full_name AS customer_name, c.phone AS customer_phone,
         w.name AS warehouse_name, w.address AS warehouse_address, w.city AS warehouse_city, w.state AS warehouse_state
  FROM orders o
  JOIN users c ON c.id = o.customer_id
  LEFT JOIN warehouses w ON w.id = o.warehouse_id`;

function assertCanView(user, order) {
  const allowed =
    STAFF.includes(user.role) ||
    (user.role === 'customer' && order.customer_id === user.id) ||
    (user.role === 'procurement' && PROCUREMENT_VISIBLE.includes(order.status));
  // 404 rather than 403 so IDs of other customers' orders can't be probed.
  if (!allowed) throw new HttpError(404, 'Order not found');
}

async function lockOrder(client, id) {
  const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw new HttpError(404, 'Order not found');
  return rows[0];
}

async function setStatus(client, order, status, actorId, eventNote, extra = {}) {
  const sets = ['status = $2', 'updated_at = now()'];
  const values = [order.id, status];
  for (const [col, val] of Object.entries(extra)) {
    values.push(val);
    sets.push(`${col} = $${values.length}`);
  }
  const { rows } = await client.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, values);
  await client.query('INSERT INTO order_events (order_id, status, note, actor_id) VALUES ($1,$2,$3,$4)', [
    order.id,
    status,
    eventNote || null,
    actorId,
  ]);
  return rows[0];
}

async function managersFor(order) {
  return order.manager_id ? [order.manager_id] : staffIds(['manager']);
}

// ---------- Queries ----------

const listSchema = z.object({
  status: z.enum(Object.values(STATUS)).optional(),
  q: z.string().trim().max(100).optional(),
});

router.get('/', validate(listSchema, 'query'), async (req, res) => {
  const { status, q } = req.valid.query;
  const where = [];
  const params = [];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (req.user.role === 'customer') add('o.customer_id = ?', req.user.id);
  if (req.user.role === 'procurement') add('o.status = ANY(?::text[])', PROCUREMENT_VISIBLE);
  if (status) add('o.status = ?', status);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(o.reference ILIKE $${params.length} OR o.item_name ILIKE $${params.length})`);
  }

  const { rows } = await query(
    `${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.updated_at DESC LIMIT 200`,
    params,
  );
  res.json({ orders: rows.map((o) => serialize(o, req.user)) });
});

router.get('/stats', requireRole('manager', 'admin', 'procurement'), async (req, res) => {
  const { rows } = await query('SELECT status, count(*)::int AS count FROM orders GROUP BY status');
  const counts = Object.fromEntries(rows.map((r) => [r.status, r.count]));
  res.json({ counts });
});

router.get('/:id', validate(idParam, 'params'), async (req, res) => {
  const { rows } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [req.valid.params.id]);
  const order = rows[0];
  if (!order) throw new HttpError(404, 'Order not found');
  assertCanView(req.user, order);

  const [offers, events] = await Promise.all([
    query(
      `SELECT ofr.id, ofr.by_side, ofr.unit_price, ofr.quantity, ofr.message, ofr.status, ofr.created_at, u.full_name
       FROM offers ofr JOIN users u ON u.id = ofr.by_user_id WHERE ofr.order_id = $1 ORDER BY ofr.created_at`,
      [order.id],
    ),
    query(
      `SELECT e.id, e.status, e.note, e.created_at, u.full_name, u.role
       FROM order_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.order_id = $1 ORDER BY e.created_at`,
      [order.id],
    ),
  ]);

  res.json({
    order: serialize(order, req.user),
    offers: offers.rows.map((o) => ({
      id: o.id,
      bySide: o.by_side,
      byName: o.by_side === 'staff' && req.user.role === 'customer' ? 'Jetlog' : o.full_name,
      unitPrice: Number(o.unit_price),
      quantity: o.quantity,
      total: Number(o.unit_price) * o.quantity,
      message: o.message,
      status: o.status,
      createdAt: o.created_at,
    })),
    events: events.rows.map((e) => ({
      id: e.id,
      status: e.status,
      label: STATUS_LABEL[e.status],
      note: e.note,
      by: req.user.role === 'customer' ? undefined : e.full_name,
      createdAt: e.created_at,
    })),
  });
});

// ---------- Customer: create & cancel ----------

const createSchema = z.object({
  itemName: z.string().trim().min(2, 'Tell us what you want to order').max(150),
  description: z.string().trim().max(2000).optional(),
  productUrl: z
    .url({ protocol: /^https?$/, message: 'Enter a valid web link (http or https)' })
    .max(500)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  quantity: qty,
  targetUnitPrice: money.optional(),
  warehouseId: z.uuid().optional(),
});

router.post('/', requireRole('customer'), validate(createSchema), async (req, res) => {
  const b = req.valid.body;
  const warehouseId = b.warehouseId || req.user.preferred_warehouse_id;
  if (warehouseId) {
    const wh = await query('SELECT 1 FROM warehouses WHERE id = $1 AND active', [warehouseId]);
    if (!wh.rowCount) throw new HttpError(400, 'Selected warehouse is not available');
  }
  const reference = `JL-${new Date().toISOString().slice(2, 7).replace('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const order = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO orders (reference, customer_id, item_name, description, product_url, requested_quantity, target_unit_price, status, warehouse_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [reference, req.user.id, b.itemName, b.description, b.productUrl, b.quantity, b.targetUnitPrice, STATUS.PENDING_REVIEW, warehouseId],
    );
    await client.query('INSERT INTO order_events (order_id, status, actor_id) VALUES ($1,$2,$3)', [
      rows[0].id,
      STATUS.PENDING_REVIEW,
      req.user.id,
    ]);
    return rows[0];
  });

  notifyUsers(await staffIds(['manager']), {
    title: 'New pre-order request',
    body: `${req.user.full_name} requested ${b.quantity} x ${b.itemName} (${reference})`,
    orderId: order.id,
  });
  res.status(201).json({ order: serialize(order, req.user) });
});

router.post(
  '/:id/cancel',
  requireRole('customer'),
  validate(idParam, 'params'),
  validate(z.object({ reason: note })),
  async (req, res) => {
    const order = await withTransaction(async (client) => {
      const o = await lockOrder(client, req.valid.params.id);
      assertCanView(req.user, o);
      if (!NEGOTIABLE.includes(o.status)) throw new HttpError(409, 'Orders can only be cancelled before the price is confirmed');
      await client.query("UPDATE offers SET status = 'withdrawn' WHERE order_id = $1 AND status = 'open'", [o.id]);
      return setStatus(client, o, STATUS.CANCELLED, req.user.id, req.valid.body.reason);
    });
    notifyUsers(await managersFor(order), {
      title: 'Order cancelled by customer',
      body: `${order.reference}: ${order.item_name}`,
      orderId: order.id,
    });
    res.json({ order: serialize(order, req.user) });
  },
);

// ---------- Negotiation ----------

const offerSchema = z.object({ unitPrice: money, quantity: qty, message: note });

router.post(
  '/:id/offers',
  requireRole('customer', 'manager', 'admin'),
  validate(idParam, 'params'),
  validate(offerSchema),
  async (req, res) => {
    const { unitPrice, quantity, message } = req.valid.body;
    const isCustomer = req.user.role === 'customer';

    const order = await withTransaction(async (client) => {
      const o = await lockOrder(client, req.valid.params.id);
      assertCanView(req.user, o);
      if (!NEGOTIABLE.includes(o.status)) throw new HttpError(409, 'This order is no longer open for negotiation');
      if (isCustomer && o.status !== STATUS.NEGOTIATING) {
        throw new HttpError(409, 'Please wait for our team to send you a price first');
      }

      await client.query("UPDATE offers SET status = 'superseded' WHERE order_id = $1 AND status = 'open'", [o.id]);
      await client.query(
        'INSERT INTO offers (order_id, by_user_id, by_side, unit_price, quantity, message) VALUES ($1,$2,$3,$4,$5,$6)',
        [o.id, req.user.id, isCustomer ? 'customer' : 'staff', unitPrice, quantity, message],
      );

      if (o.status === STATUS.PENDING_REVIEW) {
        return setStatus(client, o, STATUS.NEGOTIATING, req.user.id, 'First price offer sent', { manager_id: req.user.id });
      }
      const extra = !isCustomer && !o.manager_id ? ', manager_id = $2' : '';
      const { rows } = await client.query(
        `UPDATE orders SET updated_at = now()${extra} WHERE id = $1 RETURNING *`,
        extra ? [o.id, req.user.id] : [o.id],
      );
      return rows[0];
    });

    const summary = `${quantity} x ${naira(unitPrice)} = ${naira(unitPrice * quantity)}`;
    if (isCustomer) {
      notifyUsers(await managersFor(order), { title: `Counter-offer on ${order.reference}`, body: summary, orderId: order.id });
    } else {
      notifyUsers([order.customer_id], { title: `New price for ${order.item_name}`, body: summary, orderId: order.id });
    }
    res.status(201).json({ order: serialize(order, req.user) });
  },
);

router.post(
  '/:id/offers/:offerId/accept',
  requireRole('customer', 'manager', 'admin'),
  validate(offerParams, 'params'),
  async (req, res) => {
    const { id, offerId } = req.valid.params;
    const order = await withTransaction(async (client) => {
      const o = await lockOrder(client, id);
      assertCanView(req.user, o);
      if (o.status !== STATUS.NEGOTIATING) throw new HttpError(409, 'This order is no longer open for negotiation');

      const { rows } = await client.query('SELECT * FROM offers WHERE id = $1 AND order_id = $2 FOR UPDATE', [offerId, o.id]);
      const offer = rows[0];
      if (!offer || offer.status !== 'open') throw new HttpError(409, 'This offer is no longer available');

      // Only the opposite side may accept an offer.
      const acceptorSide = req.user.role === 'customer' ? 'customer' : 'staff';
      if (offer.by_side === acceptorSide) throw new HttpError(403, 'You cannot accept your own offer');

      await client.query("UPDATE offers SET status = 'accepted' WHERE id = $1", [offer.id]);
      const total = (Number(offer.unit_price) * offer.quantity).toFixed(2);
      return setStatus(client, o, STATUS.CONFIRMED, req.user.id, `Agreed ${offer.quantity} x ${naira(offer.unit_price)}`, {
        final_unit_price: offer.unit_price,
        final_quantity: offer.quantity,
        final_total: total,
      });
    });

    const body = `${order.reference}: ${order.final_quantity} x ${naira(order.final_unit_price)} = ${naira(order.final_total)}`;
    notifyUsers([order.customer_id], { title: 'Order confirmed', body, orderId: order.id });
    notifyUsers(await managersFor(order), { title: 'Price agreed - ready for procurement', body, orderId: order.id });
    res.json({ order: serialize(order, req.user) });
  },
);

router.post(
  '/:id/reject',
  requireRole('manager', 'admin'),
  validate(idParam, 'params'),
  validate(z.object({ reason: z.string().trim().min(3, 'Give the customer a reason').max(1000) })),
  async (req, res) => {
    const order = await withTransaction(async (client) => {
      const o = await lockOrder(client, req.valid.params.id);
      if (!NEGOTIABLE.includes(o.status)) throw new HttpError(409, 'Only open requests can be declined');
      await client.query("UPDATE offers SET status = 'withdrawn' WHERE order_id = $1 AND status = 'open'", [o.id]);
      return setStatus(client, o, STATUS.REJECTED, req.user.id, req.valid.body.reason);
    });
    notifyUsers([order.customer_id], {
      title: `Update on ${order.item_name}`,
      body: `We're unable to fulfil this request: ${req.valid.body.reason}`,
      orderId: order.id,
    });
    res.json({ order: serialize(order, req.user) });
  },
);

// ---------- Procurement & logistics ----------

router.post(
  '/:id/send-to-procurement',
  requireRole('manager', 'admin'),
  validate(idParam, 'params'),
  validate(z.object({ procurementId: z.uuid().optional(), note })),
  async (req, res) => {
    const { procurementId, note: n } = req.valid.body;
    if (procurementId) {
      const p = await query("SELECT 1 FROM users WHERE id = $1 AND role = 'procurement' AND active", [procurementId]);
      if (!p.rowCount) throw new HttpError(400, 'Selected procurement manager is not available');
    }
    const order = await withTransaction(async (client) => {
      const o = await lockOrder(client, req.valid.params.id);
      if (o.status !== STATUS.CONFIRMED) throw new HttpError(409, 'Only confirmed orders can be sent to procurement');
      return setStatus(client, o, STATUS.SENT_TO_PROCUREMENT, req.user.id, n, {
        procurement_id: procurementId || null,
        manager_id: o.manager_id || req.user.id,
      });
    });

    notifyUsers(procurementId ? [procurementId] : await staffIds(['procurement']), {
      title: 'New order to place',
      body: `${order.reference}: ${order.final_quantity} x ${order.item_name}`,
      orderId: order.id,
    });
    notifyUsers([order.customer_id], {
      title: 'Your order is being processed',
      body: `We're placing your order for ${order.item_name} with our supplier.`,
      orderId: order.id,
    });
    res.json({ order: serialize(order, req.user) });
  },
);

const advanceSchema = z.object({
  note,
  supplierReference: z.string().trim().min(2).max(100).optional(),
  trackingNumber: z.string().trim().min(2).max(100).optional(),
  warehouseId: z.uuid().optional(),
});

router.post(
  '/:id/advance',
  requireRole('procurement', 'manager', 'admin'),
  validate(idParam, 'params'),
  validate(advanceSchema),
  async (req, res) => {
    const b = req.valid.body;
    const order = await withTransaction(async (client) => {
      const o = await lockOrder(client, req.valid.params.id);
      const idx = LOGISTICS_FLOW.indexOf(o.status);
      if (idx === -1 || idx === LOGISTICS_FLOW.length - 1) {
        throw new HttpError(409, 'This order cannot be moved to a next shipping step');
      }
      if (req.user.role === 'procurement' && o.procurement_id && o.procurement_id !== req.user.id) {
        throw new HttpError(403, 'This order is assigned to another procurement manager');
      }

      const next = LOGISTICS_FLOW[idx + 1];
      const extra = {};
      if (next === STATUS.ORDER_PLACED) {
        if (!b.supplierReference) throw new HttpError(400, 'Enter the supplier order reference');
        extra.supplier_reference = b.supplierReference;
        if (req.user.role === 'procurement') extra.procurement_id = req.user.id;
      }
      if (b.trackingNumber) extra.tracking_number = b.trackingNumber;
      if (next === STATUS.READY_FOR_PICKUP) {
        const warehouseId = b.warehouseId || o.warehouse_id;
        if (!warehouseId) throw new HttpError(400, 'Choose the pickup warehouse');
        const wh = await client.query('SELECT 1 FROM warehouses WHERE id = $1 AND active', [warehouseId]);
        if (!wh.rowCount) throw new HttpError(400, 'Selected warehouse is not available');
        extra.warehouse_id = warehouseId;
        extra.pickup_code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
        extra.pickup_attempts = 0;
      }
      return setStatus(client, o, next, req.user.id, b.note, extra);
    });

    notifyUsers([order.customer_id], {
      title: STATUS_LABEL[order.status],
      body: CUSTOMER_MESSAGES[order.status](order),
      orderId: order.id,
    });
    notifyUsers(await managersFor(order), {
      title: `${order.reference}: ${STATUS_LABEL[order.status]}`,
      body: `${order.final_quantity} x ${order.item_name}`,
      orderId: order.id,
    });
    res.json({ order: serialize(order, req.user) });
  },
);

const pickupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
const MAX_PICKUP_ATTEMPTS = 5;

router.post(
  '/:id/complete-pickup',
  pickupLimiter,
  requireRole('manager', 'admin'),
  validate(idParam, 'params'),
  validate(z.object({ pickupCode: z.string().regex(/^\d{6}$/, 'Pickup code is 6 digits') })),
  async (req, res) => {
    const result = await withTransaction(async (client) => {
      const o = await lockOrder(client, req.valid.params.id);
      if (o.status !== STATUS.READY_FOR_PICKUP) throw new HttpError(409, 'This order is not awaiting pickup');

      const ok =
        o.pickup_code &&
        crypto.timingSafeEqual(Buffer.from(o.pickup_code), Buffer.from(req.valid.body.pickupCode));
      if (!ok) {
        const attempts = o.pickup_attempts + 1;
        if (attempts >= MAX_PICKUP_ATTEMPTS) {
          // Too many wrong guesses: issue a fresh code that only the customer can see.
          const fresh = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
          await client.query('UPDATE orders SET pickup_code = $2, pickup_attempts = 0 WHERE id = $1', [o.id, fresh]);
          return { failed: true, regenerated: true, order: o };
        }
        await client.query('UPDATE orders SET pickup_attempts = $2 WHERE id = $1', [o.id, attempts]);
        return { failed: true, order: o };
      }
      const updated = await setStatus(client, o, STATUS.PICKED_UP, req.user.id, 'Collected by customer', { pickup_code: null });
      return { order: updated };
    });

    if (result.failed) {
      if (result.regenerated) {
        notifyUsers([result.order.customer_id], {
          title: 'Pickup code changed',
          body: 'For your security, your pickup code was reset. Open the app to see the new code.',
          orderId: result.order.id,
        });
        throw new HttpError(400, 'Too many incorrect codes. A new code has been sent to the customer.');
      }
      throw new HttpError(400, 'Incorrect pickup code');
    }

    notifyUsers([result.order.customer_id], {
      title: 'Order collected',
      body: `Thank you! ${result.order.item_name} has been collected.`,
      orderId: result.order.id,
    });
    res.json({ order: serialize(result.order, req.user) });
  },
);

export default router;
