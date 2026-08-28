# 📖 FreelanceWriting.pro - Complete Documentation

## 📑 Table of Contents

1. [Project Overview](#overview)
2. [Architecture](#architecture)
3. [API Documentation](#api)
4. [Frontend Components](#frontend)
5. [Database Schema](#database)
6. [Installation](#installation)
7. [Configuration](#configuration)
8. [Contributing](#contributing)

---

## <a name="overview"></a>📋 Project Overview

**FreelanceWriting.pro** is a full-stack marketplace platform connecting freelance writers with clients who need quality written content.

### Key Features

✅ **User Authentication** - Secure JWT-based login/registration
✅ **Project Management** - Create, bid, and manage writing projects
✅ **Payment Processing** - Secure Stripe integration with bank transfers
✅ **Real-time Messaging** - Direct communication between writers and clients
✅ **Rating System** - Build trust with reviews and ratings
✅ **Portfolio Management** - Showcase your best work
✅ **Role-Based Access** - Separate dashboards for writers and clients

---

## <a name="architecture"></a>🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18+
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- Axios (API client)
- Socket.io (real-time messaging)

**Backend:**
- Node.js + Express
- PostgreSQL (database)
- JWT (authentication)
- Stripe (payments)
- Socket.io (real-time)

### Project Structure

```
freelance-writing-platform/
├── server/
│   ├── index.js                 # Main server entry
│   ├── middleware/
│   │   └── auth.js             # Authentication & RBAC
│   ├── routes/
│   │   ├── auth.js             # Login/Register endpoints
│   │   ├── projects.js         # Project management
│   │   ├── payments.js         # Payment processing
│   │   └── messages.js         # Messaging system
│   ├── config/
│   │   └── database.js         # DB connection pool
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx            # Main app component
│   │   ├── main.jsx           # Entry point
│   │   ├── pages/             # Page components
│   │   ├── components/        # Reusable components
│   │   ├── services/          # API calls
│   │   ├── store/             # State management
│   │   └── index.css          # Global styles
│   ├── vite.config.js         # Vite configuration
│   └── package.json
├── database/
│   └── schema.sql             # Database schema
├── MARKETING_STRATEGY.md       # Marketing plan
├── DEPLOYMENT_GUIDE.md        # Deployment instructions
└── README.md
```

---

## <a name="api"></a>🔌 API Documentation

### Base URL
- **Development:** `http://localhost:5000/api`
- **Production:** `https://api.freelancewriting.pro/api`

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```bash
Authorization: Bearer <your_jwt_token>
```

### Endpoints

#### Authentication

**POST /auth/register**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "writer" // or "client"
}
```
Response:
```json
{
  "message": "✅ Registration successful",
  "user": { "id": 1, "email": "...", "role": "writer" },
  "token": "eyJhbGc..."
}
```

**POST /auth/login**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**POST /auth/refresh**
```json
{
  "token": "expired_token"
}
```

#### Projects

**GET /projects**
- Query params: `status`, `category`, `limit`, `offset`
- Returns: List of all projects

**GET /projects/:id**
- Returns: Single project details

**POST /projects** (Protected - Clients only)
```json
{
  "title": "Write Blog Post",
  "description": "Need 1000-word blog post about...",
  "budget": 100,
  "category": "blog",
  "deadline": "2025-12-31"
}
```

**POST /projects/:id/bids** (Protected - Writers only)
```json
{
  "amount": 80,
  "proposal": "I can complete this...",
  "timeline": "3 days"
}
```

#### Payments

**POST /payments/intent** (Protected)
```json
{
  "amount": 100,
  "projectId": 1,
  "description": "Payment for project"
}
```

**POST /payments/confirm** (Protected)
```json
{
  "paymentIntentId": "pi_xxx",
  "projectId": 1,
  "writerId": 5,
  "amount": 100
}
```

**POST /payments/withdraw** (Protected)
```json
{
  "amount": 100
}
```

**GET /payments/balance** (Protected)
- Returns: User's available balance

**GET /payments/history** (Protected)
- Returns: Payment history

#### Messages

**GET /messages/conversations** (Protected)
- Returns: List of conversations

**GET /messages/:conversationId** (Protected)
- Returns: Messages in conversation

**POST /messages/send** (Protected)
```json
{
  "recipientId": 5,
  "content": "Message text"
}
```

---

## <a name="frontend"></a>🎨 Frontend Components

### Pages

- **Home** - Landing page with features and CTA
- **Login** - User login form
- **Register** - User registration form
- **WriterDashboard** - Writer's main dashboard with balance and projects
- **ClientDashboard** - Client's dashboard to manage projects
- **Projects** - Browse all available projects
- **ProjectDetail** - Detailed view of a single project
- **Messages** - Messaging system
- **Settings** - User settings and preferences

### Components

- **Navbar** - Navigation bar with menu
- **FeatureCard** - Reusable feature card
- **StatCard** - Statistics display card

### State Management (Zustand)

```javascript
const { user, token, isAuthenticated, login, logout } = useAuthStore()
```

---

## <a name="database"></a>🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(20) CHECK (role IN ('writer', 'client', 'admin')),
  total_earned DECIMAL(15, 2) DEFAULT 0,
  total_spent DECIMAL(15, 2) DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,
  stripe_account_id VARCHAR(255)
)
```

### Projects Table
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  budget DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  deadline DATE
)
```

### Bids Table
```sql
CREATE TABLE bids (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  writer_id INTEGER REFERENCES users(id),
  amount DECIMAL(10, 2),
  proposal TEXT,
  status VARCHAR(20) DEFAULT 'pending'
)
```

### Payments Table
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount DECIMAL(10, 2),
  type VARCHAR(20),
  status VARCHAR(20),
  stripe_transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Messages Table
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id),
  recipient_id INTEGER REFERENCES users(id),
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---

## <a name="installation"></a>⚙️ Installation

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed setup instructions.

### Quick Start

```bash
# Clone repo
git clone https://github.com/davistyrone557-lab/freelance-writing-platform.git
cd freelance-writing-platform

# Backend setup
cd server
npm install
npm run dev

# Frontend setup (new terminal)
cd client
npm install
npm run dev
```

---

## <a name="configuration"></a>🔧 Configuration

### Environment Variables

**Server (.env)**
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your_secret_key
STRIPE_SECRET_KEY=sk_test_xxx
PORT=5000
NODE_ENV=development
```

**Client (.env)**
```bash
VITE_API_URL=http://localhost:5000/api
VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
```

---

## <a name="contributing"></a>🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 📞 Support

For issues or questions:
- GitHub Issues: [Report a bug](https://github.com/davistyrone557-lab/freelance-writing-platform/issues)
- Email: support@freelancewriting.pro

---

**Happy coding! Build something amazing! 🚀**
