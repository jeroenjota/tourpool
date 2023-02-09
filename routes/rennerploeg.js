const express = require('express');
const con = require('../helpers/database');
const router = express.Router();

//create
router.post("/", (req, res) => {
  const { ploegNaam, land, id } = req.body
  console.log(ploegNaam, land, id)
  if (id > 0) {
    qry = "UPDATE rennerploegen SET ploegNaam = ?, land = ? WHERE id = " + id
  } else {
    qry = "INSERT INTO rennerploegen (ploegNaam, land) VALUES (?, ?)"
  }
  con.db.query(qry, [ploegNaam, land], (err, row) => {
    if (err) throw err
    if (row) {
      console.log("Rennerploeg toegevoegd", row)
    } else {
      console.log("Rennerploeg toevoegen niet gelukt")
    }
    res.redirect("/rennerploeg")
  })
})

//retrieve
router.get("/", (req, res) => {
  // alle rennerploegen
  var qry = "SELECT id, ploegNaam, land, tour_id,tourPloeg_id, IFNULL(t.ploegnummer,0) ploegnummer "
  qry += "from rennerploegen r LEFT JOIN "
  qry += "tourploegen t ON r.id = t.ploeg_id "
  qry += "ORDER BY ploegnummer, ploegNaam"
  console.log(qry)
  con.db.query(qry, (err, rows) => {
    if (err) { console.log("FOUT in SQL") }
    res.render('rennerploegen.pug', { title: 'Ploegen', rennerploegen: rows })
  })
})
router.get("/:id", (req, res) => {
  // alle rennerploegen
  const { id } = req.params
  console.log(id)
  const qry = "Select * from rennerploegen WHERE id = ?"
  con.db.query(qry, [id], (err, rows) => {
    console.log(rows[0])
    res.send(rows)
  })
})

//update
router.put("/update/:id", (req, res) => {
  const { id, ploegNaam, land } = req.body

  qry = "UPDATE rennerploegen SET ploegNaam =?, land =? WHERE id = ?"
  con.db.query(qry, [ploegNaam, land, id], (err, row) => {
    if (err) throw err
    console.log("Rennerploeg aangepast")
    res.redirect("/")
  })
})

//delete
router.delete("/delete/:id", (req, res) => {
  const { id } = req.params
  qry = "DELETE FROM rennerploegen WHERE id = ? "
  con.db.query(qry, id, (err, row) => {
    if (err) throw err
    console.log("Rennerploeg verwijderd")
    res.redirect("/")
  })
})

router.get("/addtotour/:id/:nr", (req, res) => {
  // ploeg in/uit de huidige tour
  var { id, nr } = req.params
  nr = parseInt(nr)
  id = parseInt(id)
  console.log("nr = " + nr)
  var tourid = 1
  const sqlstr = "SELECT tourPloeg_id FROM tourploegen WHERE ploeg_id = ? AND tour_id = ?"
  con.db.query(sqlstr, [id, tourid], (err, result) => {
    var actie
    if (err) throw err
    if (result.length > 0) {
      // ploeg is al in deze tour
      if (nr === 0) // weghalen
      {
        console.log(result)
        actie = "verwijderd"
        updstr = "DELETE FROM tourploegen WHERE ploeg_id = ? AND tour_id = ?"
      } else {
        updstr = "UPDATE tourploegen SET ploegnummer = " + nr + " WHERE ploeg_id = ? AND tour_id = ?"
        actie = "aangepast"
      }
    } else {
      // ploeg aan de tour toevoegen
      console.log(result)
      actie = "toegevoegd"
      updstr = "INSERT INTO tourploegen (ploeg_id, tour_id, ploegnummer) VALUES (?, ? , ?)"
    }
    con.db.query(updstr, [id, tourid, nr], (err, result) => {
      console.log("Rennerploeg = " + id, "tour = " + tourid, "Nummer: " + nr)
      if (err) throw err
      console.log("Tour ploeg is " + actie)
    })
  })
  res.redirect("/rennerploeg")
})

module.exports = router