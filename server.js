const express = require('express');
const cors = require('cors');
const path = require('path');
const searchRoute = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve frontend static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/search', searchRoute);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
