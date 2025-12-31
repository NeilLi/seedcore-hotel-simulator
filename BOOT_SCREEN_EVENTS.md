# Events Emitted on Boot Screen

## Overview
The boot screen is displayed when `isAiEnabled === false`. Even though the UI shows a static boot screen, the simulation continues running in the background, which causes events to be emitted.

---

## User-Initiated Events (Boot Screen)

### 1. `ui.button.clicked`
**When:** User clicks the "Initialize Intelligence" button  
**Location:** `VirtualLobby.tsx:446`  
**Payload:**
```json
{
  "buttonId": "initialize-intelligence",
  "action": "enable-ai"
}
```
**Frequency:** Once per click (user action only)

### 2. `ui.keyboard.pressed`
**When:** User presses the Enter key  
**Location:** `VirtualLobby.tsx:68`  
**Payload:**
```json
{
  "key": "Enter",
  "action": "exit-lobby"
}
```
**Frequency:** Once per keypress (user action only)

---

## Background Events (Still Running During Boot Screen)

These events are emitted continuously by the simulation loop in `App.tsx`, even when the boot screen is visible:

### 3. `sim.agent.state.changed`
**When:** An agent's state changes (e.g., WALKING → SOCIALIZING)  
**Location:** `App.tsx:115`  
**Payload:**
```json
{
  "agentId": "G-1",
  "agentRole": "GUEST",
  "state": "SOCIALIZING",
  "previousState": "WALKING"
}
```
**Frequency:** 
- Always emitted for significant states: `SOCIALIZING`, `SERVICING`, `CHARGING`, `OBSERVING`
- 10% of minor state changes (WALKING, PAUSING)
- **This is likely the main source of constant events!**

**Throttling:** None (emitted immediately on state change)

### 4. `sim.room.occupancy.changed`
**When:** Room occupancy count changes  
**Location:** `App.tsx:173-186`  
**Payload:**
```json
{
  "roomId": "room-101",
  "roomName": "Suite 101",
  "occupancy": 2,
  "previousOccupancy": 1
}
```
**Frequency:**
- Checked every 5 seconds (throttled)
- Only emitted if occupancy actually changed
- **This is the second source of constant events!**

**Throttling:** Max once per 5 seconds per room

---

## Events NOT Emitted on Boot Screen

- ❌ `ui.hotspot.entered` - Robot hotspot only visible when `isAiEnabled === true`
- ❌ `ui.hotspot.left` - Same reason
- ❌ `ui.voice.transcript.final` - Voice input not active on boot screen
- ❌ `sim.robot.position.updated` - Not in ALLOWED_EVENT_TYPES (commented out)

---

## Why You See Constant Events

Even though the boot screen looks static, the simulation in `App.tsx` continues running:

1. **Simulation tick loop** runs every `TICK_RATE_MS` (typically 100-200ms)
2. **Agents move and change state** continuously
3. **Room occupancy is checked** every 5 seconds
4. **Events are queued** and flushed every 2 seconds to Kafka

This means you'll see:
- `sim.agent.state.changed` events every few seconds (when agents change behavior)
- `sim.room.occupancy.changed` events every 5+ seconds (when guests enter/leave rooms)

---

## How to Reduce Boot Screen Events

If you want to stop events during boot screen:

1. **Pause simulation when `!isAiEnabled`:**
   ```typescript
   // In App.tsx, modify the tick interval:
   useEffect(() => {
     if (!initialized || !isAiEnabled) return; // Add !isAiEnabled check
     const i = setInterval(tick, TICK_RATE_MS);
     return () => clearInterval(i);
   }, [initialized, isAiEnabled, tick]);
   ```

2. **Or filter events in KafkaPublisher:**
   ```typescript
   // In kafkaPublisher.ts, check if AI is enabled before publishing
   publish(event: SeedcoreHotelEvent) {
     if (!isAiEnabled && event.source === 'sim') return; // Skip sim events on boot
     // ... rest of publish logic
   }
   ```

---

## Summary

| Event Type | Source | Frequency | User Action? |
|------------|--------|-----------|--------------|
| `ui.button.clicked` | VirtualLobby | On click | ✅ Yes |
| `ui.keyboard.pressed` | VirtualLobby | On keypress | ✅ Yes |
| `sim.agent.state.changed` | App.tsx | Continuous | ❌ No (background) |
| `sim.room.occupancy.changed` | App.tsx | Every 5s (if changed) | ❌ No (background) |

**The constant stream of events you saw in the error logs is from `sim.agent.state.changed` and `sim.room.occupancy.changed` running in the background!**

