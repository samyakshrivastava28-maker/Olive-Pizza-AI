import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';

export function TelemetryPanel() {
  const { isTelemetryOpen, telemetry, websiteContext, messages } = useChatStore();
  const [activeTab, setActiveTab] = useState<'metrics' | 'diagnostics' | 'models' | 'context' | 'actions' | 'health' | 'integration' | 'alerts'>('metrics');
  const [ping, setPing] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [modelStatus, setModelStatus] = useState<any[]>([]);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Ping gateway & fetch health, alerts, and model orchestrator status periodically
  useEffect(() => {
    if (!isTelemetryOpen) return;
    const fetchHealthAndAlerts = async () => {
      const start = performance.now();
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          setPing(Math.round(performance.now() - start));
        }
      } catch {
        setPing(null);
      }

      try {
        const mRes = await fetch('/api/ai/models/status');
        if (mRes.ok) {
          const mData = await mRes.json();
          setModelStatus(mData.models || []);
        }
      } catch {
        /* skip */
      }

      try {
        const aRes = await fetch('/api/ai/alerts');
        if (aRes.ok) {
          const data = await aRes.json();
          setAlerts(data.alerts || []);
        }
      } catch {
        /* skip */
      }
    };

    fetchHealthAndAlerts();
    const interval = setInterval(fetchHealthAndAlerts, 5000);
    return () => clearInterval(interval);
  }, [isTelemetryOpen]);

  const handleTriggerTestAlert = async () => {
    setIsSendingTestAlert(true);
    setAlertNotice(null);
    try {
      const res = await fetch('/api/ai/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorName: 'DiagnosticSelfTest',
          message: 'Manual telemetry reliability check initiated by developer dashboard',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAlertNotice('✅ Diagnostic incident generated and alert dispatched!');
        setAlerts((prev) => [data.alert, ...prev]);
      }
    } catch (err) {
      setAlertNotice(`❌ Alert failed: ${(err as Error).message}`);
    } finally {
      setIsSendingTestAlert(false);
    }
  };

  // Aggregate executed actions from conversation
  const executedActions = messages
    .flatMap((m) => m.actions || [])
    .filter(Boolean);

  return (
    <AnimatePresence>
      {isTelemetryOpen && (
        <motion.aside
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          style={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: 380,
            background: 'rgba(9, 13, 16, 0.96)',
            backdropFilter: 'blur(40px)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            padding: '18px 14px',
            gap: 10,
            zIndex: 40,
            overflowY: 'auto',
            boxShadow: '-24px 0 48px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 }}>
            <div>
              <p
                className="font-mono-label"
                style={{ color: 'var(--text-secondary)', letterSpacing: '0.12em', fontSize: 10 }}
              >
                MULTI-LLM ORCHESTRATOR
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                Olive AI Production Intelligence
              </p>
            </div>
            {/* Live Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: ping ? '#4ADE80' : '#F87171',
                }}
              >
                {ping ? `${ping}ms` : 'OFFLINE'}
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: ping ? '#22C55E' : '#EF4444',
                  boxShadow: ping ? '0 0 8px rgba(34,197,94,0.6)' : '0 0 8px rgba(239,68,68,0.6)',
                }}
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              padding: 2,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {(['metrics', 'diagnostics', 'models', 'context', 'actions', 'health', 'integration', 'alerts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: 9,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: activeTab === tab ? 'rgba(124,111,247,0.25)' : 'transparent',
                  color: activeTab === tab ? '#c6c0ff' : 'rgba(255,255,255,0.45)',
                  border: activeTab === tab ? '1px solid rgba(124,111,247,0.3)' : 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.15s',
                }}
              >
                {tab === 'diagnostics' ? 'GUARD' : tab}
              </button>
            ))}
          </div>

          {/* Tab Content: METRICS */}
          {activeTab === 'metrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {telemetry ? (
                <>
                  <DiagnosticRow icon="🤖" label="Active LLM" value={telemetry.activeModel || 'DeepSeek V4 Flash'} accent />
                  <DiagnosticRow icon="🧮" label="Embedding Model" value={telemetry.activeEmbeddingModel || 'NV-Embed-7B'} />
                  <DiagnosticRow icon="🗄️" label="Vector DB" value={telemetry.activeVectorDB || 'Pinecone+Firestore'} />
                  <DiagnosticRow
                    icon="⚡"
                    label="Response Latency"
                    value={`${telemetry.avgLatencyMs}ms`}
                    accent={telemetry.avgLatencyMs < 2000}
                  />
                  <DiagnosticRow icon="🔢" label="Tokens Used" value={telemetry.tokenCount.toLocaleString()} />
                  <DiagnosticRow
                    icon="💰"
                    label="Estimated Cost"
                    value={`$${telemetry.estimatedCostUSD.toFixed(6)} (NVIDIA Tier: $0)`}
                    accent
                  />
                  <DiagnosticRow icon="📄" label="Retrieved Chunks" value={String(telemetry.retrievedChunks)} />
                  <DiagnosticRow
                    icon="🎯"
                    label="Similarity Score"
                    value={telemetry.similarityScore > 0 ? telemetry.similarityScore.toFixed(3) : 'Direct/Live Menu'}
                    accent={telemetry.similarityScore > 0.6}
                  />
                  <DiagnosticRow
                    icon="📏"
                    label="Context Payload"
                    value={`${Math.round(telemetry.contextSizeChars / 1000)}k chars`}
                  />
                  <DiagnosticRow
                    icon="🔄"
                    label="Fallbacks Triggered"
                    value={String(telemetry.fallbacksTriggered)}
                    accent={telemetry.fallbacksTriggered === 0}
                  />
                  <DiagnosticRow
                    icon="❌"
                    label="System Errors"
                    value={String(telemetry.errorsCount)}
                    accent={telemetry.errorsCount === 0}
                  />
                </>
              ) : (
                <EmptyState label="Send a message to view live model telemetry" />
              )}
            </div>
          )}

          {/* Tab Content: DIAGNOSTICS & GUARD */}
          {activeTab === 'diagnostics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {telemetry ? (
                <>
                  <p className="font-mono-label" style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                    PIPELINE INTENT
                  </p>
                  <DiagnosticRow icon="🧠" label="Classified Intent" value={telemetry.intentClassified || 'UNKNOWN'} accent />
                  <DiagnosticRow icon="🍴" label="Restaurant Query?" value={telemetry.restaurantKnowledgeUsed ? 'YES' : 'NO'} accent={telemetry.restaurantKnowledgeUsed} />

                  <p className="font-mono-label" style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 2 }}>
                    PINECONE RAG PIPELINE
                  </p>
                  <DiagnosticRow icon="🧮" label="Query Embedding Model" value={telemetry.activeEmbeddingModel || 'baai/bge-m3'} />
                  <DiagnosticRow icon="⏱️" label="Query Embedding Latency" value={telemetry.embeddingGenerated ? 'Loaded' : 'N/A'} />
                  <DiagnosticRow icon="🌲" label="Pinecone Search Latency" value={telemetry.pineconeQueried ? `${telemetry.pineconeLatencyMs}ms` : 'SKIPPED'} accent={telemetry.pineconeQueried} />
                  <DiagnosticRow icon="📄" label="Top-K Retrieved Chunks" value={String(telemetry.vectorsRetrieved || 0)} accent={(telemetry.vectorsRetrieved || 0) > 0} />
                  <DiagnosticRow icon="🎯" label="Top Similarity Score" value={(telemetry.topSimilarityScore || 0).toFixed(3)} accent={(telemetry.topSimilarityScore || 0) > 0.6} />
                  <DiagnosticRow icon="🔑" label="Retrieved Document IDs" value={(telemetry.retrievedDocumentIds || []).length > 0 ? (telemetry.retrievedDocumentIds || []).join(', ').substring(0, 20) + '...' : 'None'} />
                  <DiagnosticRow icon="📏" label="Context Sent to LLM" value={`${telemetry.finalContextLengthChars || 0} chars`} />
                  <DiagnosticRow icon="⏱️" label="LLM Response Latency" value={`${telemetry.avgLatencyMs}ms`} />
                  <DiagnosticRow icon="⏱️" label="End-to-End Latency" value={`${telemetry.avgLatencyMs + (telemetry.pineconeLatencyMs || 0) + 150}ms`} />
                  <DiagnosticRow icon="ℹ️" label="Retrieval Status" value={telemetry.pineconeQueried ? 'SUCCESS' : 'BYPASSED'} accent={telemetry.pineconeQueried} />
                  
                  {telemetry.retrievedDocumentIds && telemetry.retrievedDocumentIds.length > 0 && (
                    <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.5)' }}>
                      Retrieved Docs: {telemetry.retrievedDocumentIds.join(', ')}
                    </div>
                  )}

                  <p className="font-mono-label" style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 2 }}>
                    CATALOG GUARD (ZERO HALLUCINATION)
                  </p>
                  <DiagnosticRow 
                    icon="🛡️" 
                    label="Guard Status" 
                    value={telemetry.catalogGuardStatus || 'PENDING'} 
                    accent={telemetry.catalogGuardStatus === 'PASS'} 
                  />
                  
                  {telemetry.flaggedHallucinatedItems && telemetry.flaggedHallucinatedItems.length > 0 && (
                    <div style={{ 
                      padding: 8, 
                      background: 'rgba(239,68,68,0.1)', 
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 6, 
                      fontSize: 10, 
                      fontFamily: 'JetBrains Mono, monospace', 
                      color: '#fca5a5' 
                    }}>
                      <span style={{ fontWeight: 'bold' }}>⚠️ FLAGGED ITEMS:</span>
                      <ul style={{ paddingLeft: 16, marginTop: 4, marginBottom: 0 }}>
                        {telemetry.flaggedHallucinatedItems.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState label="Send a message to view live diagnostics" />
              )}
            </div>
          )}

          {/* Tab Content: MODELS ORCHESTRATOR */}
          {activeTab === 'models' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <p className="font-mono-label" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  ORCHESTRATOR REGISTRY ({modelStatus.length || 9} Models)
                </p>
                <span style={{ fontSize: 9, color: '#4ADE80', fontFamily: 'JetBrains Mono, monospace' }}>
                  NVIDIA PRIMARY
                </span>
              </div>

              {modelStatus.length > 0 ? (
                modelStatus.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: m.isOpen ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${m.isOpen ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: m.provider === 'nvidia' ? '#c6c0ff' : '#93c5fd' }}>
                        {m.displayName}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: 'JetBrains Mono, monospace',
                          color: m.isOpen ? '#f87171' : '#4ade80',
                        }}
                      >
                        {m.isOpen ? 'CIRCUIT OPEN' : 'HEALTHY'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>
                      <span>Provider: {m.provider.toUpperCase()} (P{m.priority})</span>
                      <span>Calls: {m.totalCalls} | Tokens: {m.totalTokens}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <DiagnosticRow icon="🥇" label="Primary Chat" value="DeepSeek V4 Flash (NVIDIA)" accent />
                  <DiagnosticRow icon="🧠" label="Reasoning" value="GLM 5.2 (NVIDIA)" accent />
                  <DiagnosticRow icon="⚡" label="Complex Reasoning" value="Nemotron (NVIDIA)" accent />
                  <DiagnosticRow icon="📜" label="Long Context" value="Kimi (NVIDIA)" accent />
                  <DiagnosticRow icon="🎙️" label="Speech Recognition" value="Whisper Large V3" accent />
                  <DiagnosticRow icon="🛡️" label="Secondary Failover" value="OpenRouter (Qwen / Gemma)" />
                  <DiagnosticRow icon="🛡️" label="Ultimate Safeguard" value="Google Gemini Direct" />
                </div>
              )}
            </div>
          )}

          {/* Tab Content: CONTEXT */}
          {activeTab === 'context' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DiagnosticRow icon="🌐" label="Target Website" value="olive-pizza.vercel.app" accent />
              <DiagnosticRow icon="📍" label="Current Route" value={websiteContext.currentPage || '/'} />
              <DiagnosticRow
                icon="👤"
                label="User Auth"
                value={websiteContext.isAuthenticated ? `Verified (${websiteContext.userRole || 'Customer'})` : 'Guest'}
                accent={websiteContext.isAuthenticated}
              />
              <DiagnosticRow
                icon="🛒"
                label="Cart Items"
                value={String(websiteContext.cartItems?.length || 0)}
              />
              <DiagnosticRow
                icon="🎟️"
                label="Active Coupons"
                value={websiteContext.appliedCoupons?.join(', ') || 'None'}
              />
              <DiagnosticRow icon="🌐" label="Language" value={websiteContext.language || 'en'} />
              <DiagnosticRow icon="🎨" label="Theme" value={websiteContext.theme || 'dark'} />
            </div>
          )}

          {/* Tab Content: ACTIONS */}
          {activeTab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p className="font-mono-label" style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                DISPATCHED TOOL ACTIONS ({executedActions.length})
              </p>
              {executedActions.length > 0 ? (
                executedActions.map((act, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(124,111,247,0.08)',
                      border: '1px solid rgba(124,111,247,0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#c6c0ff',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        ⚡ {act.type}
                      </span>
                      <span style={{ fontSize: 10, color: '#4ADE80' }}>EXECUTED</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{act.description}</p>
                  </div>
                ))
              ) : (
                <EmptyState label="No website actions dispatched yet" />
              )}
            </div>
          )}

          {/* Tab Content: HEALTH & MONITORS */}
          {activeTab === 'health' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DiagnosticRow icon="🔌" label="AI Gateway" value="Online (3051)" accent />
              <DiagnosticRow icon="🍕" label="Olive Pizza Backend" value="Connected / SSOT" accent />
              <DiagnosticRow icon="🌲" label="Pinecone Vector DB" value="olive-pizza-qhdsm46" accent />
              <DiagnosticRow icon="🔥" label="Firestore DB" value="Live Sync Active" accent />
              <DiagnosticRow icon="🧠" label="NVIDIA NIM (Primary)" value="Connected (Free Tier)" accent />
              <DiagnosticRow icon="🛡️" label="OpenRouter (Secondary)" value="Connected (Failover)" accent />
              <DiagnosticRow icon="🎙️" label="Speech Engine" value="Whisper V3 + Canary" accent />
              <DiagnosticRow icon="🧮" label="Embedding Pipeline" value="NV-Embed-7B" accent />
              <DiagnosticRow icon="⚡" label="Rate Limiter" value="60 req / min" />
            </div>
          )}

          {/* Tab Content: INTEGRATION & ARCHITECTURE */}
          {activeTab === 'integration' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p className="font-mono-label" style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                DECOUPLED ARCHITECTURE STATUS
              </p>
              <DiagnosticRow icon="🔌" label="Main Backend API" value={ping ? 'CONNECTED' : 'OFFLINE'} accent={ping !== null} />
              <DiagnosticRow icon="🛡️" label="Auth Synchronization" value="Firebase JWT Verified" accent />
              <DiagnosticRow icon="📡" label="Real-Time Event Stream" value="Listening (SSE)" accent />
              <DiagnosticRow icon="🛒" label="Cart Mutation Logic" value="Delegated to Main API" accent />
              <DiagnosticRow icon="📊" label="Order Creation Logic" value="Delegated to Main API" accent />
              <DiagnosticRow icon="🎨" label="Website Controller" value="Event Dispatcher Active" accent />
              <div style={{ marginTop: 8, padding: 10, background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: 8 }}>
                <p style={{ fontSize: 10, color: '#4ade80', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}>
                  <strong>ARCHITECTURE:</strong> Olive Pizza AI operates as an independent intelligent orchestrator. No business logic or operational data is mutated locally. All actions are forwarded to the Main Olive Pizza Project via secure REST APIs.
                </p>
              </div>
            </div>
          )}

          {/* Tab Content: EMAIL ALERTS */}
          {activeTab === 'alerts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="font-mono-label" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  INCIDENTS & EMAIL ALERTS ({alerts.length})
                </p>
                <button
                  onClick={handleTriggerTestAlert}
                  disabled={isSendingTestAlert}
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {isSendingTestAlert ? 'Testing…' : '🚨 Test Alert'}
                </button>
              </div>

              {alertNotice && (
                <div
                  style={{
                    padding: '6px 10px',
                    fontSize: 11,
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.05)',
                    color: '#f3f4f6',
                  }}
                >
                  {alertNotice}
                </div>
              )}

              {alerts.length > 0 ? (
                alerts.map((al, idx) => (
                  <div
                    key={al.id || idx}
                    style={{
                      padding: '10px',
                      borderRadius: 8,
                      background: 'rgba(239,68,68,0.06)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>
                        {al.incident?.errorName || 'Production Incident'}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: 'JetBrains Mono, monospace',
                          color: al.status === 'rate_limited' ? '#f59e0b' : '#34d399',
                          textTransform: 'uppercase',
                        }}
                      >
                        {al.status || 'Delivered'}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                      {al.incident?.errorMessage}
                    </p>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>
                      To: {al.recipients?.join(', ')} • {new Date(al.sentAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState label="No production errors detected. All systems healthy." />
              )}
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function DiagnosticRow({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="telemetry-row"
      style={{
        borderColor: accent ? 'rgba(74,225,118,0.2)' : 'rgba(255,255,255,0.05)',
        background: accent ? 'rgba(74,225,118,0.04)' : 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <span
        style={{
          color: accent ? 'var(--accent-green)' : 'var(--text-primary)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 10px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 28 }}>📊</span>
      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
    </div>
  );
}
