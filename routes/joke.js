var express = require('express');
var router = express.Router();

router.get('/', (req, res) => {
  // console.log("joke")
  res.render('joke', {
    title: "Grapje",
    joke: {
      vraag: 'Hoe noem je een hond die kan toveren?',
      antwoord: 'een labarcadabrador'
    }
  }
  );
});

module.exports = router;