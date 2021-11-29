const express = require('express');
const AppError = require('../js/AppError');
const router = express.Router();
const wrapAsync = require('../js/wrapAsync')
const { isAdmin } = require('../js/middleware');
const Tourrenner = require('../models/tourrenner');

const Uitslag = require('../models/uitslag');
const poolSetting = require('../public/data/tourdata');
const _ = require('lodash');

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
    const uitslag = await Uitslag.find({ jaar: poolSetting.tourjaar })
    const tourrenners = await Tourrenner.find({}).populate('renner')

    const renners = _.sortBy(tourrenners, function(item) {
        return [item.renner.aNaam]
    })

    res.render('admin/rituitslag', { uitslag, renners })
}))

router.post('/rituitslag', wrapAsync(async(req, res, next) => {
    const { ritnr, ritUitsl, geel, groen, bol, wit } = req.body
    console.log(ritUitsl, geel)
    const qry = { jaar: poolSetting.tourjaar, ritnr: ritnr }
    let uitslag = await Uitslag.find(qry)
    if (uitslag) {
        Uitslag.deleteOne(qry)
    }
    uitslag = await new Uitslag({
        jaar: poolSetting.tourjaar,
    })
    uitslag.etappes.push({
        ritnr: ritnr,
        ritUitsl: [],
    })
    for (let i = 0; i < ritUitsl.length; i++) {
        uitslag.etappes.ritUitsl.push({
            plaats: i + 1,
            renner: ritUitsl[i]
        })
    }
    for (let i = 0; i < geel.length; i++) {
        uitslag.etappes.geel.push({ plaats: i + 1, renner: geel[i] })
    }
    for (let i = 0; i < groen.length; i++) {
        uitslag.etappes.groen.push({ plaats: i + 1, renner: groen[i] })
    }
    for (let i = 0; i < bol.length; i++) {
        uitslag.etappes.bol.push({ plaats: i + 1, renner: bol[i] })
    }
    for (let i = 0; i < wit.length; i++) {
        uitslag.etappes.wit.push({ plaats: i + 1, renner: wit[i] })
    }

    console.log(uitslag)

    // const newUitslag = await uitslag.save();
    res.send("Opgeslagen ???")
}))

module.exports = router;