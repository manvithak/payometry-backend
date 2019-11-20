var stripe = require('stripe')('sk_test_gZYhxcQrMR9QkfyFaxw1mbmZ00yeaQPGgn');

exports.makePayment = (req, res, next) => {
	let name = req.body.name
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
	    if(err){
	    	if(err.raw){
		  		return res.send({
		  			data: err
		  		})
		  	}else{
		  		return err
		  	}
	    }
	   stripe.charges.create({
		    amount: req.body.amount,
		    currency: 'usd',
		    description: 'Example charge',
		    source: token.id,
		    shipping: {
		    name: name,
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
		  	if(err){
		  		if(err.raw){
			  		return res.send({
			  			data: err
			  		})
			  	}else{
			  		return err
			  	}
		  	}
		  	return res.send({
					data: payment
				})
		  }
		  );
	  }
	)
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