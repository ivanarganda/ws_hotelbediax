const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require("body-parser");
const mysql = require('mysql');

const PORT = process.env.PORT || 3000;

app.use(cors()); // Allow requests from all origins
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Database connection configuration with connection pooling
const pool = mysql.createPool({
  connectionLimit: 10,
  host: 'srv936.hstgr.io',
  user: 'u263299673_HotelBediaX',
  password: 'Admin1234*!',
  database: 'u263299673_HotelBediaX'
});

// Function to execute SQL queries with retry logic
const executeQuery = (query) => {
  return new Promise((resolve, reject) => {
    pool.query(query, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

// Middleware to validate paths
app.use((req, res, next) => {
  const allowedPaths = ['/', '/destinations', '/destinations/create', '/destinations/update', '/destinations/delete'];
  if (allowedPaths.includes(req.path)) {
    next();
  } else {
    res.status(406).json({ 'Error': 'Invalid path' });
  }
});

// Route to render index page
app.get('/', async (req, res) => {
  try {
    res.render('index', {
      port: PORT,
      currentTime: new Date().toLocaleString()
    });
  } catch (error) {
    console.error('Error in rendering index page', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});

// Route to get destinations
app.get('/destinations', async (req, res) => {
  try {
    const query = `SELECT * FROM destinations`;
    const results = await executeQuery(query);
    res.json(results);
  } catch (error) {
    console.error('Error in retrieving destination data', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});

// Route to create a destination
app.post('/destinations/create', async (req, res) => {
  try {
    // const { name, countryCode } = req.body;
    // if (!name || !countryCode) {
    //   return res.status(400).json({ 'Error': 'Invalid input' });
    // }
    // const query = `INSERT INTO destinations (name, countryCode) VALUES ('${name}', '${countryCode}')`;
    // const result = await executeQuery(query);
    // res.status(201).json({ 'Message': 'Destination created', 'id': result.insertId });
    res.status(201).json({ 'Message': 'Destination created' });
  } catch (error) {
    console.error('Error in creating destination', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});

// Route to update a destination
app.put('/destinations/update', async (req, res) => {
  try {
    const { id, name, countryCode } = req.body;
    if (!id || !name || !countryCode) {
      return res.status(400).json({ 'Error': 'Invalid input' });
    }
    // const query = `UPDATE destinations SET name = '${name}', countryCode = '${countryCode}' WHERE id = ${id}`;
    // await executeQuery(query);
    res.status(200).json({ 'Message': id });
  } catch (error) {
    console.error('Error in updating destination', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});

// Route to delete a destination
app.delete('/destinations/delete', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ 'Error': 'Invalid input' }); 
    }
    // const query = `DELETE FROM destinations WHERE id = ${id}`;
    // await executeQuery(query);
    res.status(200).json({ 'Message': id });
  } catch (error) {
    console.error('Error in deleting destination', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
