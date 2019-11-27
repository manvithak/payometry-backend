var stripe = require('stripe')('sk_test_gZYhxcQrMR9QkfyFaxw1mbmZ00yeaQPGgn');
const async = require('async');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const Transaction = require('../models/transaction');
const Card = require('../models/Card');
const reAttemptTransaction = require('../models/reattemptTransaction');
const schedule = require('node-schedule');

function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const saveAndUpdateCard = (cardDetails, callback) => {
    Card.findOne({cardNumber: cardDetails.number}, (err, res) => {
        if (err) return callback(err);
        if (res) {
            //update the card
            const dataToSet = {
                expiryMonth: cardDetails.exp_month,
                expiryYear: cardDetails.exp_year
            };
            Card.findOneAndUpdate({_id: res._id}, {$set:dataToSet}, {new:true, upsert:true}, (error, result) => {
                callback(error, result);
            })
        } else {
            //create the card
            const CardToSave = new Card({
                name: cardDetails.name,
                cardNumber: cardDetails.number,
                expiryMonth: cardDetails.exp_month,
                expiryYear: cardDetails.exp_year,
                cvv: cardDetails.cvc
            });

            CardToSave.save((error, result) => {
                callback(error, result);
            })
        }
    })
};

const createAndUpdateTransaction = (merchantDetails, err, creditCard, callback) => {
    console.log("update transaction error :  ", err);
    const merchantId = merchantDetails.merchantId;
    const amount = merchantDetails.amount;
    let dataPath = path.join(__dirname, '../data');
    dataPath  += "/codeMap.json";
    Transaction.findOne({merchantId : merchantId}, (transactionErr, transactionRes) => {
        if (transactionErr) return callback(err);
        if (transactionRes) {
            fs.readFile(dataPath, 'utf-8', (fsErr, fsRes) => {
                if (fsErr) return callback(fsErr)
                if (fsRes) {
                    fsRes = JSON.parse(fsRes);
                    //check for card_expired
                    async.waterfall([
                        (cb) => {
                            //create reartempt transaction
                            const reAttemptTransactionToSave = new reAttemptTransaction({
                                merchantId: merchantId,
                                stripeError:JSON.stringify(err),
                                attemptCount: transactionRes.attempt
                            });
                            reAttemptTransactionToSave.save((reError, reRes) => {
                                console.log("save retry : ", reError, reRes);
                                if (reError) {
                                    cb(reError);
                                } else {
                                    cb();
                                }
                            })
                        },
                        (cb) => {
                            //update transaction
                            if (err.raw.code === "expired_card") {
                                //apply logic and update card details in case if any other error is coming.
                            }
                            let nextAttemptDay = randomIntFromInterval(fsRes[err.raw.code].minimum_days_between, fsRes[err.raw.code].maximum_days_between);
                            console.log("error code: ", err.raw.code, " : ", fsRes[err.raw.code].max_recycle_attempts);
                            const dataToSet = {
                                //maxAttemptCount: fsRes[err.raw.code].max_recycle_attempts,
                                //maximumDaysToFinalDisposition: fsRes[err.raw.code].maximum_days_to_final_disposition,
                                nextAttemptDate: moment(new Date()).add(nextAttemptDay, 'minutes'),
                                nextAttemptTime: nextAttemptDay,
                                attempt: transactionRes.attempt ? transactionRes.attempt + 1 : 1
                            };
                            Transaction.findOneAndUpdate({merchantId: merchantId}, {$set:dataToSet}, {upsert:true, lean: true, new: true}, (dbErr, dbRes) => {
                                cb(dbErr, dbRes);
                            });
                        }
                    ], (wErr, wRes) => {
                        callback(wErr, wRes);
                    })

                }
            })
        } else {
            async.waterfall([
                (wcb) => {
                    saveAndUpdateCard(creditCard, (cerr, cres) => {
                        if (cerr) {
                            wcb(cerr);
                        } else {
                            console.log("card response : ", cres);
                            wcb (null, cres._id);
                        }
                    })
                },
                (cardId, wcb) => {
                    const TransactionToSave = new Transaction({
                        merchantId: merchantId,
                        attempt: 1,// increase this count on the basis of number of retry attempt,
                        cardId: cardId,
                        amount: amount
                    });

                    TransactionToSave.save((error, result) => {
                        if(error){
                            wcb(error)
                        } else {
                            //call retry logic functionality

                            fs.readFile(dataPath, 'utf-8', (fsErr, fsRes) => {
                                if (fsErr) return callback(fsErr)
                                if (fsRes) {
                                    fsRes = JSON.parse(fsRes);
                                    let nextAttemptDay = randomIntFromInterval(fsRes[err.raw.code].minimum_days_between, fsRes[err.raw.code].maximum_days_between);
                                    const dataToSet = {
                                        maxAttemptCount: fsRes[err.raw.code].max_recycle_attempts,
                                        maximumDaysToFinalDisposition: fsRes[err.raw.code].maximum_days_to_final_disposition,
                                        nextAttemptDate: moment(new Date()).add(nextAttemptDay, 'minutes'),
                                        nextAttemptTime: nextAttemptDay
                                    };
                                    Transaction.findOneAndUpdate({merchantId: merchantId}, {$set:dataToSet}, {upsert:true, lean: true, new: true}, (dbErr, dbRes) => {
                                        wcb(dbErr, dbRes);
                                    });

                                }
                            })

                        }
                    })
                }
            ],(wcErr, wcRes) => {
                callback(wcErr, wcRes);
            })

        }
    });
}

