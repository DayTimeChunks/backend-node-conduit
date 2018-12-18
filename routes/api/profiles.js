
let router = require('express').Router(),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    auth = require('../auth');

// the combination of .param and get, allows us to build a route as:
// localhost:3000/api/username/{{username}} , where the username parameter is defined in route GET as: ":username"

router.param('username', function(req, res, next, username){
  User.findOne({username: username}).then(function(user){
    if (!user) { return res.sendStatus(404); }

    req.profile = user; // attach user object to the request

    return next();
  }).catch(next);
});

router.get('/:username', auth.optional, function(req, res, next){
  if (req.payload){
    User.findById(req.payload.id).then(function(user){
      if(!user){ return res.json({profile: req.profile.toProfileJSONFor(false)}); } // return false if no user found

      return res.json({profile: req.profile.toProfileJSONFor(user)}); // return the user's public profile
    });
  } else {
    return res.json({profile: req.profile.toProfileJSONFor(false)}); // return false if no payload in the request
  }
  return res.json({profile: req.profile.toProfileJSONFor()});  // convert the user object into an 'edited' JSON object
});

module.exports = router;