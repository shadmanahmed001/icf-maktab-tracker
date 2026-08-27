const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const { initSchema, query } = require('./db');
const seedDatabase = require('./seed');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Mount API routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve client in production
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// Fallback handler for client-side routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.json({
    message: 'ICF Maktab Progress Tracker API Server Running',
    api: `http://localhost:${PORT}/api/admin/dashboard`,
    clientDev: 'Run client via npm run dev in client directory'
  });
});

async function startServer() {
  await initSchema();
  // Auto seed if terms table is empty
  const terms = await query(`SELECT COUNT(*) as count FROM terms`);
  if (!terms || terms[0].count === 0) {
    console.log('Database empty, automatically seeding...');
    await seedDatabase();
  }

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🕌 ICF Maktab Progress Tracker API Server`);
    console.log(`🚀 Running at http://localhost:${PORT}`);
    console.log(`📡 API Endpoints at http://localhost:${PORT}/api/admin/dashboard`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
