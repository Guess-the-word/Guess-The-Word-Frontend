// Run after building the backend. Uses the frontend's existing Socket.IO client.
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const { createGameServer } = require('../../Guess-The-Word-Backend/dist/server');
const server = createGameServer();
const clients = [];
let action = 0;
const waitState = (client, predicate, timeout = 8000) => {
  if (client.state && predicate(client.state)) return Promise.resolve(client.state);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { client.off('roomUpdate', listener); reject(new Error('State update timed out')); }, timeout);
    const listener = state => {
      if (predicate(state)) { clearTimeout(timer); client.off('roomUpdate', listener); resolve(state); }
    };
    client.on('roomUpdate', listener);
  });
};
const request = (client, event, extra = {}) => new Promise((resolve, reject) => {
  const state = client.state || {};
  client.timeout(3000).emit(event, {
    roomName: 'network1', lobbyId: state.lobbyId, matchId: state.matchId,
    turnId: state.turnId, actionId: `network-${++action}`, ...extra,
  }, (error, result) => error ? reject(error) : resolve(result));
});
const accepted = async (...args) => assert.equal((await request(...args)).ok, true);
const rejected = async (...args) => assert.equal((await request(...args)).ok, false);
async function connect(url, nickname, roomName = 'network1') {
  const client = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(client);
  client.on('roomUpdate', state => { client.state = state; });
  await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
  await accepted(client, 'joinRoom', { roomName, nickname });
  await waitState(client, state => state.players.includes(client.id));
  return client;
}
(async () => {
  try {
    await new Promise(resolve => server.httpServer.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    const a = await connect(url, 'Alex');
    const b = await connect(url, 'Alex');
    await waitState(a, state => state.players.length === 2);
    assert.equal(a.state.hostId, a.id);
    assert.deepEqual(a.state.teams, { '1': [a.id], '2': [b.id] });
    await rejected(b, 'startGame');
    await rejected(b, 'updateSettings', { rounds: 7, turnSeconds: 90 });
    await accepted(a, 'updateSettings', { rounds: 3, turnSeconds: 30 });
    await waitState(b, state => state.settings.turnSeconds === 30);
    const startPayload = { lobbyId: a.state.lobbyId };
    await accepted(a, 'startGame', startPayload);
    await rejected(a, 'startGame', startPayload);
    await waitState(b, state => state.status === 'playing');
    assert.equal(b.state.yourWord, null);
    const c = await connect(url, 'Alex');
    assert.deepEqual(c.state.waitingPlayers, [c.id]);
    assert.equal(c.state.yourWord, null);
    await rejected(c, 'guessWord', { guess: a.state.yourWord });
    const outsider = await connect(url, 'Outsider', 'another1');
    await rejected(outsider, 'resetGame', { roomName: 'network1', matchId: a.state.matchId });
    await rejected(outsider, 'correctWord', { roomName: 'network1', matchId: a.state.matchId, turnId: 0 });
    const relay = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Video signaling relay timed out')), 3000);
      b.once('webrtc-signal', payload => { clearTimeout(timer); resolve(payload); });
    });
    a.emit('webrtc-signal', { target: b.id, callerId: 'forged', signal: { type: 'offer', sdp: 'test-only' } });
    assert.deepEqual(await relay, { callerId: a.id, signal: { type: 'offer', sdp: 'test-only' } });
    await rejected(a, 'skipWord', { matchId: null });
    await waitState(a, state => state.phase === 'active');
    await waitState(b, state => state.phase === 'active');
    await accepted(b, 'guessWord', { guess: 'this is wrong' });
    assert.equal(b.state.turnId, 0);
    const oldTurn = { matchId: a.state.matchId, turnId: 0, actionId: 'duplicate' };
    await accepted(b, 'guessWord', { ...oldTurn, guess: a.state.yourWord.toUpperCase() });
    await waitState(a, state => state.phase === 'reveal');
    assert.equal(a.state.history[0].outcome, 'correct');
    assert.equal(a.state.yourWord, null);
    await rejected(a, 'correctWord');
    await waitState(a, state => state.turnId === 1 && state.phase === 'active');
    await rejected(a, 'correctWord', oldTurn);
    await accepted(b, 'skipWord');
    await waitState(a, state => state.turnId === 2 && state.phase === 'active');
    await accepted(a, 'skipWord');
    await waitState(b, state => state.turnId === 3 && state.phase === 'active');
    await accepted(b, 'correctWord');
    await waitState(a, state => state.turnId === 4 && state.phase === 'active');
    await accepted(a, 'correctWord');
    console.log('PASS: network authorization, same-name players, private words, spectators, duplicate and stale actions');
    console.log('Waiting for the final 30-second turn to expire…');
    await waitState(a, state => state.status === 'finished', 40000);
    await waitState(b, state => state.status === 'finished');
    await waitState(c, state => state.status === 'finished');
    for (const client of [a, b, c]) {
      assert.deepEqual(client.state.score, { '1': 2, '2': 1 });
      assert.equal(client.state.winner, '1');
      assert.equal(client.state.history.length, 6);
      assert.equal(client.state.timeLeft, 0);
      assert.equal(client.state.yourWord, null);
    }
    const finished = a.state;
    b.disconnect();
    await waitState(a, state => state.players.length === 2);
    assert.equal(a.state.status, 'finished');
    assert.deepEqual(a.state.history, finished.history);
    const d = await connect(url, 'Alex');
    assert.equal(d.state.status, 'finished');
    assert.equal(d.state.waitingPlayers.includes(d.id), true);
    await rejected(d, 'resetGame');
    await accepted(a, 'resetGame');
    await waitState(c, state => state.status === 'waiting');
    assert.equal(c.state.waitingPlayers.length, 0);
    assert.equal(c.state.teams['2'].includes(c.id), true);
    assert.equal(c.state.history.length, 0);
    assert.equal(c.state.guesses.length, 0);
    await rejected(a, 'resetGame', { matchId: finished.matchId });
    await rejected(a, 'startGame', startPayload);
    await accepted(a, 'startGame');
    await waitState(c, state => state.status === 'playing');
    await rejected(a, 'correctWord', oldTurn);
    const aId = a.id;
    a.disconnect();
    await waitState(c, state => state.status === 'waiting' && state.hostId === c.id);
    assert.equal(c.state.notice.includes('Match canceled'), true);
    assert.equal(c.state.players.includes(aId), false);
    await accepted(c, 'updateSettings', { rounds: 5, turnSeconds: 90 });
    c.disconnect();
    await waitState(d, state => state.players.length === 1 && state.hostId === d.id);
    await accepted(d, 'leaveRoom');
    d.disconnect();
    const fresh = await connect(url, 'Fresh');
    assert.deepEqual(fresh.state.settings, { rounds: 3, turnSeconds: 60 });
    assert.equal(fresh.state.hostId, fresh.id);
    console.log('PASS: complete 2–1 match, synchronized results, results departures/arrivals, rematch, host transfer and empty-room cleanup');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    for (const client of clients) client.disconnect();
    await server.close();
  }
})();
