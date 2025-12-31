# Kafka Event Ingress Setup

This document describes how to configure and use the event tracking system that publishes events from the SeedCore Hotel Simulator to Kafka.

## Overview

The system uses a **hybrid approach**: only **semantic, meaningful events** go to Kafka. High-frequency "noise" events are kept local.

### ✅ Events Published to Kafka

**UI Events (`seedcore-ui-events` topic):**
- `ui.hotspot.entered` - User hovers over interactive hotspots (discrete intent)
- `ui.hotspot.left` - User leaves a hotspot
- `ui.voice.transcript.final` - Voice transcription (user requests)
- `ui.button.clicked` - **Meaningful button clicks only** (e.g., "Initialize Intelligence", "Director Mode", "Request Assistance")
- `ui.keyboard.pressed` - **Meaningful keyboard actions only** (e.g., Enter to exit lobby)

**Simulation Events (`seedcore-sim-events` topic):**
- `sim.room.occupancy.changed` - Room occupancy count changes (throttled to 2s)
- `sim.agent.state.changed` - Agent state transitions (WALKING → PAUSING, etc.)
- `sim.atmosphere.changed` - Atmosphere/lighting changes (coarse-grained, only on change)
- `sim.time.updated` - Time of day updates (coarse-grained, only on hour boundaries)

### ❌ Events NOT Published to Kafka (Local Only)

- `ui.pointer.moved` - High-frequency mouse movements (not semantically meaningful)
- `sim.robot.position.updated` - High-frequency position updates (unless needed for replay/analytics)

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Kafka Configuration (for server)
KAFKA_BROKERS=localhost:9092
# Or for Confluent Cloud:
# KAFKA_BROKERS=pkc-xxxxx.region.provider.confluent.cloud:9092
KAFKA_CLIENT_ID=seedcore-server
KAFKA_SSL=true
KAFKA_USERNAME=your_api_key
KAFKA_PASSWORD=your_api_secret

# Frontend (optional - for direct publishing, currently uses server proxy)
VITE_KAFKA_BROKERS=localhost:9092
VITE_KAFKA_SSL=false
VITE_KAFKA_USERNAME=
VITE_KAFKA_PASSWORD=
```

### Local Kafka Setup

For local development:

```bash
# Using Docker Compose
docker-compose up -d kafka

# Or using Confluent Platform
confluent local services start
```

### Confluent Cloud Setup

1. Create a cluster in Confluent Cloud
2. Create topics:
   - `seedcore-ui-events`
   - `seedcore-sim-events`
3. Create API key/secret
4. Add credentials to `.env.local`

## Event Schema

All events follow this structure:

```typescript
{
  eventId: string;          // UUID for deduplication/tracing
  timestamp: number;        // Unix timestamp (ms)
  sessionId: string;        // Unique session ID
  userId?: string;         // Optional user ID
  traceId?: string;        // Correlation ID for distributed tracing
  source: 'frontend' | 'sim' | 'agent';  // Event source
  importance: 'low' | 'normal' | 'high'; // Event importance
  type: string;            // Event type (e.g., "ui.hotspot.entered")
  payload: {               // Event-specific data
    [key: string]: unknown;
  };
}
```

### Example Events

**UI Event:**
```json
{
  "eventId": "1704067200000-abc123-def456",
  "timestamp": 1704067200000,
  "sessionId": "session_1704067200_abc123",
  "traceId": "trace_1704067200_xyz789",
  "source": "frontend",
  "importance": "high",
  "type": "ui.hotspot.entered",
  "payload": {
    "hotspotId": "robot-concierge",
    "atmosphere": "GOLDEN_HOUR",
    "timeOfDay": 12.5
  }
}
```

**Simulation Event:**
```json
{
  "eventId": "1704067201000-ghi789-jkl012",
  "timestamp": 1704067201000,
  "sessionId": "session_1704067200_abc123",
  "traceId": "trace_1704067200_xyz789",
  "source": "sim",
  "importance": "normal",
  "type": "sim.agent.state.changed",
  "payload": {
    "agentId": "R-1",
    "agentRole": "ROBOT_CONCIERGE",
    "state": "WALKING",
    "previousState": "PAUSING"
  }
}
```

## Architecture

```
Frontend (React)
  ↓
EventEmitter Service
  ↓
KafkaPublisher Service (batches events)
  ↓
POST /api/kafka/publish
  ↓
Express Server
  ↓
KafkaJS Producer
  ↓
Kafka Topics
```

## Features

### Batching
- Events are batched and flushed every 500ms
- Immediate flush if queue reaches 10 events
- Prevents overwhelming Kafka with individual messages

### Error Handling
- Failed publishes are re-queued (up to 100 events)
- Graceful degradation if Kafka is unavailable
- Console logging for debugging

### Event Filtering
- **Pointer movements**: NOT sent to Kafka (high-frequency noise)
- **Room occupancy**: Throttled to max 1 check per 2 seconds
- **Time updates**: Only emitted on hour boundaries (coarse-grained)
- **Button clicks**: Only meaningful buttons are tracked (filtered list)
- **Position updates**: Marked as `importance: 'low'` and filtered by Kafka publisher

## Testing

### Check if events are being published

1. Start the server:
   ```bash
   npm run dev:server
   ```

2. Check server logs for:
   ```
   [Kafka] ✅ Connected to brokers: [...]
   [KafkaPublisher] ✅ Published X events
   ```

3. Use Kafka console consumer:
   ```bash
   kafka-console-consumer \
     --bootstrap-server localhost:9092 \
     --topic seedcore-ui-events \
     --from-beginning
   ```

### Verify in Confluent Cloud

1. Go to your cluster → Topics
2. Select `seedcore-ui-events` or `seedcore-sim-events`
3. View messages in real-time

## Troubleshooting

### Events not publishing

1. Check server logs for Kafka connection status
2. Verify `.env.local` has correct Kafka credentials
3. Check browser console for event logs (in dev mode)
4. Verify topics exist in Kafka

### Too many events

- Adjust throttling intervals in `App.tsx` and `VirtualLobby.tsx`
- Increase batch flush interval in `kafkaPublisher.ts`

### Performance issues

- Events are batched and async - shouldn't block UI
- If needed, reduce event frequency or add more throttling

## Next Steps

- Add event filtering/whitelisting
- Add event compression for large payloads
- Implement event replay
- Add metrics/monitoring dashboard
- Stream events to analytics platform

