const mongoose = require('mongoose');
const { Schema } = mongoose;

const TourRennerSchema = new Schema({
    nr: Number,
    renner: { type: Schema.Types.ObjectId, ref: 'Renner' },
    ploeg: { type: String, trim: true },
    status: {
        type: Date(),
        enum: ['Actief', 'Gevallen', 'Doping', 'Afgestapt', 'Anders'],
        default: 'Actief'
    }
});

module.exports = mongoose.model('TourRenner', TourRennerSchema);