exports.makePayment = (req, res, next) => {
    let name = req.body.name;
    let merchantId = req.body.merchantId;
    stripe.tokens.create(
        {
            card: {
                number: req.body.cardNumber,
                exp_month: req.body.expireMonth,
                exp_year: req.body.expireYear,
                cvc: req.body.cvv,
            },
        },
        function (err, token) {
            if (err) {
                if (err.raw) {
                    err.metadata = {
                        merchantId: merchantId
                    }

                    const creditCard = {
                        number: req.body.cardNumber,
                        exp_month: req.body.expireMonth,
                        exp_year: req.body.expireYear,
                        cvc: req.body.cvv,
                        name: req.body.name
                    };

                    const merchantDetails = {
                        merchantId: merchantId,
                        amount: req.body.amount
                    };
                    console.log("console error :  ", err);
                    createAndUpdateTransaction(merchantDetails, err, creditCard, (terr, tres) => {
                        if (terr) {
                            if (res) {
                                return res.send({
                                    data: err
                                })
                            } else {
                                next(terr, tres);
                            }
                        } else {
                            if (res) {
                                return res.send({
                                    data: err
                                })
                            } else {
                                next(terr, tres);
                            }
                        }
                    });
                    return;
                } else {
                    return err
                }
            }
            stripe.charges.create({
                    amount: req.body.amount,
                    currency: 'usd',
                    description: 'Example charge',
                    source: token.id,
                    metadata: {
                        merchantId: merchantId
                    },
                    shipping: {
                        name: name,
                        address: {
                            line1: '510 Townsend St',
                            postal_code: '98140',
                            city: 'San Francisco',
                            state: 'CA',
                            country: 'US',
                        }
                    }
                },
                function (err, payment) {
                    if (err) {
                        if (err.raw) {
                            err.metadata = {
                                merchantId: merchantId
                            }

                            const creditCard = {
                                number: req.body.cardNumber,
                                exp_month: req.body.expireMonth,
                                exp_year: req.body.expireYear,
                                cvc: req.body.cvv,
                                name: req.body.name
                            };
                            const merchantDetails = {
                                merchantId: merchantId,
                                amount: req.body.amount
                            };
                            console.log("token error :  ", err);
                            createAndUpdateTransaction(merchantDetails, err, creditCard, (terr, tres) => {
                                if (terr) {
                                    if (res) {
                                        return res.send({
                                            data: err
                                        })
                                    } else {
                                        next(terr, tres);
                                    }
                                } else {
                                    if (res) {
                                        return res.send({
                                            data: err
                                        })
                                    } else {
                                        next(terr, tres);
                                    }
                                }
                            });
                            return;
                        } else {
                            return err
                        }
                    }
                    if (res) {
                        return res.send({
                            data: payment
                        })
                    } else {
                        next(terr, tres);
                    }
                }
            );
        }
    )
}

const retryTransaction = (transactionId) => {
    console.log("retry transaction: ");
    async.waterfall([
        (cb) => {
            //get card details from transaction and amount
            Transaction.findOne({"_id":transactionId}, {}, {lean:true}, (err, res) => {
                if (err) {
                    cb(err);
                } else if (res) {
                    if (res.attempt <= res.maxAttemptCount) {
                        Card.findOne({"_id":res.cardId}, {}, {lean:true}, (cErr, cRes) => {
                            if (cErr) cb(cErr)
                            if (cRes) {
                                let cardDetails = {};
                                cardDetails.body = {
                                    cardNumber: cRes.cardNumber,
                                    expireMonth: cRes.expiryMonth,
                                    expireYear: cRes.expiryYear,
                                    cvv: cRes.cvv,
                                    amount: res.amount,
                                    merchantId: res.merchantId,
                                    name: cRes.name
                                };
                                cb(null, cardDetails);
                            }
                        })
                    }
                } else {
                    cb("INVALID_TRANSACTION_ID");
                }
            })
        },
        (cardDetails, cb) => {
            //call stripe API for payment process
            this.makePayment(cardDetails, null, (err, res)=> {
                console.log("after stripe payment: ", err, res);
                cb(err, res);
            });
        }
    ],() => {
        console.log("completed");
    })
}
exports.scheduleCron = () => {
    let j = schedule.scheduleJob('*/30 * * * * *', function(){
        Transaction.find({},{},{lean:true}, (err, res) => {
            if (err) {
                console.log("Error while fetching transaction");
            } else if (res) {
                async.forEachOf(res, (value, key, callback) => {
                    if (value) {
                        let rule = new schedule.RecurrenceRule();
                        rule.minute = Number(moment(value.nextAttemptDate).format("mm"));
                        rule.hour = Number(moment(value.nextAttemptDate).format("HH"));
                        console.log("rule is: ", rule);
                        let j = schedule.scheduleJob(rule, function(){
                            const transactionId = value._id;
                            retryTransaction(transactionId);
                            callback();
                        });
                    } else {
                        callback();
                    }
                }), () => {
                    console.log("final callback");
                }
            } else {
                console.log("No transaction to schedule");
            }
        })
    });

}

/*exports.makePayment = (req, res) => {
  let amount = req.body.amount
  let card = {
    number: req.body.cardNumber,
    exp_month: req.body.expireMonth,
    exp_year: req.body.expireYear,
    cvc: req.body.cvv
  }
	stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
  }, function(err, intent){
  	console.log(err, intent)
  	if(err){
  		return err
  	}
  	return res.send({
    	data: intent.client_secret
    })
  });
}*/