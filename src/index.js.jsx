/* globals L */
var React = require("react/addons"),
    classNames = require("classnames"),
    Immutable = require("immutable"),
    queue = require("queue-async"),
    d3 = require("d3");

// require('mapbox.js');
// var base = "http://Monyafeek.local:5044/",
//   mapName = "What";
// d3.csv("/nsa_simple.csv", function(err, csv) {
//   d3.json(base + mapName + ".json", function(tilejson) {
//     var southWest = L.latLng(tilejson.bounds[3], tilejson.bounds[0]),
//       northEast = L.latLng(tilejson.bounds[1], tilejson.bounds[2]),
//       bounds = L.latLngBounds(southWest, northEast);

//     // var map = L.mapbox.map(document.body, tilejson);
//     // map.setView([-37.8136, 144.9631], 17);
//     // map.setMaxBounds(bounds);
//     // map.on("click", clickedMap);
//     // var pointsOfInterest = Immutable.List();
//     csv.forEach(function(row) {
//       pointsOfInterest = pointsOfInterest.push({
//         coords: [+row.longitude, +row.latitude],
//         name: row.name
//       });
//     });

//     console.log(pointsOfInterest.toJSON());
//   });
// });

// function clickedMap(event) {
//   visitedCoords = visitedCoords.push(latlngToCoord(event.latlng));
//   var results = getVisitedPlaces(visitedCoords, pointsOfInterest);
//   visitedPlaces = results.visitedPlaces;
//   unvisitedPlaces = results.unvisitedPlaces;
//   console.log(visitedPlaces.size, unvisitedPlaces.size);
//   console.log(JSON.stringify(visitedCoords.toJSON()));
// }

function getVisitedPlaces(visited, places) {
  var visitedPlaces = Immutable.List();
  var thresholdDistance = 0.3;

  for(var placeIndex = 0; placeIndex < places.size; placeIndex++) {
    for(var visitedIndex = 0; visitedIndex < visited.size; visitedIndex++) {
      var place = places.get(placeIndex);
      var visitedPoint = visited.get(visitedIndex);
      var distance = 6373 * d3.geo.distance(visitedPoint, place.coords);
      if(distance < thresholdDistance) {
        visitedPlaces = visitedPlaces.push(place);
        break;
      }
    }
  }

  var unvisitedPlaces = Immutable.List();
  for(var testPlaceIndex = 0; testPlaceIndex < places.size; testPlaceIndex++) {
    var testPlace = places.get(testPlaceIndex);
    if(!visitedPlaces.includes(testPlace)) {
      unvisitedPlaces = unvisitedPlaces.push(testPlace);
    }
  }

  return {
    visitedPlaces: visitedPlaces,
    unvisitedPlaces: unvisitedPlaces
  };
}

function latlngToCoord(latlng) {
  return [latlng.lng, latlng.lat];
}

var App = React.createClass({
  states: {
    POUCH: 0,
    LOADING: 1
  },

  getInitialState: function() {
    return {
      screen: this.states.LOADING,
      visitedCoords: Immutable.List([[144.95399951934814,-37.80008640557414],[144.94099617004395,-37.80944489940969],[144.94091033935547,-37.81887000955131],[144.9574327468872,-37.82375160792541],[144.96927738189697,-37.80964833175728],[144.96871948242188,-37.82232784175096],[144.97318267822266,-37.81642908929268]]),
      pointsOfInterest: Immutable.List()
    };
  },

  componentDidMount: function() {
    d3.text("/data/files", function(err, files) {
      var q = queue(1);
      files.split("\n").filter(function(d) { return d.trim() !== ""; }).forEach(function(file) {
        q.defer(d3.csv, "/data/" + file + ".csv");
      });

      q.awaitAll(function(err, placeSetDetails) {
        var newPlaces = Immutable.List();
        placeSetDetails.forEach(function(placeSet) {
          placeSet.forEach(function(place) {
            newPlaces = newPlaces.push(this.processPlace(place));
          }.bind(this));
        }.bind(this));

        this.setState({
          pointsOfInterest: newPlaces,
          screen: this.states.POUCH
        });
      }.bind(this));
    }.bind(this));
  },

  processPlace: function(place, type) {
    return {
      coords: [+place.longitude, +place.latitude],
      name: place.name,
      description: place.description,
      datasetID: place.datasetID,
      mediaURL: place.mediaURL,
      type: type
    };
  },

  render: function() {
    switch(this.state.screen) {
      case this.states.POUCH: return (
        <Pouch visitedCoords={this.state.visitedCoords} pointsOfInterest={this.state.pointsOfInterest} />
      );
      case this.states.LOADING: return null;
      default: return null;
    }
  }
});

var Pouch = React.createClass({
  render: function() {
    var visitBundle = getVisitedPlaces(this.props.visitedCoords, this.props.pointsOfInterest);
    var places = visitBundle.visitedPlaces.map(function(place) {
      return (
        <div>{place.name}</div>
      );
    });

    console.log(visitBundle);
    return (
      <div>
        <div className="pouch-title">Your pouch</div>
        <div>{visitBundle.visitedPlaces.size} of {this.props.pointsOfInterest.size} bits of Melbourne discovered</div>
        <div className="pouch-items">{places}</div>
      </div>
    );
  }
});

React.render(<App />, document.body);
