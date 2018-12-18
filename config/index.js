module.exports = {
  // The secret is set to "secret" in development and reads from an environment variable in production.
  secret: process.env.NODE_ENV === 'production' ? process.env.SECRET : 'secret'
};
