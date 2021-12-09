const mongoose = require('mongoose')
const { Schema } = mongoose;

const UitslagSchema = new Schema({
    jaar: Number,
    etappes: [{
        ritnr: Number,
        rit: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' },
            punten: Number
        }, ],
        geel: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' },
            punten: Number,
            eind: Boolean
        }, ],
        groen: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' },
            punten: Number,
            eind: Boolean
        }, ],
        bol: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' },
            punten: Number,
            eind: Boolean
        }, ],
        wit: [{
            plaats: Number,
            punten: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' }
        }, ]
    }]
})

UitslagSchema.set('toObject', { virtuals: true })
UitslagSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model('Result', UitslagSchema);