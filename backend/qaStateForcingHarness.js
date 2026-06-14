/**
 * backend/qaStateForcingHarness.js
 *
 * Dedicating state-forcing QA test suite for Monopoly India.
 * Direct injection of game states via /api/qa/inject.
 * Verification of trade branches, house building restrictions, hotels, and bankruptcy mutations.
 */

'use strict';

const { io } = require('socket.io-client');
const http = require('http');

const BACKEND_URL = 'http://localhost:3000';
const INJECT_URL = `${BACKEND_URL}/api/qa/inject`;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const postJSON = (url, body) => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
};

const runQA = async () => {
  console.log("==================================================");
  console.log("🌟 EVIDENCE-BASED QA STATE-FORCING HARNESS");
  console.log("==================================================");

  const roomCode = 'QATEST';
  
  // Connect players
  const sA = io(BACKEND_URL, { transports: ['websocket'], forceNew: true });
  const sB = io(BACKEND_URL, { transports: ['websocket'], forceNew: true });

  await new Promise((resolve) => sA.once('connect', resolve));
  await new Promise((resolve) => sB.once('connect', resolve));

  const players = [
    { id: 'playerA', username: 'Player A', socketId: sA.id, ready: true, connected: true },
    { id: 'playerB', username: 'Player B', socketId: sB.id, ready: true, connected: true }
  ];

  // Helper to re-inject states to reset
  const inject = async (gameState) => {
    return postJSON(INJECT_URL, { roomCode, players, gameState, status: 'playing' });
  };

  const getStates = async () => {
    return new Promise((resolve) => {
      sA.emit('get-room-state', {}, (ack) => {
        resolve(ack.data);
      });
    });
  };

  // Setup generic initial gameState mockup
  const baseGameState = {
    status: 'playing',
    turnOrder: ['playerA', 'playerB'],
    currentTurnIdx: 0,
    hasRolled: true,
    pendingAction: null,
    players: {
      playerA: { id: 'playerA', username: 'Player A', money: 10000, position: 0, loanActive: false, isBankrupt: false },
      playerB: { id: 'playerB', username: 'Player B', money: 10000, position: 0, loanActive: false, isBankrupt: false }
    },
    properties: {
      1: { ownerId: null, houses: 0, hotel: false, mortgaged: false, tileId: 1 }, // Patna (Brown)
      3: { ownerId: null, houses: 0, hotel: false, mortgaged: false, tileId: 3 }  // Ranchi (Brown)
    }
  };

  try {
    // Join room codes first to map sockets
    await new Promise((resolve) => sA.emit('join-room', { code: roomCode, username: 'Player A', playerId: 'playerA' }, resolve));
    await new Promise((resolve) => sB.emit('join-room', { code: roomCode, username: 'Player B', playerId: 'playerB' }, resolve));

    // ─────────────────────────────────────────────────────────────────────────
    // 1. TRADE TEST (Success Path)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n==================================================");
    console.log("TRADE TEST: SUCCESS PATH");
    console.log("==================================================");

    const tradeState = JSON.parse(JSON.stringify(baseGameState));
    tradeState.properties[1].ownerId = 'playerA'; // Patna
    tradeState.properties[3].ownerId = 'playerB'; // Ranchi

    await inject(tradeState);

    let stateBefore = await getStates();
    console.log("Before:");
    console.log(`- Player A owns Patna (Tile 1): ${stateBefore.gameState.properties[1].ownerId}`);
    console.log(`- Player B owns Ranchi (Tile 3): ${stateBefore.gameState.properties[3].ownerId}`);

    console.log("\nSocket: initiate-trade");
    const initAck = await new Promise((resolve) => {
      sA.emit('initiate-trade', {
        targetId: 'playerB',
        offer: { money: 0, propertyIds: [1] },
        request: { money: 0, propertyIds: [3] }
      }, resolve);
    });
    console.log("Initiate response:", initAck);

    console.log("\nSocket: accept-trade");
    const acceptAck = await new Promise((resolve) => {
      sB.emit('accept-trade', {}, resolve);
    });
    console.log("Accept response:", acceptAck);

    let stateAfter = await getStates();
    console.log("\nAfter:");
    console.log(`- Player A owns Patna (Tile 1): ${stateAfter.gameState.properties[1].ownerId}`);
    console.log(`- Player B owns Ranchi (Tile 3): ${stateAfter.gameState.properties[3].ownerId}`);
    
    if (stateAfter.gameState.properties[1].ownerId === 'playerB' && stateAfter.gameState.properties[3].ownerId === 'playerA') {
      console.log("Result: PASS");
    } else {
      console.error("Result: FAIL");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. HOUSE BUILD TEST
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n==================================================");
    console.log("HOUSE BUILD TEST: SUCCESS PATH");
    console.log("==================================================");

    const houseState = JSON.parse(JSON.stringify(baseGameState));
    houseState.properties[1].ownerId = 'playerA'; // Patna
    houseState.properties[3].ownerId = 'playerA'; // Ranchi (completes Brown Monopoly)

    await inject(houseState);

    stateBefore = await getStates();
    console.log("Before:");
    console.log(`- Patna Houses: ${stateBefore.gameState.properties[1].houses}`);
    console.log(`- Player A Cash: ₹${stateBefore.gameState.players.playerA.money}`);

    console.log("\nSocket: build-house { tileId: 1 }");
    const buildAck = await new Promise((resolve) => {
      sA.emit('build-house', { tileId: 1 }, resolve);
    });
    console.log("Build response:", buildAck);

    stateAfter = await getStates();
    console.log("\nAfter:");
    console.log(`- Patna Houses: ${stateAfter.gameState.properties[1].houses}`);
    console.log(`- Player A Cash: ₹${stateAfter.gameState.players.playerA.money}`);
    
    if (stateAfter.gameState.properties[1].houses === 1) {
      console.log("Result: PASS");
    } else {
      console.error("Result: FAIL");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. HOTEL BUILD TEST
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n==================================================");
    console.log("HOTEL BUILD TEST: SUCCESS PATH");
    console.log("==================================================");

    const hotelState = JSON.parse(JSON.stringify(baseGameState));
    hotelState.properties[1].ownerId = 'playerA';
    hotelState.properties[1].houses = 4;
    hotelState.properties[3].ownerId = 'playerA';
    hotelState.properties[3].houses = 4; // Completed Monopoly + 4 houses on all

    await inject(hotelState);

    stateBefore = await getStates();
    console.log("Before:");
    console.log(`- Patna Houses: ${stateBefore.gameState.properties[1].houses}`);
    console.log(`- Patna Hotel: ${stateBefore.gameState.properties[1].hotel}`);

    console.log("\nSocket: build-hotel { tileId: 1 }");
    const hotelAck = await new Promise((resolve) => {
      sA.emit('build-hotel', { tileId: 1 }, resolve);
    });
    console.log("Hotel build response:", hotelAck);

    stateAfter = await getStates();
    console.log("\nAfter:");
    console.log(`- Patna Houses: ${stateAfter.gameState.properties[1].houses}`);
    console.log(`- Patna Hotel: ${stateAfter.gameState.properties[1].hotel}`);

    if (stateAfter.gameState.properties[1].hotel === true && stateAfter.gameState.properties[1].houses === 0) {
      console.log("Result: PASS");
    } else {
      console.error("Result: FAIL");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. BANKRUPTCY TEST
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n==================================================");
    console.log("BANKRUPTCY TEST: SUCCESS PATH");
    console.log("==================================================");

    const bankruptState = JSON.parse(JSON.stringify(baseGameState));
    bankruptState.players.playerA.money = -500; // Negative balance

    await inject(bankruptState);

    stateBefore = await getStates();
    console.log("Before:");
    console.log(`- Player A Bankrupt Status: ${stateBefore.gameState.players.playerA.isBankrupt}`);

    console.log("\nSocket: declare-bankruptcy");
    const bankruptAck = await new Promise((resolve) => {
      sA.emit('declare-bankruptcy', {}, resolve);
    });
    console.log("Bankruptcy response:", bankruptAck);

    stateAfter = await getStates();
    console.log("\nAfter:");
    console.log(`- Player A Bankrupt Status: ${stateAfter.gameState.players.playerA.isBankrupt}`);

    if (stateAfter.gameState.players.playerA.isBankrupt === true) {
      console.log("Result: PASS");
    } else {
      console.error("Result: FAIL");
    }

    sA.disconnect();
    sB.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Harness Exception:", err);
    sA.disconnect();
    sB.disconnect();
    process.exit(1);
  }
};

runQA();
