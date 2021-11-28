/////////////
// RENNER model
/////////////

// this is the source renner table. 
// For now used as the basis for the user temas. 
///  

/// CHANGE THIS !!!! 

const mongoose = require('mongoose')
const { Schema } = mongoose;

const RennerSchema = new Schema({
    vNaam: { type: String, trim: true },
    tNaam: { type: String, trim: true },
    aNaam: {

        type: String,
        trim: true,
        required: true
    },
    land: { type: String, trim: true },
});

RennerSchema.set('toObject', { virtuals: true })
RennerSchema.set('toJSON', { virtuals: true })


// volledige naam
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
    // Achternaam gevolgde door Voornaam en tussenvg

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