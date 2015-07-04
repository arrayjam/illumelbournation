/* globals L */
var React = require("react/addons"),
    classNames = require("classnames"),
    Immutable = require("immutable"),
    queue = require("queue-async"),
    bearing = require("turf-bearing"),
    point = require("turf-point"),
    nearest = require("turf-nearest"),
    distance = require("turf-distance"),
    featurecollection = require("turf-featurecollection"),
    d3 = require("d3");

var thresholdDistance = 0.15;

var Remarkable = require('remarkable');
var md = new Remarkable({breaks: true});

require('mapbox.js');
L.RotatedMarker = L.Marker.extend({
  options: { angle: 0, distance: "0m" },
  _setPos: function(pos) {
    L.Marker.prototype._setPos.call(this, pos);
    var distanceNode = d3.select(this._icon).select(".current-location-marker-distance").node();
    distanceNode.innerHTML = this.options.distance;
    if (L.DomUtil.TRANSFORM) {
      // use the CSS transform rule if available
      this._icon.style[L.DomUtil.TRANSFORM] += ' rotate(' + this.options.angle + 'deg)';
      distanceNode.style[L.DomUtil.TRANSFORM] = ' rotate(' + (-this.options.angle) + 'deg)';
    } else if (L.Browser.ie) {
      // fallback for IE6, IE7, IE8
      var rad = this.options.angle * L.LatLng.DEG_TO_RAD,
      costheta = Math.cos(rad),
      sintheta = Math.sin(rad);
      this._icon.style.filter += ' progid:DXImageTransform.Microsoft.Matrix(sizingMethod=\'auto expand\', M11=' +
        costheta + ', M12=' + (-sintheta) + ', M21=' + sintheta + ', M22=' + costheta + ')';
    }
  }
});

L.rotatedMarker = function(pos, options) {
  return new L.RotatedMarker(pos, options);
};

function metersToDegrees(meters) {
  return meters / 1000 / 6373 * 57.2957795;
}

var circleWithAngle = (function() {
  var circle = d3.geo.circle();

  return function (origin, angle) {
    return circle.precision(0.5).origin(origin).angle(angle)();
  };
})();

function createNonOverlappingCircles(origin, angles) {
  var circles = [];

  circles.push(circleWithAngle(angles[0]));

  for (var i = 1; i < angles.length; i++) {
    var circleGeo = circleWithAngle(origin, angles[i]), // Generate a circle with the given angle
        holeCircleGeo = circleWithAngle(origin, angles[i - 1]); // And a circle with a previous angle

    // Holes in GeoJSON Polygons are specified in the coordinates array in the 1 to nth index in reverse winding order
    circleGeo.coordinates.push(holeCircleGeo.coordinates[0].reverse());
    circles.push(circleGeo);
  }

  return circles;
}

