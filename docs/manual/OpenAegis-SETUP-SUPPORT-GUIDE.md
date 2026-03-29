# OpenAegis Setup and Support Guide

## 1. Prerequisites

- Node.js 22+
- npm 10+
- Docker (optional for full dependency stack)

## 2. Local Setup

```bash
npm install
npm run typecheck
npm run test
npm run build
```

## 3. Run Validation

```bash
npm run smoke:pilot
node tools/scripts/pilot-demo.mjs
```

## 4. Start UI for Manual Demo

Terminal A:
```bash
PORT=4300 node tools/scripts/run-gateway.mjs
```

Terminal B:
```bash
VITE_API_URL=http://127.0.0.1:4300 npm run --workspace @openaegis/admin-console dev -- --host 127.0.0.1 --port 4273
```

Open `http://127.0.0.1:4273`.

## 5. Common Issues

### `Failed to fetch` in browser
- Ensure gateway is running
- Ensure `VITE_API_URL` points to the gateway
- Ensure CORS headers are enabled (already configured in gateway)

### `No configured push destination`
- Add a git remote:
```bash
git remote add origin <repository-url>
git push -u origin master
```

### Port conflicts (`EADDRINUSE`)
- Change service ports using environment variables
- Stop conflicting local services

## 6. Support Escalation Template

When opening an issue include:

- OS and Node version
- command executed
- error output
- expected result
- screenshot/log file

## 7. Operational Support Checklist

- Confirm service health endpoint responds
- Confirm policy evaluation endpoint responds
- Confirm approval endpoint returns pending tickets
- Confirm audit endpoint returns events
- Confirm UI reflects execution state transitions
