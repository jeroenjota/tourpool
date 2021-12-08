/////////////
// TEAM model
/////////////
/// This is the model for the user teams (NOT the Tour teams)
/////////////
//////// ???????????????????????
// for now we use the RENNER model this should be the TOURRENNER model
/////////// !!!!!!!!!!!!!!!!!!!!!!!
const mongoose = require('mongoose')
const { Schema } = mongoose

const TeamSchema = new Schema({
    jaar: { type: Number },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    teamname: {
        type: String,
        trim: true,
        required: true,
        unique: [true, 'Naam bestaat al']
    },
    renners: [{ type: Schema.Types.ObjectId, ref: 'Tourrenner' }],
    punten: [{
        etappe: Number,
        pnt: Number
    }],
    betaald: Boolean,
}, { timestamps: true })

TeamSchema.set('toObject', { virtuals: true })
TeamSchema.set('toJSON', { virtuals: true })

TeamSchema.virtual('ttlPnt').get(function() {
    let ttl = 0
    this.punten.forEach((etap) => {
        ttl += etap.pnt
    })
    return ttl;
})
module.exports = mongoose.model('Team', TeamSchema)