const express = require('express');
const morgan = require('morgan');
const stringsRouter = require('./routes/strings');

// Express app entry point
const app = express();


app.use(express.json());
app.use(morgan('dev'));


app.get('/health', (_req, res) => res.json({ status: 'ok' }));


app.use('/strings', stringsRouter);

app.get('/', (_req, res) => {
  res.json({
    name: 'String Analyzer API',
    status: 'ok',
    docs: {
      health: '/health',
      create: 'POST /strings',
      list: 'GET /strings',
      get_specific: 'GET /strings/{string_value}',
      natural_language: 'GET /strings/filter-by-natural-language?query=...',
      delete: 'DELETE /strings/{string_value}'
    }
  });
});

// 404 fallback
app.use((req, res) => {
return res.status(404).json({ error: 'Not Found' });
});


// Error handler
app.use((err, _req, res, _next) => {
console.error(err);
return res.status(500).json({ error: 'Internal Server Error' });
});


module.exports = app;