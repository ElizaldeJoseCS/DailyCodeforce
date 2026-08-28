const { WebSocketServer } = require("ws");
const http = require("http");
const { URL } = require("url");

const PORT = 3001;
// clientId -> WebSocket
const clients = new Map();

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

function broadcast() {
  const msg = JSON.stringify({ count: clients.size });
  for (const ws of clients.values()) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientId = url.searchParams.get("cid") || Math.random().toString(36).slice(2);

  const existing = clients.get(clientId);
  if (existing && existing !== ws) {
    try { existing.terminate(); } catch {}
  }

  clients.set(clientId, ws);
  ws.send(JSON.stringify({ count: clients.size }));
  broadcast();

  ws.on("close", () => {
    if (clients.get(clientId) === ws) {
      clients.delete(clientId);
    }
    broadcast();
  });

  ws.on("error", () => {
    if (clients.get(clientId) === ws) {
      clients.delete(clientId);
    }
    broadcast();
  });

  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

setInterval(() => {
  for (const [cid, ws] of clients) {
    if (!ws.isAlive) { clients.delete(cid); ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  broadcast();
}, 30000);

server.listen(PORT, () => {
  console.log(`Presence server on :${PORT}`);
});
