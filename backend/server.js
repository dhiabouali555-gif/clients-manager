const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'clients.json');

app.use(express.json({ limit: '5mb' }));

function readState() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { clients: [], selectedId: null };
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const d = JSON.parse(raw);
    return {
      clients: Array.isArray(d.clients) ? d.clients : (Array.isArray(d) ? d : []),
      selectedId: d.selectedId || null
    };
  } catch (e) {
    return { clients: [], selectedId: null };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

app.get('/api/state', (req, res) => {
  res.json(readState());
});

app.put('/api/state', (req, res) => {
  const body = req.body || {};
  const state = {
    clients: Array.isArray(body.clients) ? body.clients : [],
    selectedId: body.selectedId || null
  };
  writeState(state);
  res.json({ ok: true });
});

// Serve frontend
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

app.listen(PORT, () => {
  console.log('Clients manager backend running on http://localhost:' + PORT);
});
