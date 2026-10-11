# IRCTC Next-Gen Railway Reservation & High-Concurrency PRS Engine

A production-grade, full-stack Indian Railways Reservation System (PRS) and Tatkal ticketing platform built with **Node.js**, **Express**, **Redis**, **BullMQ**, **MongoDB**, and **React 19** with **Tailwind CSS**.

Architected for extreme concurrency, high-throughput Tatkal booking bursts, atomic seat allocation, automated waitlist promotions, and zero-drift timezone scheduling.

---

## 🏛️ System Architecture

```
                             ┌────────────────────────┐
                             │  React 19 Frontend UI  │
                             │ (Vite + Tailwind CSS)  │
                             └───────────┬────────────┘
                                         │ HTTP / REST
                                         ▼
                             ┌────────────────────────┐
                             │  Express.js API Layer  │
                             │ (Auth, Booking, Admin) │
                             └─────┬────────────┬─────┘
                                   │            │
                 Enqueues Job      │            │ Redis Lua Script
                 (Priority: TQ=1)  │            │ (Atomic Tier Drain)
                                   ▼            ▼
                   ┌───────────────────┐    ┌─────────────────────┐
                   │  BullMQ Queue     │    │  Redis In-Memory    │
                   │  - bookingQueue   │    │  - Seat Inventory   │
                   │  - refundQueue    │    │  - Seat Hold Locks  │
                   │  - chartQueue     │    │  - 6-Digit OTP TTL  │
                   └─────────┬─────────┘    └─────────────────────┘
                             │
                             ▼ Workers
                   ┌───────────────────┐
                   │  Worker Services  │
                   │  - bookingWorker  │
                   │  - refundWorker   │
                   │  - chartWorker    │
                   └─────────┬─────────┘
                             │ Read / Write / Snapshot Tx
                             ▼
                   ┌───────────────────┐
                   │ MongoDB Database  │
                   │  - Users, Trains  │
                   │  - Coaches, Seats │
                   │  - Bookings (PNR) │
                   └───────────────────┘
```

---

## 🌟 Core Features & Modules Implemented

### 1. High-Concurrency Inventory Engine (Redis + Lua)
- **Timezone-Safe Normalization ([`src/utils/keyGenerator.js`](src/utils/keyGenerator.js))**:
  - Normalizes dates to strict `Asia/Kolkata` (`YYYY-MM-DD`) format using `Intl.DateTimeFormat`.
  - Completely eliminates UTC offset drift where midnight IST rolled back to the previous calendar day.
  - Automatically calculates 48-hour post-journey TTLs (`calculateInventoryTTL`) to prevent RAM exhaustion and stale Redis hashes.
- **Cascading Atomic Reservation Script (`RESERVE_SEATS_LUA` in [`src/services/inventoryService.js`](src/services/inventoryService.js))**:
  - Executes as a single atomic Redis transaction, preventing race conditions and overselling.
  - Validates total pool capacity (`available + rac + wl >= requested`).
  - Sequentially drains inventory: **Confirmed (CNF)** ➔ **RAC** (with starting sequence number) ➔ **Waitlist (WL)** (with starting waitlist number).
  - Eliminates stranded-berth bugs by dynamically splitting multi-passenger bookings across tiers.
- **Compensating Rollback (`ROLLBACK_RESERVATION_LUA`)**:
  - Atomically restores seats back to their exact Redis pools if downstream database writes fail.
