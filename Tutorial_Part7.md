
# Tutorial Part 7 (Exposing a Global Tags Endpoint)

On the homepage of our site, we want to showcase the most popular tags that users added to their articles. 
With a normal relational database, we would need to create a new table for tags, associate posts with them, etc. 
However, MongoDB and Mongoose make this insanely easy to do with minimal changes required.

First, let's create a router for our tags.

#### Create a new router for tags: `routes/api/tags.js`

    var router = require('express').Router();
    var mongoose = require('mongoose');
    var Article = mongoose.model('Article');
    
    module.exports = router;
    
#### Register the tags router with the API router `routes/api/index.js`
    
    router.use('/profiles', require('./profiles'));
    router.use('/articles', require('./articles'));
    +router.use('/tags', require('./tags'));

And this is where the magic happens. Using the find and distinct methods from Mongoose, we can gather the list of all 
unique tags that have been added to articles -- no additional database or model logic required.

#### Create a route for getting the set of tags that have been used on articles

    router.get('/', function(req, res, next) {
      Article.find().distinct('tagList').then(function(tags){
        return res.json({tags: tags});
      }).catch(next);
    });
    
    
### Testing Tags with Postman

- Using the "Create Article" request, modify the body and create a few articles with different tag sets.
- Fetch an article you've created using the "Single Article by slug" request and make sure tagList is included in the response.
- Using the "All Tags" request in Postman, send a request and make sure the tags are listed in descending order based 
off of how often they're used.

## Creating Queryable Endpoints for Lists & Feeds

Now that all the features have been built for our API, we're missing one last piece of functionality: Listing articles. 
We do this in a couple of places, there's a publically accessible Articles querying endpoint (where authentication can 
optionally be provided) for retrieving Articles by tag, author, and favoriter. Then there's a separate authenticated 
Feed which returns articles authored by users the authenticated user is following.

### Making a Queryable Endpoint

Our queryable endpoints support a few different options as query strings in the URL (`/api/articles?tag=NodeJS`). Here 
are the query parameters that we need to implement:

- `limit` - the number of articles being returned. This value defaults to `20` if it's not provided by the front end.
- `offset` - the number of articles to skip for query. This value is used for retrieving different pages of articles 
and defaults to `0` if it's not provided by the front end.
- `tag` - when provided, query for articles that include this tag.
- `author` - when provided, query for articles authored by this username.
- `favorited` - when provided, query for articles favorited by this username.

In addition to the list of articles, we also need a count of the query to return in our response for pagination. 
Our responses should look something like:

    {
      "articles": [{
        "description": "Ever wonder how?",
        "slug": "how-to-train-your-dragon",
        "title": "How to train your dragon",
        "tagList": ["dragons", "training"],
        "createdAt": "2016-02-18T03:22:56.637Z",
        "updatedAt": "2016-02-18T03:48:35.824Z",
        "favorited": false,
        "favoritesCount": 0,
        "author": {
          "username": "jake",
          "bio": "I work at statefarm",
          "image": "https://i.stack.imgur.com/xHWG8.jpg",
          "following": false
        }
      }, {
        "description": "So toothless",
        "slug": "how-to-train-your-dragon-2",
        "title": "How to train your dragon 2",
        "tagList": ["dragons", "training"],
        "createdAt": "2016-02-18T03:22:56.637Z",
        "updatedAt": "2016-02-18T03:48:35.824Z",
        "favorited": false,
        "favoritesCount": 0,
        "author": {
          "username": "jake",
          "bio": "I work at statefarm",
          "image": "https://i.stack.imgur.com/xHWG8.jpg",
          "following": false
        }
      }],
        "articlesCount": 2
    }

Let's start by creating the endpoint to return the all of the articles in the correct format, in addition to supporting 
the limit and offset query parameters; then we'll implement support for the other query parameters. To get the values 
required for our response, we'll need to run a few queries to MongoDB:

