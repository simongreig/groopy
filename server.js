'use strict';

console.log ("Running in NODE_ENV=" + process.env.NODE_ENV);

const express = require('express');
var cookieSession = require('cookie-session');
var Grant = require('grant-express');
var cookieParser = require('cookie-parser');
var Purest = require('purest');
var compression = require('compression');


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

//var cfmode = false ;

// A bit of a bodge but check if running in Cloud Foundry mode.
// It seems to run all the time but worth keeping in.
//process.argv.forEach(function (val, index, array) {
//  if (index == 2 && val == "cf") {
//    cfmode = true;
//  }
//});

// Map the public directory
app.use(express.static(__dirname + '/public'));


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
// This route only exists in order to quickly test the Flickr API is working
//
//******************************************************************************
app.get('/flickr_test', function (req, res) {
  // call flickr.test.login
  flickr.get('?method=flickr.test.login', {
    oauth:{token: req.cookies.groopy.access_token, secret: req.cookies.groopy.access_secret},
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
  console.log("Logged on " + req.query.raw.username + " (" + req.query.raw.user_nsid + ")");
  var cookie_content = {};
  cookie_content = req.query;
  cookie_content.user_id = req.query.raw.user_nsid ;

  var expire_time = 28 * 24 * 3600000;  // 4 weeks
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
    extras: "views, url_q"
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

  flickr.get('?method=flickr.photos.search', {
    oauth:{token: req.cookies.groopy.access_token, secret: req.cookies.groopy.access_secret},
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

  flickr.get('?method=flickr.photos.getAllContexts', {
    oauth:{token: req.cookies.groopy.access_token, secret: req.cookies.groopy.access_secret},
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

//    console.log("***ACTUAL UPDATE COMMENTED OUT FOR TEST***");

  var params = {
    api_key: flickrOptions.api_key,
    photo_id: req.params.photo_id,
    group_id: req.params.to_pool
  } ;


  flickr.get('?method=flickr.groups.pools.add', {
    oauth:{token: req.cookies.groopy.access_token, secret: req.cookies.groopy.access_secret},
    qs:params
  },function (err, inres, body)
  {
    if (err) {
      // This is only valid if there is a connection error with Flickr.
      // Should never really happen.  Abort now in case of further damage.
      console.log ("Add error:", JSON.stringify(err));
      res.end(JSON.stringify(err));
    } else {

      // This is the real response.  It is either ok or fail.
      // If the add failed (eg the photo lmit is reached) then exit now with
      // a useful error message.
      if (body.stat == "fail") {
        // The add failed so return the error string.
        res.end(JSON.stringify(body));
        return;
      }

      // Ok so still here then?  If so then the add worked and time to do the remove
      if (req.params.from_pool != "undefined") {
        var params = {
          api_key: flickrOptions.api_key,
          photo_id: req.params.photo_id,
          group_id: req.params.from_pool
        } ;

        flickr.get('?method=flickr.groups.pools.remove', {
          oauth:{token: req.cookies.groopy.access_token, secret: req.cookies.groopy.access_secret},
          qs:params
        },function (err, inres, body) {
          if (err) {
            console.log ("Remove error:", JSON.stringify(err));
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

  flickr.get('?method=flickr.groups.join', {
    oauth:{token: req.cookies.groopy.access_token, secret: req.cookies.groopy.access_secret},
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






  // start server on the specified port and binding host
  app.listen(appEnv.port, '0.0.0.0', function() {

  // print a message when the server starts listening
  console.log("Groopy server starting on " + appEnv.url);
});
