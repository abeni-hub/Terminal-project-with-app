# Backend NestJS ALPR Module Documentation

## Current Status: Phase 2 - NestJS Backend Modules Implementation

### Modules Added/Updated:

1. **`prisma/schema.prisma`**:
   - Models added: `CameraDevice`, `RecognitionEvent`, `RecognitionConfiguration`, `CameraHeartbeat`.
   - Enums added: `CameraType`, `CameraSourceType`, `CameraStatus`, `JourneyState`, `QueueEntryType`, `RecognitionProcessingResult`.
   - Extended: `Vehicle` (adds `journeyState`), `QueueEntry` (adds `entryType`, `recognitionEventId`, `cameraId`, `confidence`), `DispatchRecord` (adds `exitRecognitionEventId`, `departureConfirmed`).

2. **`src/events`**:
   - `EventsGateway`: WebSockets Socket.IO gateway (`@WebSocketGateway({ cors: { origin: '*' } })`) for broadcasting real-time recognition captures, queue entries, unknown vehicle alerts, and camera status updates.

3. **`src/camera`**:
   - `CameraModule`, `CameraController`, `CameraService`, DTOs.
   - Endpoints for Camera CRUD, connection testing (`POST /api/v1/cameras/:id/test`), status toggle, recognition enable/disable, heartbeat listener.

4. **`src/recognition`**:
   - `RecognitionModule`, `RecognitionController`, `RecognitionService`, DTOs.
   - `POST /api/v1/recognition/process`: Plate normalization engine, Eligibility validation (Case 1: Auto-queue assigned vehicle, Case 2: Unassigned vehicle violation queue, Case 3: Unknown vehicle alert creation), Exit camera departure handler, Destination return queue handler.

5. **`src/journey`**:
   - `JourneyModule`, `JourneyService`, `JourneyController`.
   - Vehicle journey state tracking (`WAITING` -> `DISPATCHED` -> `ON_ROUTE` -> `ARRIVED` -> `READY_FOR_RETURN`).

6. **`src/camera-health`**:
   - `CameraHealthService`: Background heartbeat monitor checking camera status and flagging offline cameras.

7. **`src/queue` & `src/dispatch` & `src/violations` & `src/reports`**:
   - Extended to support `AUTO_RECOGNIZED` entry types, exit camera departure confirmation, and ALPR metrics.
