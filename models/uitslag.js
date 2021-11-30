const mongoose = require('mongoose')
const { Schema } = mongoose;

const UitslagSchema = new Schema({
    jaar: Number,
    etappes: [{
        ritnr: Number,
        ritUitsl: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' }
        }, ],
        geel: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' },
            eind: Boolean
        }, ],
        groen: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' },
            eind: Boolean
        }, ],
        bol: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' },
            eind: Boolean
        }, ],
        wit: [{
            plaats: Number,
            renner: { type: Schema.Types.ObjectId, ref: 'Tourrenner' }
        }, ]
    }]
})

module.exports = mongoose.model('Result', UitslagSchema);