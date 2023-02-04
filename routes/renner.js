const express = require('express');
const con = require('../helpers/database');
const router = express.Router();

//create
//WERKT NOG NIET (iig niet met POSTMAN)
router.post("/", (req, res) => {
  console.log("Post route")
  const { vNaam, tNaam, aNaam } = req.body
  console.log(req.body)
  if (vNaam) {
    var rNaam = aNaam + ', ' + vNaam.substring(0) + '. ' + tNaam
    rNaam = rNaam.trim()
  }
  console.log([vNaam, tNaam, aNaam, rNaam])
  qry = "UPDATE renners SET vNaam =?, tNaam =?, aNaam =?, rNaam= ? WHERE id = ?"
  con.db.query(qry, [vNaam, tNaam, aNaam, rNaam], (err, row) => {
    if (err) throw err
    if (row) {
      console.log("Renner toegevoegd", row)
    } else {
      console.log("Renner toevoegen niet gelukt")
    }
    res.redirect("/")
  })
})
//retrieve
router.get("/", (req, res) => {
  // alle renners
  const qry = "Select * from renners"
  con.db.query(qry, (err, rows) => {
    res.send(rows)
  })
})
router.get("/:id", (req, res) => {
  // alle renners
  const { id } = req.params
  console.log(id)
  const qry = "Select * from renners WHERE id = ?"
  con.db.query(qry, [id], (err, rows) => {
    console.log(rows[0])
    res.send(rows)
  })
})

//update
router.put("/update/:id", (req, res) => {
  const { id, vNaam, tNaam, aNaam } = req.body

  var rNaam = aNaam + ', ' + vNaam.substring(0) + '. ' + tNaam
  rNaam = rNaam.trim()
  qry = "UPDATE renners SET vNaam =?, tNaam =?, aNaam =?, rNaam= ? WHERE id = ?"
  con.db.query(qry, [vNaam, tNaam, aNaam, rNaam, id], (err, row) => {
    if (err) throw err
    console.log("Renner aangepast")
    res.redirect("/")
  })
})

//delete
router.delete("/delete/:id", (req, res) => {
  const { id } = req.params
  qry = "DELETE FROM renners WHERE id = ? "
  con.db.query(qry, id, (err, row) => {
    if (err) throw err
    console.log("Renner verwijderd")
    res.redirect("/")
  })
})

module.exports = router