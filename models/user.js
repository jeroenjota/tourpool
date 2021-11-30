//  USER model

const mongoose = require('mongoose')
const { Schema } = mongoose;

const passportLocalMongoose = require('passport-local-mongoose')

const UserSchema = new Schema({

    vNaam: { type: String, trim: true },
    tNaam: { type: String, trim: true },
    aNaam: { type: String, trim: true },
    email: {
        type: String,
        required: [true, 'Email is verplicht'],
        unique: [true, 'Email is al geregistreerd']
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

// passportLocalMongooses voegt automatisch username en password toe!!!
UserSchema.plugin(passportLocalMongoose);


UserSchema.statics.isAdmin = async function(id) {
    const foundUser = await this.findById({
        id
    })
    return foundUser.isAdmin
}

UserSchema.set('toObject', { virtuals: true })
UserSchema.set('toJSON', { virtuals: true })

UserSchema.virtual('fullName').get(function() {
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


module.exports = mongoose.model('User', UserSchema);