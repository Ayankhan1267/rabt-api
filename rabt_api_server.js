// ============================================
// Rabt Naturals — MongoDB API Proxy
// Updated: All CRUD routes added
// ============================================

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();

app.use(cors({ origin: ['https://admin.rabtnaturals.com', 'https://rabtnaturals.com', 'http://localhost:3000'], credentials: true }));
app.use(express.json());

// ✅ SECURE: Only from environment variable
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

// ── Health check ──
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

app.post('/api/orders', async (req, res) => {
  try {
    const db = await getDB();
    const order = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('orders').insertOne(order);
    res.json({ success: true, orderId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('orders').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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


// ============================================
// USERS / CUSTOMERS
// ============================================
app.get('/api/users', async (req, res) => {
  try {
    const db = await getDB();
    const users = await db.collection('users').find({}, {
      projection: { password: 0, __v: 0 }
    }).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/stats', async (req, res) => {
  try {
    const db = await getDB();
    const total = await db.collection('users').countDocuments();
    const thisMonth = await db.collection('users').countDocuments({
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    });
    res.json({ total, thisMonth });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const db = await getDB();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { password: 0 } }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { password, ...safeBody } = req.body;
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...safeBody, updatedAt: new Date() } }
    );
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
// PRODUCTS / INVENTORY
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
    const product = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('products').insertOne(product);
    res.json({ success: true, productId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/products/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('products').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
    const c = { ...req.body, status: req.body.status || 'pending', createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('consultations').insertOne(c);
    res.json({ success: true, consultationId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/consultations/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('consultations').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
      await db.collection('consultationsettings').updateOne(
        { _id: existing._id },
        { $set: { ...req.body, updatedAt: new Date() } }
      );
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
      await db.collection('consultationsettings').updateOne(
        { _id: existing._id },
        { $set: { ...req.body, updatedAt: new Date() } }
      );
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
    const profile = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('skinprofiles').insertOne(profile);
    res.json({ success: true, profileId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/skinprofiles/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('skinprofiles').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
    const s = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('specialists').insertOne(s);
    res.json({ success: true, specialistId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/specialists/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('specialists').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
    const review = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('reviews').insertOne(review);
    res.json({ success: true, reviewId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/reviews/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('reviews').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
    const coupon = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('coupons').insertOne(coupon);
    res.json({ success: true, couponId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/coupons/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('coupons').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
    const payout = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('payouts').insertOne(payout);
    res.json({ success: true, payoutId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/payouts/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('payouts').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
    const session = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('sessions').insertOne(session);
    res.json({ success: true, sessionId: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/sessions/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
    const item = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('rlflx').insertOne(item);
    res.json({ success: true, id: result.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/rlflx/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('rlflx').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
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
    const order = { ...req.body, source: 'sales_partner', createdAt: new Date(), updatedAt: new Date() };
    const result = await db.collection('orders').insertOne(order);
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
      customers: userStats,
      consultations: consultStats,
      reviews: reviewCount,
      rlflx: rlflxCount,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/google-ads', (req, res) => res.json([]));


// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Rabt API running on port ${PORT}`);
  console.log(`📦 Database: ${DB_NAME}`);
  console.log(`✅ All routes ready`);
});
