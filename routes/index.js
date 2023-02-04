var express = require('express');
var router = express.Router();
const con = require('../helpers/database')

router.get("/", (req, res) => {
  // vindt aantal gebruikers in database
  const qry = 'SELECT COUNT(*) aant FROM users'
  con.db.query(qry, (err, rows) => {
    if (err) { console.log("FOUT: " + err) }
    const aantal = rows[0].aant
    res.render('index', { title: 'Jota', userCnt: aantal })
  })
});

module.exports = router;