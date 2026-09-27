/**
 * Demo data seed. Wipes the development database and loads a realistic marketplace:
 * 1 admin, 3 approved vendors, 1 pending vendor, 5 customers, 45 products, ~30 past
 * orders in every lifecycle state, reviews, refunds and payouts.
 *
 * Run with `npm run seed`. Deterministic: the same data is produced on every run.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient, type SubOrderStatus } from '@prisma/client';
import 'dotenv/config';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const prisma = new PrismaClient();
const PASSWORD = 'Password123';
const COMMISSION_BPS = 1000;
const DAY = 86_400_000;
const NOW = Date.now();

// Deterministic PRNG (mulberry32) so every seed run produces identical data.
let seed = 20260927;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ago = (days: number, hours = 0) => new Date(NOW - days * DAY - hours * 3_600_000);

const CATEGORIES = ['Home & Kitchen', 'Fashion', 'Electronics', 'Books', 'Beauty & Wellness', 'Sports & Outdoors', 'Handicrafts', 'Grocery & Gourmet'];

type P = [title: string, category: string, rupees: number, stock: number, description: string];

const VENDORS: { email: string; name: string; store: string; description: string; products: P[] }[] = [
  {
    email: 'vendor@demo.com',
    name: 'Arjun Mehta',
    store: 'Lumen & Loom',
    description: 'Handcrafted home décor and textiles from artisan clusters across Rajasthan and Gujarat. Every piece is made in small batches.',
    products: [
      ['Brass Diya Table Lamp', 'Home & Kitchen', 2499, 18, 'Hand-cast brass lamp with a warm, flickering glow. Perfect for festive evenings and reading corners.'],
      ['Block-Printed Cotton Bedsheet (Queen)', 'Home & Kitchen', 1899, 25, 'Sanganeri hand block print on 100% cotton, 200 TC, with two pillow covers. Natural dyes.'],
      ['Terracotta Planter Set of 3', 'Home & Kitchen', 899, 40, 'Breathable, hand-thrown terracotta pots in three sizes, with drainage holes and saucers.'],
      ['Copper Water Bottle 1L', 'Home & Kitchen', 1199, 3, 'Pure copper, leak-proof lid, with a hammered finish. Store water overnight for an Ayurvedic boost.'],
      ['Handwoven Jute Rug 4×6 ft', 'Home & Kitchen', 3299, 9, 'Braided natural jute rug, reversible and hard-wearing. Adds texture to any living room.'],
      ['Kantha Stitch Throw Blanket', 'Handicrafts', 2199, 14, 'Layered vintage-cotton throw, hand-quilted by women artisans in West Bengal with traditional kantha running stitch.'],
      ['Madhubani Painting on Handmade Paper', 'Handicrafts', 3499, 6, 'Original Madhubani artwork depicting the tree of life, painted with natural pigments. A4, unframed.'],
      ['Blue Pottery Coaster Set', 'Handicrafts', 749, 30, 'Six Jaipur blue-pottery coasters with cork backing. Each floral motif is hand-painted.'],
      ['Sheesham Wood Serving Tray', 'Handicrafts', 1599, 12, 'Solid sheesham wood tray with brass handles. Food-safe finish; hand wash only.'],
      ['Ajrakh Print Cotton Kurta', 'Fashion', 1499, 22, 'Straight-cut kurta in hand-block Ajrakh print, natural indigo and madder dyes. Breathable summer cotton.'],
      ['Handloom Silk Stole', 'Fashion', 1899, 15, 'Lightweight mulberry silk stole woven on a pit loom in Varanasi, with a subtle zari border.'],
      ['Embroidered Jutti Flats', 'Fashion', 1299, 2, 'Handcrafted leather juttis with phulkari-inspired embroidery and a cushioned insole.'],
      ['Indigo Dabu Print Saree', 'Fashion', 3899, 7, 'Mud-resist dabu hand-block print on soft mulmul cotton. Includes an unstitched blouse piece.'],
      ['Macramé Wall Hanging', 'Handicrafts', 1099, 0, 'Knotted by hand from recycled cotton cord on a driftwood rod. 60 cm wide.'],
      ['Marble Mortar and Pestle', 'Home & Kitchen', 999, 20, 'Solid white marble, polished outside and textured inside for grinding spices and herbs.'],
    ],
  },
  {
    email: 'vendor2@demo.com',
    name: 'Neha Kapoor',
    store: 'Circuit Bazaar',
    description: 'Hand-picked electronics and fitness gear with honest specs, a 1-year warranty and fast dispatch from Bengaluru.',
    products: [
      ['Wireless Earbuds with ANC', 'Electronics', 4999, 35, 'Active noise cancellation, 30-hour battery with case, IPX4 sweat resistance and low-latency gaming mode.'],
      ['Mechanical Keyboard (Hot-swap, TKL)', 'Electronics', 5499, 11, 'Tenkeyless layout, hot-swappable brown switches, PBT keycaps and per-key white backlight. USB-C.'],
      ['20,000 mAh Power Bank 22.5W', 'Electronics', 1799, 50, 'Fast-charges two devices at once, with USB-C PD input/output and a digital battery display.'],
      ['Smart LED Bulb (Pack of 2)', 'Electronics', 1099, 60, '9W Wi-Fi bulbs with 16 million colours, schedules, and voice assistant support. No hub needed.'],
      ['Portable Bluetooth Speaker', 'Electronics', 2799, 16, '360° sound, 12-hour playtime, IPX7 waterproof, with a built-in lanyard for treks.'],
      ['1080p Webcam with Dual Mics', 'Electronics', 2299, 4, 'Full-HD webcam with auto light correction, privacy shutter and noise-reducing stereo mics.'],
      ['Fitness Smartwatch', 'Electronics', 3999, 20, 'AMOLED display, SpO2 and heart-rate tracking, 100+ sport modes and 10-day battery life.'],
      ['Yoga Mat 6mm (Anti-slip)', 'Sports & Outdoors', 1299, 45, 'TPE mat with alignment lines, dual-layer grip and a carry strap. Free of PVC and latex.'],
      ['Adjustable Dumbbells 2×10 kg', 'Sports & Outdoors', 4499, 8, 'Spin-lock dumbbell set with chrome handles and cast-iron plates in a storage case.'],
      ['Badminton Racquet Pair', 'Sports & Outdoors', 1699, 25, 'Lightweight aluminium-carbon frames, pre-strung, with a full cover and 3 feather shuttles.'],
      ['Insulated Steel Bottle 750ml', 'Sports & Outdoors', 899, 70, 'Double-walled vacuum insulation keeps drinks cold 24 h or hot 12 h. Leak-proof sports cap.'],
      ['Trekking Backpack 45L', 'Sports & Outdoors', 3499, 10, 'Ventilated back panel, rain cover, hip-belt pockets and hydration sleeve for weekend treks.'],
      ['USB-C Hub 7-in-1', 'Electronics', 2499, 28, 'HDMI 4K@30Hz, 100W PD pass-through, SD/microSD, 2× USB-A and gigabit Ethernet.'],
      ['Resistance Bands Set', 'Sports & Outdoors', 799, 5, 'Five latex bands from 5–30 kg with handles, ankle straps and a door anchor.'],
      ['Noise-cancelling Headphones', 'Electronics', 8999, 6, 'Over-ear hybrid ANC with 40-hour battery, multipoint Bluetooth and a foldable design.'],
    ],
  },
  {
    email: 'vendor3@demo.com',
    name: 'Farhan Ali',
    store: 'Chai & Chapters',
    description: 'Books, single-estate teas and small-batch wellness products — everything you need for a slow Sunday.',
    products: [
      ['Darjeeling First Flush Tea 100g', 'Grocery & Gourmet', 649, 40, 'Muscatel-noted spring harvest from a single estate. Whole leaf, vacuum-sealed for freshness.'],
      ['Masala Chai Blend 250g', 'Grocery & Gourmet', 399, 80, 'Assam CTC with hand-pounded cardamom, ginger, cinnamon and clove. Brews strong with milk.'],
      ['Kashmiri Saffron 1g', 'Grocery & Gourmet', 549, 25, 'Grade-A Mongra saffron threads from Pampore, with a lab purity certificate.'],
      ['Cold-pressed Coconut Oil 500ml', 'Grocery & Gourmet', 449, 3, 'Wood-pressed (kachi ghani) virgin coconut oil for cooking, hair and skin.'],
      ['Wildflower Honey 500g', 'Grocery & Gourmet', 499, 35, 'Raw, unfiltered honey collected from forest hives in the Nilgiris.'],
      ['The Midnight Library (Paperback)', 'Books', 399, 20, 'Matt Haig’s bestselling novel about the infinite lives we might have lived.'],
      ['Atomic Habits (Paperback)', 'Books', 499, 30, 'James Clear’s practical guide to building good habits and breaking bad ones.'],
      ['A Suitable Boy (Hardcover)', 'Books', 1299, 5, 'Vikram Seth’s sweeping classic set in newly independent India. Collector’s hardcover.'],
      ['The God of Small Things (Paperback)', 'Books', 350, 18, 'Arundhati Roy’s Booker Prize–winning debut novel set in Kerala.'],
      ['Sapiens: A Brief History (Paperback)', 'Books', 549, 24, 'Yuval Noah Harari explores how Homo sapiens came to dominate the planet.'],
      ['Kumkumadi Face Oil 30ml', 'Beauty & Wellness', 899, 22, 'Ayurvedic saffron-based facial oil for radiance, with 16 herbs in a sesame base.'],
      ['Neem & Tulsi Soap (Pack of 4)', 'Beauty & Wellness', 349, 60, 'Cold-process handmade soaps with neem, holy basil and shea butter. Palm-oil free.'],
      ['Aromatherapy Diffuser Oil Set', 'Beauty & Wellness', 1199, 14, 'Six pure essential oils — lavender, eucalyptus, lemongrass, peppermint, tea tree, orange.'],
      ['Herbal Hair Oil 200ml', 'Beauty & Wellness', 449, 0, 'Bhringraj and amla infused in coconut oil, slow-cooked the traditional way.'],
      ['Handmade Leather Journal', 'Books', 899, 16, 'A5 journal with 200 pages of handmade cotton-rag paper and a wraparound tie.'],
    ],
  },
];

const PENDING_VENDOR = {
  email: 'pending@demo.com',
  name: 'Kavya Iyer',
  store: 'Urban Threads',
  description: 'Contemporary streetwear made from deadstock fabric in Chennai. Applying to launch our first collection.',
};

const CUSTOMERS = [
  { email: 'customer@demo.com', name: 'Priya Sharma', city: 'Bengaluru', state: 'Karnataka', pin: '560034' },
  { email: 'rahul@demo.com', name: 'Rahul Verma', city: 'Mumbai', state: 'Maharashtra', pin: '400050' },
  { email: 'ananya@demo.com', name: 'Ananya Iyer', city: 'Chennai', state: 'Tamil Nadu', pin: '600020' },
  { email: 'vikram@demo.com', name: 'Vikram Singh', city: 'New Delhi', state: 'Delhi', pin: '110017' },
  { email: 'sneha@demo.com', name: 'Sneha Reddy', city: 'Hyderabad', state: 'Telangana', pin: '500081' },
];

const REVIEW_TEXT: Record<number, string[]> = {
  5: ['Absolutely love it — the quality is even better than the photos.', 'Beautifully made and arrived well packed. Highly recommend!', 'Exactly as described. Will definitely order again.', 'Fantastic value for money, and the seller was very responsive.'],
  4: ['Really nice, just took a couple of extra days to arrive.', 'Good quality overall; the colour is slightly different from the photo.', 'Very happy with this purchase. Packaging could be more eco-friendly.'],
  3: ['Decent, but smaller than I expected.', 'It’s okay for the price. Does the job.'],
  2: ['Not great — the finish had a few rough spots.'],
};
const CARRIERS = ['Delhivery', 'BlueDart', 'DTDC', 'Ecom Express', 'India Post'];

async function main() {
  console.log('🌱 Seeding database…');
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await prisma.setting.create({ data: { key: 'commission_rate_bps', value: String(COMMISSION_BPS) } });

  await prisma.user.create({ data: { email: 'admin@demo.com', name: 'Aditi Rao (Admin)', passwordHash, role: 'ADMIN', createdAt: ago(120) } });

  const categories = new Map<string, string>();
  for (const name of CATEGORIES) {
    const c = await prisma.category.create({ data: { name, slug: slugify(name) } });
    categories.set(name, c.id);
  }

  // ---- Vendors & products ----
  const products: { id: string; vendorId: string; title: string; price: number; imageUrl: string }[] = [];
  const vendorUsers = new Map<string, string>();
  for (const [vi, v] of VENDORS.entries()) {
    const user = await prisma.user.create({ data: { email: v.email, name: v.name, passwordHash, role: 'VENDOR', createdAt: ago(100 - vi * 5) } });
    const vendor = await prisma.vendor.create({
      data: { userId: user.id, storeName: v.store, slug: slugify(v.store), description: v.description, status: 'APPROVED', approvedAt: ago(95 - vi * 5), createdAt: ago(98 - vi * 5) },
    });
    vendorUsers.set(vendor.id, user.id);
    for (const [pi, [title, category, rupees, stock, description]] of v.products.entries()) {
      const slug = `${slugify(title)}-${vi}${pi}`;
      const imageUrl = `https://picsum.photos/seed/${slug}/600/600`;
      const product = await prisma.product.create({
        data: {
          vendorId: vendor.id,
          categoryId: categories.get(category)!,
          title,
          slug,
          description,
          price: rupees * 100,
          stock,
          createdAt: ago(90 - pi * 2 - vi),
          images: { create: [{ url: imageUrl, position: 0 }, { url: `https://picsum.photos/seed/${slug}-alt/600/600`, position: 1 }] },
        },
      });
      products.push({ id: product.id, vendorId: vendor.id, title, price: product.price, imageUrl });
    }
  }

  const pendingUser = await prisma.user.create({ data: { email: PENDING_VENDOR.email, name: PENDING_VENDOR.name, passwordHash, createdAt: ago(3) } });
  await prisma.vendor.create({
    data: { userId: pendingUser.id, storeName: PENDING_VENDOR.store, slug: slugify(PENDING_VENDOR.store), description: PENDING_VENDOR.description, createdAt: ago(2) },
  });

  // ---- Customers ----
  const customers = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    const user = await prisma.user.create({ data: { email: c.email, name: c.name, passwordHash, createdAt: ago(80 - i * 7) } });
    customers.push({ ...c, id: user.id });
  }

  // ---- Past orders across every lifecycle state ----
  // [daysAgo, status for each sub-order] — older orders are delivered, recent ones in progress.
  const plan: { days: number; statuses: SubOrderStatus[] }[] = [];
  for (let i = 0; i < 32; i++) {
    // 22 orders spread over the last 45 days, then 10 in the last ~5 days.
    const age = i < 22 ? Math.round(45 - i * 1.8) : Math.round((31 - i) * 0.55);
    const statusFor = (): SubOrderStatus => {
      if (age > 12) return rand() < 0.93 ? 'DELIVERED' : 'CANCELLED';
      if (age > 6) return pick<SubOrderStatus>(['DELIVERED', 'DELIVERED', 'SHIPPED']);
      if (age > 2) return pick<SubOrderStatus>(['SHIPPED', 'PACKED', 'DELIVERED']);
      return pick<SubOrderStatus>(['PLACED', 'PLACED', 'PACKED']);
    };
    const statuses = [statusFor(), statusFor(), statusFor()];
    if (i === 4 || i === 15) statuses[0] = 'CANCELLED'; // a couple of seller cancellations
    plan.push({ days: age, statuses });
  }

  const deliveredPurchases: { customerId: string; productId: string; deliveredAt: Date }[] = [];
  const deliveredSubOrders: { id: string; vendorId: string; earnings: number; deliveredAt: Date }[] = [];
  let refundRequestsCreated = 0;

  for (const [i, entry] of plan.entries()) {
    // Priya (customer@demo.com) gets a good spread of orders for the demo.
    const customer = i % 3 === 0 ? customers[0] : customers[1 + (i % 4)];
    const lineCount = int(1, 4);
    const chosen = new Map<string, { product: (typeof products)[number]; qty: number }>();
    while (chosen.size < lineCount) {
      const product = pick(products);
      if (!chosen.has(product.id)) chosen.set(product.id, { product, qty: rand() < 0.8 ? 1 : 2 });
    }
    const byVendor = new Map<string, { product: (typeof products)[number]; qty: number }[]>();
    for (const line of chosen.values()) byVendor.set(line.product.vendorId, [...(byVendor.get(line.product.vendorId) ?? []), line]);

    const placedAt = ago(entry.days, int(1, 10));
    const paidAt = new Date(placedAt.getTime() + int(1, 5) * 60_000);
    const subOrdersData = [...byVendor.entries()].map(([vendorId, lines], si) => {
      const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
      const commissionAmount = Math.round((subtotal * COMMISSION_BPS) / 10_000);
      return { vendorId, lines, subtotal, commissionAmount, status: entry.statuses[si % entry.statuses.length] };
    });
    const total = subOrdersData.reduce((s, x) => s + x.subtotal, 0);

    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        paymentStatus: 'PAID',
        totalAmount: total,
        shippingName: customer.name,
        shippingPhone: `+91 98${int(10000000, 99999999)}`,
        shippingLine1: `${int(1, 250)}, ${pick(['MG Road', 'Park Street', 'Linking Road', 'Anna Salai', 'Banjara Hills Rd 12', 'Hauz Khas Village'])}`,
        shippingCity: customer.city,
        shippingState: customer.state,
        shippingPostalCode: customer.pin,
        shippingCountry: 'India',
        paidAt,
        createdAt: placedAt,
        payment: {
          create: {
            provider: 'MOCK',
            providerOrderId: `mock_order_seed${i.toString().padStart(3, '0')}`,
            providerPaymentId: `mock_pay_seed${i.toString().padStart(3, '0')}`,
            status: 'CAPTURED',
            amount: total,
            createdAt: placedAt,
          },
        },
      },
    });

    for (const so of subOrdersData) {
      const h = (n: number) => new Date(paidAt.getTime() + n * 3_600_000);
      const packedAt = ['PACKED', 'SHIPPED', 'DELIVERED'].includes(so.status) ? h(int(4, 20)) : null;
      const shippedAt = ['SHIPPED', 'DELIVERED'].includes(so.status) ? h(int(24, 40)) : null;
      const deliveredAt = so.status === 'DELIVERED' ? new Date(Math.min(h(int(60, 110)).getTime(), NOW - 3_600_000)) : null;
      const cancelledAt = so.status === 'CANCELLED' ? h(int(2, 10)) : null;
      const carrier = shippedAt ? pick(CARRIERS) : null;
      const tracking = shippedAt ? `${carrier!.slice(0, 3).toUpperCase()}${int(10_000_000, 99_999_999)}` : null;

      const events: { status: SubOrderStatus; note: string | null; createdAt: Date }[] = [{ status: 'PLACED', note: 'Payment confirmed — order placed', createdAt: paidAt }];
      if (packedAt) events.push({ status: 'PACKED', note: null, createdAt: packedAt });
      if (shippedAt) events.push({ status: 'SHIPPED', note: `Shipped via ${carrier} · tracking ${tracking}`, createdAt: shippedAt });
      if (deliveredAt) events.push({ status: 'DELIVERED', note: null, createdAt: deliveredAt });
      if (cancelledAt) events.push({ status: 'CANCELLED', note: 'Cancelled by seller: Item out of stock', createdAt: cancelledAt });

      const sub = await prisma.subOrder.create({
        data: {
          orderId: order.id,
          vendorId: so.vendorId,
          status: so.status,
          subtotal: so.subtotal,
          commissionRateBps: COMMISSION_BPS,
          commissionAmount: so.commissionAmount,
          vendorEarnings: so.subtotal - so.commissionAmount,
          trackingNumber: tracking,
          carrier,
          packedAt,
          shippedAt,
          deliveredAt,
          cancelledAt,
          cancelReason: cancelledAt ? 'Cancelled by seller: Item out of stock' : null,
          refundedAmount: cancelledAt ? so.subtotal : 0,
          createdAt: placedAt,
          items: {
            create: so.lines.map((l) => ({
              productId: l.product.id,
              productTitle: l.product.title,
              imageUrl: l.product.imageUrl,
              unitPrice: l.product.price,
              quantity: l.qty,
              lineTotal: l.product.price * l.qty,
            })),
          },
          events: { create: events },
        },
      });

      if (cancelledAt) {
        await prisma.refundRequest.create({
          data: { subOrderId: sub.id, customerId: customer.id, reason: 'Automatic refund: Cancelled by seller', amount: so.subtotal, status: 'APPROVED',
            adminNote: 'Refunded automatically on cancellation', providerRefundId: `mock_rfnd_seed${i}`, createdAt: cancelledAt, resolvedAt: cancelledAt },
        });
      }

      if (deliveredAt) {
        for (const l of so.lines) deliveredPurchases.push({ customerId: customer.id, productId: l.product.id, deliveredAt });
        // A couple of recent deliveries get an open refund request for the admin to handle.
        if (refundRequestsCreated < 2 && entry.days < 7 && entry.days > 2) {
          refundRequestsCreated++;
          await prisma.refundRequest.create({
            data: { subOrderId: sub.id, customerId: customer.id, amount: so.subtotal, createdAt: new Date(deliveredAt.getTime() + 3_600_000 * 20),
              reason: refundRequestsCreated === 1 ? 'The item arrived with a cracked corner — photos attached in the email.' : 'Received the wrong colour; I ordered the natural variant.' },
          });
        } else {
          deliveredSubOrders.push({ id: sub.id, vendorId: so.vendorId, earnings: so.subtotal - so.commissionAmount, deliveredAt });
        }
      }
    }
  }

  // ---- Payouts: an older batch already paid, a newer batch waiting to be sent ----
  const windowCutoff = NOW - 7 * DAY;
  const payable = deliveredSubOrders.filter((s) => s.deliveredAt.getTime() < windowCutoff);
  const oldest = payable.filter((s) => s.deliveredAt.getTime() < NOW - 25 * DAY);
  const middle = payable.filter((s) => s.deliveredAt.getTime() >= NOW - 25 * DAY && s.deliveredAt.getTime() < NOW - 16 * DAY);
  for (const [batch, paid] of [[oldest, true], [middle, false]] as const) {
    const byVendor = new Map<string, typeof batch>();
    for (const s of batch) byVendor.set(s.vendorId, [...(byVendor.get(s.vendorId) ?? []), s]);
    for (const [vendorId, subs] of byVendor) {
      await prisma.payout.create({
        data: {
          vendorId,
          amount: subs.reduce((sum, s) => sum + s.earnings, 0),
          status: paid ? 'PAID' : 'PENDING',
          reference: paid ? `NEFT${int(100000, 999999)}` : null,
          createdAt: paid ? ago(18) : ago(4),
          paidAt: paid ? ago(16) : null,
          subOrders: { connect: subs.map((s) => ({ id: s.id })) },
        },
      });
    }
  }

  // ---- Reviews from verified buyers (≈70% of delivered purchases) ----
  const reviewed = new Set<string>();
  for (const p of deliveredPurchases) {
    const key = `${p.customerId}:${p.productId}`;
    if (reviewed.has(key) || rand() > 0.7) continue;
    reviewed.add(key);
    const rating = pick([5, 5, 5, 4, 4, 4, 3, 2]);
    await prisma.review.create({
      data: { productId: p.productId, userId: p.customerId, rating, comment: pick(REVIEW_TEXT[rating]), createdAt: new Date(p.deliveredAt.getTime() + int(1, 4) * DAY / 2) },
    });
  }
  const aggs = await prisma.review.groupBy({ by: ['productId'], _avg: { rating: true }, _count: { _all: true } });
  for (const a of aggs) {
    await prisma.product.update({ where: { id: a.productId }, data: { avgRating: Math.round((a._avg.rating ?? 0) * 10) / 10, reviewCount: a._count._all } });
  }

  // ---- Something in Priya's cart ----
  const cartPicks = [products[0], products[16], products[31]];
  for (const p of cartPicks) await prisma.cartItem.create({ data: { userId: customers[0].id, productId: p.id, quantity: 1 } });

  const counts = {
    users: await prisma.user.count(),
    vendors: await prisma.vendor.count(),
    products: await prisma.product.count(),
    orders: await prisma.order.count(),
    subOrders: await prisma.subOrder.count(),
    reviews: await prisma.review.count(),
    payouts: await prisma.payout.count(),
    openRefunds: await prisma.refundRequest.count({ where: { status: 'REQUESTED' } }),
  };
  console.log('✅ Seed complete:', counts);
  console.log(`\nDemo logins (password for all: ${PASSWORD})`);
  console.log('  admin@demo.com      — Admin');
  console.log('  vendor@demo.com     — Vendor (Lumen & Loom)');
  console.log('  vendor2@demo.com    — Vendor (Circuit Bazaar)');
  console.log('  vendor3@demo.com    — Vendor (Chai & Chapters)');
  console.log('  pending@demo.com    — Pending vendor application (Urban Threads)');
  console.log('  customer@demo.com   — Customer (Priya), plus rahul@, ananya@, vikram@, sneha@demo.com');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
