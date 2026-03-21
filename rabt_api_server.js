// ============================================
// Rabt Naturals – MongoDB API Proxy
// Updated: All CRUD routes added
// ============================================

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();

app.use(cors({ origin: ['https://admin.rabtnaturals.com', 'https://rabtnaturals.com', 'http://localhost:3000', 'http://localhost:3002'], credentials: true }));
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'rabt';

if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable not set!');
  process.exit(1);
}

let client = null;

async function getDB() {
  if (!client || !client.topology?.isConnected()) {
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
  }
  return client.db(DB_NAME);
}

app.get('/', (req, res) => {
  res.json({ status: 'Rabt API Live ✅', db: DB_NAME, time: new Date() });
});

app.get('/api/live/ping', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ============================================
// ORDERS
// ============================================
app.get('/api/orders', async (req, res) => {
  try {
    const db = await getDB();
    const { status, limit = 200 } = req.query;
    const query = status ? { status } : {};
    const orders = await db.collection('orders').find(query).sort({ createdAt: -1 }).limit(Number(limit)).toArray();
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/stats', async (req, res) => {
  try {
    const db = await getDB();
    const orders = await db.collection('orders').find({}).toArray();
    const total = orders.length;
    const revenue = orders.filter(o => o.status === 'delivered' || o.status === 'Delivered')
      .reduce((sum, o) => sum + (o.pricing?.total || o.totalAmount || o.amount || 0), 0);
    const byStatus = {};
    orders.forEach(o => {
      const s = o.status || 'unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    res.json({ total, revenue, byStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const db = await getDB();
    const order = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function getShiprocketToken() {
  const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'anitales786@gmail.com', password: 'uKoc&t1JaQ*hCGira33^ytNW59B%6C^#' })
  });
  const data = await res.json();
  return data.token;
}

async function createShiprocketOrder(order) {
  const token = await getShiprocketToken();
  let phone = (order.shippingAddress?.contactPhone || order.customerPhone || '').replace(/^\+91/, '').replace(/\s/g, '').replace(/[^0-9]/g, '').slice(-10);
  const payload = {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt).toISOString().split('T')[0],
    billing_customer_name: order.shippingAddress?.contactName || order.customerName || '',
    billing_last_name: '',
    billing_address: (order.shippingAddress?.street || order.address || 'N/A').padEnd(3, ' '),
    billing_city: order.shippingAddress?.city || '',
    billing_state: order.shippingAddress?.state || '',
    billing_pincode: order.shippingAddress?.pincode || '',
    billing_country: 'India',
    billing_phone: phone,
    billing_email: order.customerEmail || '',
    shipping_is_billing: true,
    order_items: (order.items || []).map(item => ({
      name: item.productSnapshot?.name || 'Product',
      sku: item.variant?.sku || 'SKU',
      units: item.quantity || 1,
      selling_price: item.price?.final || 0,
      discount: 0, tax: 0, hsn: 420222
    })),
    payment_method: order.payment?.method === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges: order.pricing?.shippingCharges || 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: order.pricing?.couponDiscount || 0,
    sub_total: order.pricing?.subtotal || order.pricing?.total || 0,
    length: 10, breadth: 10, height: 10, weight: 0.3
  };
  const res = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

app.post('/api/orders', async (req, res) => {
  try {
    const db = await getDB();
    const orderNumber = 'HQ' + Date.now() + Math.floor(Math.random()*1000);
    const body = req.body;
    const contactName = body.shippingAddress?.contactName || body.customerName || '';
    const contactPhone = body.shippingAddress?.contactPhone || body.customerPhone || '';
    const contactEmail = body.customerEmail || '';
    const order = {
      ...body, orderNumber,
      customerName: contactName, customerPhone: contactPhone, customerEmail: contactEmail,
      user: {
        firstName: contactName.split(' ')[0] || contactName,
        lastName: contactName.split(' ').slice(1).join(' ') || '',
        email: contactEmail, phoneNumber: contactPhone,
      },
      createdAt: new Date(), updatedAt: new Date()
    };
    const result = await db.collection('orders').insertOne(order);
    try {
      console.log('Creating Shiprocket order for:', order.orderNumber, 'phone:', order.shippingAddress?.contactPhone || order.customerPhone);
      const srRes = await createShiprocketOrder(order);
      console.log('Shiprocket response:', JSON.stringify(srRes));
      if (srRes.order_id) {
        await db.collection('orders').updateOne(
          { _id: result.insertedId },
          { $set: { 'trackingDetails.order_id': srRes.order_id, 'trackingDetails.shipment_id': srRes.shipment_id, 'trackingDetails.status': 'NEW' } }
        );
      }
    } catch (srErr) { console.error('Shiprocket error:', srErr.message, JSON.stringify(srErr)); }
    res.json({ success: true, orderId: result.insertedId, orderNumber });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('orders').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('orders').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/orders/by-order-number/:orderNumber', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('orders').updateOne({ orderNumber: req.params.orderNumber }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// USERS / CUSTOMERS
// ============================================
app.get('/api/users', async (req, res) => {
  try {
    const db = await getDB();
    const users = await db.collection('users').find({}, { projection: { password: 0, __v: 0 } }).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/stats', async (req, res) => {
  try {
    const db = await getDB();
    const total = await db.collection('users').countDocuments();
    const thisMonth = await db.collection('users').countDocuments({ createdAt: { $gte: new Date(new Date().setDate(1)) } });
    res.json({ total, thisMonth });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const db = await getDB();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) }, { projection: { password: 0 } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { password, ...safeBody } = req.body;
    await db.collection('users').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...safeBody, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// PRODUCTS
// ============================================
app.get('/api/products', async (req, res) => {
  try {
    const db = await getDB();
    const { status } = req.query;
    const query = status ? { status } : {};
    const products = await db.collection('products').find(query).toArray();
    res.json(products);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const db = await getDB();
    const product = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('products').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, productId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/products/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('products').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('products').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// CONSULTATIONS
// ============================================
app.get('/api/consultations', async (req, res) => {
  try {
    const db = await getDB();
    const { status, specialist } = req.query;
    const query = {};
    if (status) query.status = status;
    if (specialist) query.assignedSpecialist = specialist;
    const consultations = await db.collection('consultations').find(query).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(consultations);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/consultations/stats', async (req, res) => {
  try {
    const db = await getDB();
    const total = await db.collection('consultations').countDocuments();
    const pending = await db.collection('consultations').countDocuments({ status: { $in: ['pending', 'scheduled'] } });
    const done = await db.collection('consultations').countDocuments({ status: { $in: ['completed', 'done'] } });
    res.json({ total, pending, done });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/consultations/:id', async (req, res) => {
  try {
    const db = await getDB();
    const c = await db.collection('consultations').findOne({ _id: new ObjectId(req.params.id) });
    if (!c) return res.status(404).json({ error: 'Consultation not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/consultations', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('consultations').insertOne({ ...req.body, status: req.body.status || 'pending', createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, consultationId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/consultations/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('consultations').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/consultations/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('consultations').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// CONSULTATION SETTINGS
// ============================================
app.get('/api/consultationsettings', async (req, res) => {
  try {
    const db = await getDB();
    const settings = await db.collection('consultationsettings').findOne({});
    res.json(settings || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/consultationsettings', async (req, res) => {
  try {
    const db = await getDB();
    const existing = await db.collection('consultationsettings').findOne({});
    if (existing) {
      await db.collection('consultationsettings').updateOne({ _id: existing._id }, { $set: { ...req.body, updatedAt: new Date() } });
    } else {
      await db.collection('consultationsettings').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/consultationsettings', async (req, res) => {
  try {
    const db = await getDB();
    const existing = await db.collection('consultationsettings').findOne({});
    if (existing) {
      await db.collection('consultationsettings').updateOne({ _id: existing._id }, { $set: { ...req.body, updatedAt: new Date() } });
    } else {
      await db.collection('consultationsettings').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// SKIN PROFILES
// ============================================
app.get('/api/skinprofiles', async (req, res) => {
  try {
    const db = await getDB();
    const profiles = await db.collection('skinprofiles').find({}).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(profiles);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/skinprofiles/:id', async (req, res) => {
  try {
    const db = await getDB();
    const profile = await db.collection('skinprofiles').findOne({ _id: new ObjectId(req.params.id) });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/skinprofiles', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('skinprofiles').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, profileId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/skinprofiles/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('skinprofiles').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/skinprofiles/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('skinprofiles').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// SPECIALISTS
// ============================================
app.get('/api/specialists', async (req, res) => {
  try {
    const db = await getDB();
    const specialists = await db.collection('specialists').find({}).toArray();
    res.json(specialists);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/specialists/:id', async (req, res) => {
  try {
    const db = await getDB();
    const s = await db.collection('specialists').findOne({ _id: new ObjectId(req.params.id) });
    if (!s) return res.status(404).json({ error: 'Specialist not found' });
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/specialists', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('specialists').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, specialistId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/specialists/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('specialists').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/specialists/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('specialists').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// REVIEWS
// ============================================
app.get('/api/reviews', async (req, res) => {
  try {
    const db = await getDB();
    const { status } = req.query;
    const query = status ? { status } : {};
    const reviews = await db.collection('reviews').find(query).sort({ createdAt: -1 }).limit(100).toArray();
    res.json(reviews);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reviews/:id', async (req, res) => {
  try {
    const db = await getDB();
    const review = await db.collection('reviews').findOne({ _id: new ObjectId(req.params.id) });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('reviews').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, reviewId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/reviews/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('reviews').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('reviews').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// COUPONS
// ============================================
app.get('/api/coupons', async (req, res) => {
  try {
    const db = await getDB();
    const coupons = await db.collection('coupons').find({}).toArray();
    res.json(coupons);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/coupons/:id', async (req, res) => {
  try {
    const db = await getDB();
    const coupon = await db.collection('coupons').findOne({ _id: new ObjectId(req.params.id) });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json(coupon);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/coupons', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('coupons').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, couponId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/coupons/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('coupons').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('coupons').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// PAYOUTS
// ============================================
app.get('/api/payouts', async (req, res) => {
  try {
    const db = await getDB();
    const payouts = await db.collection('payouts').find({}).sort({ createdAt: -1 }).toArray();
    res.json(payouts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/payouts/:id', async (req, res) => {
  try {
    const db = await getDB();
    const payout = await db.collection('payouts').findOne({ _id: new ObjectId(req.params.id) });
    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    res.json(payout);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/payouts', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('payouts').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, payoutId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/payouts/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('payouts').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/payouts/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('payouts').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// SESSIONS
// ============================================
app.get('/api/sessions', async (req, res) => {
  try {
    const db = await getDB();
    const sessions = await db.collection('sessions').find({}).sort({ createdAt: -1 }).limit(100).toArray();
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sessions/recent', async (req, res) => {
  try {
    const db = await getDB();
    const sessions = await db.collection('sessions').find({}).sort({ createdAt: -1 }).limit(20).toArray();
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const db = await getDB();
    const session = await db.collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('sessions').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, sessionId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/sessions/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('sessions').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// RLFLX
// ============================================
app.get('/api/rlflx', async (req, res) => {
  try {
    const db = await getDB();
    const { status, limit = 100 } = req.query;
    const query = status ? { status } : {};
    const data = await db.collection('rlflx').find(query).sort({ createdAt: -1 }).limit(Number(limit)).toArray();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rlflx/:id', async (req, res) => {
  try {
    const db = await getDB();
    const item = await db.collection('rlflx').findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rlflx', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('rlflx').insertOne({ ...req.body, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, id: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/rlflx/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('rlflx').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rlflx/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('rlflx').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// PARTNER ORDERS
// ============================================
app.get('/api/partner/orders', async (req, res) => {
  try {
    const db = await getDB();
    const { partnerId } = req.query;
    const query = partnerId ? { partnerId } : {};
    const orders = await db.collection('orders').find(query).sort({ createdAt: -1 }).toArray();
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/partner/orders', async (req, res) => {
  try {
    const db = await getDB();
    const result = await db.collection('orders').insertOne({ ...req.body, source: 'sales_partner', createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, orderId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// ANALYTICS
// ============================================
app.get('/api/analytics', async (req, res) => {
  try {
    const db = await getDB();
    const [orderStats, userStats, consultStats, reviewCount, rlflxCount] = await Promise.all([
      db.collection('orders').aggregate([
        { $group: { _id: null, total: { $sum: 1 }, revenue: { $sum: '$pricing.total' }, avgOrder: { $avg: '$pricing.total' } } }
      ]).toArray(),
      db.collection('users').countDocuments(),
      db.collection('consultations').countDocuments(),
      db.collection('reviews').countDocuments(),
      db.collection('rlflx').countDocuments(),
    ]);
    const stats = orderStats[0] || { total: 0, revenue: 0, avgOrder: 0 };
    res.json({
      orders: { total: stats.total, revenue: Math.round(stats.revenue || 0), avgOrder: Math.round(stats.avgOrder || 0) },
      customers: userStats, consultations: consultStats, reviews: reviewCount, rlflx: rlflxCount,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/google-ads', (req, res) => res.json([]));

// ============================================
// CARTS
// ============================================
app.get('/api/carts', async (req, res) => {
  try {
    const db = await getDB();
    const carts = await db.collection('carts').find({}).sort({ updatedAt: -1 }).limit(200).toArray();
    res.json(carts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/carts', async (req, res) => {
  try {
    const db = await getDB();
    const { cartId, ...rest } = req.body;
    await db.collection('carts').updateOne(
      { cartId },
      { $set: { cartId, ...rest, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/carts/:cartId/convert', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('carts').updateOne({ cartId: req.params.cartId }, { $set: { ...req.body, updatedAt: new Date() } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// LIVE TRACKING
// ============================================
app.post('/api/live/ping', async (req, res) => {
  try {
    const db = await getDB();
    const { visitorId, page, action, phone, source } = req.body;
    await db.collection('live_visitors').updateOne(
      { visitorId },
      { $set: { visitorId, page, action, phone, source, lastSeen: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tracking/event', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('tracking_events').insertOne({ ...req.body, createdAt: new Date() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/live/visitors', async (req, res) => {
  try {
    const db = await getDB();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const visitors = await db.collection('live_visitors').find({ lastSeen: { $gte: fiveMinAgo } }).toArray();
    const byAction = {};
    visitors.forEach(v => { byAction[v.action] = (byAction[v.action] || 0) + 1; });
    res.json({ count: visitors.length, visitors, byAction });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tracking/stats', async (req, res) => {
  try {
    const db = await getDB();
    const today = new Date(); today.setHours(0,0,0,0);
    const [totalVisits, todayVisits, events] = await Promise.all([
      db.collection('live_visitors').countDocuments(),
      db.collection('live_visitors').countDocuments({ lastSeen: { $gte: today } }),
      db.collection('tracking_events').countDocuments({ createdAt: { $gte: today } }),
    ]);
    res.json({ totalVisits, todayVisits, events });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// CREATE SESSION (HQ se video call start)
// ============================================
app.post('/api/create-session', async (req, res) => {
  try {
    const db = await getDB();
    const { consultationId, specialistId } = req.body;
    if (!consultationId || !specialistId) return res.status(400).json({ error: 'consultationId and specialistId required' });
    const existing = await db.collection('sessions').findOne({ consultation: new ObjectId(consultationId) });
    if (existing) return res.json({ success: true, sessionUrl: existing.sessionUrl, session: existing });
    const consultation = await db.collection('consultations').findOne({ _id: new ObjectId(consultationId) });
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });
    await db.collection('consultations').updateOne(
      { _id: new ObjectId(consultationId) },
      { $set: { status: 'accepted', assignedSpecialist: new ObjectId(specialistId), acceptedAt: new Date(), updatedAt: new Date() } }
    );
    const crypto = require('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionUrl = 'https://rabtnaturals.com/video-session/' + consultation.user + '/' + sessionToken;
    const result = await db.collection('sessions').insertOne({
      consultation: new ObjectId(consultationId),
      user: consultation.user,
      specialist: new ObjectId(specialistId),
      sessionToken, sessionUrl,
      scheduledStartTime: new Date(consultation.scheduledDate),
      status: 'scheduled',
      sessionAmount: 0, specialistEarning: 0, platformFee: 0, paymentReceived: false,
      createdAt: new Date(), updatedAt: new Date(),
    });
    res.json({ success: true, sessionUrl, sessionId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// GA4 ANALYTICS ROUTES
// ============================================
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

function getGA4Client() {
  const creds = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (!creds) return null;
  try {
    return new BetaAnalyticsDataClient({ credentials: JSON.parse(creds) });
  } catch { return null; }
}

const GA_PROPERTY = process.env.GA_PROPERTY_ID;

async function runGA4Report(client, params) {
  const [res] = await client.runReport({ property: `properties/${GA_PROPERTY}`, ...params });
  return res;
}

// Overview — raw numbers for frontend fmt()
app.get('/api/ga/overview', async (req, res) => {
  const { startDate = '30daysAgo', endDate = 'today' } = req.query;
  const client = getGA4Client();
  if (!client || !GA_PROPERTY) return res.json({ sessions: 0, users: 0, bounceRate: 0, avgDuration: 0, pageviews: 0, newUsers: 0, note: 'GA4 not configured' });
  try {
    const report = await runGA4Report(client, {
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' }, { name: 'totalUsers' }, { name: 'bounceRate' },
        { name: 'averageSessionDuration' }, { name: 'screenPageViews' }, { name: 'newUsers' }
      ]
    });
    const row = report.rows?.[0]?.metricValues || [];
    const v = (i) => row[i]?.value || '0';
    res.json({
      sessions: parseInt(v(0)),
      users: parseInt(v(1)),
      bounceRate: parseFloat(v(2)),
      avgDuration: parseFloat(v(3)),
      pageviews: parseInt(v(4)),
      newUsers: parseInt(v(5)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Traffic sources
app.get('/api/ga/sources', async (req, res) => {
  const { startDate = '30daysAgo', endDate = 'today' } = req.query;
  const client = getGA4Client();
  if (!client || !GA_PROPERTY) return res.json([]);
  try {
    const report = await runGA4Report(client, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'sessionMedium' }, { name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10
    });
    const rows = report.rows?.map(r => ({
      source: r.dimensionValues[2].value,
      medium: r.dimensionValues[1].value,
      channel: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      users: parseInt(r.metricValues[1].value),
    })) || [];
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Top pages — raw avgDuration in seconds
app.get('/api/ga/pages', async (req, res) => {
  const { startDate = '30daysAgo', endDate = 'today' } = req.query;
  const client = getGA4Client();
  if (!client || !GA_PROPERTY) return res.json([]);
  try {
    const report = await runGA4Report(client, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'averageSessionDuration' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10
    });
    const rows = report.rows?.map(r => ({
      path: r.dimensionValues[0].value,
      title: r.dimensionValues[1].value,
      views: parseInt(r.metricValues[0].value),
      users: parseInt(r.metricValues[1].value),
      avgDuration: parseFloat(r.metricValues[2].value),
    })) || [];
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Top Indian states
app.get('/api/ga/states', async (req, res) => {
  const { startDate = '30daysAgo', endDate = 'today' } = req.query;
  const client = getGA4Client();
  if (!client || !GA_PROPERTY) return res.json([]);
  try {
    const report = await runGA4Report(client, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'region' }, { name: 'city' }],
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
      dimensionFilter: { filter: { fieldName: 'country', stringFilter: { value: 'India' } } },
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 15
    });
    const rows = report.rows?.map(r => ({
      state: r.dimensionValues[0].value,
      city: r.dimensionValues[1].value,
      users: parseInt(r.metricValues[0].value),
      sessions: parseInt(r.metricValues[1].value),
    })) || [];
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Daily traffic
app.get('/api/ga/daily', async (req, res) => {
  const { startDate = '30daysAgo', endDate = 'today' } = req.query;
  const client = getGA4Client();
  if (!client || !GA_PROPERTY) return res.json([]);
  try {
    const report = await runGA4Report(client, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    });
    const rows = report.rows?.map(r => ({
      date: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      users: parseInt(r.metricValues[1].value),
      pageviews: parseInt(r.metricValues[2].value),
    })) || [];
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Rabt API running on port ${PORT}`);
  console.log(`📦 Database: ${DB_NAME}`);
  console.log(`✅ All routes ready`);
});


