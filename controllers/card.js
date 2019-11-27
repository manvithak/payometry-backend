const Card = require('../models/Card');

exports.addCard = (req, res) => {
	const card = new Card({
	  name: req.body.name,
	  cardNumber: req.body.cardNumber,
	  expiryMonth: req.body.expiryMonth,
	  expiryYear: req.body.expiryYear,
	  cvv: req.body.cvv
	})

	Card.findOne({cardNumber: req.body.cardNumber}, (err, existingCard) => {
		if(err){
			return err;
		}
		if(existingCard){
			return res.send({
				message: 'Card already exists'
			})
		}
		card.save((err, card) => {
			if(err){
				return err
			}
			return res.send({
				data: card,
				status: 200
			})
		})
	})
}