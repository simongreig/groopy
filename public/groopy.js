  angular.module('groopyApp', ['ngAnimate', 'ui.bootstrap', 'ngCookies']);
  angular.module('groopyApp').controller('GroopyController', function($scope, $location, $timeout, $http, $q, $window, $sce, $cookies){


    // Used to force a look up when the page is loaded for the first ever time
    // added because the new watch logic to minimise accidental fetches is too
    // restrictive.
    $scope.firstLoad = true;
    $scope.showDialog = "none";

    // Query string contains a test search.
//    $locationProvider.html5Mode(true).hashPrefix('!');

    // TODO this needs to use some sort of URL router to do it properly
    // need to read into it.  For now, bodge it.
    var textparam = $location.path();
    textparam = textparam.replace('/', '');
    console.log (textparam);
    if (textparam) {
      $scope.search = textparam;
    } else {
      $scope.search = "";
    }

    // The photo search screen elements.
    $scope.page=1;
    $scope.totalPages = 1;

    // The number of pages to show on the pager at the bottom.
    $scope.maxSize=10;

    // TODO these all should be in a single object that is put into the array.
    $scope.displayWait = [];
    $scope.currGroup = [];
    $scope.nextGroup = [];
    $scope.goodbyeLink = [];
    $scope.boxType = [];
    $scope.views = [];
    $scope.imageLink = [];
    $scope.tooltip = [];

    // Number of images to display per page options.  Teh config screen really ought to be in a separate module
    $scope.perPageOptions = [
      "25",
      "50",
      "75",
      "100",
      "150",
      "200",
      "300",
      "400",
      "500"
    ];

    $scope.perPage = $cookies.get('groopy-per_page');
    if (!$scope.perPage) {
      $scope.perPage = "25";
    }



    // Maps the Flickr pool ID to the name.
    const GROUPLIST = [
      {id:"14813384@N00", name:"25"},
      {id:"63923506@N00", name:"50"},
      {id:"26651003@N00", name:"75"},
      {id:"37045109@N00", name:"100"},
      {id:"35419517@N00", name:"200"},
      {id:"76852794@N00", name:"300"},
      {id:"97866666@N00", name:"400"},
      {id:"32266655@N00", name:"500"},
      {id:"50687206@N00", name:"600"},
      {id:"65104419@N00", name:"700"},
      {id:"87608476@N00", name:"800"},
      {id:"79303709@N00", name:"900"},
      {id:"85342170@N00", name:"1000"},
      {id:"66448677@N00", name:"1250"},
      {id:"18374590@N00", name:"1500"},
      {id:"25661400@N00", name:"1750"},
      {id:"44588749@N00", name:"2000"},
      {id:"10386539@N00", name:"3000"},
      {id:"69218008@N00", name:"4000"},
      {id:"52498228@N00", name:"5000"},
      {id:"28114976@N00", name:"10000"},
      {id:"665334@N25",  name:"25000"},
      {id:"2057721@N25", name:"50000"},
      {id:"2105197@N21", name:"100000"},
      {id:"3747149@N21", name:"200000"},
      {id:"3720261@N20", name:"300000"},
      {id:"3467367@N22", name:"400000"},
      {id:"3372120@N25", name:"500000"},
      {id:"3773061@N22", name:"750000"},
      {id:"3773081@N22", name:"1000000"},
      {id:"3720761@N20", name:"2000000"},
      {id:"3773141@N22", name:"3000000"},
      {id:"3709129@N24", name:"4000000"},
      {id:"3424443@N23", name:"5000000"}
      ];

    // Used only for the group add status screen
    $scope.groupList = GROUPLIST;
    $scope.groupStatus = [];

    var groupLookup = {};
    for (var i = 0; i < GROUPLIST.length; i++) {
      groupLookup[GROUPLIST[i].id] = GROUPLIST[i];
      groupLookup[GROUPLIST[i].id].index = i;
      $scope.groupStatus[GROUPLIST[i].id] = "wait";
    }

    // Maps the Flickr API sort strings to text.
    $scope.sortItems = [
      {api:"date-posted-desc", label: "Most Recently Posted"},
      {api:"date-posted-asc", label:"Least Recently Posted"},
      {api:"date-taken-desc", label:"Most Recently Taken"},
      {api:"date-taken-asc", label:"Least Recently Taken"},
      {api:"interestingness-desc", label:"Most Interesting"},
      {api:"interestingness-asc", label:"Least Interesting"},
      {api:"relevance", label:"Relevance"}
    ];

    $scope.sort = {api:"date-posted-desc", label: "Most Recently Posted"};


    // Populate the pool list for the dropdown.
    $scope.poolItems = [{id:"all", label:"All Photos"}];

    for (i = 0; i < GROUPLIST.length; i++) {
      var item = {id:GROUPLIST[i].id, label:"Views: " + GROUPLIST[i].name};
      $scope.poolItems.push(item);
    }
    $scope.group = {id:"all", label:"All Photos"} ;

    //******************************************************************************
    //
    // Gets a param from the query string.
    //
    //******************************************************************************
    function getUrlParameter(param) {
            var sPageURL = window.location.search.substring(1),
                sURLVariables = sPageURL.split(/[&||?]/),
                res;

            for (var i = 0; i < sURLVariables.length; i += 1) {
                var paramName = sURLVariables[i],
                    sParameterName = (paramName || '').split('=');

                if (sParameterName[0] === param) {
                    res = sParameterName[1];
                }
            }

            return res;
    }

    //******************************************************************************
    //
    // Creates a query string.  Takes an object and returns a querystring
    // e.g.
    // var obj = {name:"Fred", city:"Bedrock"};
    // var query = serialise (obj);
    // console.log (query);
    //
    // Returns: name=Fred&city=Bedrock
    //
    //******************************************************************************
    serialise = function(obj) {
      var str = [];
      for(var p in obj)
        if (obj.hasOwnProperty(p)) {
          str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
      return str.join("&");
    }

    //******************************************************************************
    //
    // The main watcher for changes in the UI.
    //
    //******************************************************************************
    $scope.$watchGroup(['search', 'group', 'sort'], function(newValues, oldValues, scope) {
      // newValues array contains the current values of the watch expressions
      // with the indexes matching those of the watchExpression array
      // i.e.
      // newValues[0] -> $scope.foo
      // and
      // newValues[1] -> $scope.bar
      //      $scope.details = null;

      console.log(newValues, oldValues);

      // Only do a new fetch if the values have actually changes.  This is a bit
      // belt and braces but doesn't do any harm.
      var doFetch = false;
      if ($scope.firstLoad) {
        doFetch = true;
        $scope.firstLoad = false;
      } else {
        for (var i = 0, l=newValues.length; i < l; i++) {
          if (newValues[i] != oldValues[i]){
            doFetch = true;
//            break;
          }
        }
      }


      // Reset the page number to 1 if anything other than the page number changed.
      console.log("Fetching", newValues, oldValues);
      $scope.page = 1;
      fetch();

    });

    //******************************************************************************
    //
    // Gets the base URL from the browser of where this app is running.
    //
    //******************************************************************************
    function GetBaseURL () {
      // Get it from the browser URL.
      var url = $location.protocol()+ "://" + $location.host() + ":" + $location.port();
      return url;
    }

    //******************************************************************************
    //
    // Returns the key of an array for a specific value.
    //
    //******************************************************************************
    Object.prototype.getKeyByValue = function( value ) {
      for (i=0;i<this.length;i++) {
        if (this[i].name == value) {
          return this[i].id;
        }
      }
    }


    //******************************************************************************
    //
    // Handles the change in sort dropdown
    //
    //******************************************************************************
    $scope.changeSort = function(selected){
      $scope.sort = selected;
    }

    //******************************************************************************
    //
    // Handles the change in per page dropdown
    //
    //******************************************************************************
    $scope.changePerPage = function(selected){
      $scope.perPage = selected;

      var expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + (365*5)); // 5 years
      // Setting a cookie
      $cookies.put('groopy-per_page', selected, {'expires': expireDate});
      fetch();
    }

    //******************************************************************************
    //
    // Handles the change in pool filter dropdown
    //
    //******************************************************************************
    $scope.changePool = function(selected){
      $scope.group = selected;
    }

    //******************************************************************************
    //
    // Handles the page change event
    //
    //******************************************************************************

    $scope.pageChanged = function() {
      console.log('Page changed to: ' + $scope.page);
      fetch();
    };

    //******************************************************************************
    //
    // Does the main lookup on the server.
    //
    //******************************************************************************
    function fetch() {

      // Change the search string in the url
      if ($location.path() != "/"+$scope.search) {
        $location.path ( $scope.search ) ;
      }


      // Reset everything
      $scope.nextGroup = [];
      $scope.currGroup = [];
      $scope.boxType = [];
      $scope.goodbyeLink = [];
      $scope.error_string = "";
      $scope.tooltip = [];

      // Add the wait box
      for (box in $scope.displayWait){
        box = true;
      }

      // Clear the details
      $scope.details = null;

      // Reset the aborter so that new HTTP requests can get through.
      if ($scope.httpAborter) {
        $scope.httpAborter.resolve();
      }
      $scope.httpAborter = $q.defer();

      // Find if there is a site message to display
      var messageURL = GetBaseURL() + "/message" ;
      $http.get(messageURL, {timeout: $scope.httpAborter.promise}).then(function(response){

        var msgdiv = document.getElementById("groopy-site-message");
          if (response.data === "") {
            msgdiv.style.display = "none";
          } else {
            msgdiv.style.display = "block";
          }
        $scope.site_message = response.data;
      });


      // Build the search params
      var querystring = {
        sort: $scope.sort.api,
        page: $scope.page
      };

      if ($scope.group.id != "all") {
        querystring.group_id = $scope.group.id ;
      }

      if ($scope.search) {
        querystring.text = $scope.search;
      }

      if ($scope.perPage) {
        querystring.per_page = $scope.perPage;
      }

      // Build the url.  Looks like:
      // http://localhost:6002/photos?group_id=14813384@N00&page=2&per_page=10&sort=date-posted-asc&text=watch
      var url = GetBaseURL() + "/photos?" + serialise(querystring);


      // Which looks like:   http://localhost:8080/photos/sort/group/page/text
//      var url = GetBaseURL() + "/photos/" + $scope.sort.api + "/" + $scope.group.id + "/" + $scope.page;



/*      if ($scope.search){
        // No text so do the plain search
        // Do the text string based search
        // Which looks like:   http://localhost:8080/photos/sort/group/page/text
        url = url +  "/" + $scope.search;
      }
*/

      // Make the request to search for the photos.
      var start = new Date().getTime();
      $http.get(url, {timeout: $scope.httpAborter.promise}).then(function(response){

        console.log("Get:", url, response.data, 'Time: ' + (new Date().getTime() - start));
        if (response.data.stat == "fail" && response.data.code == "999") {
          // Need to log on the user
          $window.location.href = GetBaseURL() + "/connect/flickr";
        }

        // Set the maximum pages
        $scope.totalPages = response.data.photos.pages *10;

        // Sets up the grid with the result JSON data
        $scope.details = response.data;

        // for each photo in the result, find the group details.
        for (var key in response.data.photos.photo) {
          // Make the call to get the pools the photo is in.
          // Which looks like: http://localhost:8080/photo/id
//          console.log ("Requesting photo pool details for ID " + photo.id);
          var photo = response.data.photos.photo[key] ;
          if (!photo.id) {
            console.log ("**No photo ID**", response.data, key, photo);
          } else {

            $scope.views[photo.id] = photo.views;
            $scope.displayWait[photo.id]=true;
            $scope.tooltip[photo.id]=$sce.trustAsHtml(photo.title);


            // Set the link to the photo for the ui.
            $scope.imageLink[photo.id] = "https://www.flickr.com/photos/" + photo.owner + "/" + photo.id;

            //
            // TODO need to tidy this up.  For some reason there is a rogue object in
            // the array that causes an error.  I am simply not making the Server
            // call when there is no photo.id
            //
            var start = new Date().getTime();
            var photoURL = GetBaseURL() + "/photo/"+photo.id ;
            $http.get(photoURL, {timeout: $scope.httpAborter.promise}).then(function(response){

              // Check logged in
              console.log("Get:", photoURL, response.data, 'Time: ' + (new Date().getTime() - start));
              if (response.data.stat == "fail" && response.data.code == "999") {
                // Need to log on the user
                $window.location.href = GetBaseURL() + "/connect/flickr";
              }



              // This is where the magic happens...
              var id = response.data.id;
              var views = $scope.views[id];

              var move = false;
              var inGroup = false;
              $scope.boxType[id] = null;

              for (var pool in response.data.pool){
                var pool_id = response.data.pool[pool].id;
                var currentGroup = groupLookup[pool_id];

                if (currentGroup) {
                  // This photo is in this group.  Set the top left value.
                  $scope.currGroup[id] = currentGroup.name;
                  inGroup = true;


                  // This works in two stages:
                  // 1) Find out what group the photo *should* be in
                  // 2) Find out what group the photo is actually in
                  // If they are different then move it
                  //

                  // Find out what group the photo should be in
                  var shouldBeInGroup = null ;
                  for (i=GROUPLIST.length - 1; !shouldBeInGroup; i-- ) {
                    if (Number(views)>=Number(GROUPLIST[i].name)) {
                      shouldBeInGroup = GROUPLIST[i];
                    }
                  }

                  // Is it different to the current pool?
                  if (shouldBeInGroup.id != pool_id) {
                    move = true;
                    $scope.nextGroup[id] = shouldBeInGroup.name;
                    $scope.boxType[id] = "move";
                    var tooltip = $scope.tooltip[id] + "<div class='groopy-tooltip-detail'>Click to move to Views: " + shouldBeInGroup.name + "</div>";
                    $scope.tooltip[id]=$sce.trustAsHtml(tooltip);
                    break ; // Jump out of the loop
                  }

                  // Check if it is ready to say goodbye.
                  var next_group = GROUPLIST[currentGroup.index + 1].name;
                  if (!move && (Number(views)+5 >= Number(next_group))) {
                    $scope.boxType[id] = "cheerio";
                    $scope.goodbyeLink[id] = "https://www.flickr.com/groups/views"+currentGroup.name+"/discuss";
                    var tooltip = $scope.tooltip[id] + "<div class='groopy-tooltip-detail'>Ready to say goodbye to Views: " + currentGroup.name + "</div>";
                    $scope.tooltip[id]=$sce.trustAsHtml(tooltip);
                  }
                }
              }
              // Now need to check if the photo is in NO group but should be.
              if (!inGroup) {
                if (Number(views) >= 25) {

                  for (i=GROUPLIST.length - 1; !shouldBeInGroup; i-- ) {
                    if (Number(views) >= Number(GROUPLIST[i].name)){
                      $scope.nextGroup[id] = GROUPLIST[i].name;
                      $scope.boxType[id] = "add";
                      var tooltip = $scope.tooltip[id] + "<div class='groopy-tooltip-detail'>Click to add to Views: " + GROUPLIST[i].name + "</div>";
                      $scope.tooltip[id]=$sce.trustAsHtml(tooltip);
                      break;
                    }
                  }
                }
              }
              $scope.displayWait[id]=false;
            });
          }

        }
      });

      //******************************************************************************
      //
      // Determine whether to show the colour box or not.
      //
      //******************************************************************************
      $scope.isShowBox = function (id) {
        if ($scope.boxType[id]) {
          return true ;
        }
        return false;
      };

      //******************************************************************************
      //
      // Determine whether to show the wait box or not.
      //
      //******************************************************************************
      $scope.isShowWait = function (id) {
        return $scope.displayWait[id];
      };

      //******************************************************************************
      //
      // Checks the array of images to determine what type of box to add.
      //
      //******************************************************************************
      $scope.getBoxClass = function (id) {
        // convert to a proper class name
        if ($scope.boxType[id]=="move") {
          return "movegroup" ;
        } else if ($scope.boxType[id]=="add"){
          return "addgroup";
        } else if ($scope.boxType[id]=="cheerio"){
          return "goodbyegroup";
        }
      };

      //******************************************************************************
      //
      // Toggle the dialog with the name in the arguments
      // e.g. about, help, groupadd,
      //
      //******************************************************************************
      $scope.toggleDialog = function (dialogName) {
        if ($scope.showDialog != dialogName) {
          $scope.showDialog = dialogName;
        }
        else {
          $scope.showDialog = "none";
        }
      };


      //******************************************************************************
      //
      // Returns a little snippet of code to determine the status of the group add
      //
      //******************************************************************************
      $scope.getGroupStatus = function (id) {
        // convert to a proper class name
        if ($scope.groupStatus[id]=="wait") {
          return "Checking..." ;
        } else if ($scope.groupStatus[id]=="ok"){
          return "Added ok";
        } else if ($scope.groupStatus[id]=="fail"){
          return "Already a member";
        }
      };



      //******************************************************************************
      //
      // Add the user to all of the relevant groups.  The user is probably
      // already a member of most of them so just ignore errors.
      //
      //******************************************************************************
      $scope.addToGroups = function () {

        // Set the size of the response status window dynamically in case the list of groups changes
        // in the future.
        //
        var totalExpected = GROUPLIST.length ;
        var height = totalExpected * 20;

        // Reset
        for (var i = 0; i < GROUPLIST.length; i++) {
          $scope.groupStatus[GROUPLIST[i].id] = "wait";
        }
        $scope.showDialog = "groupadd";

        for (var index = 0; index < GROUPLIST.length; index++) {
          var group = GROUPLIST[index];

          // TODO need to hide this into a function that has the callback as an argument
          // The inputs are url and callback.  The function does the logon check, timing, logging
          // and calls the callback.
          var url = GetBaseURL() + "/group/" + group.id;
          var start = new Date().getTime();

          $http.get(url).then(function(response){

            // Check logged in
            console.log("Get:", response.data, 'Time: ' + (new Date().getTime() - start));
            if (response.data.stat == "fail" && response.data.code == "999") {
              // Need to log on the user
              $window.location.href = GetBaseURL() + "/connect/flickr";
            }

            if (response.data.group_id) {
              $scope.groupStatus [response.data.group_id] = response.data.stat;
              console.log (groupLookup[response.data.group_id].name, response.data);
            } else {
              console.log ("No group ID in response", response.data);
            }
          });
        }

      };



      //******************************************************************************
      //
      // Handles the click event on a specific box in the grid.
      //
      //******************************************************************************
      $scope.clickBox = function (id) {
        console.log("Clicked box number " + id);
        if ($scope.boxType[id] == "cheerio") {
          // Don't want to take any action
          return;
        }
        $scope.displayWait[id] = true;

        var from_pool_id = GROUPLIST.getKeyByValue($scope.currGroup[id]);
        var to_pool_id = GROUPLIST.getKeyByValue($scope.nextGroup[id]);

        var url = GetBaseURL() + "/move/"+id+"/"+from_pool_id+"/"+to_pool_id;
        var start = new Date().getTime();

        // Notice that we don't use the canceller here.  This is because we want
        // this to complete regardless.
        $http.get(url).then(function(response){

          // Check logged in
          console.log("Get:", url, response.data, 'Time: ' + (new Date().getTime() - start));
          if (response.data.stat == "fail" && response.data.code == "999") {
            // Need to log on the user
            $window.location.href = GetBaseURL() + "/connect/flickr";
          }

          $scope.displayWait[response.data.id] = false;
          if (response.data.stat == "ok") {
            // Hide the boxes to show that the action has completed
            $scope.boxType[response.data.id] = null;

            // Clear the error message
            $scope.error_string = "";
          } else {
            // Show an error alert with the error string
            // Error message is in response.data.message
            // response.data.code will have the error codes, likely ones are:
            // 2 = Not a member of the group
            // 3 = Photo already in pool
            // 5 = Photo limit reached
            if (response.data.code == "2") {
              $scope.error_string = "You are not a member of that group.  Click the groopy logo and select the option to add you to the groups.";
            } else if (response.data.code == "3") {
              $scope.error_string = "Your photo is already in the pool, please make sure that the photo is only in ONE Views group.";
            } else if (response.data.code == "5") {
              $scope.error_string = "You have reached today's limit for adding photos to this group.  Try again tomorrow.";
            } else if (response.data.code == "8") {
              $scope.error_string = "Image not allowed, check the photo's safety level.";
            } else {
              $scope.error_string = response.data.message;
            }
          }
        });
      }

    }
  });
