var fs = require('fs');
var assert = require('assert');
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var http = require('http');
var mongoClient = require('mongodb').MongoClient;
var objectID = require('mongodb').ObjectID;
var mongoUrl = 'mongodb://localhost:27017/test';
var app = express();

app.use(express.static('../public'));
app.use(bodyParser.json());

app.get('/services/getTAFXML', function(req, res) {
    //res.send('<xml>no weather found</xml>');
    console.log("received taf request from: " + req.connection.remoteAddress);
    var icao = req.query.stations;
    console.log("wx request for ICAO: " + icao);
    
    var wxBody;
    request("http://www.aviationweather.gov/adds/dataserver_current/httpparam?datasource=tafs&requesttype=retrieve&format=xml&mostRecentForEachStation=true&hoursBeforeNow=0&stationString=" + icao, function(error, response, body){
        assert.equal(null, error);
        assert.equal(response.statusCode, 200);

        console.log("received TAF: " + body);

        wxBody = body;

        res.send(wxBody);
    });
});



app.get('/services/loadCard', function(req, res) {
    console.log("received LoadCard request from" + req.ip);
});

app.post('/services/saveCard', function(req, res) {
    console.log("received saveCard request from" + req.ip);
    console.log("request: " + JSON.stringify(req.body));

    mongoClient.connect(mongoUrl, function(err, db) {
        assert.equal(null, err);
        insertDocument(req, db, function(){
            db.close();
        });
    });

    res.send(req.body); //echo response

});

var insertDocument = function(req, db, callback){
    console.log("req: " + JSON.stringify(req.body));
    db.collection('testCollection').insertOne(
        req.body, function(err, result){
            assert.equal(err, null);
            console.log("Inserted datacard into the testCollection collection.");
            callback();
        });
};

app.listen(8000, function() {
    console.log('Server listening on port 8000');
});
