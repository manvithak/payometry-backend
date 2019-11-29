const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    name: {type: String, index: true, required:true},
    cardNumber: {type: String, index: true, required:true},
    expiryMonth: {type: Number, required:true},
    expiryYear: {type: Number, required:true},
    cvv: {type: Number, required:true}
}, {timestamps: true})


const Card = mongoose.model('Card', cardSchema);
module.exports = Card;