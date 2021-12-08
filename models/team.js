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



module.exports = mongoose.model('Team', TeamSchema)