import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());

const users = [
  { id: 1, role: 'driver', phone: '9000000001', password: 'driver123', name: 'Ravi Driver' },
  { id: 2, role: 'customer', phone: '9000000002', password: 'cust123', name: 'Neha Customer' },
];

const loads = [];
const bookings = [];

let loadId = 1;
let bookingId = 1;

const trackingByBooking = new Map();

const seedTracking = {
  lat: 28.6139,
  lng: 77.209,
  speed: 52,
};

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { phone, password, role } = req.body;
  const user = users.find(
    (u) => u.phone === phone && u.password === password && u.role === role,
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  return res.json({
    token: `demo-token-${user.id}`,
    user: { id: user.id, role: user.role, name: user.name, phone: user.phone },
  });
});

app.get('/api/loads', (_, res) => {
  res.json(loads);
});

app.post('/api/loads', (req, res) => {
  const { origin, destination, weight, material, price, customerId } = req.body;

  if (!origin || !destination || !weight || !material || !price || !customerId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const load = {
    id: loadId++,
    origin,
    destination,
    weight,
    material,
    price,
    customerId,
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  loads.unshift(load);
  return res.status(201).json(load);
});

app.post('/api/bookings', (req, res) => {
  const { loadId: targetLoadId, driverId } = req.body;
  const load = loads.find((l) => l.id === Number(targetLoadId));

  if (!load) {
    return res.status(404).json({ message: 'Load not found' });
  }

  if (load.status !== 'open') {
    return res.status(400).json({ message: 'Load already booked' });
  }

  const booking = {
    id: bookingId++,
    loadId: load.id,
    driverId,
    status: 'in_transit',
    createdAt: new Date().toISOString(),
  };

  bookings.unshift(booking);
  load.status = 'booked';

  trackingByBooking.set(booking.id, {
    ...seedTracking,
    updatedAt: new Date().toISOString(),
  });

  io.emit('booking_created', booking);
  io.emit('tracking_update', { bookingId: booking.id, ...trackingByBooking.get(booking.id) });

  return res.status(201).json(booking);
});

app.get('/api/bookings', (_, res) => {
  res.json(bookings);
});

app.get('/api/tracking/:bookingId', (req, res) => {
  const bookingIdValue = Number(req.params.bookingId);
  const tracking = trackingByBooking.get(bookingIdValue);

  if (!tracking) {
    return res.status(404).json({ message: 'No tracking found for booking' });
  }

  return res.json({ bookingId: bookingIdValue, ...tracking });
});

io.on('connection', (socket) => {
  socket.emit('bootstrap', {
    loads,
    bookings,
    tracking: Array.from(trackingByBooking.entries()).map(([id, data]) => ({ bookingId: id, ...data })),
  });
});

setInterval(() => {
  bookings
    .filter((booking) => booking.status === 'in_transit')
    .forEach((booking) => {
      const current = trackingByBooking.get(booking.id);
      if (!current) {
        return;
      }

      const next = {
        lat: Number((current.lat + (Math.random() - 0.5) * 0.02).toFixed(5)),
        lng: Number((current.lng + (Math.random() - 0.5) * 0.02).toFixed(5)),
        speed: Math.max(25, Math.min(80, Math.round(current.speed + (Math.random() - 0.5) * 8))),
        updatedAt: new Date().toISOString(),
      };

      trackingByBooking.set(booking.id, next);
      io.emit('tracking_update', { bookingId: booking.id, ...next });
    });
}, 3000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
