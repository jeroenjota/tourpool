/////////////
// TOUR model
/////////////
/// not used for now. We have a JSON file for this. 
/// public/data/tourdata.js
////////////


const mongoose = require('mongoose')
const { Schema } = mongoose;

const TourSchema = new Schema({
    jaar: Number,
    datum: {
        start: Date,
        eind: Date
    },
    etappes: [{
        nr: Number,
        datum: Date,
        van: String,
        naar: String,
        kms: Number,
        type: {
            type: String,
            enum: ['vlak', 'tijdrit', 'heuvels', 'bergen', 'rustdag']
        }
    }]

})