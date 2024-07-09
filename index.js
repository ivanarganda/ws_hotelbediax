require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require("body-parser");
const mysql = require('mysql');

const PORT = process.env.PORT;

app.use(cors()); // Allow requests from all origins
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Database connection configuration with connection pooling
const pool = mysql.createPool({
  connectionLimit: 20,
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DB,
  connectTimeout: 30000, // Increase timeout to 30 seconds
  acquireTimeout: 30000  // Increase acquire timeout to 30 seconds
});

async function executeQuery(query, values) {
  return new Promise((resolve, reject) => {
    const attemptQuery = (retries) => {
      pool.query(query, values, (error, results) => {
        if (error) {
          if (retries > 0) {
            console.warn(`Retrying query... (${retries} attempts left)`);
            setTimeout(() => attemptQuery(retries - 1), 1000);
          } else {
            return reject(error);
          }
        } else {
          resolve(results);
        }
      });
    };
    attemptQuery(3); // Retry 3 times before failing
  });
}

// Middleware to validate paths
app.use((req, res, next) => {
  const allowedPaths = ['/', '/countries', '/destination' , '/destinations', '/destinations/create', '/destinations/update', '/destinations/delete'];
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
app.post('/destinations', async (req, res) => {
  try {
    let { filtersSidebar , total_records = false, search = '', page = 1, per_page = 400 } = req.body;
    let clausure_like = '';
    const queryParams = [];

    if (total_records) {
      if (search !== '') {
        clausure_like = `
          WHERE d.name LIKE ? OR c.name LIKE ? OR d.description LIKE ? OR d.countrycode LIKE ? OR d.type LIKE ?
        `;
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }
      const [total] = await executeQuery(`SELECT COUNT(*) AS total FROM destinations d LEFT JOIN countries c ON d.countrycode = c.countrycode ${clausure_like}`, queryParams);
      res.json({ total_records: total.total });
      return;
    }

    // Ensure page and per_page are numbers and have valid default values
    page = parseInt(page) || 1;
    per_page = parseInt(per_page) || 400;

    const offset = (page - 1) * per_page;

    const queryBase = `
      SELECT
        d.id AS id,
        d.name AS destination_name,
        d.countrycode AS country_code,
        c.name AS country_name,
        d.description AS description,
        d.type AS type
      FROM destinations d
      LEFT JOIN countries c ON d.countrycode = c.countrycode
    `;

    if (search !== '') {
      clausure_like = `
        WHERE ( d.name LIKE ? OR c.name LIKE ? OR d.description LIKE ? OR d.countrycode LIKE ? OR d.type LIKE ? )
      `;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    } else {
      clausure_like = '';
    }

    if ( filtersSidebar.destination_name || filtersSidebar.description || filtersSidebar.country || filtersSidebar.type ){
      const filterCriteria = [];
      if (filtersSidebar.destination_name) filterCriteria.push(`d.name LIKE?`);
      if (filtersSidebar.description) filterCriteria.push(`d.description LIKE?`);
      if (filtersSidebar.country) filterCriteria.push(`c.name LIKE?`);
      if (filtersSidebar.type) filterCriteria.push(`d.type LIKE?`);
      clausure_like += ` ${search === '' ? 'WHERE' : 'OR' } (${filterCriteria.join(' AND ')})`;
      queryParams.push(...filtersSidebar.destination_name? [ `%${filtersSidebar.destination_name}%` ] : [],
                         ...filtersSidebar.description? [ `%${filtersSidebar.description}%` ] : [],
                         ...filtersSidebar.country? [ `%${filtersSidebar.country.split('--')[0]}%` ] : [],
                         ...filtersSidebar.type? [ `%${filtersSidebar.type}%` ] : []);
    } 

    const queryPagination = `LIMIT ?, ?`;
    queryParams.push(offset, per_page);

    const finalQuery = `${queryBase} ${clausure_like} ${queryPagination}`;

    const results = await executeQuery(finalQuery, queryParams); 
    res.json(results);

  } catch (error) {
    console.error('Error in retrieving destination data', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});


app.get('/destination', async (req, res) => {

  try {

    const query = `SELECT
        d.id AS id,
        d.name AS destination_name,
        d.countrycode AS country_code,
        c.name AS country_name,
        d.description AS description,
        d.type AS type
    FROM destinations d LEFT JOIN countries c ON d.countrycode = c.countrycode WHERE d.id = ${req.query.id}`;

    const results = await executeQuery(query);

    res.json(results);

  } catch (error) {
    console.error('Error in retrieving destination data', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }

});

// Route to get countries
app.get('/countries', async (req, res) => {
  try {

    const query = `SELECT
        c.name AS country,
        c.countrycode AS country_code
    FROM countries c`;

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
    const { name, description, country_code, type } = req.body;
    if (!name || !description || !country_code || !type) {
      return res.status(400).json({ 'Error': 'Invalid input' });
    }

    const query = `INSERT INTO destinations (name, description, countrycode, type, last_modif) 
                   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
    const values = [name, description, country_code, type];

    const result = await executeQuery(query, values);
    res.status(201).json({ 'Message': 'Destination created', 'id': result.insertId });
  } catch (error) {
    console.error('Error in creating destination', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});

// Route to update a destination
app.put('/destinations/update', async (req, res) => {
  try {
    const { id, name, description, country_code, type } = req.body;
    if (!id || !name || !description || !country_code || !type) {
      return res.status(400).json({ 'Error': 'Invalid input' });
    }

    const query = `
      UPDATE destinations 
      SET 
        name = ?, 
        description = ?, 
        countrycode = ?, 
        type = ?
      WHERE id = ?
    `;

    const values = [name, description, country_code, type, id];

    // Execute the query
    await executeQuery(query, values);

    res.status(200).json({ 'Message': 'Destination updated successfully', id });
  } catch (error) {
    console.error('Error in updating destination', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});

// Route to delete a destination
app.delete('/destination', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ 'Error': 'Invalid input' });
    }
    const query = `DELETE FROM destinations WHERE id = ${id}`;
    await executeQuery(query);
    res.status(200).json({ 'Success': id });
  } catch (error) {
    console.error('Error in deleting destination', error);
    res.status(500).json({ 'Error': 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
