const Question = require('../models/Question');

exports.addQuestion = (req, res) => {
	const questionToSave = new Question({
	  question: req.body.question,
	  type: req.body.type,
  	answerType: req.body.answerType
	})
	console.log(questionToSave)
	questionToSave.save((err, question) => {
		if(err){
			/*return res.send({
				error: err,
				status: 400
			})*/
			return err
		}
		return res.send({
			data: question
		})
	})
}

exports.getQuestions = (req, res) => {
	Question.find({}, (err, questions) => {
		if(err){
			/*return res.send({
				error: err,
				status: 400
			})*/
			return err
		}
		return res.send({
			data: questions
		})
	})
}

exports.saveAnswers = (req, res) => {
	Question.find({}, (err, questions) => {
		if(err){
			/*return res.send({
				error: err,
				status: 400
			})*/
			return err
		}
		return res.send({
			data: questions
		})
	})
}