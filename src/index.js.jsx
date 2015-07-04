/* globals L */
var React = require("react/addons"),
    classNames = require("classnames"),
    Immutable = require("immutable"),
    queue = require("queue-async"),
    d3 = require("d3");

require('mapbox.js');
console.log(L);
var visitedCoords = Immutable.List();
var pointsOfInterest = Immutable.List();
var base = "http://Monyafeek.local:5044/",
  mapName = "What";
d3.csv("/nsa_simple.csv", function(err, csv) {
  d3.json(base + mapName + ".json", function(tilejson) {
    var southWest = L.latLng(tilejson.bounds[3], tilejson.bounds[0]),
      northEast = L.latLng(tilejson.bounds[1], tilejson.bounds[2]),
      bounds = L.latLngBounds(southWest, northEast);

    var map = L.mapbox.map(document.body, tilejson);
    map.setView([-37.8136, 144.9631], 17);
    map.setMaxBounds(bounds);
    map.on("click", clickedMap);
    csv.forEach(function(row) {
      pointsOfInterest = pointsOfInterest.push({
        coords: [+row.longitude, +row.latitude],
        name: row.name
      });
    });

    console.log(pointsOfInterest.toJSON());
  });
});

function clickedMap(event) {
  visitedCoords = visitedCoords.push(latlngToCoord(event.latlng));
  getVisitedPlaces(visitedCoords, pointsOfInterest);
  console.log(visitedCoords.toJSON());
}

function getVisitedPlaces(visited, places) {
  var visitedPlaces = Immutable.List();
  console.log("number of places", places.size)
  console.log("number of visited points", visited.size)
  var thresholdDistance = 0.3;

  for(var placeIndex = 0; placeIndex < places.size; placeIndex++) {
    for(var visitedIndex = 0; visitedIndex < visited.size; visitedIndex++) {
      var place = places.get(placeIndex);
      var visitedPoint = visited.get(visitedIndex);
      var distance = 6373 * d3.geo.distance(visitedPoint, place.coords);
      if(distance < thresholdDistance) {
        // console.log("Visited ", place);
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

  console.log("visitedPlaces", visitedPlaces);
  console.log("unvisitedPlaces", unvisitedPlaces);

  return {
    visitedPlaces: visitedPlaces,
    unvisitedPlaces: unvisitedPlaces
  };
}

function latlngToCoord(latlng) {
  return [latlng.lng, latlng.lat];
}
