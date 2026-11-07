const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const steamRoutes = require('./routes/steam');

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(publicDir));
app.use('/api/steam', steamRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api', (req, res) => {
  res.json({ name: 'SteamCity API', health: '/api/health' });
});

app.listen(port, () => {
  console.log(`SteamCity is running at http://localhost:${port}`);
});
