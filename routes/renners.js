const express = require('express');
const AppError = require('../js/AppError');
const router = express.Router();
const Renner = require('../models/renner');
const wrapAsync = require('../js/wrapAsync')
const { isLoggedIn } = require('../js/middleware')
    // ROUTES to RENNERS

router.get('/', (req, res) => {
    // aantal renners op pagina
    var perPage = 12 // (req.query.records == null) ? 1 : req.query.records;
    var page = (req.query.page == null) ? 1 : req.query.page;
    Renner
        .find({})
        .sort({
            nr: 1
        })
        .collation({
            locale: 'nl',
            numericOrdering: true
        })
        .skip((perPage * page) - perPage)
        .limit(perPage) // console.log(renners)
        .exec(function(err, renners) {
            Renner.count().exec(function(err, count) {
                if (err) return next(err)
                res.render('renners/index', {
                    current: page,
                    "renners": renners,
                    "pages": Math.ceil(count / perPage)
                })
            })
        })
})

router.get('/new', isLoggedIn, (req, res) => {
    res.render('renners/new');
})

router.post('/', isLoggedIn, wrapAsync(async(req, res, next) => {
    // sla de renner op
    //if (!req.body.renner.aNaam) throw new AppError('Achternaam van een renner is verplicht', 400)
    const rennerSchema = Joi.object({
        renner: Joi.object({
            vNaam: Joi.string().alphanum(),
            tNaam: Joi.string().alphanum(),
            aNaam: Joi.string().alphanum(),
            nr: Joi.number().integer().min(1).max(250),
            land: Joi.string().alphanum(),
            ploeg: Joi.string().alphanum()
        })
    })
    const renner = new Renner(req.body.renner);
    const newRenner = await renner.save();
    if (!newRenner) {
        req.flash('error', "Renner is niet opgeslagen???")
        return res.redirect('/renners')
    }
    const renNaam = renner.vNaam + ' ' + renner.tNaam + ' ' + renner.aNaam
    res.flash('success', `Renner ${renNaam} is toegevoegd`)
    res.redirect(`/renners/${renner._id}`)
}))

router.get("/:id", isLoggedIn, wrapAsync(async(req, res, next) => {
    const {
        id
    } = req.params;
    const renner = await Renner.findById(id)
    if (!renner) {
        throw new AppError('Renner niet gevonden', 404)
    }
    // console.log(`Renner: ${renner}`);
    res.render('renners/show', {
        renner: renner
    })
}))

router.put('/:id', isLoggedIn, wrapAsync(async(req, res, next) => {
    if (!req.body.renner.aNaam) throw new AppError('Achternaam van een renner is verplicht', 400)
    const {
        id
    } = req.params
    const renner = await Renner.findByIdAndUpdate(id, {
        ...req.body.renner
    })
    req.flash('info', 'Renner is opgeslagen')
    res.redirect(`/renners`)

}))

router.delete("/:id", isLoggedIn, wrapAsync(async(req, res, next) => {
    const {
        id
    } = req.params;
    Renner.deleteOne({ _id: id });
    req.flash('success', 'Renner is verwijderd')
    res.redirect(`/renners`)
}))

module.exports = router;