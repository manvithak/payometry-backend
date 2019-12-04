const Answer = require('../models/Answer');
const random_name = require('node-random-name');

exports.saveAnswers = (req, res) => {
	let answers = req.body.answers
	let merchantId = random_name();
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

exports.getAnswers = (req, res) => {
	Answer.find({}, (err, answers) => {
		if(err){
			return err
		}else{
			return res.send({
				data: answers
			})
		}
	})
}

exports.updateAnswers = (req, res) => {
	let id = req.body.id
	let answers = req.body.answers
	Answer.updateOne({merchantId: id},
		{$set: { answers: answers }}
		, (err, response) => {
			if(err){
				return err
			}else{
				console.log(response)
				return res.send({
					data: response
				})
			}
		})
}