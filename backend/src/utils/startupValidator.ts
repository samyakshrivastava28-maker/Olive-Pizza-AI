import { env } from '../config/env';

export function validateStartup() {
  console.log('🔍 Running Production Startup Validation...');
  
  const requiredEnvVars = [
    'ASSISTANT_NVIDIA_API_KEY',
    'PINECONE_API_KEY',
    'FIREBASE_SERVICE_ACCOUNT_BASE64',
    'TRACKING_TOKEN_SECRET'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ CRITICAL STARTUP ERROR: Missing required environment variables: ${missing.join(', ')}`);
    console.error('Server boot aborted. Please configure these variables in Render.');
    process.exit(1);
  }

  console.log('✅ Startup Validation Passed.');
}
