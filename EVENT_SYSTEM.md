# Unified Event System - `seedcore.hotel.events`

## Overview

All events from the frontend and simulator are published to a **single Kafka topic**: `seedcore.hotel.events`. This unified approach simplifies Coordinator consumption and ensures event ordering per session.

## Event Envelope

All events follow this structure:

```typescript
{
  eventId: string;        // UUID for deduplication/tracing
  timestamp: number;       // Unix timestamp (ms)
  sessionId: string;      // Unique session ID (used as Kafka key)
  userId?: string;        // Optional user ID
  source: "ui" | "sim";   // Event source
  type: string;           // Event type (see below)
  payload: Record<string, unknown>; // Event-specific data
}
```

## Allowed Event Types

Only these meaningful events are published to Kafka:

### UI Events
- `ui.hotspot.entered` - User hovers over interactive hotspots
- `ui.hotspot.left` - User leaves a hotspot
- `ui.voice.transcript.final` - Final voice transcription (user requests)
- `ui.button.clicked` - Meaningful button clicks only
- `ui.keyboard.pressed` - Meaningful keyboard actions (e.g., Enter key)

### Simulation Events
- `sim.room.occupancy.changed` - Room occupancy count changes
- `sim.agent.state.changed` - Agent state transitions

## Architecture

```
Frontend/Simulator
  ↓
EventEmitter.emitHotelEvent()
  ↓
KafkaPublisher.publish() (filters by ALLOWED_EVENT_TYPES)
  ↓
POST /api/events
  ↓
Express Server (filters again, validates)
  ↓
Kafka Producer
  ↓
Topic: seedcore.hotel.events
  Key: sessionId (ensures ordering per session)
  ↓
Coordinator Consumer
```

## Frontend Usage

### Emitting Events

```typescript
import { useEventTracking } from './hooks/useEventTracking';

const events = useEventTracking();

// UI Events
events.emitHotspotEntered({ 
  hotspotId: "robot-concierge",
  atmosphere: "GOLDEN_HOUR",
  timeOfDay: 12.5 
});

events.emitHotspotLeft({ hotspotId: "robot-concierge" });

events.emitButtonClick({ 
  buttonId: "initialize-intelligence",
  action: "enable-ai" 
});

events.emitKeyboardPressed({ 
  key: "Enter",
  action: "exit-lobby" 
});

// Sim Events
events.emitRoomOccupancyChanged({
  roomId: "lobby-1",
  roomName: "Grand Atrium",
  occupancy: 5
});

events.emitAgentStateChanged({
  agentId: "R-1",
  agentRole: "ROBOT_CONCIERGE",
  state: "WALKING",
  previousState: "PAUSING"
});
```

## Backend Endpoint

### `POST /api/events`

**Request:**
```json
{
  "events": [
    {
      "eventId": "1704067200000-abc123-def456",
      "timestamp": 1704067200000,
      "sessionId": "session_1704067200_abc123",
      "source": "ui",
      "type": "ui.hotspot.entered",
      "payload": {
        "hotspotId": "robot-concierge"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "published": 1,
  "dropped": 0
}
```

## Coordinator Consumption Pattern

Your Coordinator should consume `seedcore.hotel.events` and switch on `event.type`:

```python
# Pseudo-code
for event in kafka_consumer:
    if event.type == "ui.hotspot.entered":
        # Prepare NPC context
        prepare_npc_context(event.payload.hotspotId)
        
    elif event.type == "ui.voice.transcript.final":
        # Call Gemini → get response
        response = call_gemini(event.payload.transcript)
        # Send to ElevenLabs
        speak(response)
        
    elif event.type == "ui.button.clicked":
        # Handle button action
        handle_button_action(event.payload.buttonId)
        
    elif event.type == "sim.room.occupancy.changed":
        # Update state
        update_room_occupancy(event.payload)
        
    elif event.type == "sim.agent.state.changed":
        # Update agent state
        update_agent_state(event.payload)
```

## Key Features

1. **Single Topic**: All events go to `seedcore.hotel.events`
2. **Session Ordering**: Kafka key = `sessionId` ensures ordering per session
3. **Filtered**: Only meaningful events are published (no noise)
4. **Type-Safe**: Full TypeScript support with payload types
5. **Batched**: Events are batched every 500ms for efficiency
6. **Error Handling**: Failed publishes are re-queued (up to 100 events)

## Configuration

Add to `.env.local`:

### Confluent Cloud (Production)

```bash
# Get these from: Confluent Cloud Console → Cluster → Cluster Settings → API Keys
KAFKA_BROKERS=pkc-xxxxx.region.provider.confluent.cloud:9092
KAFKA_CLIENT_ID=seedcore-server
KAFKA_SSL=true
KAFKA_USERNAME=your_api_key_here
KAFKA_PASSWORD=your_api_secret_here
```

**How to get Confluent Cloud credentials:**
1. Go to Confluent Cloud Console
2. Select your cluster
3. Go to **Cluster Settings** → **API Keys**
4. Create a new API key (or use existing)
5. Copy:
   - **Bootstrap server** → `KAFKA_BROKERS` (format: `pkc-xxxxx.region.provider.confluent.cloud:9092`)
   - **API Key** → `KAFKA_USERNAME`
   - **API Secret** → `KAFKA_PASSWORD`

### Local Kafka (Development)

```bash
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=seedcore-server
KAFKA_SSL=false
KAFKA_USERNAME=
KAFKA_PASSWORD=
```

## Testing

1. Start the server: `npm run dev:all`
2. Check server logs for: `[Events] ✅ Published X events to seedcore.hotel.events`
3. Use Kafka console consumer:
   ```bash
   kafka-console-consumer \
     --bootstrap-server localhost:9092 \
     --topic seedcore.hotel.events \
     --from-beginning \
     --property print.key=true
   ```

## Event Examples

### Hotspot Entered
```json
{
  "eventId": "1704067200000-abc123",
  "timestamp": 1704067200000,
  "sessionId": "session_1704067200_abc123",
  "source": "ui",
  "type": "ui.hotspot.entered",
  "payload": {
    "hotspotId": "robot-concierge",
    "atmosphere": "GOLDEN_HOUR",
    "timeOfDay": 12.5
  }
}
```

### Agent State Changed
```json
{
  "eventId": "1704067201000-def456",
  "timestamp": 1704067201000,
  "sessionId": "session_1704067200_abc123",
  "source": "sim",
  "type": "sim.agent.state.changed",
  "payload": {
    "agentId": "R-1",
    "agentRole": "ROBOT_CONCIERGE",
    "state": "WALKING",
    "previousState": "PAUSING"
  }
}
```

