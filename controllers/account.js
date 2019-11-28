const Account = require('../models/Account')

exports.saveAccount = (req, res) => {
    const accountToSave = new Account({
	  accountName: req.body.accountName,
	  name: req.body.name,
	  amount: req.body.amount,
	  cardNumber: req.body.cardNumber,
	  expireMonth: req.body.expireMonth,
	  expireYear: req.body.expireYear,
	  cvv: req.body.cvv,
	  address1: req.body.address1,
	  address2: req.body.address2,
	  city: req.body.city,
	  state: req.body.state,
	  zip: req.body.zip
	})
	accountToSave.save((err, result) => {
		if(err){
			return err
		}
		return res.send({
			data: result
		})
	})
}

exports.getAccounts = (req, res) => {
	Account.find({}, (err, result) => {
		if(err){
			return err
		}
		else{
			return res.send({
				data: result
			})
		}
	})
}