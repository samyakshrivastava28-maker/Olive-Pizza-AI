import { Pinecone } from '@pinecone-database/pinecone';
import { env } from './env';

let _pinecone: Pinecone | null = null;

export function getPinecone(): Pinecone {
  if (_pinecone) return _pinecone;
  _pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  console.log('✅ Pinecone client initialized');
  return _pinecone;
}

export function getPineconeIndex() {
  return getPinecone().index(env.PINECONE_INDEX_NAME, env.PINECONE_INDEX_HOST);
}
