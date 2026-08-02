import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { routeToLLM, classifyIntent } from './src/services/llm/modelRouter';
import { hybridRetrieve } from './src/services/retrieval/hybridRetriever';
import { generateEmbedding } from './src/services/embeddings/embeddingPipeline';
import { buildSystemPrompt } from './src/services/llm/promptBuilder';
import { runCatalogGuard, isRestaurantQuery, buildKnowledgeUnavailableResponse } from './src/services/guard/catalogGuard';

async function testQuery(query: string, description: string) {
  console.log(`\n======================================================`);
  console.log(`🧪 TEST: ${description}`);
  console.log(`📝 Query: "${query}"`);
  console.log(`======================================================`);

  try {
    const isRestaurant = isRestaurantQuery(query);
    console.log(`🔍 Intent Classifier -> isRestaurantQuery: ${isRestaurant}`);

    let retrievedContext = '';
    if (isRestaurant) {
      console.log('🔄 Fetching embedding & hybrid retrieval...');
      const embedRes = await generateEmbedding(query).catch(() => ({ vector: [] }));
      const context = await hybridRetrieve(query, embedRes.vector);
      retrievedContext = context.assembledPrompt;
      console.log(`✅ Retrieved Context Chunks: ${context.chunks.length} from Pinecone, ${context.firestoreFacts.length} from Firestore`);
      
      if (context.chunks.length === 0 && context.firestoreFacts.length === 0 && !retrievedContext.includes('LIVE OLIVE PIZZA VERIFIED MENU')) {
        console.log(`⚠️ KNOWLEDGE LOCK TRIGGERED: No data retrieved!`);
        console.log(`🤖 Output: ${buildKnowledgeUnavailableResponse(query)}`);
        return;
      }
    } else {
      console.log('⏩ Skipping retrieval (General Knowledge Query)');
      retrievedContext = '=== GENERAL ASSISTANCE MODE ===';
    }

    const sysPrompt = buildSystemPrompt(retrievedContext, {});
    const messages = [{ role: 'user', content: query, timestamp: Date.now() }];
    
    console.log('🤖 Generating LLM Response...');
    const stream = routeToLLM(sysPrompt, messages as any, {}, false, () => {});
    
    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
    }
    console.log(`\n💬 RAW LLM RESPONSE:\n${fullResponse}\n`);

    if (isRestaurant) {
      console.log('🛡️ Running CatalogGuard...');
      const guardResult = await runCatalogGuard(fullResponse, true);
      console.log(`🛡️ Guard Status: ${guardResult.status}`);
      if (guardResult.flaggedItems.length > 0) {
        console.log(`🚩 Flagged Hallucinations:`, guardResult.flaggedItems);
      }
      console.log(`✅ Verified Product IDs:`, guardResult.verifiedProductIds);
      console.log(`\n🧹 SANITIZED FINAL RESPONSE:\n${guardResult.sanitizedText}`);
    }

  } catch (err: any) {
    console.error('❌ Test failed with error:', err.message);
  }
}

async function runVerificationSuite() {
  console.log('🚀 Starting Zero Hallucination Verification Suite');
  
  await testQuery("Show me your pizzas", "Live Menu Grounding");
  await testQuery("Do you have Pepperoni Pizza?", "Non-Veg Rejection Guard");
  await testQuery("What is your refund policy?", "Policy Retrieval Grounding");
  await testQuery("Who invented calculus?", "General Knowledge Fallback");
  
  console.log('\n✅ Suite complete.');
  process.exit(0);
}

runVerificationSuite();
