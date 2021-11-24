function isLoggedIn(req, res, next) {
    if (!req.isAuthenticated()) {
        // store url to be redirected to
        req.session.triedUrl = req.originalUrl
        req.flash('error', "Je moet zijn ingelogd hiervoor!");
        return res.redirect('/users/login');
    }
    next();
}

function isAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        // store url to be redirected to
        req.session.triedUrl = req.originalUrl
        req.flash('error', "Je moet zijn ingelogd hiervoor!");
        return res.redirect('/users/login');
    }
    if (!req.user.isAdmin) {
        req.flash('error', "Je moet zijn ingelogd hiervoor!");
        return res.redirect('#');
    }
    next();
}

module.exports = {
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin
}