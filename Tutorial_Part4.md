
# Tutorial - Articles

In this chapter, we'll learn how to build REST routes that enable our frontend to perform full CRUD operations on articles.

## Creating CRUD Endpoints for Articles

Creating, Reading, Updating, and Destroying data (CRUD) is the core paradigm for interactive web applications. While we 
only implemented creating, reading and updating user data in previous chapters, we will be utilizing full CRUD operations 
for implementing the functionality of articles.

If you've ever used a blogging system before, you're already familiar with how the functionality should work: you can 
create a new article, allow yourself and others to view the article, have the ability to edit the article if need be, 
or delete the article entirely if you decide that it sucks. In shorter words, we want the ability to create, read, update 
and destroy articles.

### Creating the Articles model

To get started, we'll need to build a new model that will handle the storage & manipulation of articles in the database. 
Per our [API Spec](https://thinkster.io/tutorials/design-a-robust-json-api/crud-endpoints#articles), articles will need 
to contain the following data:

- slug: This is a generated string that will be unique to each article used for database lookups 
(i.e. "how-to-build-a-snowman"). If you're not familiar with the concept of URL slugs, take a peek at this Wikipedia 
[article](https://en.wikipedia.org/wiki/Semantic_URL#Slug).

- title: The title of the article (i.e. "How to Build a Snowman")

- body: The markdown text that our article is comprised of (i.e. "Step 1 = Build Snowman, etc")

- description: A short explanation of what this article is about (i.e. "Learn how to build the world's best snowman")

- favoritesCount: The total number of times users have favorited this article (i.e. any number >= 0)

- tagList: A list of the tags that this article is associated with (i.e. ["snow", "man", "frozen"])

- author: An object that contains the public profile JSON of the article's author

Let's go ahead and create the base Mongoose model for this!

### Create a new file in `models/Article.js` for the Article model

We'll be using `mongoose-unique-validator` again to ensure the `slug` is unique

    var mongoose = require('mongoose');
    var uniqueValidator = require('mongoose-unique-validator');
    var slug = require('slug'); // package we'll use to auto create URL slugs
    
    var ArticleSchema = new mongoose.Schema({
      slug: {type: String, lowercase: true, unique: true},
      title: String,
      description: String,
      body: String,
      favoritesCount: {type: Number, default: 0},
      tagList: [{ type: String }],
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }, {timestamps: true});
    
    ArticleSchema.plugin(uniqueValidator, {message: 'is already taken'});
    
    
    mongoose.model('Article', ArticleSchema);
    
Excellent! Now, you may be wondering how the slug for a given article gets generated. 
The answer is that we have to do that ourselves :)

### Create a model method for generating unique article slugs

We'll use the [slug](https://www.npmjs.com/package/slug) package we imported to create a URL friendly slug based on the 
article's title. To ensure the slug is unique, we'll generate & add a random string that's 6 characters long to the end 
of the slug.

    [...]
    
    ArticleSchema.plugin(uniqueValidator, {message: 'is already taken'});
    
    ArticleSchema.methods.slugify = function() {
      this.slug = slug(this.title) + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36);
    };
    
    mongoose.model('Article', ArticleSchema);

So we have a method the generates a unique slug for this article, but where do we invoke that method? Ideally, it would 
be automatically invoked whenever an article is saved or updated.

For this, we can hook into Mongoose's middleware which allows us to execute functions before (and after) the model is 
validated and saved.

### Use Mongoose middleware to invoke the slugify method we created

