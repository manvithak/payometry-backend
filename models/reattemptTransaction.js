const mongoose = require('mongoose');
const reAttemptTransactionSchema = new mongoose.Schema({
    merchantId: {type:String, required:true, index:true},
    stripeSuccess: {type: String},
    stripeError:{type: String},
    merchantId: {type:String, required:true, index:true},
    attemptCount: {type:Number}

}, { timestamps: true });

const reAttemptTransaction = mongoose.model('ReAttemptTransaction', reAttemptTransactionSchema);
module.exports = reAttemptTransaction;