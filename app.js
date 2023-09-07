'use strict';

console.log ("Running in NODE_ENV=" + process.env.NODE_ENV);

const express = require('express');
var cookieSession = require('cookie-session');
var cookieParser = require('cookie-parser');
var compression = require('compression');
var Grant = require('grant').express()
const Flickr = require('flickr-sdk')


// NOTE: Groopy needs two .env files to run.  .env.local and .env.prod

const envFile = ".env." + process.env.NODE_ENV
var habitat = require("habitat"),
    env = habitat.load(envFile),
    flickrOptions = env.get("FLICKR");

console.log ("Loaded options:", flickrOptions);


// Constants
const PORT = 8080;


// Load the Grant and Purest libraries used for auth and comms.
var grant = new Grant (
  {
    "defaults": {
      "origin": flickrOptions.origin,
      "transport": "querystring"
    },
    "flickr": {
      "key": flickrOptions.api_key,
      "secret": flickrOptions.api_secret,
      "callback": flickrOptions.callback,
      "scope": [flickrOptions.permissions]
    }
  }
);

// App
const app = express();

var path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieSession({
  name: 'groopy-session-default',
  keys: [flickrOptions.session_secret1, flickrOptions.session_secret1]
}))



app.use(grant);
app.use(cookieParser());

// Add in some basic security middleware
var helmet = require('helmet');
app.use(helmet());

// Add in compresison to speed up the app generally
app.use(compression());


//******************************************************************************
//
// Helper function to instantiate a new flickr connection object using the
// tokens and things from the request message.  Need to use the request tokens
// to support multiple users.
//
//******************************************************************************
function frickr(req) {
  return new Flickr(Flickr.OAuth.createPlugin(
    flickrOptions.api_key,
    flickrOptions.api_secret,
    req.cookies.groopy.access_token,
    req.cookies.groopy.access_secret
  ));
}


//******************************************************************************
//
// The authentication call back once the call to the server is complete.
// All it does is store the access toke and secret in the cookie.
//
//******************************************************************************
app.get('/authcallback', function (req, res) {
  // TODO this should be one cookie storing an object.
  console.log("Logged on " + req.query.raw.username + " (" + req.query.raw.user_nsid + ")");
  var cookie_content = {};
  cookie_content = req.query;
  cookie_content.user_id = req.query.raw.user_nsid ;

  var expire_time = 5 * 365 * 24 * 3600000;  // 5 years
  res.cookie('groopy' , cookie_content, {maxAge : expire_time});

  res.redirect(flickrOptions.post_auth_redirect);
});


//******************************************************************************
//
// Logs out the user by deleting the session cookie.
//
//******************************************************************************
app.get('/logout', function(req,res){
  // TODO this should be one cookie storing an object.
  res.clearCookie('groopy');
  res.send('Logged out');
});


//******************************************************************************
//
// This route only exists in order to quickly test the Flickr API is working
//
//******************************************************************************
app.get('/flickr_test', function (req, res) {
  frickr(req).test.login().then(function (resp) {
    res.end(JSON.stringify(resp.body));
  }).catch(function (err) {
    res.end(JSON.stringify(err));
  });
});


//******************************************************************************
//
// Run a search against Flickr.
// Example:
// http://localhost:6002/photos?group_id=14813384@N00&page=2&per_page=10&sort=date-posted-asc&text=watch
//
// Valid query params:  group_id, page, per_page, sort, text
//
//******************************************************************************
app.get('/photos', function (req, res) {

  // Check if the user is logged on.  If they are not then it will
  // initiate the oauth flow.
  if (!req.cookies.groopy) {

    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
    return;
  } else {
    // Refresh the cookie expiry.
    req.cookies.groopy.maxAge = 28 * 24 * 3600000; // 4 weeks
  }

  var params = {
    api_key: flickrOptions.api_key,
    user_id: req.cookies.groopy.user_id,
    privacy_filter: 1,
    extras: "views, url_q, count_faves"
  } ;

  if (req.query.group_id) {
    params.group_id = req.query.group_id;
  }

  if (req.query.page) {
    params.page = req.query.page ;
  }

  if (req.query.per_page) {
    params.per_page = req.query.per_page;
  } else {
    params.per_page = 25;
  }

  if (req.query.sort) {
    params.sort = req.query.sort;
  }

  if (req.query.text) {
    params.text = req.query.text;
  }

  var start = new Date().getTime();
  frickr(req).photos.search(params).then(function (resp) {
    resp.body.flickr_time_taken = new Date().getTime() - start;
    res.end(JSON.stringify(resp.body));
  }).catch(function (err) {
    res.end(JSON.stringify(err));
  });
});

