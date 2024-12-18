const express = require("express");
const sql = require("mssql");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken")

const dbconfig = 
{
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    server: process.env.DB_SERVER,
    options: 
        {
        encrypt: true,
        trustServerCertificate: true,
        }
};
  

const app = express();



// middleware her:
app.use(express.json());
app.use(cors());


const PORT = process.env.PORT || 3000; // benytter den først hvis api'en er hostet, 
// hvis den er null kører api'en sikkert lokalt og benytter port 3000

async function connectDb() {
    try {
      const pool = await sql.connect(dbconfig);
      console.log('Connected to SQL Server');
      return pool;
    } catch (err) {
      console.error('Database connection failed:', err.message);
    }
  }

  app.listen(PORT, async () => {
    const pool = await connectDb();
    console.log(`Server is now listening on localhost:${PORT}/`);
  });


  app.get('/api/items/allitems', async (req, res) => {
    try {
     const { category } = req.query;
     const token = req.headers['authorization']?.split(' ')[1];
      const pool = await sql.connect(dbconfig);
      const result = await pool.request().query(`
        select itemId, title, description, imgLink, rating, amountOfRating, price, quantity, categories.category 
        FROM items 
        INNER JOIN categories on items.category = categories.id;
        `);
        let filteredItems = result.recordset;
        

        jwt.verify(token, process.env.JWT_ENCRYPTION_CODE, (err, decoded) => {
          if(err || !decoded){
          filteredItems = filteredItems.map(item => ({ ...item, price: null }));
          }
        });

        if (category !== 'all'){
          
          filteredItems = filteredItems.filter(item => item.category === category);
          res.json(filteredItems);
        }
        else{
      res.json(filteredItems);
        }
    } catch (err) {
      console.error('Error querying database:', err); 
      res.status(500).json({ message: 'Server Error', error: err.message });
    }
  });



  app.post('/api/users/createuser', async (req, res) => 
  {
    try 
    {
    const pool = await sql.connect(dbconfig);
    const { username, passcode } = req.body;
    const result = await pool.request()
    .input('username', sql.VarChar, username)
    .input('passcode', sql.VarChar, passcode) // bekæmper SQL injection :D
    .query('INSERT INTO users (username, passcode) VALUES (@username, @passcode)');
      res.json(result.recordset);
    } 
    catch (err) {
      console.error('error attempting to create user:', err);
      
      res.status(500).json({ message: 'a server error occoured: ', error: err.message });
    }
  });

  app.post('/api/users/login', async (req, res) => 
  {
    
    const { username, passcode } = req.body;
    const pool = await sql.connect(dbconfig);
    const result = await pool.request()
    .input('username', sql.VarChar, username)
    .input('passcode', sql.VarChar, passcode) // bekæmper SQL injection :D
    .query(`SELECT username from users where username = @username AND passcode = @passcode`);
    if(result.recordset.length == 1){
      const token = jwt.sign({username}, process.env.JWT_ENCRYPTION_CODE, {expiresIn: '15m'});
      const returnusername = result.recordset[0].username
      res.json({token,username: returnusername});
    } 
    else{
      res.status(400).json({ message: 'Invalid username or password' });
    }
  })

  app.delete('/api/users/deleteuser', async ( req, res) => {
    try{
      const { username } = req.body;
      const pool = await sql.connect(dbconfig);
      const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query('DELETE FROM users WHERE username = @username');
      
      if (result.rowsAffected[0] > 0) {
        res.status(200).json({ message: `${username} user deleted` });
      } 
      else
      {
        res.status(404).json({ message: 'User not found' });
     }
    }
    catch(err){
      res.status(500).json({ message: 'errir in server', error: err.message });
    }
    
  })