////////
/// tourrenner model
////////

//// De renners die in deze tour aktief zijn/waren

const mongoose = require('mongoose');
const { Schema } = mongoose;

const TourRennerSchema = new Schema({
    renner: { type: Schema.Types.ObjectId, ref: 'Renner' },
    nr: Number,
    ploeg: { type: String, trim: true },
    status: {
        type: String,
        enum: ['Actief', 'Gevallen', 'Doping', 'Afgestapt', 'Anders'],
        default: 'Actief'
    },
    lastChanged: { type: Date, default: Date.now }

});


module.exports = mongoose.model('Tourrenner', TourRennerSchema);