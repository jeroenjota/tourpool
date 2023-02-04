var express = require('express')
var path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: '.env_local' })
const app = express()
const bodyparser = require('body-parser')
const PORT = process.env.PORT || 3000


var indexRouter = require('./routes/index')
var jokeRouter = require('./routes/joke')
var userRouter = require('./routes/user')
var adminRouter = require('./routes/admin')
var rennerRouter = require('./routes/renner')

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(bodyparser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter)
app.use('/joke', jokeRouter)
app.use('/user', userRouter)
app.use('/admin', adminRouter)
app.use('/renner', rennerRouter)


app.listen(PORT, () => {
  console.log(`Gestart op poort ${PORT}`);
})

