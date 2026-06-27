---
name: SatTrack Leaflet / React 19 compatibility
description: react-leaflet must be v5+ on this Next 15 / React 19 app, or the live map crashes
---
The Live Map (PassMap) requires `react-leaflet` v5+. This app runs Next 15 with React 19.

**Why:** react-leaflet v4 only supports React 18. On React 19 it throws "Invalid hook call / more than one copy of React", which leaves the Leaflet container half-initialized and then crashes with "Map container is already initialized." Symptom: the Live Map modal opens blank, then the app crashes.
**How to apply:** Keep `react-leaflet` at `^5.0.0` (pulls `@react-leaflet/core` v3). Never downgrade to v4 while React is 19. PassMap also gives `MapContainer` a `key` so it remounts cleanly when reopening/switching satellites.
