const { WebSocketServer } = require("ws");
const http = require("http");

const PORT = 3001;
const clients = new Set();

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
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ count: clients.size }));
  broadcast();

  ws.on("close", () => {
    clients.delete(ws);
    broadcast();
  });

  ws.on("error", () => {
    clients.delete(ws);
    broadcast();
  });

  // keepalive
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

// heartbeat every 30s, kill dead connections
setInterval(() => {
  for (const ws of clients) {
    if (!ws.isAlive) { clients.delete(ws); ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  broadcast();
}, 30000);

server.listen(PORT, () => {
  console.log(`Presence server on :${PORT}`);
});
