// ============================================
// Rabt Naturals — MongoDB API Proxy
// Deploy on Render.com (Free)
// ============================================
// 1. Create new repo on GitHub with these 3 files
// 2. Deploy on render.com as Web Service
// 3. Set environment variable: MONGO_URI
// ============================================

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();

app.use(cors({ origin: ['https://admin.rabtnaturals.com', 'http://localhost:3000'], credentials: true }));
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://rabtnaturals:Wd1cex7xub@cluster0.toblnpp.mongodb.net/rabt?retryWrites=true&w=majority';
const DB_NAME = 'rabt';

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
  res.json({ status: 'Rabt API Live ✅', db: DB_NAME });
});

// ── ORDERS ──
app.get('/api/orders', async (req, res) => {
  try {
    const db = await getDB();
    const orders = await db.collection('orders').find({}).sort({ createdAt: -1 }).limit(100).toArray();
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/orders/stats', async (req, res) => {
  try {
    const db = await getDB();
    const orders = await db.collection('orders').find({}).toArray();
    const total = orders.length;
    const revenue = orders.filter(o => o.status === 'delivered' || o.status === 'Delivered')
      .reduce((sum, o) => sum + (o.totalAmount || o.amount || 0), 0);
    const byStatus = {};
    orders.forEach(o => {
      const s = o.status || 'unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    res.json({ total, revenue, byStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const db = await getDB();
    await db.collection('orders').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── USERS / CUSTOMERS ──
app.get('/api/users', async (req, res) => {
  try {
    const db = await getDB();
    const users = await db.collection('users').find({}, {
      projection: { password: 0, __v: 0 }
    }).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/stats', async (req, res) => {
  try {
    const db = await getDB();
    const total = await db.collection('users').countDocuments();
    const thisMonth = await db.collection('users').countDocuments({
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    });
    res.json({ total, thisMonth });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PRODUCTS / INVENTORY ──
app.get('/api/products', async (req, res) => {
  try {
    const db = await getDB();
    const products = await db.collection('products').find({}).toArray();
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CONSULTATIONS ──
app.get('/api/consultations', async (req, res) => {
  try {
    const db = await getDB();
    const consultations = await db.collection('consultations').find({}).sort({ createdAt: -1 }).limit(100).toArray();
    res.json(consultations);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/consultations/stats', async (req, res) => {
  try {
    const db = await getDB();
    const total = await db.collection('consultations').countDocuments();
    const pending = await db.collection('consultations').countDocuments({ status: { $in: ['pending', 'scheduled'] } });
    const done = await db.collection('consultations').countDocuments({ status: { $in: ['completed', 'done'] } });
    res.json({ total, pending, done });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SKIN PROFILES ──
app.get('/api/skinprofiles', async (req, res) => {
  try {
    const db = await getDB();
    const profiles = await db.collection('skinprofiles').find({}).sort({ createdAt: -1 }).limit(100).toArray();
    res.json(profiles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── REVIEWS ──
app.get('/api/reviews', async (req, res) => {
  try {
    const db = await getDB();
    const reviews = await db.collection('reviews').find({}).sort({ createdAt: -1 }).limit(50).toArray();
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ANALYTICS SUMMARY ──
app.get('/api/analytics', async (req, res) => {
  try {
    const db = await getDB();
    const [orderStats, userStats, consultStats, reviewCount] = await Promise.all([
      db.collection('orders').aggregate([
        { $group: {
          _id: null,
          total: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          avgOrder: { $avg: '$totalAmount' }
        }}
      ]).toArray(),
      db.collection('users').countDocuments(),
      db.collection('consultations').countDocuments(),
      db.collection('reviews').countDocuments()
    ]);

    const stats = orderStats[0] || { total: 0, revenue: 0, avgOrder: 0 };

    res.json({
      orders: { total: stats.total, revenue: Math.round(stats.revenue || 0), avgOrder: Math.round(stats.avgOrder || 0) },
      customers: userStats,
      consultations: consultStats,
      reviews: reviewCount
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SESSIONS / RECENT ACTIVITY ──
app.get('/api/sessions/recent', async (req, res) => {
  try {
    const db = await getDB();
    const sessions = await db.collection('sessions').find({}).sort({ createdAt: -1 }).limit(20).toArray();
    res.json(sessions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Rabt API running on port ${PORT}`));
