var express = require('express');
var router = express.Router();
const con = require('../helpers/database')

router.get("/", (req, res) => {
  // vindt aantal gebruikers in database
  const qrySet = "SET lc_time_names = 'nl_NL'; "
  con.db.query(qrySet, (err, result) => {
    if (err) { console.log("FOUT: " + err) }
    const tourQry = "SELECT tournaam, jaar,Date_Format(startdatum,'%W %e %M') as startdatum,	Date_Format(einddatum,'%W %e %M') as einddatum,	nummer,	Date_Format(datum,'%a %e %M') as datum,	van,	naar, 	afstand,	rittype FROM tours t JOIN etappes e ON e.tour_id = t.id"
    const poolQry = "SELECT * FROM pools WHERE tour_id = ( SELECT id FROM tours WHERE jaar = ?) "
    const curYear = new Date().getFullYear()
    con.db.query(tourQry, curYear, (err, tourrows) => {
      if (err) { console.log("FOUT: " + err) }
      con.db.query(poolQry, curYear, (err, poolrows) => {
        if (err) { console.log("FOUT: " + err) }
        res.render('index', { title: "Jota's Tourpool", tour: tourrows, pool: poolrows })
      })
    })
  })
});

module.exports = router