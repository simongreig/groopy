# Flickr Groopy

Flickr Group manager written in Angular and NodeJS.  Hosted here: [https://flickrgroopy.net](https://flickrgroopy.net)

Written by Simon Greig.

## Deploying to AWS
The steps required to deploy are:

### Lightsail

The app is deployed in AWS Lightsail with a Lightsale managed domain.  This means that all DNS updates need to be done via Lightsail and any DNS changes made in Route53 don't apply.

### Manual Deployments

It is all pull at the moment from GitHub.  This is how to do a clean install:

1. Go to the Lightsail console at AWS and click connect to instance
2. On the SSH terminal `cd /opt/bitnami/projects`
3. Refresh the code `git clone https://github.com/simongreig/groopy`
4. Go into the app `cd groopy`
5. Refresh the install `npm install`

### Manual Updates

It is all pull at the moment from GitHub.  This is how to do a refresh from the master repo:

1. Go to the Lightsail console at AWS and click connect to instance
2. On the SSH terminal `cd /opt/bitnami/projects/groopy`
3. Refresh the code `git pull`  **NOTE THIS IS UNTESTED - UPDATE THESE NOTES WHEN A CODE CHANGE IS DEPLOYED**
4. Find and stop the service:  `forever list` then `forever stop 0` (replace `0` with whatever `forever list` responds to
5. Restart the service: `NODE_ENV=prod forever start ./bin/www`




## Running the app
The app will run in production mode or in local mode.  There is a differentiation because the Flickr authentication callback needs to know where to go.
Before running the code make sure that both of the following files exist:
    .env.local
    .env.prod


### Run in production
`NODE_ENV=prod forever start ./bin/www`

### Run locally for test purposes
Go to the local folder. e.g. `cd groopy`
Type: `npm test`
