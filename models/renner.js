const mongoose = require('mongoose')
const { Schema } = mongoose;

const RennerSchema = new Schema({
    nr: Number,
    vNaam: String,
    tNaam: String,
    aNaam: {
        type: String,
        required: true
    },
    ploeg: String,
    land: String,
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

module.exports = mongoose.model('Renner', RennerSchema);