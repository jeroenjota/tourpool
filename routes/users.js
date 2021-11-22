const express = require('express');
const AppError = require('../js/AppError');
const router = express.Router();
const userValidate = require('../validations/schemas.js')
const User = require('../models/user');
const wrapAsync = require('../js/wrapAsync');
const passport = require('passport');

const validateUser = (req, res, next) => {
    const { error } = userValidate.userSchema.validate(req.body)
    if (error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new AppError(msg, 400)
    } else {
        next();
    }
}

router.get('/login', (req, res) => {
    res.render('users/login')
})

router.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/users/login' }), (req, res) => {
    req.flash('success', "Welkom terug")
    const redirectUrl = req.session.triedUrl || '/'
    delete req.session.triedUrl
    res.redirect(redirectUrl)
})

router.get('/logout', (req, res) => {
    req.logout();
    req.flash('success', "Je bent uitgelogd, tot een volgende keer")
    res.redirect('/')
})

router.get('/register', (req, res) => {
    res.render('users/register')
})

router.post('/register', wrapAsync(async(req, res, next) => {
    // Add user to the database
    try {
        const { user } = req.body;
        const gebruiker = new User({
            username: user.username,
            vNaam: user.vNaam,
            tNaam: user.tNaam,
            aNaam: user.aNaam,
            email: user.email,
        })
        if (user.username === 'jeroenjota' && user.email === 'jeroen@jota.nl') {
            console.log("User = admin")
            gebruiker.isAdmin = true
        }
        const newUser = await User.register(gebruiker, user.wachtwoord);
        req.login(newUser, err => {
            if (err) return next(err);
        })
        req.flash("success", 'Aangemeld, welkom bij de Tourpool!')
        res.redirect('/')
    } catch (e) {
        req.flash('error', e.message)
        res.redirect('/users/register')
    }
}))

router.get('/profiel', wrapAsync(async(req, res, next) => {
    res.render('users/profiel')
}))

router.post('/profiel/:id', wrapAsync(async(req, res, next) => {
    const gebruiker = req.body
    const filter = {
        username: gebruiker.username
    }
    const update = {
        username: gebruiker.username,
        vNaam: gebruiker.vNaam,
        tNaam: gebruiker.tNaam,
        aNaam: gebruiker.aNaam,
        email: gebruiker.email
    }
    let gebr = await User.findOneAndUpdate(filter, update)
    res.redirect('/');
}))

module.exports = router;