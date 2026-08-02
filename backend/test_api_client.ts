import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { mainBackendClient } from './src/services/integration/mainBackendClient';

async function run() {
  console.log('Testing mainBackendClient without token...');
  const menu = await mainBackendClient.getLiveMenu('');
  console.log('Menu fetched:', menu ? 'Success' : 'Failed');
}

run();