//******************************************************************************
//
// Returns the detail of the faves for a photo.
// Example:
// http://localhost:6002/faves/34865737241
//
//******************************************************************************
app.get('/faves/:photo_id', function (req, res) {

  // Check if the user is logged on.  If they are not then it will
  // initiate the oauth flow.
  if (!req.cookies.groopy) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
    return;
  } else {
    // Refresh the cookie expiry.
    req.cookies.groopy.maxAge = 28 * 24 * 3600000; // 4 weeks
  }

  var params = {
    api_key: flickrOptions.api_key,
    user_id: req.cookies.groopy.user_id,
    photo_id: req.params.photo_id
  } ;

  var start = new Date().getTime();
  frickr(req).photos.getFavorites(params).then(function (resp) {
    resp.body.flickr_time_taken = new Date().getTime() - start;
    res.end(JSON.stringify(resp.body));
  }).catch(function (err) {
    res.end(JSON.stringify(err));
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
  if (!req.cookies.groopy) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
    return;
  } else {
    // Refresh the cookie expiry.
    req.cookies.groopy.maxAge = 28 * 24 * 3600000; // 4 weeks
  }

  var params = {
    api_key: flickrOptions.api_key,
    photo_id: req.params.photo_id
  } ;


  var start = new Date().getTime();
  frickr(req).photos.getAllContexts(params).then(function (resp) {
    resp.body.id = req.params.photo_id;
    resp.body.flickr_time_taken = new Date().getTime() - start;
    res.end(JSON.stringify(resp.body));
  }).catch(function (err) {
    res.end(JSON.stringify(err));
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
  if (!req.cookies.groopy) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
    return;
  } else {
    // Refresh the cookie expiry.
    req.cookies.groopy.maxAge = 28 * 24 * 3600000; // 4 weeks
  }

  var result = {};
  result.id = req.params.photo_id;
  result.from_pool = req.params.from_pool;
  result.to_pool = req.params.to_pool;

  var params = {
    api_key: flickrOptions.api_key,
    photo_id: req.params.photo_id,
    group_id: req.params.to_pool
  } ;



  frickr(req).groups.pools.add(params).then(function (resp) {
    // This is the real response.  It is either ok or fail.
    // If the add failed (eg the photo lmit is reached) then exit now with
    // a useful error message.
    var body = resp.body;

    if (body.stat == "fail") {
      // The add failed so return the error string.
      res.end(JSON.stringify(body));
      return;
    }

    // Ok so still here then?  If so then the add worked and time to do the remove
    // If the 'from pool' is undefined then don't bother to do the remove, just
    // respond back as part of the ELSE statement.
    if (req.params.from_pool != "undefined") {
      var params = {
        api_key: flickrOptions.api_key,
        photo_id: req.params.photo_id,
        group_id: req.params.from_pool
      } ;

      frickr(req).groups.pools.remove(params).then(function (resp) {
        var body = resp.body;
        if (!body) {
          var resultbody = {};
          resultbody.id = req.params.photo_id;
          resultbody.stat = "ok";
          res.end(JSON.stringify(resultbody));
        } else {
          body.id = req.params.photo_id;
          res.end(JSON.stringify(body));
        }
      }).catch(function (err) {
        res.end(JSON.stringify(err));
      });

    } else {
      body.id=req.params.photo_id;
      res.end(JSON.stringify(body));
    }
  }).catch(function (err) {
     res.end(JSON.stringify(err));
  });
});

//******************************************************************************
//
// Join the logged on user to the specified group.
// e.g. http://localhost:6002/group/665334@N25
//
// Returns "stat":"ok" if it worked.
// Returned "stat":"fail" if something went wrong.
//
//******************************************************************************
app.get('/group/:group_id', function (req, res) {

  // Check if the user is logged on.  If they are not then it will
  // initiate the oauth flow.
  if (!req.cookies.groopy) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
    return;
  } else {
    // Refresh the cookie expiry.
    req.cookies.groopy.maxAge = 28 * 24 * 3600000; // 4 weeks
  }

  var params = {
    api_key: flickrOptions.api_key,
    group_id: req.params.group_id
  } ;

  frickr(req).groups.join(params).then(function (resp) {
    resp.body.id = req.params.photo_id;
    resp.body.group_id = req.params.group_id;
    res.end(JSON.stringify(resp.body));
  }).catch(function (err) {
    res.end(JSON.stringify(err));
  });
});


//******************************************************************************
//
// This is a bit of an anomolous function.  It allows the user to
// provide a search string.  All it does is call index.html with a parameter
// which is then picked up.
// e.g. http://localhost:6002/car
// Will search for cars
//
// Returns "stat":"ok" if it worked.
// Returned "stat":"fail" if something went wrong.
//
//******************************************************************************
app.get('/:text', function (req, res) {

  // Check if the user is logged on.  If they are not then it will
  // initiate the oauth flow.
  if (!req.cookies.groopy) {
    res.end(JSON.stringify({"stat":"fail", "code":"999","message":"Not logged on"}));
    return;
  } else {
    // Refresh the cookie expiry.
    req.cookies.groopy.maxAge = 28 * 24 * 3600000; // 4 weeks
  }

  res.redirect('/#/' + req.params.text);

});


module.exports = app;
