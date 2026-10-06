import express from 'express';
import cors from 'cors';
import db, { initDb } from './db.js';

initDb();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// 1. Categories Endpoint
app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json(categories);
});

// 2. Users Endpoint
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

// Auth 1: Login Endpoint
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) {
      return res.status(401).json({ error: 'User account not found. Please sign up or choose a quick demo profile.' });
    }

    if (password && user.password && user.password !== password) {
      return res.status(401).json({ error: 'Invalid password. (Default demo password is password123)' });
    }

    res.json({ message: 'Login successful', user });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed due to a server error.' });
  }
});

// Auth 2: Signup Endpoint
app.post('/api/signup', (req, res) => {
  try {
    const { name, email, password, role, area, provider_type, mobile_number, exact_address, aadhar_number, org_name, gst_number } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and user role are required.' });
    }

    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please login.' });
    }

    const id = `${role === 'provider' ? 'prov' : (role === 'admin' ? 'admin' : (role === 'both' ? 'dual' : 'cust'))}_${Date.now()}`;
    const userRole = role || 'customer';
    const userArea = area || 'Downtown Metro';
    const distanceKm = (userRole === 'customer') ? 0 : Math.round((Math.random() * 8 + 2) * 10) / 10;
    const ratingAvg = (userRole === 'customer') ? 5.0 : 4.8;
    const initialCoins = 100;
    const avatarUrl = (userRole === 'customer')
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80';

    db.prepare(`
      INSERT INTO users (id, name, email, password, role, area, distance_km, rating_avg, total_reviews, coins, provider_type, avatar, mobile_number, exact_address, aadhar_number, org_name, gst_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, email, password || 'password123', userRole, userArea,
      distanceKm, ratingAvg, 0, initialCoins, provider_type || 'freelancer', avatarUrl,
      mobile_number || null, exact_address || null, aadhar_number || null, org_name || null, gst_number || null
    );

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({ message: 'Account created successfully!', user: newUser });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'Could not create account.' });
  }
});

// 3. Service Requests Endpoint
app.get('/api/requests', (req, res) => {
  const { customerId, providerId, role } = req.query;

  let query = 'SELECT * FROM service_requests';
  const params: any[] = [];

  if (role === 'customer' && customerId) {
    query += ' WHERE customer_id = ?';
    params.push(customerId);
  } else if (role === 'provider' && providerId) {
    query += " WHERE assigned_provider_id = ? OR id IN (SELECT request_id FROM bids WHERE provider_id = ?) OR (service_type = 'ordinary' AND status IN ('pending_bidding', 'pending'))";
    params.push(providerId, providerId);
  }

  query += ' ORDER BY created_at DESC';
  const requests = db.prepare(query).all(...params) as any[];

  // Attach bids and reviews to each request
  const requestsWithDetails = requests.map(reqItem => {
    const bids = db.prepare('SELECT * FROM bids WHERE request_id = ? ORDER BY submitted_at ASC').all(reqItem.id);
    const review = db.prepare('SELECT * FROM reviews WHERE request_id = ?').get(reqItem.id);
    const chatCount = (db.prepare('SELECT COUNT(*) as count FROM chats WHERE request_id = ?').get(reqItem.id) as any).count;

    return {
      ...reqItem,
      bids,
      review,
      chatCount
    };
  });

  res.json(requestsWithDetails);
});

// Single Request Detail
app.get('/api/requests/:id', (req, res) => {
  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(req.params.id) as any;
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const bids = db.prepare('SELECT * FROM bids WHERE request_id = ? ORDER BY submitted_at ASC').all(request.id);
  const review = db.prepare('SELECT * FROM reviews WHERE request_id = ?').get(request.id);

  res.json({ ...request, bids, review });
});

// 4. Create Service Request
app.post('/api/requests', (req, res) => {
  const {
    customer_id,
    customer_name,
    customer_phone,
    category_id,
    title,
    description,
    service_type, // 'ordinary' | 'emergency'
    provider_preference, // 'freelancer' | 'organization' | 'either'
    area,
    image_url,
    custom_date
  } = req.body;

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(category_id) as any;
  if (!category) return res.status(400).json({ error: 'Invalid category' });

  const id = `req_${Date.now()}`;
  const base_price = category.base_price;

  // Minimum required price (Emergency service is 30% higher than ordinary minimum)
  const min_price = service_type === 'emergency'
    ? Math.round(base_price * 1.30)
    : base_price;

  // Customer can adjust price above minimum price, but NOT below it
  const reqOfferedPrice = req.body.offered_price ? Number(req.body.offered_price) : 0;
  const final_price = reqOfferedPrice >= min_price ? reqOfferedPrice : min_price;

  // Rule: Ordinary service provided in 2 to 3 days, Emergency same day or next day
  const today = new Date();
  let scheduled_date = custom_date;
  if (!scheduled_date) {
    if (service_type === 'emergency') {
      scheduled_date = today.toISOString().split('T')[0];
    } else {
      const inTwoDays = new Date(today.getTime() + (2 * 24 * 60 * 60 * 1000));
      scheduled_date = inTwoDays.toISOString().split('T')[0];
    }
  }

  const finalImageUrl = image_url && image_url.trim() !== '' ? image_url : category.default_image;
  const status = service_type === 'emergency' ? 'bidding_active' : 'pending_bidding';
  const bidding_starts_at = new Date().toISOString();
  const created_at = new Date().toISOString();

  db.prepare(`
    INSERT INTO service_requests (
      id, customer_id, customer_name, customer_phone, category_id, category_name, title, description,
      service_type, base_price, final_price, provider_preference, area, image_url, scheduled_date,
      status, bidding_starts_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, customer_id, customer_name || 'Customer', customer_phone || '+91 99000 00000',
    category_id, category.name, title, description,
    service_type, base_price, final_price, provider_preference, area,
    finalImageUrl, scheduled_date, status, bidding_starts_at, created_at
  );

  // If Emergency, notify eligible providers within 13km, avg rating >= 3.5, min 35 coins, and NO schedule clash!
  if (service_type === 'emergency') {
    const providers = db.prepare(`
      SELECT * FROM users
      WHERE role = 'provider'
        AND distance_km <= 13.0
        AND rating_avg >= 3.5
        AND coins >= 35
    `).all() as any[];

    const insertBid = db.prepare(`
      INSERT INTO bids (id, request_id, provider_id, provider_name, provider_rating, provider_type, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    providers.forEach(p => {
      // Check for date schedule clash: check if provider has an assigned request on scheduled_date
      const clashes = db.prepare(`
        SELECT COUNT(*) as count FROM service_requests
        WHERE assigned_provider_id = ? AND scheduled_date = ? AND status IN ('assigned', 'in_progress')
      `).get(p.id, scheduled_date) as any;

      if (clashes.count === 0) {
        // Provider is eligible and has NO date clash!
        insertBid.run(
          `bid_${Date.now()}_${p.id}`,
          id, p.id, p.name, p.rating_avg, p.provider_type || 'freelancer',
          'notified', new Date().toISOString()
        );
      }
    });
  }

  const created = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id);
  res.json(created);
});

// 5. Provider Respond / Submit Bid
app.post('/api/requests/:id/bid', (req, res) => {
  const { provider_id, response, bid_amount, bid_note } = req.body;
  const requestId = req.params.id;

  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId) as any;
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const provider = db.prepare('SELECT * FROM users WHERE id = ?').get(provider_id) as any;
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  // Rule: Provider eligibility check (>= 35 coins, >= 3.5 stars, distance <= 13km, no date clash)
  if (provider.coins < 35) {
    return res.status(400).json({ error: `Minimum 35 coins required to enter bidding. You currently have ${provider.coins} coins. Complete ordinary jobs to earn coins!` });
  }

  if (provider.rating_avg < 3.5) {
    return res.status(400).json({ error: 'Minimum average 3.5 stars required to join emergency bidding.' });
  }

  if (provider.distance_km > 13) {
    return res.status(400).json({ error: 'Bidding is restricted to providers within 13 km radius.' });
  }

  const clash = db.prepare(`
    SELECT COUNT(*) as count FROM service_requests
    WHERE assigned_provider_id = ? AND scheduled_date = ? AND status IN ('assigned', 'in_progress')
  `).get(provider_id, request.scheduled_date) as any;

  if (clash.count > 0) {
    return res.status(400).json({ error: 'You already have a service scheduled on this date!' });
  }

  // Check current interested / bidding count (Max 10 people within 45 mins)
  const currentBiddersCount = (db.prepare(`
    SELECT COUNT(*) as count FROM bids
    WHERE request_id = ? AND status IN ('interested', 'bid_submitted')
  `).get(requestId) as any).count;

  if (currentBiddersCount >= 10) {
    return res.status(400).json({ error: 'Bidding limit reached. Maximum 10 service providers allowed.' });
  }

  // Find or create bid row
  let existingBid = db.prepare('SELECT * FROM bids WHERE request_id = ? AND provider_id = ?').get(requestId, provider_id) as any;

  const newStatus = response === 'not_interested' ? 'not_interested' : (bid_amount ? 'bid_submitted' : 'interested');

  if (existingBid) {
    db.prepare(`
      UPDATE bids
      SET status = ?, bid_amount = ?, bid_note = ?, submitted_at = ?
      WHERE id = ?
    `).run(newStatus, bid_amount || existingBid.bid_amount, bid_note || existingBid.bid_note, newStatus, existingBid.id);
  } else {
    db.prepare(`
      INSERT INTO bids (id, request_id, provider_id, provider_name, provider_rating, provider_type, status, bid_amount, bid_note, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `bid_${Date.now()}_${provider_id}`,
      requestId, provider_id, provider.name, provider.rating_avg, provider.provider_type || 'freelancer',
      newStatus, bid_amount || null, bid_note || null, new Date().toISOString()
    );
  }

  // If ordinary service or provider directly accepts minimum price
  if (request.service_type === 'ordinary' && response === 'interested') {
    db.prepare(`
      UPDATE service_requests
      SET status = 'assigned', assigned_provider_id = ?, assigned_provider_name = ?
      WHERE id = ?
    `).run(provider_id, provider.name, requestId);
  }

  res.json({ message: 'Bid updated successfully' });
});

// 6. Customer Accepts Bid
app.post('/api/requests/:id/accept-bid', (req, res) => {
  const { provider_id, accepted_price } = req.body;
  const requestId = req.params.id;

  const provider = db.prepare('SELECT * FROM users WHERE id = ?').get(provider_id) as any;
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  db.prepare(`
    UPDATE service_requests
    SET status = 'assigned', assigned_provider_id = ?, assigned_provider_name = ?, final_price = ?
    WHERE id = ?
  `).run(provider_id, provider.name, accepted_price || undefined, requestId);

  res.json({ message: 'Provider accepted successfully!' });
});

// 6b. Book / Accept Available Ordinary Work Order
app.post('/api/requests/:id/book-ordinary', (req, res) => {
  try {
    const { provider_id } = req.body;
    const requestId = req.params.id;

    const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId) as any;
    if (!request) return res.status(404).json({ error: 'Work order request not found.' });

    if (request.status === 'assigned' || request.status === 'completed') {
      return res.status(400).json({ error: 'This work order has already been booked by another service provider.' });
    }

    const provider = db.prepare('SELECT * FROM users WHERE id = ?').get(provider_id) as any;
    if (!provider) return res.status(404).json({ error: 'Service provider account not found.' });

    // Schedule clash check: Check if provider has an assigned request on request.scheduled_date
    const clash = db.prepare(`
      SELECT COUNT(*) as count FROM service_requests
      WHERE assigned_provider_id = ? AND scheduled_date = ? AND status IN ('assigned', 'in_progress')
    `).get(provider_id, request.scheduled_date) as any;

    if (clash.count > 0) {
      return res.status(400).json({ error: `Schedule Clash: You already have a booked service scheduled on ${request.scheduled_date}!` });
    }

    // Assign work order to provider
    db.prepare(`
      UPDATE service_requests
      SET status = 'assigned', assigned_provider_id = ?, assigned_provider_name = ?
      WHERE id = ?
    `).run(provider_id, provider.name, requestId);

    const updated = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(requestId);
    res.json({ message: 'Ordinary work order successfully booked! Added to your Active Work Orders.', request: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to book work order.' });
  }
});

// 7. Complete Work Order
app.post('/api/requests/:id/complete', (req, res) => {
  const requestId = req.params.id;
  db.prepare(`
    UPDATE service_requests
    SET status = 'completed'
    WHERE id = ?
  `).run(requestId);

  res.json({ message: 'Service completed! Compulsory customer review pending.' });
});

// 8. Submit Compulsory Customer Review & Award Provider Coins
app.post('/api/reviews', (req, res) => {
  const { request_id, stars, feedback } = req.body;

  // Validation: compulsory 1-5 star rating
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Compulsory star rating from 1 to 5 is required.' });
  }

  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(request_id) as any;
  if (!request) return res.status(404).json({ error: 'Service request not found.' });

  const existingReview = db.prepare('SELECT * FROM reviews WHERE request_id = ?').get(request_id);
  if (existingReview) return res.status(400).json({ error: 'Review already submitted for this service.' });

  const providerId = request.assigned_provider_id;
  if (!providerId) return res.status(400).json({ error: 'No provider assigned to this service request.' });

  // Rule: Provider gets minimum 25 coins for service + 5 bonus stars bonus (5 star = +5, 4 star = +4, etc.)
  const bonusCoins = Number(stars); // 5 star = 5 coins, 4 star = 4 coins, etc.
  const totalCoinsEarned = 25 + bonusCoins;

  const reviewId = `rev_${Date.now()}`;
  db.prepare(`
    INSERT INTO reviews (id, request_id, customer_id, customer_name, provider_id, stars, feedback, coins_earned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reviewId, request_id, request.customer_id, request.customer_name,
    providerId, stars, feedback || '', totalCoinsEarned, new Date().toISOString()
  );

  // Update provider coins and rating average
  const providerReviews = db.prepare('SELECT stars FROM reviews WHERE provider_id = ?').all(providerId) as any[];
  const totalRatingSum = providerReviews.reduce((sum, r) => sum + r.stars, 0);
  const newRatingAvg = Math.round((totalRatingSum / providerReviews.length) * 10) / 10;

  db.prepare(`
    UPDATE users
    SET coins = coins + ?,
        rating_avg = ?,
        total_reviews = total_reviews + 1
    WHERE id = ?
  `).run(totalCoinsEarned, newRatingAvg, providerId);

  res.json({
    message: 'Review submitted successfully!',
    coinsEarned: totalCoinsEarned,
    newRatingAvg
  });
});

// 9. Chat Endpoints
app.get('/api/chats/:requestId', (req, res) => {
  const messages = db.prepare('SELECT * FROM chats WHERE request_id = ? ORDER BY created_at ASC').all(req.params.requestId);
  res.json(messages);
});

app.post('/api/chats', (req, res) => {
  const { request_id, sender_id, sender_name, sender_role, message, attachment_url } = req.body;

  const id = `chat_${Date.now()}`;
  const created_at = new Date().toISOString();

  db.prepare(`
    INSERT INTO chats (id, request_id, sender_id, sender_name, sender_role, message, attachment_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, request_id, sender_id, sender_name, sender_role, message, attachment_url || null, created_at);

  const newMessage = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  res.json(newMessage);
});

// 10. Admin Manual Trigger for Bidding
app.post('/api/admin/trigger-bidding/:requestId', (req, res) => {
  const requestId = req.params.requestId;

  db.prepare(`
    UPDATE service_requests
    SET status = 'bidding_active', bidding_starts_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), requestId);

  res.json({ message: 'Emergency bidding started manually by admin!' });
});

// Global Error Handler to guarantee JSON responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`UrbanClap Backend REST API Server running on http://localhost:${PORT}`);
});
