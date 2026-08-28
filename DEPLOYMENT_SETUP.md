# 🚀 Content-Forge.pro Deployment Setup Guide

## **PHASE 1: BACKEND DEPLOYMENT (Node.js + Express + PostgreSQL)**

### Option A: Deploy to Railway (Recommended - Easiest)

#### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Authorize Railway to access your repository

#### Step 2: Connect Repository
1. Click "New Project" → "Deploy from GitHub repo"
2. Select `davistyrone557-lab/freelance-writing-platform`
3. Railway will auto-detect Node.js environment

#### Step 3: Set Up PostgreSQL Database
1. In Railway dashboard, click "Add Service" → "Database" → "PostgreSQL"
2. Railway creates a PostgreSQL instance automatically
3. Copy the database URL (it will be in format: `postgresql://user:pass@host:port/db`)

#### Step 4: Configure Environment Variables
In Railway dashboard, add these environment variables:

```bash
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
JWT_SECRET=your-super-secret-jwt-key-change-this
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SENDGRID_API_KEY=SG.your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@content-forge.pro
NODE_ENV=production
PORT=3000
API_URL=https://api.content-forge.pro
FRONTEND_URL=https://content-forge.pro
```

#### Step 5: Deploy
1. Push changes to GitHub main branch
2. Railway auto-deploys
3. Copy your Railway backend URL (e.g., `https://content-forge-pro-backend.railway.app`)

---

### Option B: Deploy to Heroku

#### Step 1: Install Heroku CLI
```bash
npm install -g heroku
heroku login
```

#### Step 2: Create Heroku App
```bash
heroku create content-forge-pro-api
```

#### Step 3: Add PostgreSQL
```bash
heroku addons:create heroku-postgresql:hobby-dev -a content-forge-pro-api
```

#### Step 4: Set Environment Variables
```bash
heroku config:set DATABASE_URL=postgresql://... -a content-forge-pro-api
heroku config:set JWT_SECRET=your-secret-key -a content-forge-pro-api
heroku config:set STRIPE_SECRET_KEY=sk_live_... -a content-forge-pro-api
heroku config:set SENDGRID_API_KEY=SG.... -a content-forge-pro-api
heroku config:set API_URL=https://api.content-forge.pro -a content-forge-pro-api
```

#### Step 5: Deploy
```bash
git push heroku main
```

---

## **PHASE 2: FRONTEND DEPLOYMENT (React + Vite)**

### Deploy to Vercel (Recommended - Optimal for React)

#### Step 1: Connect GitHub to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import your repository

#### Step 2: Configure Vercel Project
- **Project Name:** content-forge-pro
- **Framework:** Vite
- **Root Directory:** `./client`

#### Step 3: Set Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```bash
VITE_API_URL=https://api.content-forge.pro/api
VITE_STRIPE_PUBLIC_KEY=pk_live_your_stripe_key
```

#### Step 4: Deploy
Vercel auto-deploys on push to main branch. Your frontend will be available at `content-forge-pro.vercel.app`

---

## **PHASE 3: DOMAIN CONFIGURATION (content-forge.pro)**

### Step 1: Point Domain to Frontend (Vercel)
In GoDaddy DNS settings:

**For www subdomain:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

**For apex domain (content-forge.pro):**
```
Type: A
Name: @
Value: 76.76.19.132
TTL: 3600
```

Also add:
```
Type: ALIAS (or CNAME if ALIAS not available)
Name: @
Value: alias.vercel-dns.com
```

### Step 2: Point API Subdomain to Backend
```
Type: CNAME
Name: api
Value: [Your Railway/Heroku backend URL]
TTL: 3600
```

Example if using Railway:
```
Type: CNAME
Name: api
Value: content-forge-pro-backend.railway.app
TTL: 3600
```

### Step 3: Configure Domain in Vercel
1. Go to Vercel Dashboard → Settings → Domains
2. Add domain: `content-forge.pro`
3. Verify DNS records
4. Vercel provides SSL certificate automatically (Let's Encrypt)

### Step 4: Configure Domain in Backend
Update backend environment variables to use `https://api.content-forge.pro`

---

## **PHASE 4: DATABASE MIGRATION**

### Step 1: Connect to Production Database
```bash
# Using psql (PostgreSQL command line)
psql postgresql://[user]:[password]@[host]:[port]/[database]
```

### Step 2: Run Schema
Copy the contents of `database/schema.sql` and run in production database:

```bash
psql $DATABASE_URL < database/schema.sql
```

Or manually execute each CREATE TABLE statement.

### Step 3: Verify Tables
```sql
\dt  -- List all tables
```

---

## **PHASE 5: STRIPE SETUP**

