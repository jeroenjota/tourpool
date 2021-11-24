const express = require('express');
const AppError = require('../js/AppError');
const router = express.Router();
const wrapAsync = require('../js/wrapAsync')
const { isAdmin } = require('../js/middleware');
const { route } = require('./renners');
const Team = require('../models/team');

router.get("/pay", isAdmin, wrapAsync(async(req, res, next) => {
    const teams = await Team.find({}).populate('user')
        .sort({ teamname: 1 })
    if (!teams) {
        req.flash('error', "Geen teams gevonden")
        return redirect('/')
    }
    console.log(teams)
    res.render('admin/tourforms', { teams })

}))

router.get('/togglepay/:id', isAdmin, wrapAsync(async(req, res, next) => {
    const { id } = req.params;
    updTeam = await Team.findById(id)
    if (!updTeam) {
        req.flash('error', "Team update is niet gelukt ??")
        return res.redirect('/admin/pay')
    }
    updTeam.betaald = !updTeam.betaald;
    await updTeam.save()
    res.redirect('/admin/pay')
}))

module.exports = router;