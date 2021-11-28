const express = require('express');
const AppError = require('../js/AppError');
const router = express.Router();
const Tourrenner = require('../models/tourrenner');
const Renner = require('../models/renner');
const wrapAsync = require('../js/wrapAsync');
const Team = require('../models/team')
const { isLoggedIn } = require('../js/middleware');
const poolSetting = require('../public/data/tourdata');
const mongoose = require('mongoose');
const renner = require('../models/renner');
// lodash
const _ = require('lodash');


router.get("/newteam", isLoggedIn, wrapAsync(async(req, res, next) => {

    const renners = await Tourrenner.find({}).populate('renner')


    if (!renners) {
        req.flash('error', "Geen renners gevonden voor deze tour")
        return res.redirect('/');
    }
    // sort the array on aNaam (lodash)
    const renSort = _.sortBy(renners, function(item) {
        return [item.renner.aNaam]
    })
    res.render('userteams/new', { renners: renSort })
}))

router.post('/newteam', isLoggedIn, wrapAsync(async(req, res, next) => {
    const { renners, teamname } = req.body
    const renList = await Tourrenner.find()
    const team = new Team({
        jaar: poolSetting.tourjaar,
        user: req.user._id,
        teamname: teamname
    })

    for (let i = 0; i < renners.length; i++) {
        // if (isValidObjectId(renners[i])) {
        //     team.renners.push({ position: i, id: renners[i] })
        // }
        if (renners[i].substring(0, 9) != "Selecteer") {
            try {
                team.renners.push(renners[i])
            } catch (err) {
                team.renners.push(null)
            }
        } else {
            team.renners.push(null)
        }
    }
    req.session.team = team;
    console.log(await team.populate({ path: 'renners', populate: { path: 'renner', model: 'Renner' } }))
    try {
        const newTeam = await team.save();
    } catch (e) {
        var errMsg = ""
        if (e.name === 'MongoError' && e.code === 11000) {

            next(new Error('Team naam bestaat al'))
        } else {
            next()
        }
        // const newTeam = team.populate('renners')
        // return res.render('userteams/new', { team })
    }
    res.redirect('/userteams')
        //const newTeam = new Team(team)
}))

router.get('/:id/edit', isLoggedIn, wrapAsync(async(req, res, next) => {
    const { id } = req.params
    const team = await Team.findById(id).populate('user').populate({ path: 'renners', populate: { path: 'renner', model: 'Renner' } })
    if (!team) {
        req.flash('error', 'team is niet gevonden???')
        return res.redirect('userteams/index')
    }
    console.log(team)
    const renners = await Tourrenner.find({}).populate({ path: 'renner' })
    if (!renners) {
        throw new AppError("Geen renners bekend???", 404)
        return res.redirect('/');
    }
    const renSort = _.sortBy(renners, function(item) {
        return [item.renner.aNaam]
    })

    res.render('userteams/edit', { team: team, renners: renSort })
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
    const updatedTeam = await Team.findById(id)
    updatedTeam.teamname = team.teamname;
    updatedTeam.renners = renners;
    try {
        await updatedTeam.save();
    } catch (e) {
        if (e.code === 11000) {
            errMsg = "Sorry, die teamnaam bestaat al! Geef een andere op"
        } else {
            errMsg = "Foutmelding: " + e
        }
        req.flash('error', errMsg)
        return res.redirect('/userteams/' + id + '/edit')
    }
    res.redirect("/userteams")
}))

router.get('/', isLoggedIn, wrapAsync(async(req, res, next) => {
    const userteams = await Team.find({
        user: req.user._id
    }).populate('user').populate({ path: 'renners', populate: { path: 'renner', model: 'Renner' } })
    console.log(userteams)
    res.render('userteams/index', {
        userteams: userteams
    })
}))



module.exports = router;