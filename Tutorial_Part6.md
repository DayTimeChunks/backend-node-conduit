
# Tutorial Part 6 (One-to-Many Relationships)

## Implementing Following Functionality With One-to-Many Relationships 

Similar to favoriting functionality, we'll modify our User model to store & manipulate the IDs of users we follow.

Following is all the rage these days -- why waste time adding friends when you can stalk them instead 
(oops I meant follow :)? To make our blogging platform truly social, we'll need to implement the ability for users to 
follow each other and see the latest articles they're writing.

## Modifying the User model

Similar to how we implemented the functionality for favoriting articles, we'll store an array of the user IDs we're 
following on the user model.

#### Store an array of IDs the User is following on UserSchema

      following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      
Next, we'll create a method that will simply add a new user ID to the current user's following array.

#### Create a method for a following another user

    UserSchema.methods.follow = function(id){
      if(this.following.indexOf(id) === -1){
        this.following.push(id);
      }
    
      return this.save();
    };
    
Should the user decide they don't want to follow another user anymore, we'll need a method that will remove that user's 
ID from their following array.

#### Create a method for a unfollowing another user

    UserSchema.methods.unfollow = function(id){
      this.following.remove(id);
      return this.save();
    };

We need to tell the front end whether it should show a follow or unfollow button for a given user's profile. 
We'll create a method that allows us to quickly determine whether or not we're following a given user.

#### Create a method for checking if a user is following another user

    UserSchema.methods.isFollowing = function(id){
      return this.following.some(function(followId){
        return followId.toString() === id.toString();
      });
    };
    
Let's invoke that method in the JSON output of profiles on the following key.

#### Update the profiles JSON payload to include a `following` boolean

    UserSchema.methods.toProfileJSONFor = function(user){
      return {
        username: this.username,
        bio: this.bio,
        image: this.image || 'https://static.productionready.io/images/smiley-cyrus.jpg',
        following: user ? user.isFollowing(this._id) : false
      };
    };
    
### Creating API endpoints

Let's create the two routes for following and unfollowing users.

#### Create an endpoint for following another user

In `routes/api/profiles.js`, create the following route:

    router.post('/:username/follow', auth.required, function(req, res, next){
      var profileId = req.profile._id;
    
      User.findById(req.payload.id).then(function(user){
        if (!user) { return res.sendStatus(401); }
    
        return user.follow(profileId).then(function(){
          return res.json({profile: req.profile.toProfileJSONFor(user)});
        });
      }).catch(next);
    });
    
Now, we'll create the endpoint for `unfollowing`.

#### Create an endpoint for unfollowing another user

In `routes/api/profiles.js`, create the following route:

    router.delete('/:username/follow', auth.required, function(req, res, next){
      var profileId = req.profile._id;
    
      User.findById(req.payload.id).then(function(user){
        if (!user) { return res.sendStatus(401); }
    
        return user.unfollow(profileId).then(function(){
          return res.json({profile: req.profile.toProfileJSONFor(user)});
        });
      }).catch(next);
    });
    
Following and unfollowing now work!

### Testing Following using Postman

If you haven't already, create a couple more users on the backend so that we can test out our following/followers functionality

- Follow a user using the "Follow Profile" request in Postman
- Unfollow a user using the "Unfollow Profile" request in Postman

