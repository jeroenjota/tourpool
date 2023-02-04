var express = require('express');
var router = express.Router();
const con = require('../helpers/database')

router.get('/fakeusers', (req, res) => {
  con.fakeusers()
  res.redirect("/")
})

router.get("/initdb", (req, res) => {
  // vernieuw de database
  con.init()
  res.redirect("/")
})

router.get("/", (req, res) => {
  res.redirect("/")
})

module.exports = router