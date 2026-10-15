# Monopoly India Online 🎲🇮🇳

Welcome to **Monopoly India Online**! This is a modern, full-stack, real-time multiplayer implementation of the classic board game, themed around India's most prestigious properties, cities, and utilities (from Chennai to Mumbai Marine Drive). 

The game is built with a responsive frontend optimized for both desktop and mobile layouts, and a server-authoritative backend engine that runs gameplay rules, coordinates bot interactions, manages lobbies, and protects the game board state.

---

## 🚀 Technology Stack

This section is based on the checked-in package manifests, lockfiles, source imports, and deployment configuration. Version ranges below are those declared in `package.json`; the lockfiles record the resolved dependency versions. The frontend and backend are separate npm projects with their own `package.json` and `package-lock.json`.

### Languages and runtimes

* **JavaScript** is used throughout. The frontend uses JSX and ES modules; the backend uses CommonJS modules. There is no TypeScript source or TypeScript build configuration in this repository.
* **Node.js** runs the backend and frontend build tooling. The Dockerfiles use the `node:20-alpine` image; the package manifests do not declare a separate Node.js engine range.
* **HTML and CSS** provide the browser document and styling. Tailwind utility classes are used alongside authored CSS.

### Frontend

* **React** (`^19.2.6`) and **React DOM** (`^19.2.6`) render the application.
* **React Router DOM** (`^7.15.1`) handles client-side routes.
* **Socket.IO Client** (`^4.8.3`) connects the browser to the game server. The configured client transport is HTTP polling (`transports: ['polling']`); it does not upgrade to WebSocket.
* **Vite** (`^8.0.12`) serves the development app and produces the production bundle; **`@vitejs/plugin-react`** (`^6.0.1`) integrates React.
* **Tailwind CSS** (`^3.4.19`), **PostCSS** (`^8.5.15`), and **Autoprefixer** (`^10.5.0`) process styles. The project also has handwritten CSS in `src/index.css` and `src/App.css`.
* **ESLint** (`^10.3.0`) checks JavaScript/JSX, with `@eslint/js` (`^10.0.1`), `globals` (`^17.6.0`), `eslint-plugin-react-hooks` (`^7.1.1`), and `eslint-plugin-react-refresh` (`^0.5.2`). The `@types/react` (`^19.2.14`) and `@types/react-dom` (`^19.2.3`) packages are installed, but the application itself is JavaScript/JSX, not TypeScript.

### Backend

* **Node.js** runs the server in `backend/server.js`.
* **Express** (`^5.2.1`) provides HTTP routes and middleware; **CORS** (`^2.8.6`) configures cross-origin requests; **express-rate-limit** (`^8.5.2`) applies rate limits.
* **Socket.IO** (`^4.8.3`) provides the real-time game event server. The backend also declares **Socket.IO Client** (`^4.8.3`) as a development dependency for its test/integration scripts.
* **Mongoose** (`^9.6.2`) is the MongoDB ODM. MongoDB is optional at startup: when its connection is unavailable, room, user, and feedback data use in-memory registries with JSON-file fallback; completed-match history falls back to process memory only. These fallbacks are not equivalent to a durable MongoDB store.
* **Nodemailer** (`^8.0.10`) sends verification email through SMTP when SMTP environment settings are provided. The email service logs a simulated/fallback code when SMTP is not configured or delivery fails.
* **dotenv** (`^17.4.2`) loads backend environment variables. The server also uses Node.js built-in modules including `http`, `crypto`, `fs`, and `path`.

### Browser integrations and quality tooling

* The frontend loads **Google Identity Services** from Google's hosted `accounts.google.com/gsi/client` script. The backend verifies Google ID tokens through Google's `oauth2.googleapis.com/tokeninfo` endpoint.
* User avatar URLs are generated with the hosted **DiceBear** API (`api.dicebear.com`).
* **Playwright** (`^1.60.0`) is a backend dependency used by the browser QA script. The repository also contains standalone Node.js test/integration scripts; there is no `test` script declared in either package manifest.
* **Nodemon** (`^3.1.14`) is a backend development dependency used by the `npm run dev` script.

### Build and deployment configuration

* Run npm commands separately from `backend/` and `frontend/`; each has its own lockfile.
* The backend Dockerfile builds from **Node 20 Alpine**, runs `node server.js`, and exposes port `5001`.
* The frontend Dockerfile builds the Vite app with **Node 20 Alpine**, then serves the generated static files using **Nginx Alpine** on port `80`. `frontend/nginx.conf` falls back to `index.html` for client-side routes.
* Root and frontend `vercel.json` files contain SPA rewrite configuration. These files document deployment configuration only; they do not establish that a particular hosting service is currently deployed.
* The backend's default development/start commands are `npm run dev` (Nodemon) and `npm start` (Node). The frontend provides `npm run dev`, `npm run build`, `npm run preview`, and `npm run lint`.

---

## 🛠️ Key Gameplay Features

