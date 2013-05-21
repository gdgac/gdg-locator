/**
 * Created with JetBrains WebStorm.
 * User: maui
 * Date: 16.04.13
 * Time: 23:08
 * To change this template use File | Settings | File Templates.
 */

var googleapis = require('googleapis'),
    Settings = require('../settings.js'),
    OAuth2Client = googleapis.OAuth2Client;


function Mirror() {
    var me = this;
    googleapis
        .discover('mirror', 'v1')
        .execute(function(err, client) {
            me.client = client;
            me.oauth2Client = new OAuth2Client(Settings.gapi_client_id, Settings.gapi_client_secret, Settings.gapi_callback_url);
        });
}

Mirror.prototype.registerApi = function(app) {
    console.log("Register Mirror API Callbacks");

    app.post('/api/v1/mirror/location/cb', function(req, res) {
        var update = req.body;

        console.log("knock knock loc");
        if(update && update.collection == 'locations' && update.verifyToken == 'gogo') {
            console.log("location upd");
            console.log(update);
        }
        res.send(200, 'OK');
    });

    app.post('/api/v1/mirror/timeline/cb', function(req, res) {
        var update = req.body;

        console.log("knock knock timl");
        if(update && update.collection == 'timeline' && update.verifyToken == 'gogo') {
            console.log("timeline upd");
            console.log(update);
            res.send(200, 'OK');
        }
    });
};

Mirror.prototype.onCallback = function(service, new_service) {
    console.log("Mirror API connected.");
    if(new_service) {
        this.oauth2Client.credentials = {
            access_token: service.access_token,
            refresh_token: service.refresh_token
        };

        this.client
            .newBatchRequest()
            .add(this.client.mirror.timeline.insert({ resource: { "text": "Welcome to GDG Locator!" } }))
            .add(this.client.mirror.subscriptions.insert({ resource: { "callbackUrl": Settings.base_url+"/api/v1/mirror/location/cb", collection: 'locations', userToken: service.user, verifyToken: 'gogo' } }))
            .add(this.client.mirror.subscriptions.insert({ resource: { "callbackUrl": Settings.base_url+"/api/v1/mirror/timeline/cb", collection: 'timeline', userToken: service.user, verifyToken: 'gogo' } }))
            .withAuthClient(this.oauth2Client)
            .execute(function(err, results) {
                if(!err)
                    console.log(results);
            });
    }

    return this;
};

Mirror.prototype.info = {
    name: "mirror",
    description: "Google Glass Mirror API",
    scopes: ["https://www.googleapis.com/auth/glass.timeline", "https://www.googleapis.com/auth/glass.location"],
    access_type: "offline"
};

var mirror = new Mirror();
module.exports = mirror;