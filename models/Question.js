const mongoose = require('mongoose')

const questionSchema = new mongoose.Schema({
  question: { type: String, index: true },
  type: {type: String},
  answerType: {type: String}
}, { timestamps: true })


const Question = mongoose.model('Question', questionSchema);
module.exports = Question;