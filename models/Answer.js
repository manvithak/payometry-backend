const mongoose = require('mongoose')

const answerSchema = new mongoose.Schema({
  answers: { type: Array },
  merchantId: {type: String, index: true}
}, { timestamps: true })


const Answer = mongoose.model('Answer', answerSchema);
module.exports = Answer;