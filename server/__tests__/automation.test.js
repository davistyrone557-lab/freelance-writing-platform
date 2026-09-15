import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

let currentUser = { id: 1, role: 'client' }
let poolQueryHandler = async () => ({ rows: [] })
let transactionQueryHandler = async () => ({ rows: [] })

const mockStripe = {
  paymentIntents: { create: jest.fn() },
  refunds: { create: jest.fn() }
}

const mockDb = {
  query: jest.fn((sql, params) => transactionQueryHandler(sql, params)),
  release: jest.fn()
}

const mockPool = {
  query: jest.fn((sql, params) => poolQueryHandler(sql, params)),
  connect: jest.fn(async () => mockDb)
}

jest.unstable_mockModule('../config/database.js', () => ({
  default: mockPool
}))

jest.unstable_mockModule('../middleware/auth.js', () => ({
  verifyToken: (req, res, next) => {
    req.user = currentUser
    next()
  },
  roleCheck: () => (req, res, next) => next()
}))

jest.unstable_mockModule('../middleware/rateLimit.js', () => ({
  generalRateLimit: (req, res, next) => next()
}))

jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => mockStripe)
}))

jest.unstable_mockModule('dotenv', () => ({
  default: { config: jest.fn() }
}))

const { default: automationRouter } = await import('../routes/automation.js')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/automation', automationRouter)
  return app
}

describe('automation routes', () => {
  beforeEach(() => {
    currentUser = { id: 1, role: 'client' }
    poolQueryHandler = async () => ({ rows: [] })
    transactionQueryHandler = async () => ({ rows: [] })
    mockPool.query.mockClear()
    mockPool.connect.mockClear()
    mockDb.query.mockClear()
    mockDb.release.mockClear()
    mockStripe.paymentIntents.create.mockReset()
    mockStripe.refunds.create.mockReset()
  })

  it('auto-match creates bids with delivery_days and notifications', async () => {
    const app = buildApp()
    const insertedBids = []
    const notifications = []

    poolQueryHandler = async (sql, params) => {
      if (sql.includes('FROM projects')) {
        return {
          rows: [{
            id: 7,
            client_id: 1,
            title: 'Case study article',
            category: 'blog',
            budget: 200,
            deadline: '2099-01-20'
          }]
        }
      }

      if (sql.includes('FROM users u')) {
        return {
          rows: [
            { id: 11, first_name: 'Ava', last_name: 'Stone', rating: 4.9, total_projects_completed: 12 },
            { id: 12, first_name: 'Noah', last_name: 'Reed', rating: 4.7, total_projects_completed: 8 }
          ]
        }
      }

      if (sql.includes('INSERT INTO bids')) {
        insertedBids.push(params)
        return {
          rows: [{
            id: insertedBids.length,
            writer_id: params[1],
            amount: params[2],
            delivery_days: params[4]
          }]
        }
      }

      if (sql.includes('INSERT INTO notifications')) {
        notifications.push(params)
        return { rows: [] }
      }

      throw new Error(`Unhandled SQL: ${sql}`)
    }

    const response = await request(app)
      .post('/automation/auto-match')
      .send({ projectId: 7 })

    expect(response.status).toBe(200)
    expect(response.body.matchedWriters).toBe(2)
    expect(insertedBids).toHaveLength(2)
    expect(insertedBids[0][4]).toBeGreaterThanOrEqual(1)
    expect(notifications).toHaveLength(2)
  })

  it('auto-accept-bid accepts the best pending bid and creates a payment intent', async () => {
    const app = buildApp()
    const updates = []
    const notifications = []

    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'secret_123'
    })

    poolQueryHandler = async (sql, params) => {
      if (sql.includes('FROM projects')) {
        return {
          rows: [{
            id: 7,
            client_id: 1,
            title: 'Case study article',
            status: 'open'
          }]
        }
      }

      if (sql.includes('FROM bids b')) {
        return {
          rows: [{
            id: 3,
            writer_id: 21,
            amount: '150.00',
            rating: 4.8,
            first_name: 'Ava',
            last_name: 'Stone'
          }]
        }
      }

      if (sql.startsWith('UPDATE bids') || sql.startsWith('UPDATE projects')) {
        updates.push({ sql, params })
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO notifications')) {
        notifications.push(params)
        return { rows: [] }
      }

      throw new Error(`Unhandled SQL: ${sql}`)
    }

    const response = await request(app)
      .post('/automation/auto-accept-bid')
      .send({ projectId: 7 })

    expect(response.status).toBe(200)
    expect(response.body.paymentIntentId).toBe('pi_123')
    expect(response.body.bidId).toBe(3)
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 15000,
      currency: 'usd'
    }))
    expect(updates).toHaveLength(3)
    expect(notifications).toHaveLength(1)
  })

  it('auto-dispute-check processes a targeted overdue project and records a refund', async () => {
    const app = buildApp()

    mockStripe.refunds.create.mockResolvedValue({ id: 're_123' })

    poolQueryHandler = async (sql, params) => {
      if (sql.includes('FROM projects p')) {
        expect(params).toEqual([1, 7])
        return {
          rows: [{
            id: 7,
            client_id: 1,
            writer_id: 21,
            title: 'Late project',
            budget: 180
          }]
        }
      }

      if (sql.includes('FROM disputes')) {
        return { rows: [] }
      }

      if (sql.includes("AND type = 'refund'")) {
        return { rows: [] }
      }

      if (sql.includes("AND type IN ('payment', 'deposit')")) {
        return {
          rows: [{
            id: 50,
            amount: 180,
            stripe_transaction_id: 'pi_paid'
          }]
        }
      }

      if (sql.includes('INSERT INTO notifications')) {
        return { rows: [] }
      }

      throw new Error(`Unhandled SQL: ${sql}`)
    }

    const transactionalStatements = []
    transactionQueryHandler = async (sql, params) => {
      transactionalStatements.push({ sql, params })
      return { rows: [] }
    }

    const response = await request(app)
      .post('/automation/auto-dispute-check')
      .send({ projectId: 7 })

    expect(response.status).toBe(200)
    expect(response.body.projectsFlagged).toBe(1)
    expect(response.body.refundsProcessed).toBe(1)
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(expect.objectContaining({
      payment_intent: 'pi_paid',
      amount: 18000
    }))
    expect(mockPool.connect).toHaveBeenCalledTimes(1)
    expect(transactionalStatements.some(({ sql }) => sql === 'BEGIN')).toBe(true)
    expect(transactionalStatements.some(({ sql }) => sql.includes('INSERT INTO disputes'))).toBe(true)
    expect(transactionalStatements.some(({ sql }) => sql.includes('INSERT INTO payments'))).toBe(true)
    expect(mockDb.release).toHaveBeenCalled()
  })
})
