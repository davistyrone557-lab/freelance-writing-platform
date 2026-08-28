# 🚀 FreelanceWriting.pro - Deployment Guide

## **Complete Setup & Launch Instructions**

---

## 📋 **What You Have**

✅ **Backend API** (Node.js/Express/PostgreSQL)
✅ **Frontend** (React/Vite/Tailwind CSS)
✅ **Database Schema** (Ready to initialize)
✅ **Payment Integration** (Stripe)
✅ **Marketing Strategy** (Complete)
✅ **Authentication** (JWT-based)

---

## 🛠️ **Prerequisites**

Before starting, make sure you have:

1. **Node.js 16+** - Download from https://nodejs.org
2. **PostgreSQL** - Download from https://postgresql.org
3. **Git** - Download from https://git-scm.com
4. **Stripe Account** - Sign up at https://stripe.com (FREE)
5. **GitHub Account** - Already have this ✅

---

## 🔧 **Part 1: Local Development Setup**

### Step 1: Clone the Repository
```bash
git clone https://github.com/davistyrone557-lab/freelance-writing-platform.git
cd freelance-writing-platform
```

### Step 2: Setup PostgreSQL Database

**On macOS (Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**On Windows:** Download PostgreSQL installer from postgresql.org

**Create Database:**
```bash
psql postgres
CREATE DATABASE freelance_writing_db;
\q
```

**Initialize Schema:**
```bash
psql freelance_writing_db < database/schema.sql
```

### Step 3: Setup Backend

```bash
cd server
npm install
```

### Step 4: Configure Environment Variables

Create `.env` file in `server/` directory:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/freelance_writing_db

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_12345
JWT_EXPIRE=7d

# Stripe (Get from https://stripe.com)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### Step 5: Start Backend Server

```bash
npm run dev
```

✅ Backend running at: http://localhost:5000

### Step 6: Setup Frontend

**In a new terminal:**
```bash
cd client
npm install
```

### Step 7: Create Frontend `.env`

Create `.env` file in `client/` directory:

```bash
VITE_API_URL=http://localhost:5000/api
```

### Step 8: Start Frontend

```bash
npm run dev
```

✅ Frontend running at: http://localhost:3000

---

## 🎯 **Testing Locally**

1. Open http://localhost:3000 in your browser
2. Click "Sign Up"
3. Register as a Writer
4. Verify all features work:
   - ✅ Login/Logout
   - ✅ Dashboard
   - ✅ View projects
   - ✅ Withdraw balance

---

## 🌐 **Part 2: Deploy to Production**

### **Option A: Deploy Backend to Heroku (Recommended for FREE)**

#### Step 1: Create Heroku Account
- Go to https://heroku.com
- Sign up (FREE)
- Verify email

#### Step 2: Install Heroku CLI

**macOS:**
```bash
brew tap heroku/brew && brew install heroku
```

**Windows:**
Download from https://devcenter.heroku.com/articles/heroku-cli

#### Step 3: Login to Heroku
```bash
heroku login
```

#### Step 4: Create Heroku App
```bash
cd server
heroku create freelancewriting-api
```

#### Step 5: Add PostgreSQL Database
```bash
heroku addons:create heroku-postgresql:hobby-dev -a freelancewriting-api
```

#### Step 6: Set Environment Variables
```bash
heroku config:set JWT_SECRET=your_super_secret_jwt_key_12345 -a freelancewriting-api
heroku config:set STRIPE_SECRET_KEY=sk_test_xxx -a freelancewriting-api
heroku config:set STRIPE_PUBLIC_KEY=pk_test_xxx -a freelancewriting-api
heroku config:set NODE_ENV=production -a freelancewriting-api
```

#### Step 7: Deploy
```bash
git push heroku main
```

✅ Backend deployed to: `https://freelancewriting-api.herokuapp.com`

#### Step 8: Verify Deployment
```bash
curl https://freelancewriting-api.herokuapp.com/api/health
```

---

### **Option B: Deploy Frontend to Vercel (FREE & EASY)**

#### Step 1: Create Vercel Account
- Go to https://vercel.com
- Click "Sign Up"
- Choose "GitHub"
- Authorize Vercel

#### Step 2: Import Repository
- Click "New Project"
- Select `freelance-writing-platform`
- Click "Import"

#### Step 3: Configure Build
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

#### Step 4: Add Environment Variables
In Vercel Dashboard:
- `VITE_API_URL` = `https://freelancewriting-api.herokuapp.com/api`

#### Step 5: Deploy
- Click "Deploy"
- Wait 2-3 minutes

✅ Frontend deployed to: `https://freelancewriting-platform.vercel.app`

---

## 🌍 **Part 3: Connect Custom Domain**

### Step 1: Register Domain

1. Go to **Namecheap.com** (cheapest ~$10/year)
2. Search `freelancewriting.pro`
3. Add to cart & checkout
4. Complete payment

### Step 2: Connect to Vercel

1. In Vercel Dashboard → Settings → Domains
2. Click "Add Domain"
3. Enter `freelancewriting.pro`
4. Copy the Nameserver values:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ns3.vercel-dns.com
   ns4.vercel-dns.com
   ```

### Step 3: Update Namecheap Nameservers

1. Log into Namecheap
2. Go to "Domain List"
3. Click "Manage" for freelancewriting.pro
4. Go to "Nameservers"
5. Paste Vercel's nameservers
6. Save

✅ Wait 24-48 hours for DNS propagation

---

## 💳 **Part 4: Stripe Payment Setup**

### Step 1: Get Stripe API Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your keys:
   - **Secret Key** (sk_test_...)
   - **Publishable Key** (pk_test_...)

### Step 2: Add to Production

**For Heroku Backend:**
```bash
heroku config:set STRIPE_SECRET_KEY=sk_test_xxx -a freelancewriting-api
heroku config:set STRIPE_PUBLIC_KEY=pk_test_xxx -a freelancewriting-api
```

**For Vercel Frontend:**
Add in Vercel Environment Variables:
- `VITE_STRIPE_PUBLIC_KEY=pk_test_xxx`

---

## 📧 **Part 5: Email Configuration (Optional)**

For sending notifications:

1. Set up Gmail App Password:
   - Go to https://myaccount.google.com/security
   - Enable 2-Factor Authentication
   - Generate "App Password"

2. Add to `.env`:
   ```bash
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   ```

---

## 🔐 **Security Checklist**

Before launching:

- ✅ Change `JWT_SECRET` to a random 32-character string
- ✅ Enable HTTPS (automatic on Vercel/Heroku)
- ✅ Set `NODE_ENV=production`
- ✅ Never commit `.env` file
- ✅ Use strong database password
- ✅ Enable Stripe's webhook signing
- ✅ Set up CORS properly
- ✅ Use environment variables for all secrets

---

## 📊 **Monitoring & Logs**

### View Heroku Logs
```bash
heroku logs --tail -a freelancewriting-api
```

### View Vercel Logs
1. Vercel Dashboard → Deployments
2. Click deployment → Runtime Logs

---

## 🚀 **Launch Checklist**

- [ ] Database initialized locally
- [ ] Backend running on localhost:5000
- [ ] Frontend running on localhost:3000
- [ ] Can register & login
- [ ] Stripe test keys configured
- [ ] Backend deployed to Heroku
- [ ] Frontend deployed to Vercel
- [ ] Custom domain registered
- [ ] DNS pointed to Vercel
- [ ] Environment variables set in production
- [ ] Stripe webhooks configured
- [ ] Email notifications tested
- [ ] Marketing materials ready

---

## 🎉 **You're Live!**

Your platform is now available at:
- **Website:** freelancewriting.pro
- **API:** api.freelancewriting.pro (or heroku URL)

---

## 📞 **Next Steps**

1. **Start Marketing** (Use MARKETING_STRATEGY.md)
2. **Invite Beta Users** - Get 50-100 writers and clients
3. **Gather Feedback** - Improve based on user input
4. **Scale Gradually** - Add features based on demand
5. **Monetize** - Your 10% platform fee starts here!

---

## 🆘 **Troubleshooting**

### "Cannot connect to database"
```bash
# Check if PostgreSQL is running
psql -U postgres
```

### "Port 5000 already in use"
```bash
# Kill process using port 5000
lsof -i :5000
kill -9 <PID>
```

### "Frontend cannot reach API"
- Check `VITE_API_URL` is correct
- Check CORS settings in `server/index.js`
- Verify backend is running

### "Stripe payment not working"
- Verify API keys are correct
- Check you're using TEST keys (not live)
- Check Stripe dashboard for errors

---

## 💰 **Cost Breakdown (Monthly)**

| Service | Cost | Notes |
|---------|------|-------|
| Vercel | FREE | Frontend hosting |
| Heroku | $7-50 | Backend hosting (free tier available) |
| PostgreSQL | FREE | Heroku addon free tier |
| Domain | $10/year | ~$1/month |
| Stripe | 2.9% + $0.30 | Per transaction (payment processing) |
| **TOTAL** | **~$7-15/month** | Production-ready! |

---

## 🎓 **Learn More**

- [Express.js Documentation](https://expressjs.com)
- [React Documentation](https://react.dev)
- [PostgreSQL Documentation](https://postgresql.org/docs)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Vercel Deployment](https://vercel.com/docs)
- [Heroku Deployment](https://devcenter.heroku.com)

---

**Congratulations! You're ready to launch FreelanceWriting.pro! 🎉**
