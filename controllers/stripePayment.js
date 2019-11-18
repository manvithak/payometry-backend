var stripe = require('stripe')('sk_test_gZYhxcQrMR9QkfyFaxw1mbmZ00yeaQPGgn');

/*exports.makePayment = (req, res) => {
	stripe.tokens.create(
	  {
	    card: {
	      number: req.body.cardNumber,
	      exp_month: req.body.expireMonth,
	      exp_year: req.body.expireYear,
	      cvc: req.body.cvv
	    },
	  },
	  function(err, token) {
	  	console.log(err, token)
	    if(err){
	    	return err
	    }
	   stripe.charges.create({
		    amount: req.body.amount,
		    currency: 'usd',
		    description: 'Example charge',
		    source: token.id,
		    shipping: {
		    name: 'Jenny Rosen',
			    address: {
			      line1: '510 Townsend St',
			      postal_code: '98140',
			      city: 'San Francisco',
			      state: 'CA',
			      country: 'US',
			    }
			  },
		  },
		  function(err, payment) {
		  	console.log(err, payment)
		  	if(err){
		  		return err
		  	}
		  	return res.send({
					data: 'payment successful',
					status: 200
				})
		  }
		  );
	  }
	)
}*/

exports.makePayment = (req, res) => {
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
}