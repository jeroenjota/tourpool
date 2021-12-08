const express = require('express');
const AppError = require('../js/AppError');
const router = express.Router();
const wrapAsync = require('../js/wrapAsync')
const { isAdmin } = require('../js/middleware');
const Tourrenner = require('../models/tourrenner');
const Team = require("../models/team")
const Result = require('../models/result');
const poolSetting = require('../public/data/tourdata');
const _ = require('lodash');
const { rearg } = require('lodash');

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

router.get('/rituitslag', wrapAsync(async(req, res, next) => {
    let result = await Result.findOne({ jaar: poolSetting.tourjaar })
    if (!result) {
        console.log("Nieuwe uitslagen tabel")
        let result = new Result({ jaar: poolSetting.tourjaar })
        try {
            result.save();
        } catch (e) {
            req.flash('error', "Kon geen nieuwe uitslag aanmaken: " + e)
            res.redirect('/')
        }
    }
    const tourrenners = await Tourrenner.find({}).populate('renner')
    if (!tourrenners) {
        req.flash("error", "Kon de renners tabel niet vinden")
        res.redirect("/")
    }
    const renners = _.sortBy(tourrenners, function(item) {
        return [item.renner.aNaam]
    })
    if (result.etappes.length) {
        result.etappes = _.sortBy(result.etappes, function(item) {
            return [item.ritnr]
        })
    }
    console.log("Result: " + result)
    res.render('admin/rituitslag', { result, renners })
}))

async function calculateScores(ritnr) {
    // bereken de scores van de deelnemers
    // haal de uitslag op
    const ritUitslag = await Result.find({ jaar: poolSetting.tourjaar })
        // haal de deelnemerRenners op
    const deelnPloegen = await Team.find({ jaar: poolSetting.tourjaar })
    for (var plg of deelnPloegen) {
        console.log(teamName)
        for (var renner of plg.renners) {

        }
    }
}

function setEtapResult(etap, wat, arr, uitslag, pntArr) {
    etappeAant = poolSetting.tourEtappes[poolSetting.tourEtappes.length - 1].nr
    for (let i = 0; i < arr.length; i++) {
        uitslag.etappes[etap][wat].push({
            plaats: i + 1,
            renner: arr[i],
            punten: pntArr[i]
        })
    }
}

router.post('/rituitslag', wrapAsync(async(req, res, next) => {
    const { etappes } = req.body
    const { ritnr, ritUitsl, geel, groen, bol, wit } = req.body
    const etappeAant = poolSetting.tourEtappes[poolSetting.tourEtappes.length - 1].nr
    let result = await Result.findOne({ jaar: poolSetting.tourjaar })
    if (!result || result.length === 0) {
        console.log("Geen uitslag gevonden")
        result = new Result({ jaar: poolSetting.tourjaar })
    } else {
        result.etappes.splice(ritnr - 1, 1)
    }
    let eind = ritnr = etappeAant
    result.etappes.push({
        ritnr: ritnr,
    })
    setEtapResult(ritnr - 1, "ritUitsl", ritUitsl, result, poolSetting.punten.etappe.uitslag)
    let truien = ["geel", "groen", "bol", "wit"]
    truien.forEach(function(trui) {
        if (!eind) {
            setEtapResult(ritnr - 1, trui, req.body[trui], result, poolSetting.punten.etappe.truien[trui])
        } else {
            setEtapResult(ritnr - 1, trui, req.body[trui], result, poolSetting.punten.eindstand[trui])
        }
    })

    newUitsl = await result.save()
    console.log(result, ritnr)
        // await calculateScores(result)
        // const newUitslag = await result.save();
    res.redirect('/admin/rituitslag')
}))

module.exports = router;