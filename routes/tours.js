const express = require('express');
const router = express.Router();
const poolSetting = require('../public/data/tourdata')


router.get('/', (req, res) => {
    // if (!req.session.gebruikerID) {
    //   res.redirect('/login')
    // } else {
    res.render('tour/tourgegevens', {
            setting: poolSetting
        })
        // }
})


module.exports = router;