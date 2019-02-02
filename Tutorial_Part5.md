
# Tutorial Part 5 (Model Relationships)

Creating Model Relationships for Favoriting Functionality. We'll use Mongoose to associate articles with users who have 
favorited them.

The functionality for favoriting articles provides two purposes: it shows how many users have favorited a given article, 
and you can view all of the articles any given user has favorited. Considering this, it's important to figure out how we'd ideally query for this data.

## Modifying our models

Since we'll need to retrieve a user's profile data to before trying to retrieve any articles they've favorited, it makes 
sense to store all of the article ID's they've favorited in an array on the User model.

### Add a favorites collection to the `UserSchema` in `User.js`

    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],

Next, we'll create a method that will simply add an article ID to the user's favorites array.

### Create a method for a user to favorite an article

    UserSchema.methods.favorite = function(id){
      if(this.favorites.indexOf(id) === -1){
        this.favorites.push(id);
      }
    
      return this.save();
    };
    
Note **BUG**

Replace code above with this:

    UserSchema.methods.favorite = function(id){
          if(this.favorites.indexOf(id) === -1){
            // not: this.favorites.push(id);
            this.favorites = this.favorites.concat([id]);  
          }
        
          return this.save();
        };

  
    
Of course, we might regret favoriting an article (especially if it's click bait), so we should be able to 
unfavorite it as well.

### Create a method for a user to unfavorite an article

    UserSchema.methods.unfavorite = function(id){
      this.favorites.remove( id );
      return this.save();
    };
    
We need to tell the front end whether it should show a favorite or unfavorite button for any given article. 
We'll create a method that allows us to quickly determine whether or not we've favorited an article before.

### Create a method for a user to check if they've favorited an article

    UserSchema.methods.isFavorite = function(id){
      return this.favorites.some(function(favoriteId){
        return favoriteId.toString() === id.toString();
      });
    };

With that method in place, let's utilize it to output whether the currently logged in user has favorited this article 
whenever the article JSON is sent back.

### Update the JSON response 

Update the JSON response for articles to include whether or not the user viewing the 
article has favorited it (in `models/Article.js`)

    ArticleSchema.methods.toJSONFor = function(user){
      return {
        slug: this.slug,
        title: this.title,
        description: this.description,
        body: this.body,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        tagList: this.tagList,
    +   favorited: user ? user.isFavorite(this._id) : false,
        favoritesCount: this.favoritesCount,
        author: this.author.toProfileJSONFor(user)
      };
    };

Next, we'll create a method that keeps a count of how many users have favorited an article. Since this is information 
related to the retrieval of articles, we'll add this to the Article model itself.

Instead of incrementing/decrementing the field, we'll use a mongoose query to see how many user's have this article ID in 
their favorites array and set the favorites count on the article model accordingly. This way the favorites count will 
always reflect the actual number of favorites we have stored in our database, whereas incrementing/decrementing could 
lead to inaccurate data (especially if we have unknown bugs in our code :)

### Create a method to update an article's favorite count.

In `models/Article.js`, require the User model:

    var User = mongoose.model('User');
    
Then create the following method:

    ArticleSchema.methods.updateFavoriteCount = function() {
      var article = this;
    
      return User.count({favorites: {$in: [article._id]}}).then(function(count){
        article.favoritesCount = count;
    
        return article.save();
      });
    };

All of the model changes required for favoriting functionality are now complete!


## Creating API endpoints

Let's wire up our models & methods to actual API endpoints.

### Create an endpoint for favoriting an article in `routes/api/articles.js`

Since we're creating a favorite, we'll use the `POST` method for this. We'll also be calling `updateFavoriteCount` 
whenever a user favorites or unfavorites the article.

    // Favorite an article
    router.post('/:article/favorite', auth.required, function(req, res, next) {
      var articleId = req.article._id;
    
      User.findById(req.payload.id).then(function(user){
        if (!user) { return res.sendStatus(401); }
    
        return user.favorite(articleId).then(function(){
          return req.article.updateFavoriteCount().then(function(article){
            return res.json({article: article.toJSONFor(user)});
          });
        });
      }).catch(next);
    });
    
Next, we'll create the endpoint for unfavoriting an article, which is super similar to the favorite endpoint -- 
the only difference is that it's invoked from `DELETE` requests and calls the `user.unfavorite` method.

### Create an endpoint for unfavoriting an article

    // Unfavorite an article
    router.delete('/:article/favorite', auth.required, function(req, res, next) {
      var articleId = req.article._id;
    
      User.findById(req.payload.id).then(function (user){
        if (!user) { return res.sendStatus(401); }
    
        return user.unfavorite(articleId).then(function(){
          return req.article.updateFavoriteCount().then(function(article){
            return res.json({article: article.toJSONFor(user)});
          });
        });
      }).catch(next);
    });
    
And that's it! Be sure to test out these endpoints in Postman to make sure they work.

++++++++
TODO: LEFT OF HERE!!!
+++++++++

## [Enabling Commenting Functionality on Articles](https://thinkster.io/tutorials/node-json-api/adding-comments-to-articles)

Similar to CRUD operations for articles and the relational functionality behind favoriting, commenting will require a 
mix of both.
 
Comments are a staple of most blogging systems -- they allow users other than the author to provide commentary regarding 
the contents of the article. As such, we'll need to associate comments with specific articles in our database and only 
registered users will be able to submit comments.

### Creating the model
Unlike the favoriting functionality, which only required modification of existing models, we'll need to create a brand 
new model that stores the contents of a given content as well as associating itself with the author of the comment and 
the article it was posted on.

#### Create a comments model

    var mongoose = require('mongoose');
    
    var CommentSchema = new mongoose.Schema({
      body: String,
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' }
    }, {timestamps: true});
    
    // Requires population of author
    CommentSchema.methods.toJSONFor = function(user){
      return {
        id: this._id,
        body: this.body,
        createdAt: this.createdAt,
        author: this.author.toProfileJSONFor(user)
      };
    };
    
    mongoose.model('Comment', CommentSchema);

Note that we also created a toJSONFor method on this model that adheres to our comment JSON spec (similar to what we did 
for our User and Article models).

And models are never any fun to play with unless our entire app can access them, so...

Register the comments model in `app.js`

    require('./models/User');
    require('./models/Article');
    +require('./models/Comment');
    require('./config/passport');

Perfect.

So what's next? Well, we need a way to associate a comment with a specific article -- in the Articles model lets add an 
array of comment IDs.

Add a reference for many comments in the Article model

    +  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],

