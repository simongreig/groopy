'use strict';

const express = require('express');
var session = require('express-session');
var Grant = require('grant-express');
var cookieParser = require('cookie-parser');
var Purest = require('purest');


// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();


var habitat = require("habitat"),
    env = habitat.load('.env'),
    flickrOptions = env.get("FLICKR");

flickrOptions.host = appEnv.url;
// TODO fix this properly but need to strip off the HTTP or HTTPS.
if (flickrOptions.host.search("https") != -1 ) {
  flickrOptions.host = flickrOptions.host.replace ("https://", "");
}
if (flickrOptions.host.search("http") != -1 ) {
  flickrOptions.host = flickrOptions.host.replace ("http://", "");
}

console.log ("Loaded options:", flickrOptions);


// Constants
const PORT = 8080;


// Load the Grant and Purest libraries used for auth and comms.
var grant = new Grant (
  {
    "server": {
    "protocol": flickrOptions.protocol,
    "host": flickrOptions.host,
    "callback": flickrOptions.callback,
    "transport": "querystring",
    "state": false   // Not needed for OAUTH1
    },
    "flickr": {
      "key": flickrOptions.api_key,
      "secret": flickrOptions.api_secret,
      "scope": [flickrOptions.permissions]
    }
  }
);

var flickr = new Purest({
  provider:'flickr',
  key: flickrOptions.api_key,
  secret: flickrOptions.api_secret}) ;







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


app.use(session({secret: flickrOptions.session_secret}));
app.use(grant);
app.use(cookieParser());



//******************************************************************************
//
// This route only exists in order to quickly test the Flickr API is working
//
//******************************************************************************
app.get('/flickr_test', function (req, res) {
  // call flickr.test.login
  flickr.get('?method=flickr.test.login', {
    oauth:{token: req.cookies.groopy_access_token, secret: req.cookies.groopy_access_secret},
    qs:{api_key:flickrOptions.api_key}
  },function (err, inres, body) {
    if (err) {
      res.end(JSON.stringify(err));
    } else {
      res.end(JSON.stringify(body));
    }
  });
});


//******************************************************************************
//
// The authentication call back once the call to the server is complete.
// All it does is store the access toke and secret in the cookie.
//
//******************************************************************************
app.get('/authcallback', function (req, res) {
  // TODO this should be one cookie storing an object.
  console.log(req.query);
  res.cookie('groopy_access_token' , req.query.access_token);
  res.cookie('groopy_access_secret', req.query.access_secret);
  res.cookie('groopy_user_id', req.query.raw.user_nsid);
  res.redirect(flickrOptions.post_auth_redirect);
});


//******************************************************************************
//
// Logs out the user by deleting the session cookie.
//
//******************************************************************************
app.get('/logout', function(req,res){
  // TODO this should be one cookie storing an object.
  res.clearCookie('groopy_access_token');
  res.clearCookie('groopy_access_secret');
  res.clearCookie('groopy_user_id');
  res.send('Logged out');
});




//******************************************************************************
//
// Run a search against Flickr.
// Example:  http://localhost:6002/photos/date-posted-desc/all/1
//
//******************************************************************************
app.get('/photos/:sort/:group/:page', function (req, res) {

  // Check if the user is logged on.  If they are not then it will
  // initiate the oauth flow.
  if (!req.cookies.groopy_access_token) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
  }

  // Get the hostname of the URL that this app is running on.  As the app
  // runs all in the same directory then all we need to do is get the host for
  // all requests to the server.
  var params = {
    api_key: flickrOptions.api_key,
    user_id: req.cookies.groopy_user_id,
    page: req.params.page,
    per_page: 25,
    privacy_filter: 1,
    sort: req.params.sort,
    extras: "views, url_q"
  } ;

  if (req.params.group != "all") {
    params.group_id = req.params.group;
  }


  flickr.get('?method=flickr.photos.search', {
    oauth:{token: req.cookies.groopy_access_token, secret: req.cookies.groopy_access_secret},
    qs:params
  },function (err, inres, body) {
    if (err) {
      res.end(JSON.stringify(err));
    } else {
      res.end(JSON.stringify(body));
    }
  });
});

//******************************************************************************
//
// Run a search against Flickr.
// Example:  http://localhost:6002/photos/date-posted-desc/all/1/watch
//
//******************************************************************************
app.get('/photos/:sort/:group/:page/:text', function (req, res) {

  // Check if the user is logged on.  If they are not then it will
  // initiate the oauth flow.
  if (!req.cookies.groopy_access_token) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
  }
  var params = {
    api_key: flickrOptions.api_key,
    user_id: req.cookies.groopy_user_id,
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

  flickr.get('?method=flickr.photos.search', {
    oauth:{token: req.cookies.groopy_access_token, secret: req.cookies.groopy_access_secret},
    qs:params
  },function (err, inres, body) {
    if (err) {
      res.end(JSON.stringify(err));
    } else {
      res.end(JSON.stringify(body));
    }
  });
});


//******************************************************************************
//
// Get the list of groups.
// Example:  http://localhost:6002/photo/22237689693
//
// Returns "stat":"ok" if it worked.
// Returned "stat":"fail" if something went wrong.
//
//******************************************************************************
app.get('/photo/:photo_id', function (req, res) {

  // Check if the user is logged on.  If they are not then it will
  // initiate the oauth flow.
  if (!req.cookies.groopy_access_token) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
  }

  var params = {
    api_key: flickrOptions.api_key,
    photo_id: req.params.photo_id
  } ;

  flickr.get('?method=flickr.photos.getAllContexts', {
    oauth:{token: req.cookies.groopy_access_token, secret: req.cookies.groopy_access_secret},
    qs:params
  },function (err, inres, body) {
    if (err) {
      res.end(JSON.stringify(err));
    } else {
      body.id = req.params.photo_id;
      var response = JSON.stringify(body);
      res.end(JSON.stringify(body));
    }
  });
});


//******************************************************************************
//
// Move the photo between groups
//
//******************************************************************************
app.get('/move/:photo_id/:from_pool/:to_pool', function (req, res) {

  // Check if the user is logged on.  If they are not then it will
  // initiate the oauth flow.
  if (!req.cookies.groopy_access_token) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
  }

  var result = {};
  result.id = req.params.photo_id;
  result.from_pool = req.params.from_pool;
  result.to_pool = req.params.to_pool;

//    console.log("***ACTUAL UPDATE COMMENTED OUT FOR TEST***");

  var params = {
    api_key: flickrOptions.api_key,
    photo_id: req.params.photo_id,
    group_id: req.params.to_pool
  } ;


  flickr.get('?method=flickr.groups.pools.add', {
    oauth:{token: req.cookies.groopy_access_token, secret: req.cookies.groopy_access_secret},
    qs:params
  },function (err, inres, body)
  {
    if (err) {
      res.end(JSON.stringify(err));
    } else {

      if (req.params.from_pool) {
        var params = {
          api_key: flickrOptions.api_key,
          photo_id: req.params.photo_id,
          group_id: req.params.from_pool
        } ;

        flickr.get('?method=flickr.groups.pools.remove', {
          oauth:{token: req.cookies.groopy_access_token, secret: req.cookies.groopy_access_secret},
          qs:params
        },function (err, inres, body) {
          if (err) {
            res.end(JSON.stringify(err));
          } else {
            body.id=req.params.photo_id;
            res.end(JSON.stringify(body));
          }
        });
      } else {
        body.id=req.params.photo_id;
        res.end(JSON.stringify(body));
      }
  }
  });

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
