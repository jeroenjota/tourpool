const mongoose = require('mongoose')
const { Schema } = mongoose;

const RennerSchema = new Schema({
    nr: Number,
    vNaam: { type: String, trim: true },
    tNaam: { type: String, trim: true },
    aNaam: {

        type: String,
        trim: true,
        required: true
    },
    ploeg: { type: String, trim: true },
    land: { type: String, trim: true },
});

RennerSchema.set('toObject', { virtuals: true })
RennerSchema.set('toJSON', { virtuals: true })

RennerSchema.virtual('fullName').get(function() {
    let name = ''
    if (this.vNaam) {
        name = this.vNaam
    }
    if (this.tNaam) {
        if (name) {
            name = name + ' ' + this.tNaam
        }
    }
    if (this.aNaam) {
        if (name) {
            name = name + ' ' + this.aNaam
        }
    }
    return name;
})

RennerSchema.virtual('showName').get(function() {
    let name = ''
    if (this.aNaam) {
        name = this.aNaam
    }
    if (this.vNaam) {
        if (name) {
            name = name + ', ' + this.vNaam
        }
    }
    if (this.tNaam) {
        if (name) {
            name = name + ' ' + this.tNaam
        }
    }
    return name;
})

module.exports = mongoose.model('Renner', RennerSchema);