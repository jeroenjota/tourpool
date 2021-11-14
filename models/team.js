const mongoose = require('mongoose')
const { Schema } = mongoose

const TeamSchema = new Schema({
    jaar: { type: Number },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    teamname: {
        type: String,
        required: true,
        unique: [true, 'Naam bestaat al']
    },
    renners: [{
        position: { type: Number },
        renner: { type: Schema.Types.ObjectId, ref: 'Renner' }
    }],
}, { timestamps: true })

module.exports = mongoose.model('Team', TeamSchema)