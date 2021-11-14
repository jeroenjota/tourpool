const express = require('express');
const AppError = require('../js/AppError');
const router = express.Router();
const Renner = require('../models/renner');
const wrapAsync = require('../js/wrapAsync');
const Team = require('../models/team')
const { isLoggedIn } = require('../js/middleware');
const poolSetting = require('../public/data/tourdata');
const mongoose = require('mongoose');
const ObjectId = require('mongoose').Types.ObjectId;

function isValidObjectId(id) {

    if (ObjectId.isValid(id)) {
        if ((String)(new ObjectId(id)) === id)
            return true;
        return false;
    }
    return false;
}

router.get('/newteam', isLoggedIn, wrapAsync(async(req, res, next) => {
    const renners = await Renner.find({}).sort('aNaam')
    if (!renners) {
        throw new AppError("Geen renners bekend???", 404)
        return res.redirect('/');
    }
    res.render('ploegen/new', { renners })
}))

router.post('/newteam', isLoggedIn, wrapAsync(async(req, res, next) => {
    const { renners } = req.body
    console.log(renners)

    const team = new Team({
        jaar: poolSetting.tourjaar,
        user: req.user._id,
        teamname: req.body.teamname,
    })
    for (let i = 0; i < renners.length; i++) {
        // if (isValidObjectId(renners[i])) {
        //     team.renners.push({ position: i, id: renners[i] })
        // }
        console.log(renners[i])
        if (renners[i]) {
            team.renners.push({ position: i, id: renners[i] })
        }
    }
    const newTeam = await team.save();
    if (!newTeam) {
        req.flash('error', "Ploeg kon niet worden aangemaakt")
        return res.redirect('/ploegen')
    }
    res.redirect('/ploegen')
        //const newTeam = new Ploeg(team)
}))

router.get('/:id/edit', isLoggedIn, wrapAsync(async(req, res, next) => {
    const { id } = req.params
    const ploeg = await Team.findById(id).populate('renners').populate('user')
    if (!ploeg) {
        req.flash('error', 'ploeg is niet gevonden???')
        return res.redirect('ploegen/index')
    }
    console.log(ploeg)
    const renners = await Renner.find({}).sort('aNaam')
    if (!renners) {
        throw new AppError("Geen renners bekend???", 404)
        return res.redirect('/');
    }

    res.render('ploegen/edit', { ploeg, renners })
}))

router.get('/', isLoggedIn, wrapAsync(async(req, res, next) => {
    const ploegen = await Team.find({
        user: req.user._id
    }).populate('renners').populate('user')
    res.render('ploegen/index', {
        ploegen: ploegen
    })
}))



module.exports = router;