let passport = require("passport"),
    LocalStrategy = require("passport-local").Strategy,
    mongoose = require("mongoose"),
    User = mongoose.model("User"),
    crypto = require('crypto');

passport.use(new LocalStrategy({
  usernameField: 'user[email]',
  passwordField: 'user[password]'
}, function(email, password, done){
  User.findOne({email: email})
    .then(function(user){
      console.log("user salt:", typeof crypto.randomBytes(16).toString('hex'));

      console.log("user:", user.validPassword(password));
      if(!user || !user.validPassword(password)){
        return done(null, false, {errors: {'email or password': 'is invalid'}})
    }
    return done(null, user);
  }).catch(done);
}));