function getVisitedPlaces(visited, places) {
  var visitedPlaces = Immutable.List();

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

function getPouchPlaces(visited, places, filter) {
  return getVisitedPlaces(visited, places).visitedPlaces.filter(function(place) {
      return filter.get(place.type).enabled;
  });
}

var App = React.createClass({
  states: {
    POUCH: 0,
    LOADING: 1,
    FILTER: 2,
    DETAIL: 3,
    WELCOME: 4,
    MAP: 5
  },

  getInitialState: function() {
    return {
      screen: this.states.LOADING,
      visitedCoords: Immutable.List([[144.95399951934814,-37.80008640557414],[144.94099617004395,-37.80944489940969],[144.94091033935547,-37.81887000955131],[144.9574327468872,-37.82375160792541],[144.96927738189697,-37.80964833175728],[144.96871948242188,-37.82232784175096],[144.97318267822266,-37.81642908929268],[144.949622,-37.8988]]),
      pointsOfInterest: Immutable.List(),
      filter: Immutable.Map(),
      selectedPouchIndex: null
    };
  },

  componentDidMount: function() {
    d3.csv("/data/datasets.csv", function(err, files) {
      var q = queue(1);
      files.forEach(function(file) {
        q.defer(d3.csv, "/data/" + file.file_name + ".csv");
      });

      q.awaitAll(function(err, placeSetDetails) {
        var newPlaces = Immutable.List();
        var filter = Immutable.Map();
        placeSetDetails.forEach(function(placeSet, placeSetIndex) {
          var type = files[placeSetIndex];
          filter = filter.set(type.file_name, {enabled: true, name: type.category_name});
          placeSet.forEach(function(place) {
            newPlaces = newPlaces.push(this.processPlace(place, type));
          }.bind(this));
        }.bind(this));

        this.setState({
          pointsOfInterest: newPlaces,
          filter: filter,
          // TODO(yuri): Remove
          screen: this.states.MAP
          // screen: this.states.POUCH
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
      type: type.file_name,
      category: type.category_name

    };
  },

  switchToFilterScreen: function() {
    this.setState({
      screen: this.states.FILTER
    });
  },

  switchToPouchScreen: function() {
    this.setState({
      selectedPouchIndex: null,
      screen: this.states.POUCH
    });
  },

  switchToMapScreen: function() {
    this.setState({
      screen: this.states.MAP
    });
  },

  selectPouchItem: function(pouchIndex) {
    this.setState({
      selectedPouchIndex: pouchIndex,
      screen: this.states.DETAIL
    });
  },

  filterToggle: function(type) {
    var currentFilter = this.state.filter.get(type);
    currentFilter.enabled = !currentFilter.enabled;
    this.setState({
      filter: this.state.filter.set(type, currentFilter)
    });
  },

  render: function() {
    switch(this.state.screen) {
      case this.states.WELCOME: return (
        <Welcome onMapScreen={this.switchToMapScreen} />
      );
      case this.states.MAP: return (
        <ExploreMap
          pointsOfInterest={this.state.pointsOfInterest}
          onPouchScreen={this.switchToPouchScreen} />
      );
      case this.states.POUCH: return (
        <Pouch
          visitedCoords={this.state.visitedCoords}
          pointsOfInterest={this.state.pointsOfInterest}
          onFilterScreen={this.switchToFilterScreen}
          onPouchItemSelection={this.selectPouchItem}
          onMapScreen={this.switchToMapScreen}
          filter={this.state.filter} />
      );
      case this.states.FILTER: return (
        <PouchFilter
          onPouchScreen={this.switchToPouchScreen}
          onFilterUpdate={this.filterToggle}
          filter={this.state.filter} />
      );
      case this.states.DETAIL: return (
        <PouchDetail
          pouchItem={getPouchPlaces(this.state.visitedCoords, this.state.pointsOfInterest, this.state.filter).get(this.state.selectedPouchIndex)}
          onPouchScreen={this.switchToPouchScreen} />
      );
      case this.states.LOADING: return null;
      default: return null;
    }
  }
});

var Welcome = React.createClass({
  render: function() {
    return (
      <div className="page welcome">
        <img className="welcome-image" src="/img/welcome.png" />
        <div className="welcome-text">Start walking to illuminate<br />parts of Melbourne.</div>
        <div className="welcome-start" onClick={this.props.onMapScreen}>Got it!</div>
      </div>
    );
  }
});

var PouchDetail = React.createClass({
  render: function() {
    var markdownToHTML = function(markdown) {
      return {__html: md.render(markdown)};
    };

    var item = this.props.pouchItem;
    var pouchHeaderClassname = classNames("pouch-header", "pouch-detail-header", item.type);
    return (
      <div className="page pouch pouch-detail">
        <div className={pouchHeaderClassname}>
          <img src="/img/check.png" className="pouch-header-back" onClick={this.props.onPouchScreen} />
          <div className="pouch-header-content pouch-detail-header-content">
          </div>
        </div>
        <div className="pouch-detail-item">
          <div className="pouch-detail-item-type">{item.category}</div>
          <div className="pouch-detail-item-name">{item.name}</div>
          <div className="pouch-detail-item-content" dangerouslySetInnerHTML={markdownToHTML(item.description)} />
        </div>
      </div>
    );
  }
});

var PouchFilter = React.createClass({
  handleFilterUpdate: function(key) {
    this.props.onFilterUpdate(key);
  },

  render: function() {
    var filterJSX = this.props.filter.map(function(value, key) {
      var enabled = value.enabled;
      var name = value.name;
      var filterClassName = classNames("pouch-filter-item", key, {"enabled": enabled});
      return (
        <div className={filterClassName} key={key} onClick={this.handleFilterUpdate.bind(this, key)}>
          <div className="pouch-filter-item-name">{name}</div>
          {
            enabled ?
              <div className="pouch-filter-item-checkbox"><div className="glyphicon glyphicon-ok"></div></div> :
              null
          }
        </div>
      );
    }.bind(this)).toList();

    return (
      <div className="page pouch pouch-filter">
        <div className="pouch-header pouch-filter-header">
          <img src="/img/check.png" className="pouch-header-back" onClick={this.props.onPouchScreen} />
          <div className="pouch-header-content pouch-filter-header-content">
            <div className="pouch-header-title pouch-filter-header-title">Filter by interest</div>
          </div>
        </div>
        <div className="pouch-filter-items">{filterJSX}</div>
      </div>
    );
  }
});

var Pouch = React.createClass({
  handlePouchItemSelection: function(index) {
    this.props.onPouchItemSelection(index);
  },

  render: function() {
    var pouchPlaces = getPouchPlaces(this.props.visitedCoords, this.props.pointsOfInterest, this.props.filter);

    var filteredPlaces = this.props.pointsOfInterest.filter(function(place) {
      return this.props.filter.get(place.type).enabled;
    }.bind(this));

    var placesJSX = pouchPlaces.map(function(place, index) {
      var pouchClassItemClassName = classNames("pouch-item", place.type);
      return (
        <div className={pouchClassItemClassName} onClick={this.handlePouchItemSelection.bind(this, index)} key={place.name}>
          <div className="pouch-item-checkbox"><div className="glyphicon glyphicon-ok"></div></div>
          <div className="pouch-item-name">{place.name}</div>
          <div className="pouch-item-chevron glyphicon glyphicon-chevron-right" />
        </div>
      );
    }.bind(this));

    console.log(this.props.filter.toJSON());
    return (
      <div className="page pouch">
        <div className="pouch-header">
          <img className="map-icon" src="/img/close.png" onClick={this.props.onMapScreen} />
          <div className="pouch-header-content">
            <div className="pouch-header-title">Your pouch</div>
            <div className="pouch-header-count"><strong>{pouchPlaces.size}</strong> of <strong>{filteredPlaces.size}</strong> bits of Melbourne discovered</div>
          </div>
        </div>
        <div className="pouch-filter-button" onClick={this.props.onFilterScreen}><div className="glyphicon glyphicon-filter"></div></div>
        <div className="pouch-dates">
          <div className="pouch-date">TODAY</div>
          <div className="pouch-items">{placesJSX}</div>
        </div>
      </div>
    );
  }
});

var ExploreMap = React.createClass({
  shouldComponentUpdate: function() {
    return false;
  },

  componentWillReceiveProps: function(newProps) {


  },

  setCurrentPosition: function(position) {
    this._currentPosition = position;
  },

  getCurrentPosition: function() {
    return this._currentPosition;
  },

  getCurrentll: function() {
    return this.positionToll(this.getCurrentPosition());
  },

  positionToll: function(position) {
    return L.latLng(position[1], position[0]);
  },

  llToPosition: function(ll) {
    return [ll.lng, ll.lat];
  },

  componentDidMount: function() {
    this._currentPosition = null;

    var base = "http://Monyafeek.local:5044/",
      mapName = "What";

    d3.json(base + mapName + ".json", function(tilejson) {
      console.log(tilejson);

      this.setCurrentPosition([144.9667, -37.8129]);
      var currentll = this.getCurrentll();

      var map = L.mapbox.map(this.refs.map.getDOMNode(), tilejson).setView(this.getCurrentll(), 17);

      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.zoomControl.removeFrom(map);

      var currentLocationMarker = L.rotatedMarker(currentll, {
        icon: L.divIcon({
          className: "current-location-marker-container",
          html: React.renderToStaticMarkup(
            <div className="current-location-marker shadowed">
              <div className="current-location-marker-circle" />
              <span className="current-location-marker-distance">80m</span>
            </div>
          ),
          iconSize: [86, 86],
          iconAnchor: [43, 43]
        }),
        draggable: true
      });
      currentLocationMarker.addTo(map);
      // map.on("mousemove", this.trackMouse);

      this._currentLocationMarker = currentLocationMarker;
      this._map = map;
      this.addPointsOfInterest(this.props.pointsOfInterest);
      this.maskPosition(this.getCurrentPosition());
      map.on("click", this.handleMove);
      this.moveCurrentPosition(this.getCurrentPosition());
    }.bind(this));
  },

  maskPosition: function(position) {
    var smallRadius = metersToDegrees(thresholdDistance * 1000);
    var biggerRadius = metersToDegrees(100 * 1000);

    var circles = createNonOverlappingCircles(position, [smallRadius, biggerRadius]);
    var features = featurecollection(circles);

    if(this._maskLayer) {
      this._map.removeLayer(this._maskLayer);
    }

    var maskLayer = L.geoJson(features, {
      style: function() {
        return {
          fillColor: "black",
          fillOpacity: 0.8,
          clickable: false,
          stroke: false
        };
      }
    }).addTo(this._map);

    this._maskLayer = maskLayer;
  },

  handleMove: function(event) {
    this.moveCurrentPosition(this.llToPosition(event.latlng));
  },

  moveCurrentPosition: function(currentPosition) {
    this.setCurrentPosition(currentPosition);
    this._map.setView(this.getCurrentll(), 17);
    this.maskPosition(currentPosition);
    this.nearestMarkerStuff(currentPosition);
  },

  nearestMarkerStuff: function(position) {
    var currentPoint = point(position);
    var nearestPoint = nearest(currentPoint, this._pointsFeatureCollection);
    var angle = bearing(currentPoint, nearestPoint);
    var distanceToPoint = distance(currentPoint, nearestPoint) * 1000;
    this._currentLocationMarker.options.angle = angle;
    this._currentLocationMarker.options.distance = distanceToPoint.toFixed() + "m";
    this._currentLocationMarker.setLatLng(this.getCurrentll());
  },

  // trackMouse: function(event) {
  //   var mousePosition = this.llToPosition(event.latlng);
  //   var mousePoint = point(mousePosition);

  //   var currentPosition = this.getCurrentPosition();
  //   var currentPoint = point(currentPosition);

  //   var angle = bearing(currentPoint, mousePoint);
  //   this._currentLocationMarker.options.angle = angle;
  //   this._currentLocationMarker.setLatLng(this.getCurrentll());
  // },

  addPointsOfInterest: function(places) {
    console.log(places.toJSON());
    var geoJSON = featurecollection(places.map(function(place) {
      return point(place.coords, { type: place.type });
    }).toJS());

    this._pointsFeatureCollection = geoJSON;

    L.geoJson(geoJSON, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: colorMap[feature.properties.type],
          stroke: false,
          fillOpacity: 1
        });
      }
    }).addTo(this._map);
  },

  render: function() {
    return (
      <div className="page map-screen">
        <img className="pouch-icon" src="/img/pouch-icon.png" onClick={this.props.onPouchScreen} />
        <div className="map-container" ref="map"/>
      </div>
    );
  }

// function clickedMap(event) {
//   visitedCoords = visitedCoords.push(latlngToCoord(event.latlng));
//   var results = getVisitedPlaces(visitedCoords, pointsOfInterest);
//   visitedPlaces = results.visitedPlaces;
//   unvisitedPlaces = results.unvisitedPlaces;
//   console.log(visitedPlaces.size, unvisitedPlaces.size);
//   console.log(JSON.stringify(visitedCoords.toJSON()));
// }
// function latlngToCoord(latlng) {
//   return [latlng.lng, latlng.lat];
// }

});

var colorMap = {
  abc_news: "#fba953",
  community_buildings: "#52d0c2",
  education_centres: "#5adc54",
  galleries_and_museums: "#f17899",
  indigenous_heritage: "#d6d851",
  no_smoking_areas: "#e2b854",
  parks_and_gardens: "#dd8edd",
  places_of_worship: "#ec56e9",
  public_memorials_and_sculptures: "#ddbbd3",
  sports: "#aadd9b",
  theatres_and_cinemas: "#9cdac1",
  transport: "#8acde8"
};


React.render(<App />, document.getElementById("app"));
