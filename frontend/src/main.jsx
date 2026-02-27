import React from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './styles.css';

const API_BASE = 'http://localhost:4000';
const socket = io(API_BASE, { autoConnect: true });

function Login({ onLogin }) {
  const [role, setRole] = React.useState('customer');
  const [phone, setPhone] = React.useState(role === 'customer' ? '9000000002' : '9000000001');
  const [password, setPassword] = React.useState(role === 'customer' ? 'cust123' : 'driver123');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (role === 'customer') {
      setPhone('9000000002');
      setPassword('cust123');
    } else {
      setPhone('9000000001');
      setPassword('driver123');
    }
  }, [role]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, phone, password }),
    });

    if (!res.ok) {
      setError('Login failed. Use demo credentials.');
      return;
    }

    const data = await res.json();
    onLogin(data.user);
  };

  return (
    <div className="card">
      <h1>TruLoad</h1>
      <p className="subtitle">Logistics app for customers and drivers</p>
      <form onSubmit={submit} className="stack">
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="customer">Customer</option>
            <option value="driver">Driver</option>
          </select>
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Login</button>
      </form>
      <p className="hint">Customer: 9000000002 / cust123 | Driver: 9000000001 / driver123</p>
    </div>
  );
}

function CustomerDashboard({ user }) {
  const [loads, setLoads] = React.useState([]);
  const [form, setForm] = React.useState({ origin: '', destination: '', weight: '', material: '', price: '' });

  const loadData = async () => {
    const res = await fetch(`${API_BASE}/api/loads`);
    const data = await res.json();
    setLoads(data);
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const postLoad = async (e) => {
    e.preventDefault();
    await fetch(`${API_BASE}/api/loads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, customerId: user.id }),
    });
    setForm({ origin: '', destination: '', weight: '', material: '', price: '' });
    loadData();
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Post New Load</h2>
        <form className="grid" onSubmit={postLoad}>
          {['origin', 'destination', 'weight', 'material', 'price'].map((field) => (
            <label key={field}>
              {field[0].toUpperCase() + field.slice(1)}
              <input
                required
                value={form[field]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
              />
            </label>
          ))}
          <button type="submit">Post Load</button>
        </form>
      </section>

      <section className="card">
        <h2>My Loads</h2>
        <div className="list">
          {loads.map((load) => (
            <article className="list-item" key={load.id}>
              <strong>{load.origin} → {load.destination}</strong>
              <span>{load.weight} tons · {load.material}</span>
              <span>₹{load.price} · <em>{load.status}</em></span>
            </article>
          ))}
          {!loads.length && <p>No loads posted yet.</p>}
        </div>
      </section>
    </div>
  );
}

function DriverDashboard({ trackingMap }) {
  const [loads, setLoads] = React.useState([]);
  const [bookings, setBookings] = React.useState([]);

  const refresh = async () => {
    const [loadsRes, bookingsRes] = await Promise.all([
      fetch(`${API_BASE}/api/loads`),
      fetch(`${API_BASE}/api/bookings`),
    ]);
    setLoads(await loadsRes.json());
    setBookings(await bookingsRes.json());
  };

  React.useEffect(() => {
    refresh();
  }, []);

  const bookLoad = async (id) => {
    await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loadId: id, driverId: 1 }),
    });
    refresh();
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Available Loads</h2>
        <div className="list">
          {loads.map((load) => (
            <article className="list-item" key={load.id}>
              <strong>{load.origin} → {load.destination}</strong>
              <span>{load.weight} tons · ₹{load.price}</span>
              {load.status === 'open' ? (
                <button onClick={() => bookLoad(load.id)}>Book Truck</button>
              ) : (
                <span className="pill">Booked</span>
              )}
            </article>
          ))}
          {!loads.length && <p>No loads available yet.</p>}
        </div>
      </section>

      <section className="card">
        <h2>Real-time Tracking (simulated)</h2>
        <div className="list">
          {bookings.map((booking) => {
            const t = trackingMap[booking.id];
            return (
              <article className="list-item" key={booking.id}>
                <strong>Booking #{booking.id}</strong>
                {t ? (
                  <span>Lat: {t.lat}, Lng: {t.lng}, Speed: {t.speed} km/h</span>
                ) : (
                  <span>No tracking yet.</span>
                )}
                <small>Updated: {t ? new Date(t.updatedAt).toLocaleTimeString() : '-'}</small>
              </article>
            );
          })}
          {!bookings.length && <p>No bookings yet.</p>}
        </div>
      </section>
    </div>
  );
}

function App() {
  const [user, setUser] = React.useState(null);
  const [trackingMap, setTrackingMap] = React.useState({});

  React.useEffect(() => {
    socket.on('bootstrap', (data) => {
      const map = {};
      data.tracking.forEach((entry) => {
        map[entry.bookingId] = entry;
      });
      setTrackingMap(map);
    });

    socket.on('tracking_update', (payload) => {
      setTrackingMap((prev) => ({ ...prev, [payload.bookingId]: payload }));
    });

    return () => {
      socket.off('bootstrap');
      socket.off('tracking_update');
    };
  }, []);

  if (!user) {
    return <main className="container"><Login onLogin={setUser} /></main>;
  }

  return (
    <main className="container">
      <header className="topbar card">
        <div>
          <h1>Welcome, {user.name}</h1>
          <p className="subtitle">Role: {user.role}</p>
        </div>
        <button onClick={() => setUser(null)}>Logout</button>
      </header>
      {user.role === 'customer' ? <CustomerDashboard user={user} /> : <DriverDashboard trackingMap={trackingMap} />}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