1. Retrieve the list of articles and use the `limit` and `offset` query parameters.
2. Retrieve the count of articles without the `limit` and `offset` parameters.
3. Retrieve the authenticated user if a valid token was given. We need this so that we can return whether or not the 
user have favorited the article or followed the author in the article JSON.

While it may be tempting to run these queries separately, we can combine them into a single promise using `Promise.all()`.  
The `Promise.all()` method takes an array of promises, which will then try to resolve the array of promises, and then 
pass an array of resolved values to the attached `.then` handler. Any values that are not wrapped in a promise will be considered resolved.

Create an endpoint to list all articles

    router.get('/', auth.optional, function(req, res, next) {
      var query = {};
      var limit = 20;
      var offset = 0;
    
      if(typeof req.query.limit !== 'undefined'){
        limit = req.query.limit;
      }
    
      if(typeof req.query.offset !== 'undefined'){
        offset = req.query.offset;
      }
    
      return Promise.all([
        Article.find(query)
          .limit(Number(limit))
          .skip(Number(offset))
          .sort({createdAt: 'desc'})
          .populate('author')
          .exec(),
        Article.count(query).exec(),
        req.payload ? User.findById(req.payload.id) : null,
      ]).then(function(results){
        var articles = results[0];
        var articlesCount = results[1];
        var user = results[2];
    
        return res.json({
          articles: articles.map(function(article){
            return article.toJSONFor(user);
          }),
          articlesCount: articlesCount
        });
      }).catch(next);
    });
    
When the user is signed out, we use null as the last value in the array of promises passed to `Promise.all()`, which 
will resolve the last value to `null` in the array passed to our `.then` handler.

We can now retrieve a list of the 20 most recent articles using this endpoint, and use the `limit` and `offset` query 
parameters to paginate the results. Now we need to implement the `tags`, `favorited` and `author` query parameters. The 
favorited and author queries will need additional queries to resolve the usernames to users. We'll implement the `tags` 
query parameter first since we can get that functionality by adding it as part of our existing query object.

#### Add the ability to filter articles by tags

    router.get('/', auth.optional, function(req, res, next) {
      var query = {};
      var limit = 20;
      var offset = 0;
    
      if(typeof req.query.limit !== 'undefined'){
        limit = req.query.limit;
      }
    
      if(typeof req.query.offset !== 'undefined'){
        offset = req.query.offset;
      }
    
    + if( typeof req.query.tag !== 'undefined' ){
    +   query.tagList = {"$in" : [req.query.tag]};
    + }
    
      return Promise.all([
        Article.find(query)
          .limit(Number(limit))
          .skip(Number(offset))
          .sort({createdAt: 'desc'})
          .populate('author')
          .exec(),
        Article.count(query).exec(),
        req.payload ? User.findById(req.payload.id) : null,
      ]).then(function(results){
        var articles = results[0];
        var articlesCount = results[1];
        var user = results[2];
    
        return res.json({
          articles: articles.map(function(article){
            return article.toJSONFor(user);
          }),
          articlesCount: articlesCount
        });
      }).catch(next);
    });

We can now use the tag query parameter to filter our list of articles by their tags. For the `author` and `favorited` query 
parameter, we'll need to wrap our existing `Promise.all()` in another `Promise.all()` since we need to find the users from 
their usernames in the query parameters before we can run the query for articles.

#### Add the ability to filter articles by author and favoriter

