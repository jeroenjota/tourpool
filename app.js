// modules
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const app = express();
const passport = require('passport');
const LocalStrategy = require('passport-local');
const methodOverride = require('method-override');
const morgan = require('morgan');
const AppError = require('./js/AppError');
// others
const flash = require('express-flash');

// routes
const userRoutes = require('./routes/users');
const rennerRoutes = require('./routes/renners');
const tourRoutes = require('./routes/tours');
const teamRoutes = require('./routes/userteams');

// models
const User = require('./models/user');

const poolSetting = require('./public/data/tourdata')

// middleware
app.use(express.urlencoded({
    extended: true
}))

// to use themes
app.use('/semantic', express.static(path.join(__dirname + '/semantic')));
app.use('/css', express.static(path.join(__dirname + '/public/css')));
app.use('/js', express.static(path.join(__dirname + '/public/js')));
app.use('/img', express.static(path.join(__dirname + '/public/img')));
// logging
app.use(morgan('tiny'))

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

app.use(express.static(path.join(__dirname + 'public/data')));
app.use(methodOverride('_method'));


const sessionOptions = {
    secret: 'ditishetgrotejotaGEHEIM',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24,
        maxAge: 1000 * 60 * 60 * 24
    }
}
app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.gebruiker = req.user;
    res.locals.setting = poolSetting
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    next();
})

app.use('/users', userRoutes);
app.use('/renners', rennerRoutes);
app.use('/tours', tourRoutes);
app.use('/userteams', teamRoutes);

let deGebruiker = {}

// database
main().catch(err => console.log(err));
async function main() {
    await mongoose.connect('mongodb://localhost:27017/tourpool');
}

//  homeroutes
app.get('/', (req, res) => {
    res.render('index')
})


app.get('/home', (req, res) => {

    res.render('index')

})


// nothing matched so far
app.all('*', (req, res, next) => {
    next(new AppError("Pagina niet gevonden", 404))
})

app.use((err, req, res, next) => {
    const {
        status = 500
    } = err;
    if (!err.message) {
        err.message = "??? FOUTE BOEL ???"
    }
    res.status(status).render('error', {
        err
    });
})

const port = 3000;
app.listen(port, () => {
    console.log(`Connected to server on port ${port}`)
})