const mongoose = require('mongoose');
const transactionSchema = new mongoose.Schema({
    merchantId: {type:String, required:true, index:true},
    stripeSuccess: {type: Boolean},
    stripeSuccessResponse: {type:String},
    maximumDaysToFinalDisposition: {type: Number},
    cardId: {type:mongoose.Schema.ObjectId, ref: 'Card', required:true, index:true},
    attempt: {type: Number},
    amount: {type: Number, required:true, index:true},
    nextAttemptDate: {type:Date},
    nextAttemptTime: {type: Number},
    maxAttemptCount: {type: Number},
    reschedule: {type: Boolean},
    responseCodeStatus: {type: String},
    customerOrSystemAction: {type: String},
    stripeErrorCode: {type:String}

}, { timestamps: true });

const transaction = mongoose.model('Transaction', transactionSchema);
module.exports = transaction;