### Step 1: Create Stripe Account
1. Go to [stripe.com](https://stripe.com)
2. Sign up for account
3. Verify email

### Step 2: Get API Keys
1. Dashboard → Developers → API Keys
2. Copy **Publishable Key** (starts with `pk_`)
3. Copy **Secret Key** (starts with `sk_`)

### Step 3: Set Up Stripe Connect
For writer payouts:
1. Dashboard → Settings → Connect Settings
2. Enable Stripe Connect
3. Configure payout settings

### Step 4: Create Webhook Endpoint
1. Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.content-forge.pro/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy webhook secret (starts with `whsec_`)

### Step 5: Add Keys to Backend Environment
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLIC_KEY=pk_live_...
```

---

## **PHASE 6: EMAIL SERVICE SETUP**

### Using SendGrid (Recommended)

#### Step 1: Create SendGrid Account
1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up
3. Verify email

#### Step 2: Generate API Key
1. Dashboard → Settings → API Keys
2. Create new API Key
3. Name it "Content-Forge-Pro"
4. Copy key (starts with `SG.`)

#### Step 3: Configure Email
1. Settings → Sender Authentication
2. Verify your domain: `content-forge.pro`
3. Add MX records in GoDaddy DNS

#### Step 4: Add to Backend
```
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@content-forge.pro
```

---

## **PHASE 7: SSL/TLS CERTIFICATE**

### Vercel (Frontend)
- ✅ Automatic SSL via Let's Encrypt
- No action needed

### Railway/Heroku (Backend)
- ✅ Automatic SSL included
- No action needed

### Custom Domain
- ✅ Automatic with Vercel integration

---

## **PHASE 8: AUTOMATED BACKUPS**

### PostgreSQL Backups on Railway
1. Railway → Database → Backups
2. Enable automatic backups (Daily)
3. Retention: 30 days

### Manual Backup
```bash
pg_dump $DATABASE_URL > backup.sql
```

---

## **PHASE 9: MONITORING & LOGGING**

### Set Up Error Tracking (Sentry)

#### Step 1: Create Sentry Account
1. Go to [sentry.io](https://sentry.io)
2. Sign up
3. Create project: Node.js

#### Step 2: Get DSN
1. Copy Sentry DSN (looks like `https://xxx@xxx.ingest.sentry.io/xxx`)
2. Add to backend environment: `SENTRY_DSN=...`

#### Step 3: Initialize in Backend
Already included in server setup if Sentry package is added.

### View Logs
- Railway: Dashboard → Logs tab
- Vercel: Analytics → Functions → Logs

---

## **PHASE 10: LAUNCH CHECKLIST**

- [ ] Backend deployed to Railway/Heroku
- [ ] Frontend deployed to Vercel
- [ ] Domain `content-forge.pro` configured
- [ ] API subdomain `api.content-forge.pro` working
- [ ] Database migrated and populated
- [ ] Stripe keys configured
- [ ] SendGrid email configured
- [ ] SSL certificates active
- [ ] Environment variables set in all services
- [ ] Webhooks configured
- [ ] Backups enabled
- [ ] Error tracking enabled
- [ ] Test login flow works
- [ ] Test payment flow works
- [ ] Test email notifications work
- [ ] Performance monitoring active

---

## **TESTING YOUR DEPLOYMENT**

### Test Frontend
```bash
curl https://content-forge.pro
# Should return HTML
```

### Test Backend
```bash
curl https://api.content-forge.pro/api/health
# Should return status
```

### Test Database
```bash
curl https://api.content-forge.pro/api/projects
# Should return projects list
```

### Test Email
Register new account → Check inbox for verification email

### Test Payments
Use Stripe test card: `4242 4242 4242 4242`

---

## **TROUBLESHOOTING**

### Backend not responding
- Check Railway/Heroku logs
- Verify DATABASE_URL is correct
- Check environment variables are set
- Ensure port 3000 is open

### Frontend shows blank page
- Check Vercel build logs
- Verify VITE_API_URL is correct
- Check browser console for errors
- Clear cache and rebuild

### Database connection fails
- Verify DATABASE_URL format
- Check PostgreSQL is running
- Ensure IP is whitelisted
- Test connection locally

### Emails not sending
- Verify SendGrid API key
- Check from email is verified
- Review SendGrid logs
- Check spam folder

### SSL certificate issues
- Wait 24-48 hours for DNS propagation
- Verify DNS records in GoDaddy
- Use SSL checker: https://www.sslshopper.com/ssl-checker.html

---

## **NEXT STEPS AFTER LAUNCH**

1. ✅ Enable GitHub Actions CI/CD
2. ✅ Set up automated tests
3. ✅ Configure database backups
4. ✅ Monitor performance
5. ✅ Scale infrastructure as needed
6. ✅ Add team members
7. ✅ Enable two-factor authentication
8. ✅ Set up security scanning

---

**Your Content-Forge.pro platform is ready for production! 🎉**
