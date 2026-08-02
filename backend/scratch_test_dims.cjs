const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function testDims(model) {
  try {
    const response = await axios.post(
      'https://integrate.api.nvidia.com/v1/embeddings',
      { input: ['Hello world'], model, encoding_format: 'float', input_type: 'query' },
      { headers: { Authorization: `Bearer ${process.env.ASSISTANT_NVIDIA_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    console.log(`${model}: ${response.data.data[0].embedding.length} dims`);
  } catch (err) {
    console.log(`${model}: failed - ${err.message}`);
  }
}

async function testGemini() {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.ASSISTANT_GEMINI_API_KEY}`,
      { model: 'models/text-embedding-004', content: { parts: [{ text: 'Hello' }] } }
    );
    console.log(`gemini 004: ${response.data.embedding.values.length} dims`);
  } catch (err) {
    console.log(`gemini: failed - ${err.message}`);
  }
}

async function run() {
  await testDims('nvidia/nv-embedcode-7b-v1');
  await testDims('nvidia/nv-embed-v1');
  await testDims('nvidia/nemotron-embed-1b');
  await testDims('nvidia/llama-nemotron-embed-vl-1b');
  await testDims('snowflake/snowflake-arctic-embed-l');
  await testDims('baai/bge-m3');
  await testGemini();
}

run();
