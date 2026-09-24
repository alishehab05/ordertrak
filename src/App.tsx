import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Leaf,
  MapPin,
  Package,
  Truck,
} from 'lucide-react';

// These are the screens available in the single-page prototype.
type Screen = 'login' | 'customer' | 'driver';
type UserRole = 'customer' | 'driver';
type OrderStatus = 'Order placed' | 'Pending for confirmation' | 'Confirmed' | 'Processing' | 'Delivered';

// This describes one grocery selected by a customer.
interface Grocery {
  name: string;
  price: number;
  packed?: boolean;
}

// This describes the order shape stored by JSON Server.
interface Order {
  id: string;
  createdAt?: string;
  customer: string;
  address: string;
  items: Grocery[];
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  driverDelivered?: boolean;
  customerDelivered?: boolean;
  hiddenForCustomer?: boolean;
  hiddenForDriver?: boolean;
}

// These demo accounts identify the dashboard from the entered email.
const demoAccounts: Record<string, { password: string; role: UserRole }> = {
  'customer@greenroute.com': { password: 'customer123', role: 'customer' },
  'driver@greenroute.com': { password: 'driver123', role: 'driver' },
};

// This is the local JSON Server endpoint used for every order operation.
const ORDERS_URL = 'http://localhost:3001/orders';

// These groceries are grouped by category and include the prices shown to customers.
const groceryCatalog: Record<string, Grocery[]> = {
  'Fruit': [
    { name: 'Apples (1 kg)', price: 4.5 },
    { name: 'Bananas (1 kg)', price: 2.5 },
    { name: 'Oranges (1 kg)', price: 3.5 },
    { name: 'Strawberries (box)', price: 5 },
  ],
  'Vegetables': [
    { name: 'Tomatoes (1 kg)', price: 3 },
    { name: 'Potatoes (2 kg)', price: 4 },
    { name: 'Carrots (1 kg)', price: 2.75 },
    { name: 'Spinach (bag)', price: 3.25 },
  ],
  'Pantry': [
    { name: 'Milk (1 litre)', price: 2.5 },
    { name: 'Eggs (12 pack)', price: 4 },
    { name: 'Bread loaf', price: 2.25 },
    { name: 'Rice (2 kg)', price: 6 },
  ],
};

// These timeline entries define the customer-facing order journey.
const timelineSteps: Array<{ status: OrderStatus; title: string; description: string }> = [
  { status: 'Order placed', title: 'Order placed', description: 'The driver has created your order.' },
  { status: 'Pending for confirmation', title: 'Pending for confirmation', description: 'The order is waiting for driver confirmation.' },
  { status: 'Confirmed', title: 'Confirmed', description: 'The driver confirmed the order.' },
  { status: 'Processing', title: 'Processing (on the way)', description: 'The driver is processing and delivering your order.' },
  { status: 'Delivered', title: 'Delivered', description: 'Your order has arrived.' },
];

// This presents the internal processing status with the clearer customer-facing label.
function statusLabel(status: OrderStatus): string {
  return status === 'Processing' ? 'Processing (on the way)' : status;
}

// This creates a valid CSS class for statuses containing spaces or punctuation.
function statusClass(status: OrderStatus): string {
  return status.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
}

// This keeps order sorting consistent after loading, creating, and updating records.
function sortNewestFirst(orderList: Order[]): Order[] {
  return orderList
    .map((order, originalIndex) => ({ order, originalIndex }))
    .sort((first, second) => {
      const firstTime = first.order.createdAt ? new Date(first.order.createdAt).getTime() : 0;
      const secondTime = second.order.createdAt ? new Date(second.order.createdAt).getTime() : 0;
      // Equal or missing timestamps keep the original order of those existing records.
      return secondTime - firstTime || first.originalIndex - second.originalIndex;
    })
    .map(({ order }) => order);
}

// This maps older saved order statuses into the new driver-controlled workflow.
function normalizeOrder(order: Order): Order {
  const legacyStatus = order.status as string;
  const statusMap: Record<string, OrderStatus> = {
    Pending: 'Order placed',
    Accepted: 'Confirmed',
    Preparing: 'Confirmed',
    Ready: 'Confirmed',
    'On the way': 'Processing',
    Rejected: 'Order placed',
    Declined: 'Order placed',
  };
  return { ...order, status: statusMap[legacyStatus] || order.status };
}

