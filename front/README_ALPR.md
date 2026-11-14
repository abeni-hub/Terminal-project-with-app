# Next.js Frontend ALPR Integration Documentation

## Current Status: Phase 4 - Next.js Frontend Implementation

### Pages & Features Added:

1. **Camera Management (`/cameras`)**:
   - `/cameras`: Camera List with status indicators (Active, Offline, Maintenance), source type badges (USB, Android Phone, Video File, Synthetic Mock, RTSP, ONVIF), quick recognition enable/disable switches.
   - `/cameras/new`: Camera registration page.
   - `/cameras/[id]`: Live camera preview feed (MJPEG stream from Python service), test connection button, heartbeat logs.
   - `/cameras/[id]/edit`: Camera configuration edit page.

2. **Recognition Dashboard (`/recognition/dashboard`)**:
   - Live Recognition Feed: Real-time Socket.IO WebSocket ticker receiving `recognition:captured` events.
   - Today's Summary Metrics: Total Recognitions, Accuracy Rate, Active Cameras, Auto Queued Count.
   - Live Video Stream preview widget.
   - Unknown Vehicle Alert Modal with quick vehicle assignment capability.

3. **Recognition History (`/recognition/history`)**:
   - Searchable, filterable data table of all historical `RecognitionEvent` records.
   - Filters: Date range, Terminal, Camera, Processing Result (ACCEPTED, DUPLICATE, UNKNOWN, LOW_CONFIDENCE, NOT_ASSIGNED, SUSPENDED).
   - Captured Plate snippet modal.

4. **Unknown Vehicle Review (`/recognition/unknown`)**:
   - Specialized review queue for unregistered / unknown vehicle plates recognized by ALPR cameras.
   - Assign to existing vehicle or register new vehicle.

5. **ALPR Analytics (`/recognition/analytics`)**:
   - Recharts visual charts displaying hourly recognition volume, accuracy percentages, top performing cameras, and auto vs manual queue breakdown.

6. **Enhanced Dispatcher Queue Page (`/queue`)**:
   - Real-time ALPR ticker header showing recent camera check-ins.
   - Auto-recognized queue entry badges (`AUTO_RECOGNIZED` vs `MANUAL` vs `VIOLATION`).
   - Fallback manual vehicle search drawer with supervisor override.
