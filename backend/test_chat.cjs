const http = require('http');

const data = JSON.stringify({
  messages: [
    { role: 'user', content: 'What pizzas do you have?' }
  ],
  sessionId: 'test-session-integration-001',
  websiteContext: {
    currentPage: '/menu',
    cartItems: [],
    language: 'en'
  }
});

const req = http.request('http://localhost:3051/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log('CHUNK >>>', chunk);
  });
  res.on('end', () => {
    console.log('--- STREAM FINISHED ---');
  });
});

req.on('error', (e) => {
  console.error('ERROR:', e.message);
});

req.write(data);
req.end();