- **Physical MongoDB Parity ([`initializeInventory`](src/services/inventoryService.js#L112))**:
  - Dynamically synchronizes Redis inventory counters with physical `Seat` documents in MongoDB.

---

### 2. BullMQ Booking Pipeline & Workers
- **Prioritized Queuing ([`src/queue/bookingQueue.js`](src/queue/bookingQueue.js), [`src/controller/bookingController.js`](src/controller/bookingController.js))**:
  - Tatkal (`TQ`) requests receive high-priority execution (`priority: 1`), while General (`GN`) receives normal priority (`priority: 5`).
  - Pre-check validation across train active state, quotas, passenger limits, and seat capacity.
  - Retention policies keep completed jobs available for client polling (`removeOnComplete: { age: 3600, count: 1000 }`).
- **Booking Consumer ([`src/worker/bookingWorker.js`](src/worker/bookingWorker.js))**:
  - Unpacks the cascading Lua allocation plan.
  - Queries physical MongoDB `Seat` documents for `CNF` passengers and updates their status to `BOOKED`.
  - Assigns dynamic sequence numbers (`RAC <num>`, `WL <num>`) to overflow passengers.
  - Generates unique 10-digit PNRs and creates comprehensive `Booking` documents.
  - Implements automatic compensation rollbacks on MongoDB errors.

---

### 3. Ticket Cancellation & Realtime Berth Promotion Engine
- **Official IRCTC Cancellation Rules ([`src/services/cancellationService.js`](src/services/cancellationService.js))**:
  - Flat clerkage fee of ₹60 for RAC and Waitlisted tickets.
  - Time-based tiered deductions for Confirmed tickets:
    - `> 48 hours`: Flat class-based fee (1A: ₹240, 2A: ₹200, 3A: ₹180, SL: ₹120, etc.).
    - `12 – 48 hours`: 25% of base fare.
    - `4 – 12 hours`: 50% of base fare.
    - `< 4 hours`: No refund for confirmed tickets (or post-chart preparation).
    - `< 30 mins`: Cancellation window closes for RAC/Waitlist tickets.
- **Atomic Promotion Queue**:
  - MongoDB snapshot transactions release booked seats back to `AVAILABLE`.
  - Promotes highest-priority RAC passenger to `CNF` with berth allocation.
  - Promotes highest-priority Waitlisted passenger to `RAC`.
  - Re-indexes the queue and emits `pnr:updated` events via an internal event emitter.

---

### 4. Payment Webhook Reconciliation & Auto-Refund Worker
- **Payment Webhooks ([`src/routes/webhookRoutes.js`](src/routes/webhookRoutes.js))**:
  - Handles `/api/webhooks/payment` from payment gateways.
  - Verifies if the temporary Redis hold lock (`seat:{trainId}:lock:{userId}`) is still active.
  - **On-Time Payment**: Confirms booking in database and removes the hold lock.
  - **Expired/Late Payment**: Seat hold lock already expired; automatically enqueues a refund job to `refundQueue`.
- **Auto-Refund Worker ([`src/worker/refundWorker.js`](src/worker/refundWorker.js))**:
  - Processes jobs from `refundQueue` with exponential backoff and retries.
  - Communicates with payment gateway refund endpoints and records audit trails.

---

### 5. Chart Preparation & Auto-Reallocation Worker
- **Chart Preparation Worker ([`src/worker/chartWorker.js`](src/worker/chartWorker.js))**:
  - Reallocates unutilized quota inventory (Tatkal, Ladies, Senior Citizen) into the General pool using atomic Lua scripts (`REALLOCATE_QUOTAS_LUA`).
  - Upgrades remaining RAC/WL passengers to vacant berths.
  - Automatically cancels all stranded waitlisted tickets post-charting and dispatches automated refund jobs via `refundQueue`.

---

### 6. Dynamic Real-Time Seat Map API & UI
- **Backend API (`GET /api/inventory/seats` in [`src/controller/inventoryController.js`](src/controller/inventoryController.js))**:
  - Accepts `train`, `date`, and `coach` parameters.
  - Queries physical `Seat` documents for the coach and overlays real-time active `Booking` documents.
  - Returns live statuses (`AVAILABLE`, `BOOKED`, `RAC`), seat labels (`LB`, `MB`, `UB`, `SL`, `SU`), and station-by-station journey legs.
- **Frontend Reactive Seat Map ([`client/src/components/CoachLayout.jsx`](client/src/components/CoachLayout.jsx))**:
  - Reactive `useEffect` automatically queries live seat inventory on train, date, or coach changes.
  - Interactive coach tabs (`B1`, `B2`, `A1`, `S1`), date picker, and real-time occupancy counts.
  - Interactive seat inspector drawer ([`TimelineDrawer.jsx`](client/src/components/TimelineDrawer.jsx)).

---

### 7. Modern React 19 Frontend Portal
- **Train Search & Results ([`SearchWidget.jsx`](client/src/components/SearchWidget.jsx), [`TrainResultsView.jsx`](client/src/components/TrainResultsView.jsx), [`TrainCard.jsx`](client/src/components/TrainCard.jsx))**:
  - Auto-suggest station selectors with 180° station swap animation.
  - Quota selectors (**General**, **Tatkal**, **Premium Tatkal**, **Ladies**, **Senior Citizen**, **Divyangjan**).
  - Train cards with official schedules, pantry badges, and color-coded availability tiles.
  - Seamless context passing into the booking flow.
- **Passenger Details ([`PassengerForm.jsx`](client/src/components/PassengerForm.jsx))**:
  - Multi-passenger roster respecting quota caps (4 for Tatkal, 6 for General).
  - Berth preferences, travel insurance, and sticky dynamic fare calculator.
- **Interactive Payment Gateway ([`PaymentGateway.jsx`](client/src/components/PaymentGateway.jsx))**:
  - Indian payment modes: UPI / QR Code with countdown beam, Net Banking, Credit/Debit Cards, IRCTC e-Wallet.
  - 2FA OTP verification simulation with backend booking synchronization.
- **Electronic Reservation Slip (ERS) & Cancellation ([`PNRConfirmation.jsx`](client/src/components/PNRConfirmation.jsx))**:
  - Realistic 10-digit PNR display, barcode badge, printable `@media print` layout.
  - In-place ticket cancellation modal with passenger selection and real-time status update to `CAN`.
- **Authentication & User Profile ([`LoginPage.jsx`](client/src/components/LoginPage.jsx), [`RegisterPage.jsx`](client/src/components/RegisterPage.jsx))**:
  - Canvas CAPTCHA generation, password/OTP login modes, master passenger list management.

---

## 📂 Project Directory Structure

```
PROJ-IRCTC/
├── client/                               # React 19 Frontend
│   ├── src/
│   │   ├── components/                   # UI Views & Components
│   │   │   ├── CoachLayout.jsx           # Dynamic Real-Time Seat Map
│   │   │   ├── CoachRow.jsx              # Seat Layout Row
│   │   │   ├── Seat.jsx                  # Individual Berth Button
│   │   │   ├── TimelineDrawer.jsx        # Journey Leg Timeline
│   │   │   ├── SearchWidget.jsx          # Train Search Form
│   │   │   ├── TrainCard.jsx             # Train Result Card
│   │   │   ├── TrainResultsView.jsx      # Results View & Filters
│   │   │   ├── PassengerForm.jsx         # Passenger Entry & Fare Card
│   │   │   ├── PaymentGateway.jsx        # Checkout & 2FA Modal
│   │   │   ├── PNRConfirmation.jsx       # ERS Ticket Slip & Cancellation
│   │   │   ├── PNRStatusView.jsx         # PNR Search & History
│   │   │   ├── LoginPage.jsx             # Auth & Captcha
│   │   │   ├── RegisterPage.jsx          # User Registration & OTP
│   │   │   ├── Header.jsx / Footer.jsx   # Portal Shell
│   │   │   └── NoticeBar.jsx             # Tatkal Advisories Marquee
│   │   ├── context/
│   │   │   └── BookingContext.jsx        # Centralized State Management
│   │   └── App.jsx                       # Main App & Router
│   ├── package.json
│   └── vite.config.js
│
├── src/                                  # Node.js Backend
│   ├── config/
│   │   ├── db.js                         # MongoDB Connection
│   │   ├── redis.js                      # Redis Client (ioredis)
│   │   └── redisClient.js                # BullMQ Redis Configuration
│   ├── controller/
│   │   ├── authController.js             # User Auth & Master List
│   │   ├── bookingController.js          # Booking & PNR Handlers
│   │   ├── cancellationController.js     # Ticket Cancellation
│   │   ├── inventoryController.js        # Dynamic Seat Map API
│   │   └── trainController.js            # Train Search & Details
│   ├── middleware/
│   │   └── authMiddleware.js             # JWT & Optional Auth Guards
│   ├── models/
│   │   ├── booking.js                    # Booking Schema (PNR)
│   │   ├── coach.js                      # Coach Schema
│   │   ├── seat.js                       # Physical Seat Schema
│   │   ├── station.js                    # Station Schema
│   │   ├── train.js                      # Train & Route Schema
│   │   └── userdata.js                   # User Schema
│   ├── queue/
│   │   ├── bookingQueue.js               # BullMQ Booking Queue
│   │   ├── chartQueue.js                 # BullMQ Charting Queue
│   │   └── refundQueue.js                # BullMQ Auto-Refund Queue
│   ├── routes/
│   │   ├── authroutes.js                 # /api/auth routes
│   │   ├── bookingRoutes.js              # /api/bookings routes
│   │   ├── cancellationRoutes.js         # /api/tickets/cancel routes
│   │   ├── inventoryRoutes.js            # /api/inventory routes
│   │   ├── stationRoutes.js              # /api/stations routes
│   │   ├── trainRoutes.js                # /api/trains routes
│   │   └── webhookRoutes.js              # /api/webhooks/payment routes
│   ├── services/
│   │   ├── cancellationService.js        # Rules & Queue Promotion Engine
│   │   └── inventoryService.js           # Cascading Lua & Redis Logic
│   ├── utils/
│   │   └── keyGenerator.js               # Timezone-Safe Key & TTL Utility
│   ├── worker/
│   │   ├── bookingWorker.js              # BullMQ Booking Processor
│   │   ├── chartWorker.js                # Chart Preparation Processor
│   │   └── refundWorker.js               # BullMQ Auto-Refund Processor
│   └── app.js                            # Express Application Setup
│
├── server.js                             # HTTP Server Entrypoint
├── ecosystem.config.js                   # PM2 Cluster Configuration
└── package.json                          # Backend Dependencies & Scripts
```

---

## 🔌 API Reference Summary

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user & generate 6-digit Redis OTP |
| `POST` | `/api/auth/verify-OTP` | Verify OTP, save user to MongoDB & return JWT |
| `POST` | `/api/auth/login` | Login with username/password or phone |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET`  | `/api/auth/me` | Fetch active profile & master passenger list |

### Booking Pipeline (`/api/bookings`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bookings` | Queue high-concurrency booking request in BullMQ |
| `POST` | `/api/bookings/confirm` | Persist completed booking & generate PNR |
| `GET`  | `/api/bookings/job/:jobId` | Poll BullMQ job status and result |
| `GET`  | `/api/bookings/pnr/:pnr` | Retrieve booking details by 10-digit PNR |

### Inventory & Dynamic Seat Map (`/api/inventory`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/inventory/seats` | Query real-time physical seat occupancy (`?train=&date=&coach=`) |

### Ticket Cancellation (`/api/tickets`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tickets/cancel` | Cancel selected passengers, promote RAC/WL, calculate refund |

### Payment Webhook & Reconciliation (`/api/webhooks`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhooks/payment` | Reconcile payment with Redis hold lock or trigger auto-refund |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: v6.0+ (Replica Set recommended for multi-document snapshot transactions)
- **Redis**: v6.2+ (Local or cloud Redis instance)

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URL=mongodb://localhost:27017
MONGO_DATABASE=irctc_db

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=super_secret_jwt_key_irctc_2026

# Concurrency & Worker
BOOKING_WORKER_CONCURRENCY=10
CHART_WORKER_CONCURRENCY=2
REFUND_WORKER_CONCURRENCY=5
```

### 3. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
npm --prefix client install
```

### 4. Running the Application

#### Development Mode:
```bash
# Start backend API server
npm run server

# Start frontend development server (in another terminal)
npm run client

# Start BullMQ booking worker (in another terminal)
node src/worker/bookingWorker.js
```

#### Production Mode (PM2):
```bash
# Build frontend bundle
npm run build:client

# Launch all backend services & workers with PM2
pm2 start ecosystem.config.js
```

The frontend will run at `http://localhost:5173` and the backend at `http://localhost:5000`.

---

## 🛡️ Reliability & Concurrency Guarantees

1. **Zero Overbooking**: Redis single-threaded Lua script atomically decrements seat counters before jobs reach database workers.
2. **Cascading Pool Allocation**: Multi-passenger requests automatically fill available Confirmed berths before overflowing into RAC or Waitlist.
3. **Compensating Transactions**: If MongoDB persistence fails, `rollbackReservation` immediately restores the deducted Redis counters.
4. **Timezone Drift Protection**: Strict `Asia/Kolkata` date normalization ensures workers, searches, and inventory keys stay synchronized across midnight boundaries.
5. **Memory Leak Prevention**: All Redis inventory keys are provisioned with an automated 48-hour post-journey TTL.
