# Flickr Groopy

Flickr Group manager written in Angular and NodeJS.  Hosted here: [https://flickrgroopy.net](https://flickrgroopy.net)

Written by Simon Greig.

## Deploying to AWS
The steps required to deploy are:

### Deploy from scratch - create a new ElasticBeanstalk environment to host
These are all the CLI commands.  It is possible to do this in the AWS console also.

1. Download the code to your machine
2. `cd groopy`
3. Log onto AWS
4. Initiate the platform with `eb init` and follow the prompts
5. Create an environment with `eb create` and follow the prompts (this takes 2-3 minutes to create)

### Deploy to the server

1. Log into AWS
2. `eb deploy` to upload and deploy to AWS

## Running the app
The app will run in production mode or in local mode.  There is a differentiation because the Flickr authentication callback needs to know where to go.
Before running the code make sure that both of the following files exist:
    .env.local
    .env.prod


### Run in production
`npm start`

### Run locally for test purposes
Go to the local folder. e.g. `cd groopy`
Type: `npm test`
