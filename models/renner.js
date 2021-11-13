const mongoose = require('mongoose')
const {Schema} = mongoose;

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

module.exports = mongoose.model('Renner', RennerSchema);