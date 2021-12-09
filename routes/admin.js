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
        // console.log("Nieuwe uitslagen tabel")
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
    console.log("Rit: " + result.etappes[0].rit)
    res.render('admin/rituitslag', { result, renners })
}))

async function calculateScores(uitslag, ritnr) {
    // bereken de scores van de deelnemers
    // haal de uitslag op

    const klassementen = ["rit", "geel", "groen", "bol", "wit"]
    const etappe = uitslag.etappes[ritnr - 1]
        // haal de deelnemerRenners op
    const deelnPloegen = await Team.find({ jaar: poolSetting.tourjaar })
    if (!deelnPloegen) {
        return false
    }
    deelnPloegen.forEach(async function(plg) {
        let ttlPnt = 0
        klassementen.forEach(function(klsmnt) {
                etappe[klsmnt].forEach(function(plaats) {
                    // de renners zonder reserves
                    const ploeg = plg.renners.slice(0, poolSetting.rennerAant)
                    ploeg.forEach((p) => {
                        // moet met 'equals'vanwege mongo ID
                        if (p.equals(plaats.renner)) {
                            ttlPnt += plaats.punten
                        }
                    })
                })
            })
            // console.log("ploeg: " + plg.teamname, "updaten met : " + ttlPnt)
        const updTeamPnt = await Team.findById(plg._id)
        var fnd = false
        updTeamPnt.punten.forEach((etap) => {
            if (etap.etappe == ritnr) {
                etap.pnt = ttlPnt
                fnd = true
            }
        })
        if (!fnd) {
            updTeamPnt.punten.push({ etappe: ritnr, pnt: ttlPnt })
        }
        const updPloeg = await updTeamPnt.save()
            // console.log("Ploeg is bijgewerkt:" + updPloeg.teamname, ttlPnt)
    })
}


function setEtapResult(uitslag, pntArr) {
    // clear the array
    let etappe = []
    for (let i = 0; i < uitslag.length; i++) {
        etappe.push({
            plaats: i + 1,
            renner: uitslag[i],
            punten: pntArr[i]
        })
    }
    console.log(etappe)
    return etappe
}

router.post('/rituitslag', wrapAsync(async(req, res, next) => {
    const { etappes } = req.body
    const { ritnr } = req.body
    console.log(req.body)
    const etappeAant = poolSetting.tourEtappes[poolSetting.tourEtappes.length - 1].nr
    let result = await Result.findOne({ jaar: poolSetting.tourjaar })
    if (!result || result.length === 0) {
        // Nieuw record voor deze tour
        result = new Result({ jaar: poolSetting.tourjaar })
    }
    // kijk of de huidige etappe al is ingevoerd
    if (!result.etappes[ritnr - 1]) {
        result.etappes.push({ ritnr: ritnr })
        console.log("Nieuwe etappe aangemaakt ")
    }
    // is dit de laatste etappe (dan moeten er andere trui punten worden gegeven)
    const eind = (ritnr == etappeAant)
        // en voeg ook de renners uit de uitslage bij de rit & truien toe
    let klassementen = ["rit", "geel", "groen", "bol", "wit"]
    klassementen.forEach(function(klassement) {
        if (!eind) {
            result.etappes[ritnr - 1][klassement] = setEtapResult(req.body[klassement], poolSetting.punten.etappe[klassement])
        } else {
            result.etappes[ritnr - 1][klassement] = setEtapResult(req.body[klassement], poolSetting.punten.eindstand[klassement])
        }
    })

    newUitsl = await result.save()
    console.log(newUitsl, ritnr)
    await calculateScores(newUitsl, ritnr)
        // const newUitslag = await result.save();
    res.redirect('/admin/rituitslag')
}))

module.exports = router;