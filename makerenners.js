const mongoose = require('mongoose');
const AppError = require('./js/AppError');
const Renner = require('./models/renner');
const Wielrenner = require('./models/wielrenner');

// database
main().catch(err => console.log(err));
async function main() {
    await mongoose.connect('mongodb://localhost:27017/tourpool');
    console.log("Database connected")
}


const makeRennerCollection = async() => {
    const renners = await Renner.find({}, { _id: 1, vNaam: 1, tNaam: 1, aNaam: 1 })
    if (!renners) {
        throw new AppError(error, 400)
    }
    for (renner of renners) {
        console.log(renner)
        const fietser = new Wielrenner(renner);
        console.log(fietser)
        if (!fietser) {
            throw new AppError("Renner niet aangemaakt")
        }
        newFietser = await fietser.save()
            // console.log(newFietser)
    }
}

makeRennerCollection()