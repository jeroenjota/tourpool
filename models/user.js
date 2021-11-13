//  USER model

const { number } = require('joi');
const mongoose = require('mongoose')
const {Schema} = mongoose;

const passportLocalMongoose = require('passport-local-mongoose')

const UserSchema = new Schema({

  vNaam: String,
  tNaam: String,
  aNaam: String,
  email: {
    type: String,
    required: [true, 'Email is verplicht'],
    unique: [true, 'Email is al geregistreerd']
  },
  isAdmin: {
    type: Boolean,
    default: false
  },

},{timestamps: true});

// passportLocalMongooses voegt automatisch username en password toe!!!
UserSchema.plugin(passportLocalMongoose);

// UserSchema.statics.findAndValidate = async function (naam, password) {
//   const foundUser = await this.findOne({
//     username: naam
//   })
//   const isValid = await bcrypt.compare(password, foundUser.password)
//   return isValid ? foundUser : false
// }

UserSchema.statics.isAdmin = async function (id) {
  const foundUser = await this.findById({
    id
  })
  return foundUser.isAdmin
}

// userSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 12)
//   next();
// })

module.exports = mongoose.model('User', UserSchema);