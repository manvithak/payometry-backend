const mongoose = require('mongoose')

const cardSchema = new mongoose.Schema({
	name: { type: String, index: true },
  cardNumber: {type: Number, index: true},
  expiryMonth: {type: Number},
  expiryYear: {type: Number},
  cvv: {type: Number}
}, { timestamps: true })


const Card = mongoose.model('Card', cardSchema);
module.exports = Card;