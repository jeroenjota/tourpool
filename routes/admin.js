const express = require('express');
const AppError = require('../js/AppError');
const router = express.Router();
const wrapAsync = require('../js/wrapAsync')
const { isAdmin } = require('../js/middleware');
const Tourrenner = require('../models/tourrenner');

const Uitslag = require('../models/uitslag');
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
    let uitslag = await Uitslag.findOne({ jaar: poolSetting.tourjaar })
    if (!uitslag) {
        let uitslag = new Uitslag({ jaar: poolSetting.tourjaar })
        try {
            uitslag.save();
        } catch {
            req.flash('error', "Kon geen nieuwe uitslag aanmaken")
            res.redirect('/')
        }
    }
    const tourrenners = await Tourrenner.find({}).populate('renner')

    const renners = _.sortBy(tourrenners, function(item) {
        return [item.renner.aNaam]
    })
    console.log(uitslag)
    res.render('admin/rituitslag', { uitslag, renners })
}))

router.post('/rituitslag', wrapAsync(async(req, res, next) => {
    const { etappes } = req.body
    console.log(req.body, poolSetting.tourjaar)
    const { ritnr, ritUitsl, geel, groen, bol, wit } = req.body
    const etappeAant = poolSetting.tourEtappes[poolSetting.tourEtappes.length - 1].nr
    let uitslag = await Uitslag.findOne({ jaar: poolSetting.tourjaar })
    if (!uitslag || uitslag.length === 0) {
        console.log("Geen uitslag gevonden")
        uitslag = new Uitslag({ jaar: poolSetting.tourjaar })
    } else {
        uitslag.etappes.splice(ritnr - 1, 1)
    }

    uitslag.etappes.push({
        ritnr: ritnr,
    })
    for (let i = 0; i < ritUitsl.length; i++) {
        uitslag.etappes[ritnr - 1].ritUitsl.push({
            plaats: i + 1,
            renner: ritUitsl[i],
        })
    }
    for (let i = 0; i < geel.length; i++) {
        uitslag.etappes[ritnr - 1].geel.push({
            plaats: i + 1,
            renner: geel[i],
            eind: ritnr === etappeAant
        })
    }
    for (let i = 0; i < groen.length; i++) {
        uitslag.etappes[ritnr - 1].groen.push({
            plaats: i + 1,
            renner: groen[i],
            eind: ritnr === etappeAant
        })
    }
    for (let i = 0; i < bol.length; i++) {
        uitslag.etappes[ritnr - 1].bol.push({
            plaats: i + 1,
            renner: bol[i],
            eind: ritnr === etappeAant
        })
    }
    for (let i = 0; i < wit.length; i++) {
        uitslag.etappes[ritnr - 1].wit.push({
            plaats: i + 1,
            renner: wit[i],
            eind: ritnr === etappeAant
        })
    }
    newUitsl = await uitslag.save()
    console.log(uitslag)

    // const newUitslag = await uitslag.save();
    res.redirect('/admin/rituitslag')
}))

module.exports = router;