/**
 * AI Router Service
 *
 * Routes requests to different AI providers:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 */

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

// Initialize clients
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Available models with their configurations
 */
const MODELS = {
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    maxTokens: 4096,
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125
  },
  'gpt-4o': {
    provider: 'openai',
    modelId: 'gpt-4o',
    maxTokens: 4096,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015
  },
  'gpt-4o-mini': {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    maxTokens: 4096,
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006
  }
};

/**
 * Send a chat message to the AI
 *
 * @param {Object} options
 * @param {string} options.model - Model name (e.g., 'claude-3-5-sonnet')
 * @param {Array} options.messages - Chat messages array
 * @param {string} options.systemPrompt - System prompt
 * @param {boolean} options.stream - Whether to stream the response
 * @returns {Promise<Object>} Response with content and usage
 */
async function chat({ model = 'claude-3-5-sonnet', messages, systemPrompt, stream = false }) {
  const modelConfig = MODELS[model];

  if (!modelConfig) {
    throw new Error(`Unknown model: ${model}`);
  }

  if (modelConfig.provider === 'anthropic') {
    return chatAnthropic({ modelConfig, messages, systemPrompt, stream });
  } else if (modelConfig.provider === 'openai') {
    return chatOpenAI({ modelConfig, messages, systemPrompt, stream });
  }

  throw new Error(`Unsupported provider: ${modelConfig.provider}`);
}

/**
 * Anthropic (Claude) chat
 */
async function chatAnthropic({ modelConfig, messages, systemPrompt, stream }) {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await anthropic.messages.create({
    model: modelConfig.modelId,
    max_tokens: modelConfig.maxTokens,
    system: systemPrompt || 'You are a helpful assistant.',
    messages: messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))
  });

  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const cost = (inputTokens / 1000 * modelConfig.inputCostPer1k) +
               (outputTokens / 1000 * modelConfig.outputCostPer1k);

  return {
    content: response.content[0]?.text || '',
    model: modelConfig.modelId,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost
    }
  };
}

/**
 * OpenAI (GPT) chat
 */
async function chatOpenAI({ modelConfig, messages, systemPrompt, stream }) {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const formattedMessages = [];

  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }

  formattedMessages.push(...messages.map(m => ({
    role: m.role,
    content: m.content
  })));

  const response = await openai.chat.completions.create({
    model: modelConfig.modelId,
    max_tokens: modelConfig.maxTokens,
    messages: formattedMessages
  });

  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = (inputTokens / 1000 * modelConfig.inputCostPer1k) +
               (outputTokens / 1000 * modelConfig.outputCostPer1k);

  return {
    content: response.choices[0]?.message?.content || '',
    model: modelConfig.modelId,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost
    }
  };
}

/**
 * Get available models
 */
function getAvailableModels() {
  const available = [];

  if (anthropic) {
    available.push('claude-3-5-sonnet', 'claude-3-haiku');
  }
  if (openai) {
    available.push('gpt-4o', 'gpt-4o-mini');
  }

  return available;
}

module.exports = {
  chat,
  getAvailableModels,
  MODELS
};
