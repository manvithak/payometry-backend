const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
    merchantId: {type:String, required:true},
    stripeSuccess: {type: String},
    maximumDaysToFinalDisposition: {type: Number},
    cardId: {type:mongoose.Schema.ObjectId, ref: 'Card', required:true},
    attempt: {type: Number},
    amount: {type: Number},
    nextAttemptDate: {type:Date},
    nextAttemptTime: {type: Number},
    maxAttemptCount: {type: Number},

}, { timestamps: true });

transactionSchema.index({'merchantId': 1, "cardId":1}, {unique:true});
const transaction = mongoose.model('Transaction', transactionSchema);
module.exports = transaction;