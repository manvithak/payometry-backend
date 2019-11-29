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
    //console.log("update transaction error :  ", err);
    const merchantId = merchantDetails.merchantId;
    const amount = merchantDetails.amount;
    let dataPath = path.join(__dirname, '../data');
    dataPath += "/codeMap.json";
    // let query = {$and: [{merchantId: merchantId}, {cardId: merchantDetails.cardId}, {amount: amount}]};
    let query = {"_id":merchantDetails._id};
    Transaction.findOne(query, (transactionErr, transactionRes) => {
        if (transactionErr) return callback(err);
        if (transactionRes && merchantDetails && merchantDetails.cardId) {
            if (err && err.raw && err.raw.code) {
                fs.readFile(dataPath, 'utf-8', (fsErr, fsRes) => {
                    if (fsErr) return callback(fsErr)
                    if (fsRes) {
                        fsRes = JSON.parse(fsRes);
                        //check for card_expired
                        async.waterfall([
                            (cb) => {
                                if (transactionRes.stripeErrorCode === "expire_card" && transactionRes.stripeErrorCode !== err.raw.code) {
                                    //update card expireYear
                                    saveAndUpdateCard(creditCard, (cerr, cres) => {
                                        console.log("updated card error res: ", cerr, cres);
                                        cb();
                                    })
                                } else if (transactionRes.stripeErrorCode === "invalid_expiry_year" && transaction.stripeErrorCode !== err.raw.code) {
                                    //update card expireYear
                                    saveAndUpdateCard(creditCard, (cerr, cres) => {
                                        console.log("updated card error res: ", cerr, cres);
                                        cb();
                                    })
                                } else {
                                    cb();
                                }
                            },
                            (cb) => {
                                //create reartempt transaction
                                const reAttemptTransactionToSave = new reAttemptTransaction({
                                    merchantId: transactionRes._id,
                                    stripeError: JSON.stringify(err),
                                    attemptCount: transactionRes.attempt,
                                    responseCodeStatus: fsRes[err.raw.code].response_code_status,
                                    customerOrSystemAction: fsRes[err.raw.code].customer_or_system_action
                                });
                                reAttemptTransactionToSave.save((reError, reRes) => {
                                    if (reError) {
                                        cb(reError);
                                    } else {
                                        cb();
                                    }
                                })
                            },
                            (cb) => {
                                //update transaction
                                let nextAttemptDay = randomIntFromInterval(fsRes[err.raw.code].minimum_days_between, fsRes[err.raw.code].maximum_days_between);
                                // for handling exception case when minday is 0 and max day is 1 and final day is 2
                                if (nextAttemptDay == 0 && fsRes[err.raw.code].minimum_days_between == 0 && fsRes[err.raw.code].maximum_days_to_final_disposition == 2) {
                                    nextAttemptDay = 1;
                                }
                                console.log("NAD : ",nextAttemptDay)
                                let totalAttemptTime = (transactionRes.nextAttemptTime ? transactionRes.nextAttemptTime : 0) + nextAttemptDay;
                                if (transactionRes.attempt === transactionRes.maxAttemptCount) {
                                    nextAttemptDay = transactionRes.maximumDaysToFinalDisposition - transactionRes.nextAttemptTime;
                                    //get difference between nextAttemptDay and initialAttempt
                                } else {
                                    totalAttemptTime = (transactionRes.nextAttemptTime ? transactionRes.nextAttemptTime : 0) + nextAttemptDay;
                                }


                                const dataToSet = {
                                    //maxAttemptCount: fsRes[err.raw.code].max_recycle_attempts,
                                    //maximumDaysToFinalDisposition: fsRes[err.raw.code].maximum_days_to_final_disposition,
                                    nextAttemptDate: moment(new Date()).add(nextAttemptDay, 'minutes'),
                                    nextAttemptTime: totalAttemptTime,
                                    attempt: transactionRes.attempt ? transactionRes.attempt + 1 : 1
                                };
                                Transaction.findOneAndUpdate({"_id":transactionRes._id}/*{$and: [{merchantId: merchantId}, {cardId: merchantDetails.cardId}]}*/, {$set: dataToSet}, {
                                    upsert: true,
                                    lean: true,
                                    new: true
                                }, (dbErr, dbRes) => {
                                    cb(dbErr, dbRes);
                                });
                            }
                        ], (wErr, wRes) => {
                            callback(wErr, wRes);
                        })

                    }
                })
            } else {
                const reAttemptTransactionToSave = new reAttemptTransaction({
                    merchantId: transactionRes._id,
                    stripeSuccess: JSON.stringify(err),
                    attemptCount: transactionRes.attempt
                });
                reAttemptTransactionToSave.save((reError, reRes) => {
                    callback(reError, reRes);
                })
            }
        } else {
            async.waterfall([
                (wcb) => {
                    saveAndUpdateCard(creditCard, (cerr, cres) => {
                        if (cerr) {
                            wcb(cerr);
                        } else {
                            wcb(null, cres._id);
                        }
                    })
                },
                (cardId, wcb) => {

                    fs.readFile(dataPath, 'utf-8', (fsErr, fsRes) => {
                        if (fsErr) return callback(fsErr)
                        if (fsRes) {
                            fsRes = JSON.parse(fsRes);
                            let nextAttemptDay = randomIntFromInterval(fsRes[err.raw.code].minimum_days_between, fsRes[err.raw.code].maximum_days_between);
                            if (nextAttemptDay == 0 && fsRes[err.raw.code].minimum_days_between == 0 && fsRes[err.raw.code].maximum_days_to_final_disposition == 2) {
                                nextAttemptDay = 1;
                            }
                            const TransactionToSave = new Transaction({
                                merchantId: merchantId,
                                attempt: 1,// increase this count on the basis of number of retry attempt,
                                cardId: cardId,
                                amount: amount,
                                maxAttemptCount: fsRes[err.raw.code].max_recycle_attempts,
                                maximumDaysToFinalDisposition: fsRes[err.raw.code].maximum_days_to_final_disposition,
                                nextAttemptDate: moment(new Date()).add(nextAttemptDay, 'minutes'),
                                nextAttemptTime: 0,
                                responseCodeStatus: fsRes[err.raw.code].response_code_status,
                                customerOrSystemAction: fsRes[err.raw.code].customer_or_system_action,
                                stripeErrorCode: err.raw.code
                            });
                            TransactionToSave.save((error, result) => {
                                if (error) {
                                    console.log("error : ", error);
                                    wcb("ERROR_AMOUNT")
                                } else {
                                    wcb();
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

exports.getTransactions = (req, res) => {
    let skip = Number(req.query.skip)
    let limit = Number(req.query.limit)
    Transaction.countDocuments({stripeErrorCode: {$exists: true}}, (err, count) => {
        if(err){
            return err
        }
        console.log(count, skip, limit)
        Transaction.aggregate([
            {
                $lookup: {
                    from: 'cards',
                    localField: 'cardId',
                    foreignField: '_id',
                    as: 'cardDetails'
                }
            },
            {
                $lookup: {
                    from: 'reattempttransactions',
                    localField: '_id',
                    foreignField: 'merchantId',
                    as: 'reAttemptDetails'
                }
            },
            {
                $match: {stripeErrorCode: {
                    $exists: true
                }}
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }
        ],(err, response) => {
            console.log(response)
            if(err){
                return err
            }
            res.send({
                data: response,
                count: count
            })
        })
    })
}

exports.makePayment = (req, res, next) => {
    let name = req.body.name;
    let merchantId = 'Merchant-123';
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
                        amount: req.body.amount,
                        cardId: req.body.cardId,
                        _id: req.body._id
                    };
                    //console.log("console error :  ", err);
                    createAndUpdateTransaction(merchantDetails, err, creditCard, (terr, tres) => {
                        if (terr) {
                            console.log("terr is : ", terr);
                            if (res) {
                                if (terr === "ERROR_AMOUNT") {
                                    err.raw.code = "ERROR_AMOUNT";
                                    err.raw.message = "Kindly enter different amount.";
                                }
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
                    console.log("err, res   ", err, payment);
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
                                amount: req.body.amount,
                                cardId: req.body.cardId,
                                _id: req.body._id
                            };
                            //console.log("token error :  ", err);
                            createAndUpdateTransaction(merchantDetails, err, creditCard, (terr, tres) => {
                                if (terr) {
                                    console.log("terr is : ", terr);
                                    if (res) {
                                        if (terr === "ERROR_AMOUNT") {
                                            err.raw.code = "ERROR_AMOUNT";
                                            err.raw.message = "Kindly enter different amount.";
                                        }
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
                        //update transaction collection
                        if (req.body.cardId) {
                            if (req.body && req.body._id) {
                                const dataToSet = {
                                    stripeSuccess: true
                                };
                                // let query = {$and: [{merchantId: merchantId}, {cardId: req.body.cardId}, {amount:req.body.amount}]};
                                let query = {"_id":req.body._id};
                                Transaction.findOneAndUpdate(query, {$set: dataToSet}, {
                                    upsert: true,
                                    lean: true,
                                    new: true
                                }, (dbErr, dbRes) => {
                                    return res.send({
                                        data: payment
                                    })
                                });
                                return;
                            } else {
                                console.log("i am here");

                            }
                        } else {
                            async.waterfall([
                                (wcb) => {
                                    const creditCard = {
                                        number: req.body.cardNumber,
                                        exp_month: req.body.expireMonth,
                                        exp_year: req.body.expireYear,
                                        cvc: req.body.cvv,
                                        name: req.body.name
                                    };
                                    saveAndUpdateCard(creditCard, (cerr, cres) => {
                                        if (cerr) {
                                            wcb(cerr);
                                        } else {
                                            wcb(null, cres._id);
                                        }
                                    })
                                },
                                (cardId, wcb) => {

                                    const TransactionToSave = new Transaction({
                                        merchantId: merchantId,
                                        attempt: 1,// increase this count on the basis of number of retry attempt,
                                        cardId: cardId,
                                        amount: req.body.amount,
                                        stripeSuccess: true,
                                        stripeSuccessResponse: JSON.stringify(payment)
                                    });
                                    TransactionToSave.save((error, result) => {
                                        if (error) {
                                            console.log("error : ", error);
                                            wcb("ERROR_AMOUNT")
                                        } else {
                                            wcb();
                                        }
                                    })
                                }
                            ],(wcErr, wcRes) => {
                                return res.send({
                                    data: payment
                                })
                            });
                            return;
                        }
                        return;

                    } else {
                        const creditCard = {
                            number: req.body.cardNumber,
                            exp_month: req.body.expireMonth,
                            exp_year: req.body.expireYear,
                            cvc: req.body.cvv,
                            name: req.body.name
                        };
                        const merchantDetails = {
                            merchantId: merchantId,
                            amount: req.body.amount,
                            cardId: req.body.cardId,
                            _id: req.body._id
                        };
                        //console.log("token error :  ", err);
                        createAndUpdateTransaction(merchantDetails, payment, creditCard, (terr, tres) => {
                            if (terr) {
                                console.log("terr is : ", terr);
                                if (res) {
                                    if (terr === "ERROR_AMOUNT") {
                                        err.raw.code = "ERROR_AMOUNT";
                                        err.raw.message = "Kindly enter different amount.";
                                    }
                                    return res.send({
                                        data: payment
                                    })
                                } else {
                                    next(terr, tres);
                                }
                            } else {
                                if (res) {
                                    return res.send({
                                        data: payment
                                    })
                                } else {
                                    next(terr, tres);
                                }
                            }
                        });
                        return;
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
            Transaction.findOne({"_id": transactionId}, {}, {lean: true}, (err, res) => {
                if (err) {
                    cb(err);
                } else if (res) {
                    if (res.attempt <= res.maxAttemptCount) {
                        Card.findOne({"_id": res.cardId}, {}, {lean: true}, (cErr, cRes) => {
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
                                    name: cRes.name,
                                    cardId: cRes._id,
                                    _id:transactionId
                                };
                                if (res.stripeErrorCode === "expired_card" || res.stripeErrorCode === "invalid_expiry_year") {
                                    let cardExpireYear = [0, 3, 4, 2, 1, 5, 6];
                                    for (let k in cardExpireYear) {
                                        if ((res.attempt - 1) == k) {
                                            cardDetails.body.expireYear = cRes.expiryYear + cardExpireYear[k];
                                            /*if (cardExpireYear[k] === 0) {
                                                cardDetails.body.expireYear = "";

                                            } else {
                                                cardDetails.body.expireYear = cRes.expiryYear + cardExpireYear[k];

                                            }*/
                                        } else {
                                            console.log("else statement")
                                        }
                                    }
                                }
                                console.log("cardDetails : ", cardDetails);
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
            this.makePayment(cardDetails, null, (err, res) => {
                console.log("after stripe payment: ", err, res);
                let dataToSet;
                if (res && !res.stripeSuccess) {
                    dataToSet = {
                        reschedule: false
                    };
                } else {
                     dataToSet = {
                        reschedule: false,
                         stripeSuccess: true
                    };
                }
                //console.log(cardDetails, " ; ", cardDetails);
                Transaction.findOneAndUpdate({"_id":cardDetails.body._id}, {$set: dataToSet}, {
                    upsert: true,
                    new: true,
                    lean: true
                }, (dbErr, dbRes) => {
                    cb(err, res);
                })

            });
        }
    ], () => {
        console.log("completed");
    })
}
exports.scheduleCron = () => {
    let j = schedule.scheduleJob('*/15 * * * * *', function () {
        Transaction.find({}, {}, {lean: true}, (err, res) => {
            if (err) {
                console.log("Error while fetching transaction");
            } else if (res) {
                async.forEachOf(res, (value, key, callback) => {
                    if (value && !value.reschedule && value.attempt <= value.maxAttemptCount && !value.stripeSuccess) {
                        // need to update DB with boolean value
                        const dataToSet = {
                            reschedule: true
                        };
                        Transaction.findOneAndUpdate({"_id":value._id}/*{$and: [{merchantId: value.merchantId}, {cardId: value.cardId}, {amount: value.amount}]}*/, {$set: dataToSet}, {
                            upsert: true,
                            new: true,
                            lean: true
                        }, (dbErr, dbRes) => {
                            if (!dbErr && dbRes) {
                                let rule = new schedule.RecurrenceRule();
                                rule.minute = Number(moment(value.nextAttemptDate).format("mm"));
                                rule.hour = Number(moment(value.nextAttemptDate).format("HH"));
                                console.log("rule is: ", rule);
                                let j = schedule.scheduleJob(rule, function () {
                                    const transactionId = value._id;
                                    retryTransaction(transactionId);
                                    callback();
                                });
                            } else {
                                callback();
                            }
                        })
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