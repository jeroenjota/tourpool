const mysql = require('mysql')
const dotenv = require('dotenv')
const fs = require("fs")
const { faker } = require('@faker-js/faker');

const bcrypt = require('bcrypt')

dotenv.config({ path: '.env_local' })

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  multipleStatements: true,
});

const hashPassword = async (ps) => {
  return await new Promise((res, rej) => {
    bcrypt.hash(ps, 10, (err, hash) => {
      if (err) rej(err);
      res(hash)
    })
  })
}

const compPassword = async (pw1, pw2) => {
  return await bcrypt.compare(password, rows[0].password)
}


const init = async function () {

  // USE WITH CARE !!!

  fs.readFile("./public/sql/db.sql", "utf-8", async function (err, data) {
    if (err) throw err

    db.query(data, async function (err, rows) {
      if (err) throw err
      const pw = await hashPassword(process.env.DB_PASS)
      console.log("Tour tabellen vernieuwd")
      var admin = {
        username: process.env.DB_USER,
        vNaam: process.env.ADMVNAAM,
        aNaam: process.env.ADMANAAM,
        email: process.env.ADMEMAIL,
        password: pw
      }
      console.log("admin")
      var addAdmin = "INSERT INTO users SET ?"
      console.log("admin aangemaakt")
      db.query(addAdmin, admin, (err, result) => {
        if (err) throw err
        console.log("Admin " + process.env.DB_USER + " toegevoegd");
      })

    })
  })
};

const fakeusers = () => {
  var data = []
  for (var i = 0; i < 50; i++) {
    data.push([
      faker.helpers.unique(faker.internet.userName).slice(0, 32),
      faker.name.firstName().slice(0, 32),
      faker.name.middleName().slice(0, 12),
      faker.name.lastName().slice(0, 32),
      faker.helpers.unique(faker.internet.email),
      faker.internet.password(12),
      faker.date.between('2023-01-01T00:00:00.000Z', '2023-02-03T00:00:00.000Z')
    ])
  }
  // en vul met 50 fake users
  const qry = "INSERT INTO users (username, vNaam, tNaam, aNaam, email, password, created_at) VALUES ?"
  db.query(qry, [data], (err, result) => {
    if (err) throw err
    console.log('50 Fake users toegevoegd')
  })
}

module.exports = { db, init, compPassword, fakeusers, hashPassword }
