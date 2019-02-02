// Copied this from the 1st part of the tutorial (Mongoose Models - User Schema)

/*
Create the schema for the user model, with validations on username and email
* */
const mongoose = require('mongoose'),
      uniqueValidator = require('mongoose-unique-validator'),
      crypto = require('crypto'), // generating and validating passwords
      jwt = require('jsonwebtoken'), // JWT
      secret = require('../config').secret;

let UserSchema = new mongoose.Schema({
  username: {type: String, lowercase: true, unique: true, required: [true, "can't be blank"], match: [/^[a-zA-Z0-9]+$/, 'is invalid'], index: true},
  email: {type: String, lowercase: true, unique: true, required: [true, "can't be blank"], match: [/\S+@\S+\.\S+/, 'is invalid'], index: true},
  bio: String,
  image: String,
  hash: String,
  salt: String,
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }], // Tutorial part 5
}, {timestamps: true});


/*
* The {timestamps: true} option creates a createdAt and updatedAt field on our models that contain timestamps which will
* get automatically updated when our model changes. The last line mongoose.model('User', UserSchema); registers our
* schema with mongoose. Our user model can then be accessed anywhere in our application by calling mongoose.model('User').
* */

UserSchema.plugin(uniqueValidator, {message: 'is already taken.'});

// Set password
UserSchema.methods.setPassword = function(password){
  console.log("Setting password");
  console.log("type of this", this);
  this.salt = crypto.randomBytes(16).toString('hex');
  this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
};

// Validate password
UserSchema.methods.validPassword = function(password){
  let hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
  return (hash === this.hash);
};

// Generate token with payload
UserSchema.methods.generateJWT = function() {
  let today = new Date();
  let exp = new Date(today);
  exp.setDate(today.getDate() + 60); // 60 days

  console.log("Type of this", typeof this); //
  console.log(" this._id",  this._id); // undefined

  return jwt.sign({
    id: this._id,  // user database id
    username: this.username,
    exp: parseInt(exp.getTime()/1000), // UNIX time stamp in secs for expiry.
  }, secret);
};

// Authorization (in JSON format)
UserSchema.methods.toAuthJSON = function(){
  return {
    username: this.username,
    email: this.email,
    token: this.generateJWT(),
    bio: this.bio,
    image: this.image
  };
};

UserSchema.methods.toProfileJSONFor = function(user){
  return {
    username: this.username,
    bio: this.bio,
    image: this.image || 'https://static.productionready.io/images/smiley-cyrus.jpg',
    following:  false  // we'll implement following functionality in a few chapters :)
  }
};

/*
* Tutorial part 5 below (see above as well)
* */

// Save the id into favourites array, if not already existing
UserSchema.methods.favorite = function(id){
  if(this.favorites.indexOf(id) === -1){
    // this.favorites.push(id); // bug with old MongoDB Version
    this.favorites = this.favorites.concat([id]);
  }

  return this.save();
  //  TODO: call Article.updateFavoriteCount() ??
};

UserSchema.methods.unfavorite = function(id){
  this.favorites.remove( id );
  return this.save();
  //  TODO: call Article.updateFavoriteCount() ??
};

UserSchema.methods.isFavorite = function(id){
  return this.favorites.some(function(favoriteId){
    return favoriteId.toString() === id.toString();
  });
};

mongoose.model('User', UserSchema);


/*
* Add validations to the User model
* */