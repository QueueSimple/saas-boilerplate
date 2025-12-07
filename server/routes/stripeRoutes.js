/**
 * Stripe Payment Routes
 *
 * Handles subscriptions, checkout, and webhooks
 */

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const db = require('../db/database');
const { flexibleAuth } = require('../middleware/auth');

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Pricing configuration
const PLANS = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER,
    price: 29,
    features: ['1,000 AI messages/month', 'Email support']
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO,
    price: 99,
    features: ['10,000 AI messages/month', 'Priority support', 'API access']
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
    price: 299,
    features: ['Unlimited AI messages', '24/7 support', 'Custom integrations']
  }
};

/**
 * GET /api/stripe/plans
 * List available subscription plans
 */
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

/**
 * POST /api/stripe/create-checkout
 * Create a Stripe Checkout session
 */
router.post('/create-checkout', flexibleAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { plan } = req.body;
    const planConfig = PLANS[plan];

    if (!planConfig || !planConfig.priceId) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Get or create Stripe customer
    const user = await db.prepare(
      'SELECT email, stripe_customer_id FROM users WHERE id = ?'
    ).get(req.userId);

    let customerId = user?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        metadata: { userId: req.userId }
      });
      customerId = customer.id;

      await db.prepare(
        'UPDATE users SET stripe_customer_id = ? WHERE id = ?'
      ).run(customerId, req.userId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: planConfig.priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        userId: req.userId,
        plan
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/stripe/create-portal
 * Create a Stripe Customer Portal session
 */
router.post('/create-portal', flexibleAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const user = await db.prepare(
      'SELECT stripe_customer_id FROM users WHERE id = ?'
    ).get(req.userId);

    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhooks
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        await db.prepare(
          'UPDATE users SET plan = ? WHERE id = ?'
        ).run(plan, userId);

        await db.prepare(
          'INSERT INTO subscriptions (id, user_id, stripe_subscription_id, plan, status) VALUES (?, ?, ?, ?, ?)'
        ).run(
          'sub_' + Date.now(),
          userId,
          session.subscription,
          plan,
          'active'
        );
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const status = subscription.status;

      await db.prepare(
        'UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?'
      ).run(status, subscription.id);
      break;
    }
  }

  res.json({ received: true });
});

module.exports = router;