First, we'll need to see if the favorited and author query parameters were used, then we run a `User.findOne` to find 
the user with the username from the query parameter and pass it to `Promise.all()`. If the query parameter wasn't used, 
`null` is passed to `Promise.all()` instead. Once `Promise.all()` resolves we build our `query` object depending on if a 
user was resolved from the queries.

    router.get('/', auth.optional, function(req, res, next) {
      var query = {};
      var limit = 20;
      var offset = 0;
    
      if(typeof req.query.limit !== 'undefined'){
        limit = req.query.limit;
      }
    
      if(typeof req.query.offset !== 'undefined'){
        offset = req.query.offset;
      }
    
      if( typeof req.query.tag !== 'undefined' ){
        query.tagList = {"$in" : [req.query.tag]};
      }
    
    + Promise.all([
    +   req.query.author ? User.findOne({username: req.query.author}) : null,
    +   req.query.favorited ? User.findOne({username: req.query.favorited}) : null
    + ]).then(function(results){
    +   var author = results[0];
    +   var favoriter = results[1];
    +
    +   if(author){
    +     query.author = author._id;
    +   }
    +
    +   if(favoriter){
    +     query._id = {$in: favoriter.favorites};
    +   } else if(req.query.favorited){
    +     query._id = {$in: []};
    +   }
    
        return Promise.all([
          Article.find(query)
            .limit(Number(limit))
            .skip(Number(offset))
            .sort({createdAt: 'desc'})
            .populate('author')
            .exec(),
          Article.count(query).exec(),
          req.payload ? User.findById(req.payload.id) : null,
        ]).then(function(results){
          var articles = results[0];
          var articlesCount = results[1];
          var user = results[2];
    
          return res.json({
            articles: articles.map(function(article){
              return article.toJSONFor(user);
            }),
            articlesCount: articlesCount
          });
    -   }).catch(next);
    +   });
    + }).catch(next);
    });
    
When `req.query.favorited` exists (meaning the `favorited` query parameter was used) but we can't find the user in our database, 
we set `_id` to `{$in: []}` in our query so that no articles get returned (since the favoriting user doesn't exist).

### Creating the Feed Endpoint
The feed endpoint is very similar to the articles endpoint. It returns a list of articles along with the count, but it 
only needs to respond to the `limit` and `offset` query parameters. The query for articles will be based on who the user is following.

#### Create a route for retrieving articles authored by users being followed

In `routes/api/articles.js`, add the following route:

    router.get('/feed', auth.required, function(req, res, next) {
      var limit = 20;
      var offset = 0;
    
      if(typeof req.query.limit !== 'undefined'){
        limit = req.query.limit;
      }
    
      if(typeof req.query.offset !== 'undefined'){
        offset = req.query.offset;
      }
    
      User.findById(req.payload.id).then(function(user){
        if (!user) { return res.sendStatus(401); }
    
        Promise.all([
          Article.find({ author: {$in: user.following}})
            .limit(Number(limit))
            .skip(Number(offset))
            .populate('author')
            .exec(),
          Article.count({ author: {$in: user.following}})
        ]).then(function(results){
          var articles = results[0];
          var articlesCount = results[1];
    
          return res.json({
            articles: articles.map(function(article){
              return article.toJSONFor(user);
            }),
            articlesCount: articlesCount
          });
        }).catch(next);
      });
    });
    
## Building the Frontend

Create a React or Angular web app that interacts with our backend API
    
If you built a backend, then you can build your frontend app against that. Otherwise you can use our public API — 
simply set the API URL in the following tutorials to `https://conduit.productionready.io/api` instead of `localhost:3000`.

Besides utilizing the API structure we designed in the previous section for talking to the backend, there are some other 
reusable parts of the Conduit frontend you need to be familiar with.

Since we're building the same application in every frontend framework, we created a custom Bootstrap 4 CSS theme that every 
Conduit app takes advantage of. Specifically, we've provided all of the HTML structure (with relevant stylings) for every 
Conduit page to ensure we can just focus our learnings on the Javascript framework at hand.

This all comes at no expense to you, as we have a single CSS file for the Conduit Bootstrap theme hosted on our CDN 
that all of the tutorials link to out of the box. Every tutorial provides you with the relevant HTML templates as well 
while you build the app step-by-step.

## [Build the frontend](https://thinkster.io/tutorials/build-a-real-world-react-redux-application)