const mongoose = require('mongoose')

const accountSchema = new mongoose.Schema({
  accountName: { type: String, required:true},
  name: {type: String},
  amount: {type: Number},
  cardNumber: {type: String},
  expireMonth: {type: Number},
  expireYear: {type: Number},
  cvv: {type: Number},
  address1: {type: String},
  address2: {type: String},
  city: {type: String},
  state: {type: String},
  zip: {type: Number}
}, { timestamps: true })

accountSchema.index({'accountName': 1, 'cardNumber': 1});
const Account = mongoose.model('Account', accountSchema);
module.exports = Account;