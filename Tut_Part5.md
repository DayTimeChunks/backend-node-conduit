
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