1. **Multiplayer Matchmaking & Lobbies**: Support for 2 to 8 players. Persistent lobbies allow users to select custom tokens, mark themselves ready, and chat.
2. **Automated AI Bots**: Host players can add smart AI bots that act dynamically, trade, make decisions, bid in auctions, build monopolies, and even engage in reactive chat trash-talk when paying or receiving rent.
3. **Emergency Loan System**: Madras Banking Corp offers emergency cash loans (flat 20% interest rate, due in 5 turns) to players in debt, liquidating assets automatically if they default.
4. **Auctions**: Properties declined by players immediately go to open bidding where everyone bids in real-time until a winner is determined.
5. **Anti-Cheat & Reliability**: Server-authoritative state reduction prevents arbitrary client-side cheating. The server auto-saves matches and resumes them seamlessly if the server reboots.
6. **AFK Watchdog & Reconnect Grace**: Idle players are skipped after 90 seconds. Disconnected players get a 60-second grace window to rejoin before their assets are liquidated.

---

## 🧠 Recent Engineering Fixes (Elaborated)

Over the course of development, we identified and solved several challenging edge cases that were causing connection drops, UI locking, or button-tap failures—specifically on mobile devices.

### 1. Mobile Modal Touch Interception & Bubbling
* **The Problem**: On mobile Safari and Chrome, tapping buttons (like the **Accept** and **Reject** buttons in the Trade Review card) inside modals caused the modal's outer backdrop container's click handler (`onClick={onClose}`) to fire immediately. This was due to how mobile browsers emulate mouse clicks from touch events and bubble them up. Because the backdrop handler fired first or simultaneously, it immediately unmounted the modal before the async button click callback could execute and dispatch the trade event to the server.
* **The Solution**: We restructured the backdrop event handlers. Instead of relying solely on `e.stopPropagation()` inside the modal card (which mobile browsers sometimes bypass during tap emulation), we updated the backdrop's `onClick` to check `if (e.target === e.currentTarget)`. This guarantees that the modal will **only** close if the user explicitly taps the backdrop itself, and never when a tap bubbles up from an inner button. We applied this defensive guard across `TradeModal`, `LoanModal`, `PropertyPurchaseModal`, and `Chancedeckanimation`.

### 2. Transient Reconnection Failures & Spectator Demotion
* **The Problem**: When a player refreshed the page or suffered a temporary network drop, their client tried to re-establish the game state. However, if the server was restarting or database queries lagged, the `reconnectRoom` socket request would fail. The client-side catch block mistakenly assumed that *any* failure meant the player was new to the room (e.g. someone using a copied direct link), and automatically joined them as a spectator. This permanently demoted players to spectators with no way to regain control of their tokens.
* **The Solution**: We updated the client-side handlers in both `GameRoom.jsx` and `Lobby.jsx` to inspect the error returned by the server. The client now only falls back to spectator mode if the server explicitly rejects the player with a `Room not found` or `Player not found in this room` validation error. If the error is due to a network timeout, socket disconnect, or server lag, the client skips the spectator fallback and triggers a retry loop that attempts to restore the player session every 2 seconds (up to 5 attempts) once the socket reconnects.

### 3. Server-Side Auto-Healing Socket Mappings
* **The Problem**: The backend maps active socket connections to rooms using an in-memory `socketToRoom` lookup map (`socket.id` -> `roomCode`). If a socket connection dropped and reconnected, but the client's reconnection handshake packet failed or ran into a race condition, the `socketToRoom` entry remained empty. The next time the player tried to send a gameplay event, the server would reject it with a confusing `You are not in a room` error.
* **The Solution**: We added an auto-healing fallback directly inside the server's room validation middleware (`guardInRoom`). If a socket ID is missing from the `socketToRoom` map, the server will scan all active rooms in memory. If it finds a matching socket ID assigned to a player or spectator inside a room, it immediately reconstructs the map association, heals the mapping on the fly, and lets the action proceed cleanly.

### 4. Bot Execution Loops & Recovery
* **The Problem**: When bots had negative funds, the backend bot cycle entered an infinite loop of failing dispatches because even-build building rules blocked their house sales, causing the server console to freeze. Similarly, if a bot landed on an unowned property it couldn't afford, it attempted to trigger an invalid auction.
* **The Solution**: We refactored `raiseBotCash` to loop through property sales robustly rather than exiting early on a single failure. If all asset liquidations fail, the bot declares bankruptcy cleanly. We also corrected the unowned property decline branch to trigger `endTurn` rather than an invalid auction.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
Install Node.js (the Docker images use Node 20). MongoDB is optional: without a reachable MongoDB instance the backend falls back to in-memory storage and, for rooms, users, and feedback, local JSON files. Completed-match history in fallback mode is process-memory-only.

### 2. Clone and Setup Environment
Define your environment variables. In `frontend/.env` (or setup backend environment):
```bash
# Frontend configuration (.env)
VITE_BACKEND_URL=http://localhost:5001
```

### 3. Start Backend
```bash
cd backend
npm install
npm run dev # or node server.js
```

### 4. Start Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
