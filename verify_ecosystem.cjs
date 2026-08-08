const http = require('http');

const BASE_URL = 'http://127.0.0.1:3051';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      'X-Olive-Signature': 'sha256_mock_sig',
      ...headers,
    };

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        });
      },
    );

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================');
  console.log('🍕 Olive Pizza AI Multi-LLM Intelligence & Ecosystem Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`⏳ Testing: ${name}... `);
      await fn();
      console.log(`\x1b[32mPASSED\x1b[0m`);
      passed++;
    } catch (err) {
      console.log(`\x1b[31mFAILED\x1b[0m`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
  }

  // ── 1. Gateway & Health Checks ──
  console.log('\n--- 1. Gateway & Diagnostics ---');
  await test('System Health Check (/api/health)', async () => {
    const res = await request('GET', '/api/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.status === 'healthy' || res.data.status === 'degraded', 'Invalid status');
  });

  // ── 2. Multi-LLM Model Orchestrator & Provider Status ──
  console.log('\n--- 2. Multi-LLM Model Orchestrator & Registry ---');
  await test('Model Registry Status (/api/ai/models/status)', async () => {
    const res = await request('GET', '/api/ai/models/status');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.primaryProvider === 'nvidia', 'Expected NVIDIA as primary provider');
    assert(res.data.secondaryProvider === 'openrouter', 'Expected OpenRouter as secondary provider');
    assert(Array.isArray(res.data.models) && res.data.models.length >= 8, 'Expected 8+ registered models');
  });

  await test('Developer Telemetry Dashboard (/api/ai/telemetry/dashboard)', async () => {
    const res = await request('GET', '/api/ai/telemetry/dashboard');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.primaryProvider === 'nvidia', 'Dashboard missing primary provider');
    assert(res.data.providerHealth !== undefined, 'Dashboard missing provider health matrix');
  });

  // ── 3. Speech Recognition & Synthesis Hub ──
  console.log('\n--- 3. Speech Recognition & Synthesis Hub ---');
  await test('Speech-to-Text STT Gateway (/api/ai/speech/stt)', async () => {
    const res = await request('POST', '/api/ai/speech/stt', {
      audioBase64: Buffer.from('mock_audio_bytes_12345').toString('base64'),
      contentType: 'audio/wav',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.provider !== undefined, 'STT response missing provider');
  });

  await test('Speech Synthesis TTS Gateway (/api/ai/speech/tts)', async () => {
    const res = await request('POST', '/api/ai/speech/tts', {
      text: 'Welcome to Olive Pizza. Your artisan sourdough pizza is in the oven.',
      voice: 'alloy',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.format !== undefined, 'TTS response missing audio format');
  });

  // ── 4. Instant Knowledge Ingestion (Zero Restart) ──
  console.log('\n--- 4. Instant Knowledge Ingestion ---');
  await test('Instant Vector Knowledge Ingest (/api/ai/knowledge/ingest)', async () => {
    const res = await request('POST', '/api/ai/knowledge/ingest', {
      category: 'offers',
      title: 'Monsoon Artisan Slice Deal',
      content: 'Get a free Garlic Sourdough Bread with every Large Truffle Pizza during rainy days.',
      metadata: { promoCode: 'MONSOONFREE', validUntil: '2026-09-30' },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Knowledge ingestion failed');
    assert(res.data.knowledgeId !== undefined, 'Missing knowledge ID');
  });

  // ── 5. Intent-Based Routing Chat Streams (SSE) ──
  console.log('\n--- 5. Intent-Based Routing Chat Streams ---');
  await test('SSE Chat Stream - Restaurant Knowledge Intent', async () => {
    const res = await request('POST', '/api/ai/chat', {
      sessionId: 'sess_test_rag',
      messages: [{ role: 'user', content: 'What woodfired pizzas do you have on your menu?' }],
      websiteContext: { currentPage: '/menu' },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.data === 'string' && res.data.includes('data:'), 'Expected SSE stream response');
    assert(res.data.includes('telemetry') || res.data.includes('chunk') || res.data.includes('done'), 'Missing stream events');
  });

  await test('SSE Chat Stream - General Conversation Intent (Skips Vector DB)', async () => {
    const res = await request('POST', '/api/ai/chat', {
      sessionId: 'sess_test_general',
      messages: [{ role: 'user', content: 'Can you explain the difference between aerobic and anaerobic cellular respiration?' }],
      websiteContext: { currentPage: '/' },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.data === 'string' && res.data.includes('data:'), 'Expected SSE stream response');
  });

  await test('SSE Chat Stream - Product Recommendation Intent', async () => {
    const res = await request('POST', '/api/ai/chat', {
      sessionId: 'sess_test_recs',
      messages: [{ role: 'user', content: 'Can you recommend the best spicy pizza combo for tonight?' }],
      websiteContext: { currentPage: '/menu' },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.data === 'string' && res.data.includes('data:'), 'Expected SSE stream response');
  });

  await test('SSE Chat Stream - Tool Calling Intent', async () => {
    const res = await request('POST', '/api/ai/chat', {
      sessionId: 'sess_test_tools',
      messages: [{ role: 'user', content: 'Please apply coupon OLIVE50 to my order' }],
      websiteContext: { currentPage: '/cart', cartTotal: 499 },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.data === 'string' && res.data.includes('data:'), 'Expected SSE stream response');
  });

  // ── 6. Live Recommendation Engine Endpoints ──
  console.log('\n--- 6. Multi-Surface Recommendations ---');
  await test('Conversational Recommendations (/api/ai/recommendations)', async () => {
    const res = await request('POST', '/api/ai/recommendations', {
      isVeg: true,
      maxBudget: 600,
      cartItems: [{ productId: 'item-1', name: 'Classic Margherita', category: 'Pizzas', price: 499 }],
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.recommendations), 'Expected recommendations array');
  });

  await test('Homepage Recommendations (/api/ai/recommendations/homepage)', async () => {
    const res = await request('POST', '/api/ai/recommendations/homepage', {
      weather: 'rainy',
      timeOfDay: 'evening',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.trendingItems), 'Expected trendingItems');
    assert(Array.isArray(res.data.recommendedCombos), 'Expected recommendedCombos');
  });

  await test('Dashboard Recommendations (/api/ai/recommendations/dashboard)', async () => {
    const res = await request('POST', '/api/ai/recommendations/dashboard', {
      userId: 'user_olive_101',
      userRole: 'customer',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.personalFavorites), 'Expected personalFavorites');
    assert(Array.isArray(res.data.suggestedCoupons), 'Expected suggestedCoupons');
  });

  // ── 7. Agentic Tool Execution Suite (21 Actions) ──
  console.log('\n--- 7. Agentic Tool Actions (21 Full System Actions) ---');
  const toolActions = [
    { type: 'ADD_TO_CART', payload: { productId: 'item-1', size: 'large', quantity: 1 } },
    { type: 'REMOVE_FROM_CART', payload: { productId: 'item-1' } },
    { type: 'UPDATE_QUANTITY', payload: { productId: 'item-1', quantity: 2 } },
    { type: 'CLEAR_CART', payload: {} },
    { type: 'APPLY_COUPON', payload: { couponCode: 'OLIVE50' } },
    { type: 'REMOVE_COUPON', payload: { couponCode: 'OLIVE50' } },
    { type: 'CHECKOUT', payload: { step: 'payment' } },
    { type: 'REPEAT_ORDER', payload: { orderId: 'OP-98241' } },
    { type: 'NAVIGATE_PAGE', payload: { route: '/offers' } },
    { type: 'OPEN_CATEGORY', payload: { category: 'Pizzas' } },
    { type: 'OPEN_PRODUCT', payload: { productId: 'item-1' } },
    { type: 'SEARCH_MENU', payload: { query: 'truffle' } },
    { type: 'FILTER_MENU', payload: { vegOnly: true, maxPrice: 500 } },
    { type: 'TRACK_ORDER', payload: { orderId: 'OP-98241' } },
    { type: 'CANCEL_ORDER', payload: { orderId: 'OP-98241', reason: 'Change of mind' } },
    { type: 'CONTACT_SUPPORT', payload: { channel: 'whatsapp', reason: 'Delivery delayed' } },
    { type: 'CALL_RESTAURANT', payload: { branchId: 'main-kitchen' } },
    { type: 'BOOK_TABLE', payload: { date: '2026-08-05', time: '20:00', guests: 4 } },
    { type: 'RATE_ORDER', payload: { orderId: 'OP-98241', rating: 5, review: 'Superb crispy crust!' } },
    { type: 'UPDATE_DELIVERY_ADDRESS', payload: { addressLine1: 'Suite 404, Silicon Towers', city: 'Metropolis', pincode: '400001' } },
    { type: 'TRIGGER_CONFETTI', payload: { count: 50 } },
  ];

  for (const act of toolActions) {
    await test(`Tool Action: ${act.type}`, async () => {
      const res = await request('POST', '/api/ai/action', { action: act });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, `Action ${act.type} did not return success`);
      assert(res.data.action.type === act.type, `Returned action type mismatch`);
    });
  }

  // ── 8. Event-Driven Webhooks ──
  console.log('\n--- 8. Event-Driven Webhooks ---');
  const webhooks = [
    'ORDER_PLACED',
    'ORDER_STATUS_CHANGED',
    'ORDER_CANCELLED',
    'DELIVERY_LOCATION_UPDATED',
    'MENU_UPDATED',
    'PRODUCT_UPDATED',
    'CATEGORY_UPDATED',
    'COUPON_CREATED',
    'COUPON_EXPIRED',
    'USER_LOGIN',
    'USER_PROFILE_UPDATED',
    'PAYMENT_SUCCESS',
    'PAYMENT_FAILED',
  ];

  for (const ev of webhooks) {
    await test(`Webhook Event: ${ev}`, async () => {
      const res = await request('POST', '/api/ai/events', {
        eventType: ev,
        userId: 'usr_live_test',
        sessionId: 'sess_event_test',
        data: { test: true },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.status === 'acknowledged', `Webhook event ${ev} unacknowledged`);
    });
  }

  // ── 9. SDUI Designer & Google Stitch Pipeline ──
  console.log('\n--- 9. SDUI Designer & Google Stitch Pipeline ---');
  await test('SDUI Generation Preview (/api/ai/sdui/generate)', async () => {
    const res = await request('POST', '/api/ai/sdui/generate', {
      prompt: 'Promote Truffle Woodfired Sourdough Pizza Offer Banner',
      targetPage: 'homepage',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'SDUI preview generation failed');
    assert(res.data.sduiSchema !== undefined, 'Missing SDUI schema');
    assert(res.data.approvalRequired === true, 'SDUI must require approval before publishing');
  });

  // ── 10. Image Generation Gateway & Cloudinary Delegation ──
  console.log('\n--- 10. Image Generation & Cloudinary Upload Delegation ---');
  await test('Image Generation Preview (/api/ai/image/generate)', async () => {
    const res = await request('POST', '/api/ai/image/generate', {
      prompt: 'Artisan woodfired sourdough pizza with fresh basil and garlic oil',
      model: 'flux-1-dev',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Image preview generation failed');
    assert(res.data.previewUrl !== undefined, 'Missing image preview URL');
    assert(res.data.approvalRequired === true, 'Image generation must require owner approval');
  });

  // ── 11. Prompt Enhancers ──
  console.log('\n--- 11. Prompt Enhancer & Image Prompt Enhancer ---');
  await test('Text Prompt Enhancer (/api/ai/prompt/enhance)', async () => {
    const res = await request('POST', '/api/ai/prompt/enhance', {
      prompt: 'Recommend me a good vegetarian pizza combo',
      persona: 'customer',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.enhanced.includes('Olive AI'), 'Prompt enhancement missing persona');
  });

  await test('Image Prompt Enhancer (/api/ai/image-prompt/enhance)', async () => {
    const res = await request('POST', '/api/ai/image-prompt/enhance', {
      prompt: 'Spicy Garlic Chicken Pizza',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.enhanced.includes('8k resolution'), 'Image prompt enhancer missing details');
  });

  // ── 12. Specialized AI Capabilities & Dynamic Tool Registry ──
  console.log('\n--- 12. Specialized AI Capabilities & Tool Registry ---');
  await test('Promotional Email Generator (/api/ai/email/generate)', async () => {
    const res = await request('POST', '/api/ai/email/generate', {
      campaignTitle: 'Monsoon Woodfired Pizza Fest',
      targetAudience: 'VIP Customers',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.subject.includes('VIP'), 'Email AI subject error');
  });

  await test('Analytics Explanation AI (/api/ai/analytics/explain)', async () => {
    const res = await request('POST', '/api/ai/analytics/explain', {
      metrics: { totalOrders: 1500, revenue: 850000, customerRetention: 82.1 },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.insights), 'Analytics AI missing insights');
  });

  await test('Dynamic Tool Registry (/api/ai/tools/registry)', async () => {
    const res = await request('GET', '/api/ai/tools/registry');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.tools), 'Missing dynamic tool array');
  });

  await test('Cloudflare R2 Knowledge Download (/api/ai/knowledge/download)', async () => {
    const res = await request('GET', '/api/ai/knowledge/download');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Knowledge download trigger failed');
  });


  // ── Summary ──
  console.log('\n================================================================');
  console.log(`🏁 Verification Finished: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((e) => {
  console.error('Test Suite Fatal Error:', e);
  process.exit(1);
});

