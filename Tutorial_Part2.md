
# Thinkster Tutorial (Pro, Part 2)

## Setting up the Authentication Routes

With our user models created and our authentication middleware set up, we have all the pieces necessary for creating the
authentication endpoints. We'll need to create four endpoints for authentication:

- `POST /api/users` for registering users. As long the email and username haven't been taken, and a valid password is
provided, we'll create that user in our database and respond with the user's auth JSON

- `POST /api/users/login` for logging in users. A valid email/password combination will give a user's auth JSON response.

- `GET /api/user` will require authentication (a valid JWT token must be present in the Authorization header) and respond
with the user's auth JSON. This is used for the front-end to identify the user that's logged in and to refresh the JWT token.

- `PUT /api/user` will require authentication and will be used to update user information.

To get started, we'll need to create a router for our authentication functionality.

## Create the users router

In `routes/api/users.js` create the following:

    var mongoose = require('mongoose');
    var router = require('express').Router();
    var passport = require('passport');
    var User = mongoose.model('User');
    var auth = require('../auth');

    module.exports = router;

For Express to use the router we just created, we need to register it within our application.

## Register the `users` router with the API router.

In `routes/api/index.js` add the following:

    var router = require('express').Router();
    +
    +router.use('/', require('./users'));

    module.exports = router;

## Create the registration route

Add the following route to the `users.js` router:

    +router.post('/users', function(req, res, next){
    +  var user = new User();
    +
    +  user.username = req.body.user.username;
    +  user.email = req.body.user.email;
    +  user.setPassword(req.body.user.password);
    +
    +  user.save().then(function(){
    +    return res.json({user: user.toAuthJSON()});
    +  }).catch(next);
    +});

    module.exports = router;

We rely on Mongoose validations to ensure that users are created with a username or password. When `user.save()` is called,
a promise is returned for us to handle.

If the promise is resolved, that means the user was saved successfully, and we return the user's auth JSON. If the
promise gets rejected, we use `.catch()` to pass the error to our error handler.

**What error handler you say?** We need to create error handling middleware to convert mongoose validation errors to
something our front-end can consume, otherwise, our server will return it as a 500 Internal Server Error by default.

## Create a middleware function for our API router to handle validation errors from Mongoose

In `routes/api/index.js` add the following error handler:

    +router.use(function(err, req, res, next){
    +  if(err.name === 'ValidationError'){
    +    return res.status(422).json({
    +      errors: Object.keys(err.errors).reduce(function(errors, key){
    +        errors[key] = err.errors[key].message;
    +
    +        return errors;
    +      }, {})
    +    });
    +  }
    +
    +  return next(err);
    +});

    module.exports = router;

When a middleware is defined with four arguments, it will be treated as an error handler (the first argument is always
the error object). This error handler sits after all of our API routes and is used for catching ValidationErrors thrown
by mongoose. The error handler then parses the error into something our front-end can understand, and then responds with
a 422 status code.

Now that users can register, and any Mongoose validation errors will be handled properly, we can proceed to create a
route to let users log in and exchange their credentials for the auth JSON payload.

### Create the login route

Add the following route to `routes/api/users.js`:

    router.post('/users/login', function(req, res, next){
      if(!req.body.user.email){
        return res.status(422).json({errors: {email: "can't be blank"}});
      }

      if(!req.body.user.password){
        return res.status(422).json({errors: {password: "can't be blank"}});
      }

      passport.authenticate('local', {session: false}, function(err, user, info){
        if(err){ return next(err); }

        if(user){
          user.token = user.generateJWT();
          return res.json({user: user.toAuthJSON()});
        } else {
          return res.status(422).json(info);
        }
      })(req, res, next);
    });

First, we're checking to make sure an email and password were provided by the front-end and respond with a 422 status
code if they're not. Then, we pass the incoming request to `passport.authenticate` and specify that we want to use the
`local` strategy we made previously (in `config/passport.js`). Since we're using JWTs for authentication and not using
sessions, we also specify `{session: false}` to prevent Passport from serializing the user into the session.
Finally, we define a callback (i.e., function with 3 arguments in passport.authenticate) for the passport strategy (this gets used as the `done` function in our LocalStrategy in
`config/passport.js`) that will respond to the client based off if the authentication was successful or not.

While we can implement this functionality without the use of Passport in our route, an advantage to using Passport is
that it gives us the ability to add other authentication strategies such as OAuth in the future.

## Create another endpoint in `users.js` to get the current user's auth payload from their token

    router.get('/user', auth.required, function(req, res, next){
      User.findById(req.payload.id).then(function(user){
        if(!user){ return res.sendStatus(401); }

        return res.json({user: user.toAuthJSON()});
      }).catch(next);
    });

If the `User.findById()` promise doesn't get rejected, but the user we retrieved was a `falsey` value, that means the
user id in the JWT payload is invalid, and we respond with a 401 status code. This only happens when you try to use a JWT
of a user that's removed from the database, which should be an edge case since we won't be implementing how to delete a user.

Finally, let's created an authenticated endpoint to allow users to update their information.

### Create the update users endpoint (in `/users.js`)

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

        return user.save().then(function(){
          return res.json({user: user.toAuthJSON()});
        });
      }).catch(next);
    });

Here we use a series of if statements to make sure we only set fields on the user that were passed by the front-end
(so we don't accidentally set their username or password to null or undefined)