/**
 * Chat Routes
 *
 * AI-powered chat with conversation history
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const aiRouter = require('../services/aiRouter');
const { flexibleAuth } = require('../middleware/auth');

// Simple UUID generator if uuid not installed
const generateId = () => {
  return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * POST /api/chat
 * Send a message and get AI response
 */
router.post('/', flexibleAuth, async (req, res) => {
  try {
    const { message, conversationId, model = 'claude-3-5-sonnet' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = generateId();
      await db.prepare(
        'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)'
      ).run(convId, req.userId, message.substring(0, 50));
    }

    // Get conversation history
    const history = await db.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20'
    ).all(convId);

    // Add user message to history
    const messages = [...history, { role: 'user', content: message }];

    // Save user message
    const userMsgId = generateId();
    await db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(userMsgId, convId, 'user', message);

    // Get AI response
    const response = await aiRouter.chat({
      model,
      messages,
      systemPrompt: 'You are a helpful AI assistant.'
    });

    // Save assistant message
    const assistantMsgId = generateId();
    await db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, model, tokens_used, cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      assistantMsgId,
      convId,
      'assistant',
      response.content,
      response.model,
      response.usage.totalTokens,
      response.usage.cost
    );

    res.json({
      message: response.content,
      conversationId: convId,
      model: response.model,
      usage: response.usage
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

/**
 * GET /api/chat/conversations
 * List user's conversations
 */
router.get('/conversations', flexibleAuth, async (req, res) => {
  try {
    const conversations = await db.prepare(
      'SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50'
    ).all(req.userId);

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/chat/conversations/:id
 * Get conversation with messages
 */
router.get('/conversations/:id', flexibleAuth, async (req, res) => {
  try {
    const conversation = await db.prepare(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.userId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db.prepare(
      'SELECT id, role, content, model, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(req.params.id);

    res.json({ ...conversation, messages });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * GET /api/chat/models
 * List available AI models
 */
router.get('/models', (req, res) => {
  res.json(aiRouter.getAvailableModels());
});

module.exports = router;
