import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'urbanclap.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');
db.pragma('cache_size = -16000'); // 16MB cache in RAM
db.pragma('mmap_size = 30000000000'); // Memory-mapped I/O for ultra-fast reads

// Initialize database schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL DEFAULT 'password123',
      role TEXT NOT NULL, -- 'customer' | 'provider' | 'both' | 'admin'
      area TEXT NOT NULL,
      distance_km REAL NOT NULL,
      rating_avg REAL DEFAULT 4.0,
      total_reviews INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 50,
      provider_type TEXT DEFAULT 'freelancer', -- 'freelancer' | 'organization'
      avatar TEXT,
      mobile_number TEXT,
      exact_address TEXT,
      aadhar_number TEXT,
      org_name TEXT,
      gst_number TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_price REAL NOT NULL,
      emergency_price REAL NOT NULL,
      icon TEXT NOT NULL,
      default_image TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      service_type TEXT NOT NULL, -- 'ordinary' | 'emergency'
      base_price REAL NOT NULL,
      final_price REAL NOT NULL, -- includes +30% for emergency
      provider_preference TEXT NOT NULL, -- 'freelancer' | 'organization' | 'either'
      area TEXT NOT NULL,
      image_url TEXT NOT NULL,
      scheduled_date TEXT NOT NULL, -- YYYY-MM-DD
      status TEXT NOT NULL, -- 'pending_bidding' | 'bidding_active' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
      assigned_provider_id TEXT,
      assigned_provider_name TEXT,
      bidding_starts_at TEXT,
      bidding_ends_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      provider_rating REAL NOT NULL,
      provider_type TEXT NOT NULL,
      status TEXT NOT NULL, -- 'notified' | 'interested' | 'not_interested' | 'bid_submitted'
      bid_amount REAL,
      bid_note TEXT,
      submitted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      request_id TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      stars INTEGER NOT NULL, -- 1 to 5 compulsory
      feedback TEXT, -- optional
      coins_earned INTEGER NOT NULL, -- 25 minimum + rating bonus (1-5)
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_url TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Ensure missing columns are dynamically added for existing databases created with older schema
  const existingUserCols = (db.pragma('table_info(users)') as Array<{ name: string }>).map(c => c.name);
  if (!existingUserCols.includes('password')) {
    db.exec("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT 'password123'");
  }
  if (!existingUserCols.includes('avatar')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
  }
  if (!existingUserCols.includes('coins')) {
    db.exec("ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 50");
  }
  if (!existingUserCols.includes('provider_type')) {
    db.exec("ALTER TABLE users ADD COLUMN provider_type TEXT DEFAULT 'freelancer'");
  }
  if (!existingUserCols.includes('rating_avg')) {
    db.exec("ALTER TABLE users ADD COLUMN rating_avg REAL DEFAULT 4.0");
  }
  if (!existingUserCols.includes('total_reviews')) {
    db.exec("ALTER TABLE users ADD COLUMN total_reviews INTEGER DEFAULT 0");
  }
  if (!existingUserCols.includes('distance_km')) {
    db.exec("ALTER TABLE users ADD COLUMN distance_km REAL DEFAULT 0");
  }
  if (!existingUserCols.includes('mobile_number')) {
    db.exec("ALTER TABLE users ADD COLUMN mobile_number TEXT");
  }
  if (!existingUserCols.includes('exact_address')) {
    db.exec("ALTER TABLE users ADD COLUMN exact_address TEXT");
  }
  if (!existingUserCols.includes('aadhar_number')) {
    db.exec("ALTER TABLE users ADD COLUMN aadhar_number TEXT");
  }
  if (!existingUserCols.includes('org_name')) {
    db.exec("ALTER TABLE users ADD COLUMN org_name TEXT");
  }
  if (!existingUserCols.includes('gst_number')) {
    db.exec("ALTER TABLE users ADD COLUMN gst_number TEXT");
  }

  // Ensure demo accounts have designated roles
  db.exec(`
    UPDATE users SET role = 'customer' WHERE email IN ('priya@urbanclap.com', 'aarav@urbanclap.com') AND role != 'customer';
    UPDATE users SET role = 'provider' WHERE email IN ('vikram@craftsman.com', 'suresh@plumbing.com') AND role != 'provider';
    UPDATE users SET role = 'both' WHERE email IN ('rajesh@quickfix.com') AND role != 'both';
  `);

  // Seed default categories
  const categories = [
    {
      id: 'cat_plumbing',
      name: 'Plumbing & Water Systems',
      base_price: 500,
      emergency_price: 650, // +30%
      icon: 'Wrench',
      default_image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
      description: 'Leakage repairs, pipe installations, tap fixes & bathroom fittings'
    },
    {
      id: 'cat_electrical',
      name: 'Electrical & Wiring',
      base_price: 600,
      emergency_price: 780, // +30%
      icon: 'Zap',
      default_image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
      description: 'Short circuit emergency, socket replacement, fuse box & MCB setup'
    },
    {
      id: 'cat_cleaning',
      name: 'Deep Home Cleaning',
      base_price: 1200,
      emergency_price: 1560, // +30%
      icon: 'Sparkles',
      default_image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
      description: 'Kitchen deep sanitization, sofa shampooing, full apartment restoration'
    },
    {
      id: 'cat_appliance',
      name: 'Appliance Repair',
      base_price: 800,
      emergency_price: 1040, // +30%
      icon: 'Tv',
      default_image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      description: 'AC servicing, refrigerator cooling fix, washing machine diagnosis'
    },
    {
      id: 'cat_carpentry',
      name: 'Carpentry & Furniture',
      base_price: 550,
      emergency_price: 715, // +30%
      icon: 'Hammer',
      default_image: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=600&q=80',
      description: 'Door lock replacement, modular cabinet assembly & chair restoration'
    },
    {
      id: 'cat_painting',
      name: 'Wall Painting & Touchup',
      base_price: 1500,
      emergency_price: 1950, // +30%
      icon: 'Paintbrush',
      default_image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=600&q=80',
      description: 'Waterproof patch treatment, texture wall paint & interior coating'
    },
    {
      id: 'cat_ac_service',
      name: 'AC Servicing & Gas Refill',
      base_price: 900,
      emergency_price: 1170, // +30%
      icon: 'Wind',
      default_image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
      description: 'Filter cleaning, refrigerant top-up, compressor inspection & jet wash'
    },
    {
      id: 'cat_pest_control',
      name: 'Pest Control & Sanitization',
      base_price: 850,
      emergency_price: 1105, // +30%
      icon: 'ShieldAlert',
      default_image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      description: 'Termite protection, cockroach gel treatment, mosquito & rodent control'
    },
    {
      id: 'cat_cctv',
      name: 'CCTV & Smart Home Security',
      base_price: 1100,
      emergency_price: 1430, // +30%
      icon: 'Camera',
      default_image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=600&q=80',
      description: 'IP camera setup, DVR configuration, smart lock installation & wiring'
    },
    {
      id: 'cat_gardening',
      name: 'Gardening & Lawn Care',
      base_price: 450,
      emergency_price: 585, // +30%
      icon: 'Flower2',
      default_image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80',
      description: 'Lawn mowing, plant trimming, organic soil fertilizing & pot maintenance'
    },
    {
      id: 'cat_movers',
      name: 'Packers & Furniture Helpers',
      base_price: 1600,
      emergency_price: 2080, // +30%
      icon: 'Truck',
      default_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
      description: 'Heavy furniture shifting, bubble packing, loading & unloading support'
    },
    {
      id: 'cat_interior',
      name: 'Interior Design & Renovation',
      base_price: 2000,
      emergency_price: 2600, // +30%
      icon: 'Layout',
      default_image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
      description: '3D layout design, false ceiling setup, kitchen modeling & tile replacement'
    }
  ];

  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, base_price, emergency_price, icon, default_image, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of categories) {
    insertCat.run(c.id, c.name, c.base_price, c.emergency_price, c.icon, c.default_image, c.description);
  }

  // Seed default users if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const users = [
      // Dual Role (Both Customer & Service Provider) Demo Users
      {
        id: 'cust_1',
        name: 'Aarav Sharma',
        email: 'aarav@urbanclap.com',
        role: 'both',
        area: 'Downtown Metro',
        distance_km: 0,
        rating_avg: 5.0,
        total_reviews: 0,
        coins: 100,
        provider_type: 'either',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
      },
      {
        id: 'cust_2',
        name: 'Priya Verma',
        email: 'priya@urbanclap.com',
        role: 'customer',
        area: 'Westside Plaza',
        distance_km: 0,
        rating_avg: 5.0,
        total_reviews: 0,
        coins: 120,
        provider_type: 'either',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
      },

      // Service Providers
      {
        id: 'prov_1',
        name: 'Rajesh QuickFix Services',
        email: 'rajesh@quickfix.com',
        role: 'both',
        area: 'Downtown Metro', // 3.5 km away (within 13km limit)
        distance_km: 3.5,
        rating_avg: 4.8, // Eligible for emergency bidding (>= 3.5)
        total_reviews: 24,
        coins: 185, // Starts with earnings
        provider_type: 'organization',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
      },
      {
        id: 'prov_2',
        name: 'Vikram Singh (Master Electrician)',
        email: 'vikram@craftsman.com',
        role: 'provider',
        area: 'Westside Plaza', // 7.2 km away (within 13km limit)
        distance_km: 7.2,
        rating_avg: 4.5, // Eligible for emergency bidding (>= 3.5)
        total_reviews: 18,
        coins: 140,
        provider_type: 'freelancer',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80'
      },
      {
        id: 'prov_3',
        name: 'Suresh Pro Plumbers',
        email: 'suresh@plumbing.com',
        role: 'provider',
        area: 'North Hills', // 11.5 km away (within 13km limit)
        distance_km: 11.5,
        rating_avg: 4.2, // Eligible for emergency bidding (>= 3.5)
        total_reviews: 12,
        coins: 95,
        provider_type: 'organization',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80'
      },
      {
        id: 'prov_4',
        name: 'Rohan Newbie Handy',
        email: 'rohan@handy.com',
        role: 'provider',
        area: 'Downtown Metro',
        distance_km: 4.0,
        rating_avg: 3.1, // NOT eligible for emergency bidding (< 3.5 avg rating!)
        total_reviews: 5,
        coins: 30,
        provider_type: 'freelancer',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80'
      },
      {
        id: 'prov_5',
        name: 'Far City Solutions',
        email: 'farcity@services.com',
        role: 'provider',
        area: 'Outer Ring Suburb',
        distance_km: 22.0, // NOT eligible for emergency bidding (> 13 km radius!)
        rating_avg: 4.9,
        total_reviews: 40,
        coins: 310,
        provider_type: 'organization',
        avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80'
      },

      // Admin
      {
        id: 'admin_1',
        name: 'UrbanClap Ops Admin',
        email: 'admin@urbanclap.com',
        role: 'admin',
        area: 'Headquarters',
        distance_km: 0,
        rating_avg: 5.0,
        total_reviews: 0,
        coins: 9999,
        provider_type: 'either',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80'
      }
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password, role, area, distance_km, rating_avg, total_reviews, coins, provider_type, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const u of users) {
      insertUser.run(u.id, u.name, u.email, 'password123', u.role, u.area, u.distance_km, u.rating_avg, u.total_reviews, u.coins, u.provider_type, u.avatar);
    }
  }

  // Seed sample requests & bids if empty
  const reqCount = db.prepare('SELECT COUNT(*) as count FROM service_requests').get() as { count: number };
  if (reqCount.count === 0) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const inThreeDays = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

    // Request 1: Emergency Pipe Burst (Active Bidding)
    db.prepare(`
      INSERT INTO service_requests (
        id, customer_id, customer_name, customer_phone, category_id, category_name, title, description,
        service_type, base_price, final_price, provider_preference, area, image_url, scheduled_date,
        status, bidding_starts_at, created_at
      ) VALUES (
        'req_emerg_1', 'cust_1', 'Aarav Sharma', '+91 98765 43210', 'cat_plumbing', 'Plumbing & Water Systems',
        'EMERGENCY: Major Pipe Burst in Kitchen Cabinet', 'Water leaking rapidly under main sink. Need immediate shutoff and pipe replacement today!',
        'emergency', 500, 650, 'either', 'Downtown Metro',
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
        '${today}', 'bidding_active', '${new Date().toISOString()}', '${new Date().toISOString()}'
      )
    `).run();

    // Bids for Emergency Pipe Burst
    const insertBid = db.prepare(`
      INSERT INTO bids (id, request_id, provider_id, provider_name, provider_rating, provider_type, status, bid_amount, bid_note, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertBid.run('bid_1', 'req_emerg_1', 'prov_1', 'Rajesh QuickFix Services', 4.8, 'organization', 'bid_submitted', 680, 'Can reach in 30 mins with heavy duty replacement seals.', new Date().toISOString());
    insertBid.run('bid_2', 'req_emerg_1', 'prov_2', 'Vikram Singh (Master Electrician)', 4.5, 'freelancer', 'interested', null, null, new Date().toISOString());
    insertBid.run('bid_3', 'req_emerg_1', 'prov_3', 'Suresh Pro Plumbers', 4.2, 'organization', 'bid_submitted', 650, 'Standard emergency rate guaranteed.', new Date().toISOString());

    // Request 2: Ordinary AC Service (Assigned)
    db.prepare(`
      INSERT INTO service_requests (
        id, customer_id, customer_name, customer_phone, category_id, category_name, title, description,
        service_type, base_price, final_price, provider_preference, area, image_url, scheduled_date,
        status, assigned_provider_id, assigned_provider_name, created_at
      ) VALUES (
        'req_ord_1', 'cust_1', 'Aarav Sharma', '+91 98765 43210', 'cat_appliance', 'Appliance Repair',
        'Split AC Deep Cleaning & Filter Wash', 'Annual maintenance and cooling performance check for living room unit.',
        'ordinary', 800, 800, 'organization', 'Downtown Metro',
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
        '${inThreeDays}', 'assigned', 'prov_1', 'Rajesh QuickFix Services', '${new Date().toISOString()}'
      )
    `).run();

    // Request 3: Past Completed Service awaiting compulsory review
    db.prepare(`
      INSERT INTO service_requests (
        id, customer_id, customer_name, customer_phone, category_id, category_name, title, description,
        service_type, base_price, final_price, provider_preference, area, image_url, scheduled_date,
        status, assigned_provider_id, assigned_provider_name, created_at
      ) VALUES (
        'req_comp_1', 'cust_2', 'Priya Verma', '+91 99887 76655', 'cat_electrical', 'Electrical & Wiring',
        'Ceiling Fan & Light Fixture Fitting', 'Replaced 3 old fan regulators and installed LED panel lights.',
        'ordinary', 600, 600, 'freelancer', 'Westside Plaza',
        'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
        '${tomorrow}', 'completed', 'prov_2', 'Vikram Singh (Master Electrician)', '${new Date().toISOString()}'
      )
    `).run();

    // Sample Open Ordinary Service Requests available for browsing and booking
    db.prepare(`
      INSERT INTO service_requests (
        id, customer_id, customer_name, customer_phone, category_id, category_name, title, description,
        service_type, base_price, final_price, provider_preference, area, image_url, scheduled_date,
        status, created_at
      ) VALUES
      ('req_open_ord_1', 'cust_1', 'Aarav Sharma', '+91 98765 43210', 'cat_plumbing', 'Plumbing & Water Systems',
       'Bathroom Tap Leakage & Flush Tank Repair', 'Fix leaking shower head and replace worn out rubber seals in main bathroom tank.',
       'ordinary', 500, 500, 'either', 'Downtown Metro', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
       '${inThreeDays}', 'pending_bidding', '${new Date().toISOString()}'),

      ('req_open_ord_2', 'cust_2', 'Priya Verma', '+91 99887 76655', 'cat_electrical', 'Electrical & Wiring',
       'Short Circuit Check & MCB Switch Replacement', 'Need an electrician to inspect tripping main breaker and replace damaged 32A MCB.',
       'ordinary', 600, 600, 'freelancer', 'Westside Plaza', 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
       '${inThreeDays}', 'pending_bidding', '${new Date().toISOString()}'),

      ('req_open_ord_3', 'cust_1', 'Aarav Sharma', '+91 98765 43210', 'cat_cleaning', 'Deep Home Cleaning',
       'Full Apartment 2BHK Deep Sanitization', 'Kitchen grease cleaning, bathroom scrubbing and balcony washdown.',
       'ordinary', 1200, 1200, 'organization', 'Downtown Metro', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
       '${inThreeDays}', 'pending_bidding', '${new Date().toISOString()}'),

      ('req_open_ord_4', 'cust_2', 'Priya Verma', '+91 99887 76655', 'cat_carpentry', 'Carpentry & Furniture',
       'Modular Kitchen Door Hinge & Cabinet Alignment', 'Realign 4 loose cabinet doors and replace broken hydraulic soft-close hinges.',
       'ordinary', 550, 550, 'either', 'Westside Plaza', 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=600&q=80',
       '${inThreeDays}', 'pending_bidding', '${new Date().toISOString()}');
    `).run();

    // Sample Chat Messages for req_emerg_1
    const insertChat = db.prepare(`
      INSERT INTO chats (id, request_id, sender_id, sender_name, sender_role, message, attachment_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertChat.run('chat_1', 'req_emerg_1', 'cust_1', 'Aarav Sharma', 'customer', 'Hello! Water is coming out fast, turn off valve first?', null, new Date(Date.now() - 3600000).toISOString());
    insertChat.run('chat_2', 'req_emerg_1', 'prov_1', 'Rajesh QuickFix Services', 'provider', 'Yes Aarav! Turn the main copper valve clockwise right under the sink while we finalize the bid.', null, new Date(Date.now() - 1800000).toISOString());
  }
}

export default db;
