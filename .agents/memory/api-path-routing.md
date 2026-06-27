---
name: API path routing conflict
description: Why a Next.js app's /api/* routes 404 when the api-server artifact also claims /api in this monorepo.
---

# Symptom
A Next.js (or any web) artifact mounted at `/` defines route handlers under `/api/*`, but requests to them return 404 with the response coming from the `api-server` artifact (an Express service), not the web app.

# Cause
The shared reverse proxy routes by path, most-specific-first. The `api-server` artifact registers `paths = ["/api"]`, so every `/api/*` request is sent to it instead of falling through to the web app at `/`. The api-server has no matching route, so it 404s.

# Fix
Repath `api-server` off `/api` (e.g. `/_api-server`) via the artifacts skill's `verifyAndReplaceArtifactToml` callback, updating both `previewPath` and the service `paths` (and any health-check path). After replacing the toml, restart both workflows so the proxy reloads routing. Then `/api/*` falls through to the web app at `/`.

**Why:** There is no documented `removeArtifact` callback, and the api-server was unused dead scaffold; repathing is non-destructive, reversible, and definitively resolves the collision.

**How to apply:** Whenever a web artifact at `/` needs to own `/api/*`, make sure no other artifact (api-server) claims `/api`. Verify with `curl localhost:80/api/...` — it must reach the web app, not return an api-server 404.
