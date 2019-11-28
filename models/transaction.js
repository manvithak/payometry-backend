const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
    merchantId: {type:String, required:true},
    stripeSuccess: {type: Boolean},
    maximumDaysToFinalDisposition: {type: Number},
    cardId: {type:mongoose.Schema.ObjectId, ref: 'Card', required:true},
    attempt: {type: Number},
    amount: {type: Number},
    nextAttemptDate: {type:Date},
    nextAttemptTime: {type: Number},
    maxAttemptCount: {type: Number},
    reschedule: {type: Boolean},
    responseCodeStatus: {type: String},
    customerOrSystemAction: {type: String},
    stripeErrorCode: {type:String}

}, { timestamps: true });

transactionSchema.index({'merchantId': 1, "cardId":1}, {unique:true});
const transaction = mongoose.model('Transaction', transactionSchema);
module.exports = transaction;