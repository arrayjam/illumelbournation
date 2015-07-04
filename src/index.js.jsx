/* globals L */
var React = require("react/addons"),
    classNames = require("classnames"),
    Immutable = require("immutable"),
    queue = require("queue-async"),
    d3 = require("d3");

var Remarkable = require('remarkable');
var md = new Remarkable({breaks: true});

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
  var thresholdDistance = 0.2;

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

function latlngToCoord(latlng) {
  return [latlng.lng, latlng.lat];
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

var ExploreMap = React.createClass({
  render: function() {
    return (
      <div className="page map-screen">
        <img className="pouch-icon" src="/img/pouch-icon.png" onClick={this.props.onPouchScreen} />


      </div>
    );
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

React.render(<App />, document.body);
