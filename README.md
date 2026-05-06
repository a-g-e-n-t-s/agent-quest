# agent-quest
> A Kadi agent that runs a two-part client/server app and connects to the Kadi broker.

Overview
--------
agent-quest is a Kadi agent packaged project. The agent manifest is agent.json (type: "agent") and the package is currently at version 0.3.11. The runtime entrypoint for the packaged server is dist/index.js and the repository contains a client (Vite) and a server (TypeScript) portion. The agent expects to connect to the broker URL configured in agent.json (brokers.remote: wss://broker.dadavidtseng.com/kadi) and participates on the networks listed (["quest","global"]). The manifest also declares abilities (secret-ability, ability-log) and includes an Akash deployment configuration.

Quick Start
-----------
1. Install dependencies locally
```bash
npm install
```

2. Register the agent with your Kadi environment
```bash
kadi install
```
(kadi install reads agent.json and registers the agent with the platform/broker)

3. Start the agent via Kadi
```bash
kadi run start
```

Useful local commands
```bash
# Preflight checks (verifies node_modules exists)
npm run preflight

# Install all workspace dependencies and build everything
npm run setup
# (setup runs install:all then build)

# Run both client and server in dev mode (hot reload)
npm run dev
# runs concurrently:
#  - npm run dev:client  -> cd client && npx vite
#  - npm run dev:server  -> cd server && npx tsx watch src/index.ts

# Build client and server for production
npm run build
# builds both parts:
#  - npm run build:client -> npm run build --prefix client
#  - npm run build:server -> npm run build --prefix server

# Start server only (starts built server artifact)
npm run start
# executes: node server/dist/index.js

# Run tests and linters for client/server
npm run test
npm run lint
npm run type-check
```

Tools
-----
| Tool | Description |
| ---- | ----------- |
| npm | Package manager used to install dependencies and run scripts (project uses root, client/, server/). |
| concurrently (^9.1.2) | Development helper to run client and server dev processes in parallel (used by npm run dev). |
| Vite | Client development server / build tool (invoked in client via npm run dev:client and build:client). |
| tsx | TypeScript runtime used to run server in dev mode (server dev: tsx watch src/index.ts). |
| tsc | TypeScript compiler (used in build steps and type-check script). |
| kadi | AGENTS / Kadi CLI used to install and run the agent on the orchestration platform (kadi install, kadi run start). |
| kadi-secret / ability-log | Installed/used during the build pipeline (agent.json build steps run kadi install kadi-secret and kadi install ability-log). |

Configuration
-------------
Primary configuration lives in agent.json at the project root. Key fields used by the agent-quest package:

- name: "agent-quest" — agent identifier
- type: "agent"
- version: "0.3.11"
- entrypoint: "dist/index.js" — packaged entrypoint for the server
- scripts: npm script shortcuts used for development and CI. Important scripts:
  - preflight — verifies node_modules exists
  - setup — installs all workspace dependencies and runs build
  - dev / dev:client / dev:server — local development (concurrently, vite, tsx)
  - build / build:client / build:server — production build steps
  - start — starts the built server artifact (node server/dist/index.js)
  - install:all — installs root, client, and server dependencies
  - lint / test / type-check — run checks across client and server
- build.default:
  - from: "node:20-alpine" — base image used by the Kadi build container
  - cli: "latest"
  - run: (commands executed during image build)
    - NODE_ENV=development npm run install:all
    - kadi install kadi-secret
    - kadi install ability-log
    - mkdir -p /app/abilities && cp -a /opt/kadi/abilities/secret-ability@* /app/abilities/
    - npm run build
    - npm prune --omit=dev --prefix server
    - rm -rf client/node_modules
  - env: { "NODE_ENV": "production" } — build-time environment
- brokers:
  - remote: "wss://broker.dadavidtseng.com/kadi" — broker URL the agent will use by default
- networks:
  - ["quest", "global"]
- abilities:
  - secret-ability: "^0.9.5"
  - ability-log: "*"

Files and paths of interest:
- agent.json (root) — agent manifest and configuration
- config.toml (root) — runtime configuration used by the server (examples and defaults; secrets go in secrets.toml)
- client/ — front-end application (Vite project)
- server/ — back-end agent runtime (TypeScript)
- server/src/index.ts — server entrypoint used by dev script (npm run dev:server uses tsx watch src/index.ts)
- server/dist/index.js — built server entrypoint (used by npm run start and packaged image)

Architecture
------------
High-level data flow and key components:

- Client (client/):
  - Built with Vite.
  - Serves the browser UI, connects to the server portion or to Kadi as required by your application logic.
  - Development: run via `npx vite` (npm run dev:client).
  - Build output is produced by `npm run build --prefix client`.

- Server (server/):
  - TypeScript-based agent runtime. Entry: server/src/index.ts in development; server/dist/index.js in production.
  - In development, server runs with tsx in watch mode (npm run dev:server).
  - In production, server is built via tsc and executed (node server/dist/index.js) from the packaged image.

- Kadi Broker:
  - agent-quest connects to the broker URL configured in agent.json (brokers.remote by default).
  - When the agent runs under the Kadi runtime, it connects to the broker and registers its presence/handlers on the configured networks.

- Build and Deployment:
  - The build section in agent.json defines a reproducible container build based on node:20-alpine.
  - Build steps install workspace deps, install the kadi-secret helper and ability-log ability, copy a secret ability into /app/abilities, build client and server, prune devDependencies for server, and remove client/node_modules to reduce image size.
  - agent.json also contains a deploy configuration for Akash (deploy.akash). The Akash config includes:
    - target: "akash" and network: "mainnet"
    - deposit: "10" and a blacklist of Akash addresses (to avoid scheduling on those nodes)
    - engine: "podman"
    - services.app:
      - image: "agent-quest:0.3.11"
      - command: ["sh", "-c", "kadi secret receive --vault observer --vault arcadedb && kadi run start"]
      - expose: port 8888 (mapped as 8888, global)
      - env: ["NODE_ENV=production", "ARCADE_HOST=arcadedb.dadavidtseng.com", "ARCADE_PORT=443"]
      - resources: cpu 0.5, memory "512Mi", ephemeralStorage "1Gi"
      - pricing: amount "500", denom "uact"
    - secrets: vault mappings for "observer" (OBSERVER_PASSWORD) and "arcadedb" (ARCADE_USERNAME, ARCADE_PASSWORD), with delivery set to "broker"

Data flow summary:
1. Kadi platform launches the agent image on an orchestrated node.
2. Server connects to the broker at the configured URL and registers its presence/handlers.
3. Client (if served by the server or hosted separately) interacts with server or broker as designed by the agent logic.
4. Messages between agents and services flow via the Kadi broker channels.

Development
-----------
Local development workflow and notes:

1. Install dependencies
```bash
npm run install:all
# or
npm install
npm install --prefix client
npm install --prefix server
```

2. Run preflight checks
```bash
npm run preflight
```

3. Start development servers (client + server)
```bash
npm run dev
# runs concurrently:
#  - npm run dev:client  -> cd client && npx vite
#  - npm run dev:server  -> cd server && npx tsx watch src/index.ts
```

4. Build for production
```bash
npm run build
# builds client and server artifacts:
#  - npm run build:client -> npm run build --prefix client
#  - npm run build:server -> npm run build --prefix server
```

5. Start server (production style)
```bash
npm run start
# executes: node server/dist/index.js
```

6. Linting, testing, type checking
```bash
npm run lint       # runs lint in client and server projects
npm run test       # runs tests in client and server projects
npm run type-check # npx tsc --noEmit --prefix client && npx tsc --noEmit --prefix server
```

Build/CI specifics
- The build image defined in agent.json uses:
  - from: node:20-alpine
  - run:
    - NODE_ENV=development npm run install:all
    - kadi install kadi-secret
    - kadi install ability-log
    - mkdir -p /app/abilities && cp -a /opt/kadi/abilities/secret-ability@* /app/abilities/
    - npm run build
    - npm prune --omit=dev --prefix server
    - rm -rf client/node_modules
  - NODE_ENV=production is set during the build.
- The Akash deployment config (deploy.akash) in agent.json demonstrates how to run the built image in a cloud environment:
  - The service command pulls secrets from configured vaults using:
    kadi secret receive --vault observer --vault arcadedb
    and then starts the agent with:
    kadi run start
  - The manifest config also includes scheduling controls (blacklist), uses the podman engine, sets resource requests (cpu/memory/ephemeralStorage), and pricing (amount/denom).
  - Secret vault mappings and delivery are declared under deploy.akash.secrets (vaults: observer and arcadedb, delivery: "broker").

Notes and tips
- Keep agent.json and config.toml in sync with any changes to the broker URL, networks, or build steps.
- The build workflow installs a small "secret-ability" into /app/abilities during image creation — changes to abilities may require modifying the build.run steps in agent.json.
- Secrets and vault configuration are declared in agent.json (deploy.akash.secrets) and referenced by the runtime; local secret values belong in secrets.toml (gitignored) and runtime config lives in config.toml.
- If Kadi CLI is not available locally, ask your platform operator for the correct kadi client binary or path.

Configuration examples (config.toml)
-----------------------------------
A runtime example is provided in config.toml (root). Key values shown in the repository include:

```toml
# Agent Quest Configuration
# Secrets go in secrets.toml (gitignored)

[agent]
ID = "agent-quest"
VERSION = "0.3.7"

[server]
PORT = 8888
CORS_ORIGINS = "http://localhost:5173,https://quest.dadavidtseng.com"

[logging]
LEVEL = "debug"

#[broker.local]
#URL = "ws://localhost:8080/kadi"
#NETWORKS = ["quest", "global"]

[broker.remote]
URL = "wss://broker.dadavidtseng.com/kadi"
NETWORKS = ["quest", "global"]

[secrets]
VAULTS = ["observer", "arcadedb"]
KEYS = ["OBSERVER_PASSWORD", "ARCADE_USERNAME", "ARCADE_PASSWORD"]

[arcadedb]
HOST = "arcadedb.dadavidtseng.com"
PORT = 443
USERNAME = "root"
DATABASE = "agents_logs"
```

---