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
const team = require('../models/team');

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
    res.render('userteams/new', { renners })
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
            team.renners.push(renners[i])
        }
    }
    const newTeam = await team.save();
    if (!newTeam) {
        req.flash('error', "Team kon niet worden aangemaakt")
        return res.redirect('/userteams')
    }
    res.redirect('/userteams')
        //const newTeam = new Team(team)
}))

router.get('/:id/edit', isLoggedIn, wrapAsync(async(req, res, next) => {
    const { id } = req.params
    const team = await Team.findById(id).populate('renners').populate('user')
    if (!team) {
        req.flash('error', 'team is niet gevonden???')
        return res.redirect('userteams/index')
    }
    console.log(team)
    const renners = await Renner.find({}).sort('aNaam')
    if (!renners) {
        throw new AppError("Geen renners bekend???", 404)
        return res.redirect('/');
    }

    res.render('userteams/edit', { team, renners })
}))

router.get('/:id/delete', isLoggedIn, wrapAsync(async(req, res, next) => {
    const { id } = req.params
    const team = await Team.findById(id)
    if (!team) {
        req.flash('error', "Team niet gevonden??")
        return res.redirect('userteams')
    }
    const teamName = team.teamname

    console.log(await Team.findByIdAndRemove(id))
    req.flash('success', `Team ${teamName} is verwijderd`)
    res.redirect('/userteams')
}))


router.post('/:id', isLoggedIn, wrapAsync(async(req, res, next) => {
    const { id } = req.params
    const { team, renners } = req.body;
    console.log(id, team, renners)
    const updatedTeam = await Team.findById(id)
    console.log('Gevonden: ' + updatedTeam)
    updatedTeam.teamname = team.teamname;
    updatedTeam.renners = renners;
    await updatedTeam.save();
    console.log('Aangepast: ' + updatedTeam)
    res.redirect("/userteams")
}))

router.get('/', isLoggedIn, wrapAsync(async(req, res, next) => {
    const userteams = await Team.find({
        user: req.user._id
    }).populate('user').populate('renners')
    res.render('userteams/index', {
        userteams: userteams
    })
}))



module.exports = router;