const Answer = require('../models/Answer');

exports.saveAnswers = (req, res) => {
	let answers = req.body.answers
	let merchantId = Math.random().toString(36).substring(7);
	const answerToSave = new Answer({
	  answers: answers,
	  merchantId: merchantId
	})
	answerToSave.save((err, result) => {
		if(err){
			return err
		}
		return res.send({
			data: result
		})
	})
}