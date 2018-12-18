
# Thinkster Tutorial Part 1 (Available for free until Part 2)

## Setting up

After cloning this [app](https://github.com/gothinkster/node-express-realworld-example-app), I installed node:

    `npm install`

Need to run mongo on a separate terminal window. If problems see [this](https://stackoverflow.com/questions/23418134/cannot-connect-to-mongodb-errno61-connection-refused).
I ran it with brew to get it to work:

    `brew services start mongodb`
    
Also mongodb needed to be installed. If mongo is not installed, follow [this](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/).

Installed the command line tool: `nodemon` globally as:

    `npm install -g nodemon`
    
...this allows to boot up the application like:

    `nodemon app.js` 

## Project resources

- The API endpoints are [here](https://github.com/gothinkster/realworld/blob/master/api/README.md).
- This is the cloned [Git Project](https://github.com/gothinkster/node-express-realworld-example-app.git), with the 00-seed as the start branch.
- [Building the Back End](https://thinkster.io/tutorials/fullstack/building-the-backend)
- [Queries in Postpman](https://thinkster.io/tutorials/testing-backend-apis-with-postman/customizing-requests-in-postman)

#### Anatomy of the cloned project

    .
    ├── config/
    │   └── index.js
    ├── models/
    ├── public/
    ├── routes/
    │   ├── api/
    │   │  └── index.js
    │   └── index.js
    ├── app.js
    ├── package.json
    └── .gitignore


## Building up

### Nodemon dev server

Add nodemon to package.json as an NPM script to boot0up the server:

    "scripts": {
        "start": "node ./app.js",
    +   "dev": "nodemon ./app.js",
        "test": "echo \"Error: no test specified\" && exit 1"
      },

Now we can also boot up on terminal with:

    npm run dev
    
### Creating the Data Models

Our data will be stored in MongoDB. We will be using the mongoose.js library for all of our interactions with MongoDB. Mongoose allows us to define schemas 
and indices for our database, as well as providing callbacks and validations for ensuring our data remains consistent. 
Mongoose also has a plugin system for reusing code between schemas or importing community libraries to extend the 
functionality of our models.

We'll be building out each feature in our application in three phases:

1. Create the mongoose Models
2. Create any helper methods on our models and route middleware required for the feature
3. Creating the route to expose the functionality to our users

### 1) Mongoose Models - User Schema

[Mongoose documentation](https://mongoosejs.com/docs/guide.html#id) 

In `models/User.js`, add the following:

    var mongoose = require('mongoose');
    
    var UserSchema = new mongoose.Schema({
    - username: String,
    + username: {type: String, lowercase: true, required: [true, "can't be blank"], match: [/^[a-zA-Z0-9]+$/, 'is invalid'], index: true},
    - email: String,
    + email: {type: String, lowercase: true, required: [true, "can't be blank"], match: [/\S+@\S+\.\S+/, 'is invalid'], index: true},
      bio: String,
      image: String,
      hash: String,
      salt: String
    }, {timestamps: true});
    
    mongoose.model('User', UserSchema);

We also added the `index: true` options to username and email to optimize queries that use these fields.

We'll need to `require` the `mongoose-unique-validator` library, then, we can use the unique validator on our `username` and 
`email` fields. Finally, we need to register the plugin with our model to enable the unique validator. We're configuring 
the validator's message to say that the field "is already taken."
    
    var mongoose = require('mongoose');
    + var uniqueValidator = require('mongoose-unique-validator');
    
    var UserSchema = new mongoose.Schema({
    - username: {type: String, lowercase: true, required: [true, "can't be blank"], match: [/^[a-zA-Z0-9]+$/, 'is invalid'], index: true},
    + username: {type: String, lowercase: true, unique: true, required: [true, "can't be blank"], match: [/^[a-zA-Z0-9]+$/, 'is invalid'], index: true},
    - email: {type: String, lowercase: true, required: [true, "can't be blank"], match: [/\S+@\S+\.\S+/, 'is invalid'], index: true},
    + email: {type: String, lowercase: true, unique: true, required: [true, "can't be blank"], match: [/\S+@\S+\.\S+/, 'is invalid'], index: true},
      bio: String,
      image: String,
      hash: String,
      salt: String
    }, {timestamps: true});
    
    + UserSchema.plugin(uniqueValidator, {message: 'is already taken.'});
    
    mongoose.model('User', UserSchema);

### 2). Mongoose Helper Methods

In `models/User.js`, require the `crypto` library:

    + var crypto = require('crypto');
    
Next, let's create the method to hash passwords (set and validate). We'll be generating a random salt for each user. Then we can use 
`crypto.crypto.pbkdf2Sync()` to generate hashes using the salt. `pbkdf2Sync()` takes five parameters: 

- password to hash, 
- salt, 
- iteration (number of times to hash the password), 
- the length (how long the hash should be), and 
- the algorithm

Next, generate a JWT (JSON Web Token) to be passed to the front-end used for authentication and import the secret string. The JWT contains a 
payload (assertions) that is signed by the back-end, so the payload can be read by both the front-end and back-end, 
but can only be validated by the back-end.

In `models/User.js`, add:

    + var jwt = require('jsonwebtoken');
    + var secret = require('../config').secret;
    
Next, create the JWT, its payload and the JSON representation of the authorization;


    +UserSchema.methods.generateJWT = function() {
    +  var today = new Date();
    +  var exp = new Date(today);
    +  exp.setDate(today.getDate() + 60);
    +
    +  return jwt.sign({
    +    id: this._id,
    +    username: this.username,
    +    exp: parseInt(exp.getTime() / 1000),
    +  }, secret);
    +};
    
    +UserSchema.methods.toAuthJSON = function(){
    +  return {
    +    username: this.username,
    +    email: this.email,
    +    token: this.generateJWT(),
    +    bio: this.bio,
    +    image: this.image
    +  };
    +};
    
    mongoose.model('User', UserSchema);
    
Finally, register the model. In `app.js` add:

    + require('./models/User');
    
    app.use(require('./routes'));
    
    
#### Authentication - Configuring Passport for Local Authentication

Passport is an authentication system made for Node.js. We'll have to make some changes to our application to authenticate 
with JWT's since Passport uses session authentication by default. 

If you're not familiar with the differences between token and/or session based authentication, we highly recommend 
reading this [post](https://auth0.com/blog/2014/01/07/angularjs-authentication-with-cookies-vs-token/).

We'll be using passport as a middleware for our login endpoint. This middleware will use the passport-local strategy, which is meant for username/password authentication. We'll need to look up our user using the information in the request body and try to find the corresponding user, then see if the password given to the user was valid.

Create a new file in config/passport.js with the following:

    var passport = require('passport');
    var LocalStrategy = require('passport-local').Strategy;
    var mongoose = require('mongoose');
    var User = mongoose.model('User');
    
    passport.use(new LocalStrategy({
      usernameField: 'user[email]',
      passwordField: 'user[password]'
    }, function(email, password, done) {
      User.findOne({email: email}).then(function(user){
        if(!user || !user.validPassword(password)){
          return done(null, false, {errors: {'email or password': 'is invalid'}});
        }
    
        return done(null, user);
      }).catch(done);
    }));
    
`LocalStrategy` usually looks at the username and password field of the request body coming from the front-end. 
The request body from the front-end will be in the format of:

    {
      "user": {
        "email": "jake@example.com".
        "password": "mypasswordisjake"
      }
    }

In `app.js`, require `passport`:

    + require('./config/passport');
    
#### Configuring Middleware to Validate JWT's

There are two different cases in our applications for handling JWT's which we'll create separate middleware for: 

- optional authentication, and 
- required authentication (routes that require a logged-in user). 

When a JWT isn't provided to a route that requires authentication, the route will fail with a 401 status code. 
Authentication will be optional for some routes that are exposed to the public, such as fetching the global list of articles. 
The route will still respond if it's optionally authenticated, otherwise, if a JWT is provided, the user's data will be 
used to enhance the data being returned (such as if they've favorited an article or not). We'll be using the `express-jwt`
package to validate JWT's.

Create a new file in `routes/auth.js` and create (and export) a route middleware to handle decoding JWT'swith:

    +var jwt = require('express-jwt');
    +var secret = require('../config').secret;
    
    +function getTokenFromHeader(req){
    +  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Token') {
    +    return req.headers.authorization.split(' ')[1];
    +  }
    +
    +  return null;
    +}
    +
    +var auth = {
    +  required: jwt({
    +    secret: secret,
    +    userProperty: 'payload',
    +    getToken: getTokenFromHeader
    +  }),
    +  optional: jwt({
    +    secret: secret,
    +    userProperty: 'payload',
    +    credentialsRequired: false,
    +    getToken: getTokenFromHeader
    +  })
    +};
    +
    
    + module.exports = auth;

Since our JWT's were generated with the secret in `config/index.js` (the generateJWT() method we made on the user model 
uses it), we'll need to use the same secret to validate the JWT tokens from the front-end. 

To handle the two different authentication cases (optional and required), we'll need to export **two separately 
configured** `express-jwt` middlewares. You can view the configuration options for `express-jwt` [here](https://github.com/auth0/express-jwt).

In `auth`, `userProperty` is the property where the JWT payloads will be attached to each request, so we can access the data 
using `req.payload`.

We should have all the middleware necessary to implement authentication now! 

*RECAP*

We configured Passport to authenticate users with `email` and `password`, and then we made two JWT middlewares, one 
for requests that *require authentication*, and the other for requests where *authentication is optional*.