And that's all that's required for getting commenting functionality into our models! Note that we don't store the comment 
IDs in the User model as we don't have any endpoints that would return all the comments a particular user has made. 
Comments are only retrieved through their association with a specific article.

Speaking of which, lets set up the endpoints!

### Creating API endpoints

We only support three operations for comments: creating a new comment, reading a list of comments associated with an 
article, and deleting a specific comment.

Let's start with the endpoint that creates new comments and adheres to our API spec.

Create an endpoint to create comments on articles `routes/api/articles.js`

    router.post('/:article/comments', auth.required, function(req, res, next) {
      User.findById(req.payload.id).then(function(user){
        if(!user){ return res.sendStatus(401); }
    
        var comment = new Comment(req.body.comment);
        comment.article = req.article;
        comment.author = user;
    
        return comment.save().then(function(){
          req.article.comments.push(comment);
    
          return req.article.save().then(function(article) {
            res.json({comment: comment.toJSONFor(user)});
          });
        });
      }).catch(next);
    });

Excellent! Now, to retrieve all of the comments associated with a given article, we'll need to populate the comments & 
corresponding author data stored within its model and then return it.

#### Create an endpoint to list comments on articles
    
    router.get('/:article/comments', auth.optional, function(req, res, next){
      Promise.resolve(req.payload ? User.findById(req.payload.id) : null).then(function(user){
        return req.article.populate({
          path: 'comments',
          populate: {
            path: 'author'
          },
          options: {
            sort: {
              createdAt: 'desc'
            }
          }
        }).execPopulate().then(function(article) {
          return res.json({comments: req.article.comments.map(function(comment){
            return comment.toJSONFor(user);
          })});
        });
      }).catch(next);
    });
    
Finally, let's create an endpoint that will allow the comment author to delete their comments.

#### Create an endpoint to destroy comments on articles

Before we can create the DELETE route, we'll need a router param middleware for resolving the `/:comment` in our URL:

    router.param('comment', function(req, res, next, id) {
      Comment.findById(id).then(function(comment){
        if(!comment) { return res.sendStatus(404); }
    
        req.comment = comment;
    
        return next();
      }).catch(next);
    });

And then we create the router.delete middleware for deleting comments. We need to check that the currently logged in user 
is the comment author before deleting. After that, we'll remove the comment ID from the article model, save the new article's data, 
and then delete the actual comment from the database.
    
    router.delete('/:article/comments/:comment', auth.required, function(req, res, next) {
      if(req.comment.author.toString() === req.payload.id.toString()){
        req.article.comments.remove(req.comment._id);
        req.article.save()
          .then(Comment.find({_id: req.comment._id}).remove().exec())
          .then(function(){
            res.sendStatus(204);
          });
      } else {
        res.sendStatus(403);
      }
    });
    
When you work with relational data in Mongoose, you'll often need to delete not only the primary data itself (a comment, 
for example) but also any references to that data (i.e. a comment ID). This is one of the downsides of using a NoSQL database 
like MongoDB, but it's a small price to pay to avoid migrations, explicit table layouts, and other frustrating aspects of 
relational databases.

### Testing Comments using Postman

- Create a comment using the "Create Comment for Article" request in Postman
- Retrieve comments for an article using the "All Comments for Article" request in Postman
- Delete a comment using the "Delete Comment for Article" request in Postman