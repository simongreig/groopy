'use strict';

const express = require('express');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();


// TODO this needs to be replaced with a manual config load in order to unlink flickrOptions with the .env file.
var habitat = require("habitat"),
    env = habitat.load('.env'),
    Flickr = require("flickrapi"),
    flickrOptions = env.get("FLICKR");


// This is the version that requires a reauth every execution.
var Flickr = require("flickrapi") ;
var flickrOptions = {
  api_key: "6d742277929e0f153206a8af201e5962",
  secret: "1d0b18e0ccaaaecf",
  permissions: "write",
  nobrowser: "true",
  callback: appEnv.url + "/auth"
};

// TODO fix this properly but need to make sure it says HTTP and not HTTPS.
if (flickrOptions.callback.search("https") != -1 ) {
  flickrOptions.callback = flickrOptions.callback.replace ("https", "http");
}
console.log ("Loaded options", flickrOptions);


    // TODO.  Need to store the secret in the session cookie rather than the .env file.
    // Probably just over write it here with the session cookie data:
    // flickrOptions.access_token_secret = from the cookie
    // flickrOptions.access_token = from the cookie
    // flickrOptions.user_id = from the cookie



// Constants
const PORT = 8080;


// App
const app = express();

var cfmode = false ;

// A bit of a bodge but check if running in Cloud Foundry mode.
// It seems to run all the time but worth keeping in.
process.argv.forEach(function (val, index, array) {
  if (index == 2 && val == "cf") {
    cfmode = true;
  }
});

// Map the public directory
app.use(express.static(__dirname + '/public'));



// Run a search
app.get('/photos/:sort/:group/:page', function (req, res) {

  Flickr.authenticate(flickrOptions, function(error, flickr) {
    // we can now use "flickr" as our API object


    // Get the hostname of the URL that this app is running on.  As the app
    // runs all in the same directory then all we need to do is get the host for
    // all requests to the server.
    var host = req.get("host");

    var params = {
      user_id: flickr.options.user_id,
      page: req.params.page,
      per_page: 25,
      privacy_filter: 1,
      sort: req.params.sort,
      extras: "views, url_q"
    } ;

    if (req.params.group != "all") {
      params.group_id = req.params.group;
    }

    flickr.photos.search(params, function(err, result) {

      // Add in some RESTfull next and previous page urls into the response.
      if (result) {
        var page = result.photos.page;
        if (page > 1) {
          var prevpage = page - 1;
          result.prev='http://'+host+'/photos/'+ prevpage + '/' + req.params.text;
        }

        if (page < result.photos.pages) {
          var nextpage = page + 1;
          result.next='http://'+host+'/photos/'+ nextpage + '/' + req.params.text;
        }
      }
      res.send(result);
    });
  });
});

app.get('/photos/:sort/:group/:page/:text', function (req, res) {

  Flickr.authenticate(flickrOptions, function(error, flickr) {
    // we can now use "flickr" as our API object

    // Get the hostname of the URL that this app is running on.  As the app
    // runs all in the same directory then all we need to do is get the host for
    // all requests to the server.
    var host = req.get("host");


    var params = {
      user_id: flickr.options.user_id,
      page: req.params.page,
      per_page: 25,
      privacy_filter: 1,
      extras: "views, url_q",
      sort: req.params.sort,
      text: req.params.text
    } ;

    if (req.params.group != "all") {
      params.group_id = req.params.group;
    }


    flickr.photos.search(params, function(err, result) {

      // Add in some RESTfull next and previous page urls into the response.
      if (result) {
        var page = result.photos.page;
        if (page > 1) {
          var prevpage = page - 1;
          result.prev='http://'+host+'/photos/'+ prevpage + '/' + req.params.text;
        }

        if (page < result.photos.pages) {
          var nextpage = page + 1;
          result.next='http://'+host+'/photos/'+ nextpage + '/' + req.params.text;
        }
      }


      res.send(result);
    });
  });
});


app.get('/photo/:photo_id', function (req, res) {

  Flickr.authenticate(flickrOptions, function(error, flickr) {
    // we can now use "flickr" as our API object

    // TODO need to store the access_token, access_token_secret and user_id to the session cookie instead of the .env file.


    flickr.photos.getAllContexts({
      photo_id: req.params.photo_id
    }, function(err, result) {
      // result is Flickr's response
      if (!err)
      {
        result.id = req.params.photo_id;
        res.send(result);
      } else {
        console.log(req.params.photo_id, err);
      }

    });
  });
});



app.get('/move/:photo_id/:from_pool/:to_pool', function (req, res) {

  Flickr.authenticate(flickrOptions, function(error, flickr) {
    // we can now use "flickr" as our API object

    // TODO need to store the access_token, access_token_secret and user_id to the session cookie instead of the .env file.

    // TODO this is just a placeholder to test the client code. Need to add the pool movement code.
//    console.log("Requested move of photo "+req.params.photo_id+" from pool " + req.params.from_pool + " to pool " + req.params.to_pool);
    var result = {};
    result.id = req.params.photo_id;
    result.from_pool = req.params.from_pool;
    result.to_pool = req.params.to_pool;

//    console.log("***ACTUAL UPDATE COMMENTED OUT FOR TEST***");


    flickr.groups.pools.add({
      photo_id: req.params.photo_id,
      group_id: req.params.to_pool
    }, function (err, result) {
      if (!err) {

        //
        // If there is a from pool (because if the photo was in no
        // pool then this would be null
        //
        if (req.params.from_pool) {

          //
          flickr.groups.pools.remove ({
            photo_id: req.params.photo_id,
            group_id: req.params.from_pool
            }, function (err, result) {
              if (!err){
                result.error = "no error";
              } else {
  //              console.log(err);
  //              result.error = err;
              }
            });
          }

      } else {
        console.log(err);
        result.error = err;
      }
    });

    res.send(result);

  });
});




//  The authentication handler.
app.get('/auth', function (req, res) {

  res.write("Authenticated");
  flickrOptions.exchange(req.query);
  console.log('Authenticated');



});


if (cfmode) {
  //CF version of events

  // start server on the specified port and binding host
  app.listen(appEnv.port, '0.0.0.0', function() {

  	// print a message when the server starts listening
    console.log("server starting on " + appEnv.url);
  });
} else {
  app.listen(PORT);
  //console.log('Running on http://localhost:' + PORT);
  var os = require('os');
  console.log('Running on http://' + os.hostname()+":"+PORT);
}
