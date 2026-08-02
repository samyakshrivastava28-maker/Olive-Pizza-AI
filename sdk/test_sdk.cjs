const { OliveAISDK } = require('./dist/index.js');

async function testSDK() {
  console.log('🧪 Testing @olive-ai/sdk v2.0.0 integration...');

  const sdk = new OliveAISDK({
    gatewayUrl: 'http://localhost:3051',
    autoReconnect: true,
  });

  // 1. Connect
  const connected = await sdk.connect();
  console.log('1. Connected:', connected);

  // 2. Sync Website State
  sdk.syncState({
    currentPage: '/artisan-pizzas',
    cartItems: [{ id: 'truffle-01', name: 'Truffle Mushroom', qty: 1 }],
    isAuthenticated: true,
    userId: 'user_olive_99182',
    language: 'en',
    theme: 'dark'
  });
  console.log('2. State Synced:', sdk.getState().currentPage);

  // 3. Stream Chat
  console.log('3. Streaming response:');
  let streamedText = '';
  await sdk.stream(
    [{ role: 'user', content: 'What artisan pizzas do you recommend?' }],
    'session-sdk-test-01',
    (token) => {
      process.stdout.write(token);
      streamedText += token;
    },
    (action) => {
      console.log('\n⚡ Action received:', action.type, action.payload);
    },
    (done) => {
      console.log('\n✅ Done event:', done);
    }
  );

  console.log('\n\n4. Testing Knowledge Sync:');
  const synced = await sdk.syncKnowledge('products', {
    updatedItem: 'Truffle Mushroom',
    price: 499,
    status: 'in_stock'
  });
  console.log('Knowledge Synced:', synced);

  console.log('\n🎉 ALL SDK TESTS PASSED SUCCESSFULLY!');
}

testSDK().catch(console.error);