// This component renders the shared brand header used on every screen.
function Header({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <header className="site-header">
      <button className="brand" onClick={() => onNavigate('login')} aria-label="Go to login">
        <span className="brand-mark"><Leaf size={18} /></span>
        <span>GreenRoute</span>
      </button>
      <span className="header-label">Simple order tracking</span>
    </header>
  );
}

// This component provides a consistent welcome panel for the login page.
function AuthIntro() {
  return (
    <section className="auth-intro">
      <div className="eyebrow"><Leaf size={16} /> Delivery made clear</div>
      <h1>Welcome back.</h1>
      <p>One calm place for customers and drivers to stay connected from pickup to delivery.</p>
      <div className="intro-points">
        <span><CheckCircle2 size={17} /> Live order updates</span>
        <span><CheckCircle2 size={17} /> Simple driver actions</span>
        <span><CheckCircle2 size={17} /> Clear delivery status</span>
      </div>
    </section>
  );
}

// This component handles login and restores the matching customer or driver dashboard.
function AuthPage({ onAuthenticated }: { onAuthenticated: (role: UserRole) => void }) {
  const [error, setError] = useState('');

  // This checks the demo account and stores only the role, never the password.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email')).trim().toLowerCase();
    const password = String(formData.get('password'));
    const account = demoAccounts[email];

    if (!account || account.password !== password) {
      setError('Email or password is incorrect. Please use one of the demo accounts.');
      return;
    }

    localStorage.setItem('greenroute-role', account.role);
    localStorage.setItem('greenroute-email', email);
    setError('');
    onAuthenticated(account.role);
  };

  return (
    <main className="auth-layout">
      <AuthIntro />
      <section className="card auth-card">
        <div className="card-heading">
          <p className="eyebrow">Sign in</p>
          <h2>Access your orders</h2>
          <p>Enter your account details to continue.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label>Email address<input required name="email" type="email" placeholder="you@example.com" /></label>
          <label>Password<input required name="password" type="password" placeholder="••••••••" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit">Sign in <ArrowRight size={18} /></button>
        </form>
      </section>
    </main>
  );
}

// This component displays the clean vertical tracking timeline requested for customers.
function OrderTimeline({ order }: { order: Order }) {
  // This finds the current stage so completed and upcoming timeline steps can be styled correctly.
  const { status } = order;
  const currentIndex = timelineSteps.findIndex((step) => step.status === status);

  // This renders one vertical timeline row for every stage in the delivery process.
  return (
    <div className="timeline">
      {timelineSteps.map((step, index) => {
        const completed = index <= currentIndex;
        return (
          <div className={`timeline-item ${completed ? 'timeline-completed' : ''}`} key={step.status}>
            <div className="timeline-time">{completed ? index === currentIndex ? 'Current' : 'Done' : 'Waiting'}</div>
            <div className="timeline-track">
              <span className="timeline-circle">{completed && <CheckCircle2 size={16} />}</span>
              {index < timelineSteps.length - 1 && <span className="timeline-line" />}
            </div>
            <div className="timeline-copy"><strong>{step.title}</strong><span>{step.description}</span></div>
          </div>
        );
      })}
    </div>
  );
}

// This component renders one customer order with its timeline, prices, total, and local removal.
function CustomerOrder({ order }: { order: Order }) {
  // These values calculate the order totals displayed in the read-only customer view.
  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);

  // This renders the customer-facing order details without exposing driver controls.
  return (
    <article className="card order-card">
      <div className="section-heading">
        <div><p className="eyebrow">Order #{order.id}</p><h2>Grocery delivery</h2></div>
        <span className={`status status-${statusClass(order.status)}`}><Clock3 size={14} /> {statusLabel(order.status)}</span>
      </div>
      <OrderTimeline order={order} />
      <div className="order-detail"><MapPin size={20} /><div><strong>Delivery address</strong><span>{order.address}</span></div></div>
      <div className="price-list">
        {items.map((item) => <div className={item.packed ? 'packed-item' : ''} key={item.name}><span>{item.packed ? '✓ ' : ''}{item.name}</span><strong>${item.price.toFixed(2)}</strong></div>)}
        <div><span>Groceries subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
        <div><span>Delivery fee</span><strong>$5.00</strong></div>
        <div className="price-total"><span>Total</span><strong>${order.total.toFixed(2)}</strong></div>
      </div>
    </article>
  );
}

