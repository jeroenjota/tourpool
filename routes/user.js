const express = require('express');
const con = require('../helpers/database');
const router = express.Router();

// read
router.get("/", (req, res) => {
  const qry = 'SELECT * FROM users order by isAdmin DESC, aNaam, vNaam'
  con.db.query(qry, (err, rows) => {
    if (err) { console.log("FOUT: " + err) }
    res.render('users', { title: 'Gebruikers', users: rows })
  })
});

//read 1
router.get("/:id", async function (req, res) {
  try {
    const userQry = "SELECT id, username, vNaam, tNaam, aNaam, email from users WHERE id = ?"
    const rows = await con.db.query(userQry, req.params.id)
    res.status(200).json(rows);
  } catch (error) {
    res.status(400).send(error.message)
  }
  res.send("Gevonden" + rows[0].username)
})
// Create
router.post('/', async function (req, res) {
  try {
    var { username, vNaam, tNaam, aNaam, email, password } = req.body
    const pw = await con.hashPassword(password, 10)
    var nwReg = {
      username: username,
      vNaam: vNaam,
      tNaam: tNaam,
      aNaam: aNaam,
      email: email,
      password: pw,
    }
    const qry = "INSERT INTO users SET ? "
    con.db.query(qry, nwReg, (err, row) => {
      if (err) throw err;
      if (row) {
        console.log("Gebruiker toegevoegd", row)
      } else {
        console.log("Gebruiker toevoegen niet gelukt")
      }
    })
  } catch {
    console.log('Database probleem')
  }
})

router.post('/login', async function (req, res) {
  try {
    const { username, password } = req.body

    const sqlGetUser = "Select username, password from users WHERE username = ?"
    const rows = await pool.query(sqlGetUser, username)
    if (rows.length) {
      // res.status(200).json(rows[0])
      const isValid = con.compPassword(password, rows[0].password)
      res.status(200).json({ isValid: isValid })
    } else {
      res.send(`Gebruiker ${username} niet gevonden`)
    }

  } catch (error) {
  }
})

module.exports = router;
