
# Deploying to App Engine

To switch projects, type:

    `gcloud config set project PROJECT_ID`
    
Testing this app in project-id: `black-sanctum-181618`

Then, run:

    `gcloud app deploy`
    
    
The tutorials that helped me:

With App Engine: [Tutorial](https://cloud.google.com/community/tutorials/nodejs-mongodb-on-appengine). The code here 
of the connection is rather implemented with Mongoose as it is done [here](https://medium.freecodecamp.org/introduction-to-mongoose-for-mongodb-d2a7aa593c57).

And this helpful [stack post](https://stackoverflow.com/questions/46527549/connecting-mongoose-on-google-app-engine/46782642?noredirect=1#comment94568377_46782642).

## Setting up: app.yaml

On `app.yaml` declare environment variables: 

Attempt with **Atlas** (not working for the moment, maybe follow the MongoDB Atlas part of the 
[here](https://cloud.google.com/community/tutorials/mongodb-atlas-appengineflex-nodejs-app)):

- MongoDB URI contains the special character `$`, which needs to be repleced by `%24`.

    `paste Atlas URI here...`

Attempt with [mLab](https://mlab.com/databases/conduit-test#collections):

- First try locally, replace dbuser with `daytight` and password `p47845029`. On terminal:

    `mongo ds135844.mlab.com:35844/conduit-test -u <dbuser> -p <dbpassword>`
    `mongo ds135844.mlab.com:35844/conduit-test -u daytight -p p47845029`

The above code connected on the terminal, now to connect using a driver during development, paste this into the 
app's MongoDB URI in `app.yaml`:

    mongodb://<dbuser>:<dbpassword>@ds135844.mlab.com:35844/conduit-test
    
The app is now serving under (implemented with mLab):

    `https://black-sanctum-181618.appspot.com/api`

Check logs [here](https://console.cloud.google.com/logs/viewer?authuser=0&project=black-sanctum-181618).


NOTE: The current server for mlab will fail above one instance! So not for real production.