We'll need to generate the slug 
[before Mongoose tries to validate](https://stackoverflow.com/questions/31471940/mongoose-difference-between-pre-save-and-validate-when-to-use-which-one) 
the model otherwise it will fail to save the article (because there won't be a slug, which is a required field).

    [...]
    
    ArticleSchema.pre('validate', function(next){
      if(!this.slug)  {
        this.slugify();
      }
    
      next();
    });
    
    
    mongoose.model('Article', ArticleSchema);


Perfect! The last thing we need to add to this model is a method for returning the proper JSON output for the API 
endpoints to return. Per our API spec, we should return all of the fields on this model as well as the timestamps for 
`createdAt` and `updatedAt` that Mongoose stored for us (since we set `{timestamps: true}`).

#### Add a method that returns the JSON of an article (also in `Articles.js`):

    [...]
    
    ArticleSchema.methods.toJSONFor = function(user){
      return {
        slug: this.slug,
        title: this.title,
        description: this.description,
        body: this.body,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        tagList: this.tagList,
        favoritesCount: this.favoritesCount,
        author: this.author.toProfileJSONFor(user)
      };
    };
    
    mongoose.model('Article', ArticleSchema);
    
Notice that we're calling `toProfileJSONFor(user)` that we made previously, which automatically creates the proper JSON 
data for the author field. Pretty cool!

Finally, we'll need to include this model in our main `app.js` file to ensure it can be used across our application.

    require('./models/User');
    +require('./models/Article');
    require('./config/passport');
    
And the Article model is done! The next thing we'll do is create the routes that will invoke the model we just created 
for creating, reading, updating, and deleting articles.


### Creating REST routes

Similar to how we created a new router for profiles prefixed with `/profiles` in the last chapter, for articles we'll 
do the same thing except these routes will be prefixed with `/articles` (per the API spec).

#### Create a router for articles in `/routes/api/articles.js`
    
    var router = require('express').Router();
    var passport = require('passport');
    var mongoose = require('mongoose');
    var Article = mongoose.model('Article');
    var User = mongoose.model('User');
    var auth = require('../auth');
    
    module.exports = router;
    
Next, we need to register this new router with the main API router.

#### Register the articles router with the API router

In `routes/api/index.js`, add the following:

    router.use('/', require('./users'));
    router.use('/profiles', require('./profiles'));
    +router.use('/articles', require('./articles'));
    
With the articles router created & wired up we can start making the routes for creating, reading, updating, 
and deleting articles.

### Creating articles

Create actions are typically performed using the POST method with the body of the request containing the data. 
Our API spec for creating articles matches this, so let's implement a route for `POST /api/articles`

#### Make the endpoint for creating articles

Since articles can only be created by a logged in user, we'll need to check their authentication before attempting to 
save the article data that was POSTed. In `/api/articles.js`:

    router.post('/', auth.required, function(req, res, next) {
      User.findById(req.payload.id).then(function(user){
        if (!user) { return res.sendStatus(401); }
    
        var article = new Article(req.body.article);
    
        article.author = user;
    
        return article.save().then(function(){
          console.log(article.author);
          return res.json({article: article.toJSONFor(user)});
        });
      }).catch(next);
    });
    
Sweet! Now let's build out read, update and delete functionality.

### Utilizing router parameters

Reading, updating, and deleting all require querying the database for a particular article by its slug, 
which means we would normally have to write the same exact query for every one of these routes. 
Luckily for us, express has a sweet feature that allows us to intercept requests with specific URL parameters that we 
want to perform logic on before handing it off to the next middleware function we defined.

In our case, whenever a URL definition has `:article` in it, express will look for a `router.param` that specifies 
`'article'`, and our corresponding function will add/set the corresponding article's data to `req.article` for our 
other routes to use.

#### Use `router.param` to intercept & prepopulate article data from the slug:

Note the fourth argument in the function below; express will hand us back the value of the article's slug 
from the URL in it.

    router.param('article', function(req, res, next, slug) {
      Article.findOne({ slug: slug})
        .populate('author')
        .then(function (article) {
          if (!article) { return res.sendStatus(404); }
    
          req.article = article;
    
          return next();
        }).catch(next);
    });
    
### Reading articles

To "read" an article from our API we'll use the standard `GET` method on `/api/articles/:slug`.

#### Make the endpoint for retrieving an article by its slug:

We'll need to explicitly populate the article's author object before returning it.

    router.get('/:article', auth.optional, function(req, res, next) {
      Promise.all([
        req.payload ? User.findById(req.payload.id) : null,
        req.article.populate('author').execPopulate()
      ]).then(function(results){
        var user = results[0];
    
        return res.json({article: req.article.toJSONFor(user)});
      }).catch(next);
    });


### Updating articles

Updates are typically performed with the `PUT` method. Our route will be `PUT` `/api/articles/:slug` and the body of the 
request will be used to overwrite the relevant fields in the article's model data.

#### Create the endpoint for updating articles:

We want to ensure the author of this article is also the currently logged in user (i.e. only authors can update 
their articles), so we'll check the used ID in the JWT payload `req.payload` against user ID in `req.article.author`.

We also want to check that the fields contain data. Otherwise, we might accidentally overwrite existing fields with undefined.

    router.put('/:article', auth.required, function(req, res, next) {
      User.findById(req.payload.id).then(function(user){
        if(req.article.author._id.toString() === req.payload.id.toString()){
          if(typeof req.body.article.title !== 'undefined'){
            req.article.title = req.body.article.title;
          }
    
          if(typeof req.body.article.description !== 'undefined'){
            req.article.description = req.body.article.description;
          }
    
          if(typeof req.body.article.body !== 'undefined'){
            req.article.body = req.body.article.body;
          }
    
          req.article.save().then(function(article){
            return res.json({article: article.toJSONFor(user)});
          }).catch(next);
        } else {
          return res.sendStatus(403);
        }
      });
    });

### Deleting articles

Our endpoint needs to delete an article when the `DELETE` `/api/articles/:slug` route is hit with proper authentication, 
but no request body is required.

#### Create the endpoint for deleting articles

We'll need to check that the currently logged in user is the author of this article. If they are the author, we'll 
delete the article and send them the status code 204 (request was successful and returns no content).

    router.delete('/:article', auth.required, function(req, res, next) {
      User.findById(req.payload.id).then(function(){
        if(req.article.author._id.toString() === req.payload.id.toString()){
          return req.article.remove().then(function(){
            return res.sendStatus(204);
          });
        } else {
          return res.sendStatus(403);
        }
      });
    });
    
And our API now has full REST routes implemented for articles!

### Testing Articles CRUD with Postman

Now we can test our endpoints using Postman. We should be able to create, retrieve, update and delete articles using the 
endpoints we've created.



