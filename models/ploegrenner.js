const mongoose = require('mongoose')


const ploegRennerSchema = new mongoose.Schema({
  ploeg: mongoose.ObjectId,
  nummer: Number,
  renner: mongoose.ObjectId
})

const PloegRenner = mongoose.model('PloegRenner', ploegRennerSchema);

module.exports = PloegRenner;