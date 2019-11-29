const mongoose = require('mongoose');
const reAttemptTransactionSchema = new mongoose.Schema({
    merchantId: {type:mongoose.Schema.ObjectId, ref: 'Transaction', required:true},
    stripeSuccess: {type: String},
    stripeError:{type: String},
    attemptCount: {type:Number},
    responseCodeStatus: {type:String},
    customerOrSystemAction: {type:String},
    StripeSucces: {type: String},
    year: {type: Number}
}, { timestamps: true });

const reAttemptTransaction = mongoose.model('ReAttemptTransaction', reAttemptTransactionSchema);
module.exports = reAttemptTransaction;