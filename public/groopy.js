  angular.module('groopyApp', ['ngAnimate', 'ui.bootstrap']);
  angular.module('groopyApp').controller('GroopyController', function($scope, $location, $http, $q, $window){

    //
    // Find out if the host is localhost and disable Google Analytics if it is
    //
    $scope.useGoogleAnalytics = true;
    if ($location.host() == "localhost") {
      $scope.useGoogleAnalytics = false;
    }


    // Used to force a look up when the page is loaded for the first ever time
    // added because the new watch logic to minimise accidental fetches is too
    // restrictive.
    $scope.firstLoad = true;

    // The photo search screen elements.
    $scope.search = "";
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
      {id:"665334@N25", name:"25000"}
      ];

    var groupLookup = {};
    for (var i = 0; i < GROUPLIST.length; i++) {
      groupLookup[GROUPLIST[i].id] = GROUPLIST[i];
      groupLookup[GROUPLIST[i].id].index = i;
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

      // Reset everything
      $scope.nextGroup = [];
      $scope.currGroup = [];
      $scope.boxType = [];
      $scope.goodbyeLink = [];
      $scope.error_string = "";

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
          var photo = response.data.photos.photo[key] ;
          $scope.views[photo.id] = photo.views;
          $scope.displayWait[photo.id]=true;

          // Make the call to get the pools the photo is in.
          // Which looks like: http://localhost:8080/photo/id
//          console.log ("Requesting photo pool details for ID " + photo.id);
          if (!photo.id) {
            console.log ("**No photo ID**", response.data, key, photo);
          } else {

            // Set the link to the photo for the ui.
            $scope.imageLink[photo.id] = "https://www.flickr.com/photos/" + photo.owner + "/" + photo.id;

            //
            // TODO need to tidy this up.  For some reason there is a rogue object in
            // the array that causes an error.  I am simply not making the Server
            // call when there is no photo.id
            //
            var start = new Date().getTime();
            $http.get(GetBaseURL() + "/photo/"+photo.id, {timeout: $scope.httpAborter.promise}).then(function(response){

              // Check logged in
              console.log("Get:", url, response.data, 'Time: ' + (new Date().getTime() - start));
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
                    break ; // Jump out of the loop
                  }

                  // Check if it is ready to say goodbye.
                  var next_group = GROUPLIST[currentGroup.index + 1].name;
                  if (Number(views)+5 >= Number(next_group)) {
                    $scope.boxType[id] = "cheerio";
                    $scope.goodbyeLink[id] = "https://www.flickr.com/groups/views"+currentGroup.name+"/discuss";
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
          } else {
            // Show an error alert with the error string
            // Error message is in response.data.message
            // response.data.code will have the error codes, likely ones are:
            // 3 = Photo already in pool
            // 5 = Photo limit reached
            if (response.data.code == "3") {
              $scope.error_string = "Your photo is already in the pool, please make sure that the photo is only in ONE Views group.";
            } else if (response.data.code == "5") {
              $scope.error_string = "You have reached today's limit for adding photos to this group.  Try again tomorrow.";
            } else {
              $scope.error_string = response.data.message;
            }
          }



        });
      }

    }
  });