// This component renders the customer's grocery selection and order list.
function CustomerDashboard({ orders, onLogout }: { orders: Order[]; onLogout: () => void }) {
  // This renders only saved orders and their progress because customers cannot edit orders.
  return (
    <DashboardShell title="Customer dashboard" subtitle="Track your deliveries from one simple view." onLogout={onLogout}>
      <section className="orders-column">
        {orders.length === 0 ? <div className="card empty-card"><Package size={24} /><h2>No orders yet</h2><p>Your driver-created orders will appear here.</p></div> : orders.map((order) => <CustomerOrder key={order.id} order={order} />)}
      </section>
    </DashboardShell>
  );
}

// This component renders driver orders and hides rejected orders only from the driver's view.
function DriverDashboard({ orders, onCreateOrder, onStatusChange, onTogglePacked, onLogout }: { orders: Order[]; onCreateOrder: (order: Omit<Order, 'id'>) => void; onStatusChange: (order: Order, status: OrderStatus) => void; onTogglePacked: (order: Order, itemIndex: number) => void; onLogout: () => void }) {
  // These states control the expandable new-order form and its selected groceries.
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Grocery[]>([]);

  // This validates the driver form and sends the complete grocery order to the parent.
  const createOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = String(new FormData(event.currentTarget).get('address'));
    if (!selectedItems.length) return;
    onCreateOrder({ customer: 'Alex Morgan', address, createdAt: new Date().toISOString(), items: selectedItems.map((item) => ({ ...item, packed: false })), deliveryFee: 5, total: selectedItems.reduce((sum, item) => sum + item.price, 0) + 5, status: 'Order placed' });
    setSelectedItems([]);
    setShowNewOrder(false);
    event.currentTarget.reset();
  };

  // This adds or removes one grocery from the order being prepared by the driver.
  const toggleGrocery = (grocery: Grocery) => setSelectedItems((current) => current.some((item) => item.name === grocery.name) ? current.filter((item) => item.name !== grocery.name) : [...current, grocery]);

  // This renders the driver creation controls and the status actions for every order.
  return (
    <DashboardShell title="Driver dashboard" subtitle="Review requests and keep customers updated." onLogout={onLogout}>
      <button className="primary-button new-order-button" onClick={() => setShowNewOrder((visible) => !visible)}><Package size={18} /> {showNewOrder ? 'Close order form' : 'Make a new order'}</button>
      {showNewOrder && <section className="card action-card driver-create-card">
        <p className="eyebrow">Driver controls</p><h2>Build the grocery order</h2><p>Choose the groceries and address before submitting the order.</p>
        <form className="mini-form" onSubmit={createOrder}>
          {Object.entries(groceryCatalog).map(([category, groceries]) => <fieldset key={category}><legend>{category}</legend><div className="grocery-options">{groceries.map((grocery) => <label className="grocery-option" key={grocery.name}><input type="checkbox" checked={selectedItems.some((item) => item.name === grocery.name)} onChange={() => toggleGrocery(grocery)} /><span>{grocery.name}</span><strong>${grocery.price.toFixed(2)}</strong></label>)}</div></fieldset>)}
          <label>Delivery address<input required name="address" placeholder="Delivery address" /></label>
          <p className="delivery-fee">Delivery fee: <strong>$5.00</strong></p>
          <button className="secondary-button" type="submit">Submit new order</button>
        </form>
      </section>}
      <section className="orders-column">
        {orders.length === 0 ? <div className="card empty-card"><Truck size={24} /><h2>No incoming orders</h2><p>New customer requests will appear here.</p></div> : orders.map((order) => (
          <article className="card driver-card" key={order.id}>
            <div className="section-heading"><div><p className="eyebrow">Order #{order.id}</p><h2>{order.items?.map((item) => item.name).join(', ') || 'Grocery order'}</h2></div><span className={`status status-${statusClass(order.status)}`}><Clock3 size={14} /> {statusLabel(order.status)}</span></div>
            <div className="driver-order"><div className="driver-icon"><Package size={24} /></div><div><h3>{order.customer}</h3><p>{order.address}</p><strong>${order.total.toFixed(2)}</strong></div></div>
            {order.status === 'Order placed' && <button className="primary-button" onClick={() => onStatusChange(order, 'Pending for confirmation')}>Send order for confirmation</button>}
            {order.status === 'Pending for confirmation' && <button className="primary-button" onClick={() => onStatusChange(order, 'Confirmed')}><CheckCircle2 size={18} /> Confirm order details</button>}
            {order.status === 'Confirmed' && <div className="packing-list"><strong>Pack this order</strong>{order.items.map((item, index) => <label className="packing-item" key={item.name}><input type="checkbox" checked={item.packed === true} onChange={() => onTogglePacked(order, index)} /><span>{item.name}</span><b>${item.price.toFixed(2)}</b></label>)}</div>}
            {order.status === 'Confirmed' && order.items.every((item) => item.packed) && <button className="location-button" onClick={() => onStatusChange(order, 'Processing')}><MapPin size={18} /> Start processing / delivery</button>}
            {order.status === 'Processing' && <button className="location-button" onClick={() => onStatusChange(order, 'Delivered')}><CheckCircle2 size={18} /> Mark delivered</button>}
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}

// This wrapper keeps dashboard navigation, layout, and logout behavior consistent.
function DashboardShell({ title, subtitle, onLogout, children }: { title: string; subtitle: string; onLogout: () => void; children: React.ReactNode }) {
  // This provides the shared dashboard heading, sign-out action, and page content area.
  return <main className="dashboard-page"><div className="dashboard-heading"><div><p className="eyebrow">GreenRoute workspace</p><h1>{title}</h1><p>{subtitle}</p></div><button className="secondary-button" onClick={onLogout}>Sign out</button></div>{children}</main>;
}

// This component loads persisted orders and restores the previous signed-in role.
export default function App() {
  // This restores the last authenticated role so a browser refresh stays on the same dashboard.
  const savedRole = localStorage.getItem('greenroute-role') as UserRole | null;
  const [screen, setScreen] = useState<Screen>(savedRole === 'customer' || savedRole === 'driver' ? savedRole : 'login');
  const [orders, setOrders] = useState<Order[]>([]);

  // This loads, normalizes, filters, and sorts orders visible to the current role.
  useEffect(() => {
    if (screen === 'login') return;
    fetch(ORDERS_URL).then((response) => response.json() as Promise<Order[]>).then((loadedOrders) => {
      // This filters hidden records and sorts every visible order from newest to oldest.
      const visibleOrders = loadedOrders.map(normalizeOrder).filter((order) => screen === 'customer' ? !order.hiddenForCustomer : !order.hiddenForDriver);
      setOrders(sortNewestFirst(visibleOrders));
    }).catch(() => setOrders([]));
  }, [screen]);

  // This places a newly created order at the top of the current dashboard immediately.
  const handleOrderCreated = (order: Order) => setOrders((current) => sortNewestFirst([order, ...current]));

  // This saves a complete driver-created order and displays it at the top of both dashboards.
  const handleCreateOrder = async (order: Omit<Order, 'id'>) => {
    // This guarantees every newly created order has a reliable creation timestamp.
    const orderWithTimestamp = { ...order, createdAt: order.createdAt || new Date().toISOString() };
    const response = await fetch(ORDERS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderWithTimestamp) });
    if (response.ok) handleOrderCreated(await response.json() as Order);
  };

  // This persists a driver status transition and updates both dashboard views.
  const handleStatusChange = async (order: Order, status: OrderStatus) => {
    const response = await fetch(`${ORDERS_URL}/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (response.ok) setOrders((current) => sortNewestFirst(current.map((candidate) => candidate.id === order.id ? { ...candidate, status } : candidate)));
  };

  // This toggles one grocery as packed and saves the updated item list.
  const handleTogglePacked = async (order: Order, itemIndex: number) => {
    const items = order.items.map((item, index) => index === itemIndex ? { ...item, packed: !item.packed } : item);
    const status: OrderStatus = 'Confirmed';
    const response = await fetch(`${ORDERS_URL}/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, status }) });
    if (response.ok) setOrders((current) => sortNewestFirst(current.map((candidate) => candidate.id === order.id ? { ...candidate, items, status } : candidate)));
  };

  // This clears the saved session only when the user explicitly signs out.
  const handleLogout = () => {
    localStorage.removeItem('greenroute-role');
    localStorage.removeItem('greenroute-email');
    setScreen('login');
  };

  // This selects the login, customer, or driver screen based on the current session role.
  return <><Header onNavigate={setScreen} />{screen === 'login' && <AuthPage onAuthenticated={setScreen} />}{screen === 'customer' && <CustomerDashboard orders={orders} onLogout={handleLogout} />}{screen === 'driver' && <DriverDashboard orders={orders} onCreateOrder={handleCreateOrder} onStatusChange={handleStatusChange} onTogglePacked={handleTogglePacked} onLogout={handleLogout} />}</>;
}
