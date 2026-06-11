# Monopoly India Online 🎲🇮🇳

Welcome to **Monopoly India Online**! This is a modern, full-stack, real-time multiplayer implementation of the classic board game, themed around India's most prestigious properties, cities, and utilities (from Chennai to Mumbai Marine Drive). 

The game is built with a responsive frontend optimized for both desktop and mobile layouts, and a server-authoritative backend engine that runs gameplay rules, coordinates bot interactions, manages lobbies, and protects the game board state.

---

## 🚀 Technology Stack

* **Frontend**: React 19, React Router v7, TailwindCSS, Vite
* **Backend**: Node.js, Express, Socket.IO (WebSockets), Mongoose (MongoDB)
* **Persistent Recovery**: In-memory caching with MongoDB updates and JSON fallback files for robust match state recovery.

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
Make sure you have [Node.js](https://nodejs.org/) installed and a running [MongoDB](https://www.mongodb.com/) instance (optional, the server automatically falls back to in-memory mode with local fallback files if MongoDB is not found).

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
