let mongoose = require('mongoose'),
    router = require('express').Router(),
    passport = require('passport'),
    User = mongoose.model('User'),
    auth = require('../auth');

router.post('/users', function(req, res, next){
  let user = new User();
  // console.log("req...", req.body);

  // Note, to be able to parse, header needs to be set as:
  // "Content-Type": "application/json"
  user.email = req.body.user.email;
  user.username = req.body.user.username;
  user.setPassword(req.body.user.password);

  user.save().then(function(user){
    // console.warn("err: ", user)
    return res.json({user: user.toAuthJSON()})
  }).catch(next)
});

// See database on POSTMAN
// TODO: ATT this exposes your database to the world
router.get('/db', function(req, res){
  User.find(function(err, users){
    if (err) return console.error(err);
    return res.json({users: users})
  })
});

// Delete database (only during debugging)
// router.delete('/db/delete', function(req, res){
//   let repeats = true;
//   let username = req.body.user.username;
//   // return res.json({username: username})
//
//   while (repeats) {
//     repeats = false;
//   }
//
//   // delete all users with this username
//   User.findOneAndRemove({username: username}, function(err){
//     console.error("Error is null irrespective...", err);
//   });
//
//   User.find(function(err, users){
//     if (err) return console.error(err);
//     return res.json({users: users})
//   })
// });

router.post('/users/login', function(req, res, next){
  console.log("/user/login ", req.body.user);

  if (!req.body.user.email){
    return res.status(422).json({errors:{email: "can't be blank"}})
  }
  if (!req.body.user.password){
    return res.status(422).json({errors:{password: "can't be blank"}})
  }

  // Authenticate using local strategy, and using JWTs for authentication (not 'session')
  passport.authenticate('local', {session: false}, function(err, user, info) { // callback as third argument= "done" in passport.js
    if (err){ return next(err);}

    if (user){
      user.token = user.generateJWT();
      return res.json({user: user.toAuthJSON()})
    } else {
      return res.status(422).json(info)
    }
  })(req, res, next); // iify!
});

router.get('/user', auth.required, function(req, res, next){

  console.log("req.payload: ", req.payload); // { exp: 1550253339, iat: 1545069339 } no id ?

  User.findById(req.payload.id).then(function(user){
    if(!user){ return res.sendStatus(401); }

    return res.json({user: user.toAuthJSON()});
  }).catch(next);
});

router.put('/user', auth.required, function(req, res, next){

  User.findById(req.payload.id).then(function(user){
    if(!user){ return res.sendStatus(401); }

    // only update fields that were actually passed...
    if(typeof req.body.user.username !== 'undefined'){
      user.username = req.body.user.username;
    }
    if(typeof req.body.user.email !== 'undefined'){
      user.email = req.body.user.email;
    }
    if(typeof req.body.user.bio !== 'undefined'){
      user.bio = req.body.user.bio;
    }
    if(typeof req.body.user.image !== 'undefined'){
      user.image = req.body.user.image;
    }
    if(typeof req.body.user.password !== 'undefined'){
      user.setPassword(req.body.user.password);
    }

    return user.save().then(function() {
      return res.json({user: user.toAuthJSON()});
    });
  }).catch(next);
});

module.exports = router;