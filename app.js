var express = require('express'),
    http = require('http'),
    passport = require('passport'),
    request = require('request'),
    BearerStrategy = require('passport-http-bearer').Strategy,
    moment = require('moment'),
    googleapis = require('googleapis'),
    OAuth2Client = googleapis.OAuth2Client,
    Settings = require('./settings.js'),
	geocoder = require('geocoder');

var local = false;
if(process.env.VCAP_SERVICES) {
    var services = JSON.parse(process.env.VCAP_SERVICES);
    var redisService =  services["redis-2.2"][0].credentials;
    var mongoService =  services["mongodb-1.8"][0].credentials;
} else {
    var mongoService = {
        "hostname":"localhost",
        "port":27017,
        "username":"",
        "password":"",
        "name":"",
        "db":"db"
    }
    local = true;
}

var oauth2Client =
    new OAuth2Client(Settings.gapi_client_id, Settings.gapi_client_secret, (local) ? "http://localhost:3000/api/v1/oauth/callback" : Settings.gapi_callback_url);

var generate_mongo_url = function(obj){
    obj.hostname = (obj.hostname || 'localhost');
    obj.port = (obj.port || 27017);
    obj.db = (obj.db || 'test');
    if(obj.username && obj.password){
        return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
    else{
        return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
}

var mongoose = require('mongoose');
mongoose.connect(generate_mongo_url(mongoService));

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
    console.log("Successfully opened MongoDB...");
});

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server, {
    "transports": [ 'flashsocket', 'xhr-polling' ],
    "browser client minification": true,
    "browser client etag": true,
    "flash policy port": -1
});

if(redisService) {
    var RedisStore = require('socket.io/lib/stores/redis')
        , redis  = require('socket.io/node_modules/redis')
        , pub    = redis.createClient(redisService.port, redisService.host)
        , sub    = redis.createClient(redisService.port, redisService.host)
        , client = redis.createClient(redisService.port, redisService.host);

    pub.auth(redisService.password, function (err) { if (err) throw err; });
    sub.auth(redisService.password, function (err) { if (err) throw err; });
    client.auth(redisService.password, function (err) { if (err) throw err; });

    io.set('store', new RedisStore({
        redis    : redis
        , redisPub : pub
        , redisSub : sub
        , redisClient : client
    }));
}

var ServiceDefinition = require('./model/service_definition.js').make();
global.ServiceDefinition = ServiceDefinition;

var Services = require('./service/services.js');
Services.init(app);

var User = require('./model/user.js').make();
var Group = require('./model/group.js').make();
var Place = require('./model/place.js').make();
var Location = require('./model/location.js').make();
var GcmDevice = require('./model/gcm_device.js').make();

Group.findOne({ _id: 'gdg-io13'}, function (err, group) {
    if(!err) {
        if(!group) {

            group = new Group({
                _id: 'gdg-io13',
                name: "GDG @ I/O",
                public_map: false,
                created_by: "107130354111162483072",
                invite_code: "gimmethatglass"
            }).save();
        }
    }
});

Group.findOne({ _id: 'gdg-ambassadors-io13'}, function (err, group) {
    if(!err) {
        if(!group) {

            group = new Group({
                _id: 'gdg-ambassadors-io13',
                name: "I/O Ambassadors",
                public_map: true,
                created_by: "107130354111162483072",
                invite_code: "diplomaticimmunity"
            }).save();
        }
    }
});

app.configure(function() {
    app.use(passport.initialize());
	app.use(express.bodyParser());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

function buildQuery(query, options) {
    var skip = options.skip;
    var limit = options.limit;
    var sort = options.sort;

    if(limit == undefined)
        limit = 30;

    delete options.skip;
    delete options.limit;
    delete options.sort;

    for(var key in options) {
        query.where(key);

        var value = options[key];
        if('>' == value[0]) {
            if('=' == value[1]) {
                query.gte(value.substr(2));
            } else {
                query.gt(value.substr(1));
            }
        }
        else if('<' == value[0]) {
            if('=' == value[1]) {
                query.lte(value.substr(2));
            } else {
                query.lt(value.substr(1));
            }
        } else {
            query.equals(value);
        }
    }

    if(skip) {
        query.skip(skip);
    }
    if(limit) {
        query.limit(limit);
    }
    if(sort) {
        query.sort(sort);
    }

    return query;
}

passport.use(new BearerStrategy(
    function(token, done) {
        process.nextTick(function () {
            User.findOne({ token: token }, function (err, user) {
                if (err) { return done(err); }
                user = undefined;
                if (!user) {
                    request({
                            url: 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token='+token,
                            method: 'GET',
                            json: true
                        },
                        function(error, response, tokenInfo) {
                            if(tokenInfo.error != undefined) {
                                return done(response.error);
                            } else {
                                if(tokenInfo.user_id) {
                                    User.findOne({ _id: tokenInfo.user_id }, function (err, user) {
                                        if (err) { return done(err); }
                                        user = undefined;
                                        if(user) {
                                            user.token = token;
                                            user.expires_at = Date.now() + (tokenInfo.expires_in)*1000;
                                            user.email = tokenInfo.email;
                                            user.save();
                                            return done(null, user, { scope: 'all' });
                                        } else {
                                            request({
                                                url: 'https://www.googleapis.com/oauth2/v1/userinfo?access_token='+token,
                                                method: 'GET',
                                                json: true
                                            }, function(error, response, userInfo) {
                                                if(userInfo.error) {
                                                    return done(userInfo.error.message);
                                                } else {
                                                    user = new User();
                                                    user.token = token;
                                                    user.email = userInfo.email;
                                                    user._id = userInfo.id;
                                                    user.locale = userInfo.locale;
                                                    user.given_name = userInfo.given_name;
                                                    user.family_name = userInfo.family_name;
                                                    user.gender = userInfo.gender;
                                                    user.picture = userInfo.picture;
                                                    user.scope = tokenInfo.scope;
                                                    user.expires_at = Date.now() + (tokenInfo.expires_in)*1000;
                                                    user.save();
                                                    return done(null, user, { scope: 'all' });
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        }
                    );
                } else {
                    console.log("user");
                    return done(null, user, { scope: 'all' });
                }
            });
        });
    }
));

io.sockets.on('connection', function (socket) {
	console.log("socket conn opened");
	socket.emit('update', { hello: 'world' });
	socket.on('my other event', function (data) {
		console.log(data);
	});
});

app.get('/api/v1/users/me',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';

        res.send(req.user);
    }
);

app.get('/api/v1/users/:id',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        User.findOne({ _id: req.params.id }, function (err, user) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!user) {
                    res.send(404, 'Unknown user');
                } else {

                    if(user._id != req.user._id) {
                        delete user.scope;
                        delete user.token;
                        delete user.locale;
                        delete user.expires_at;
                    }

                    res.type('json');
                    res.send(user);
                }
            }
        });
    }
);

app.get('/api/v1/users/me/services',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';
        buildQuery(ExternalService.find({user: req.user._id}), req.query).exec(function(err, items) {
            if(err) {
                res.send(400, 'Bad request');
            } else {
                var services = [];

                items.forEach(function(item) {
                    services.push(item.service);
                });

                res.type('json');
                res.send(JSON.stringify(services));
            }
        });
    }
);

app.get('/api/v1/groups/me',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';
        buildQuery(Group.find().where('members').in([req.user._id]), req.query).exec(function(err, items) {
            if(err) {
                res.send(400, 'Bad request');
            } else {
                var services = [];

                items.forEach(function(item) {
                    services.push(item.service);
                });

                res.type('json');
                res.send(JSON.stringify(services));
            }
        });
    }
);

app.get('/api/v1/groups',
	passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';
        buildQuery(Group.find({}), req.query).exec(function (err, g) {
            var groups = [];

	        for(var i = 0; i < g.length; i++) {
		        groups[i] = g[i].toObject();
		        if(groups[i].members.indexOf(req.user._id) == -1) {
			        delete groups[i].invite_code;
			        delete groups[i].members;
			        groups[i]['member'] = false;
		        } else {
			        groups[i]['member'] = true;
		        }
            }
            if(err) {
                res.send(400, 'Bad request');
            } else {
                res.type('json');
                res.send(JSON.stringify(groups));
            }
        });
    }
)

app.get('/api/v1/groups/:slug',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        Group.findOne({ _id: req.params.slug }, function (err, group) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!group) {
                    res.send(404, 'Unknown group');
                } else {
	                var g = group.toObject();
                    if(g.members.indexOf(req.user._id) == -1) {
                        delete g['invite_code'];
	                    delete g['members'];
	                    g['member'] = false;
                    } else {
	                    g['member'] = true;
                    }

                    res.type('json');
                    res.send(g);
                }
            }
        });
    }
);

app.post('/api/v1/groups/:slug/join',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';

        Group.findOne({ _id: req.params.slug }, function (err, group) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!group) {
                    res.send(404, 'Unknown group');
                } else {

	                if(group.invite_code != req.body.invite_code) {
		                res.send(400, "wrong code");
	                } else {
		                if(group.members.indexOf(req.user._id) == -1)
	                        group.members.push(req.user._id);

	                    group.save(function(err) {
	                        if(err) {
	                            res.send(400, 'Could not update group');
	                        } else {
		                        group = group.toObject();
		                        group.member = true;
	                            res.type('json');
	                            res.send(JSON.stringify(group));
	                        }
	                    });
	                }
                }
            }
        });
    }
);

app.post('/api/v1/groups/:slug/leave',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';

        Group.findOne({ _id: req.params.slug }, function (err, group) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!group) {
                    res.send(404, 'Unknown group');
                } else {
                    group.members.remove(req.user._id);
                    group.save(function(err) {
                        if(err) {
                            res.send(400, 'Could not update group');
                        } else {
                            res.type('json');
	                        group = group.toObject();
	                        group.member = false;
	                        delete group.members;
	                        delete group.invite_code;
                            res.send(JSON.stringify(group));
                        }
                    });
                }
            }
        });
    }
);

app.get('/api/v1/groups/:slug/places',
    function(req, res) {
        res.charset = 'utf-8';

        Group.findOne({ _id: req.params.slug }, function (err, group) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!group) {
                    res.send(404, 'Unknown group');
                } else {
                    buildQuery(Place.find({ group: group._id}), req.query).exec(function (err, places) {
                        places.forEach(function(place) {
                            delete place.group;
                        });
                        if(err) {
                            res.send(400, 'Bad request');
                        } else {
                            res.type('json');
                            res.send(JSON.stringify(places));
                        }
                    });
                }


            }
        });
    }
);

app.get('/api/v1/groups/:slug/map/members',
    function(req, res) {
        res.charset = 'utf-8';

        Group.findOne({ _id: req.params.slug }, function (err, group) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!group) {
                    res.send(404, 'Unknown group');
                } else {
	                console.log("got group");
                    var locations = [];
	                var index = 0;
                    group.members.forEach(function(user) {
                        Location.findOne({ user: user }).sort("-created_at").populate('user','given_name family_name _id picture').exec(function (err, location) {
                            if(err)
                                console.log("err finding location");

	                        console.log(location);
	                        if(location)
	                            locations.push(location);
	                        else
	                            console.log("no location");

	                        index++;
	                        if(index == group.members.length) {
		                        res.type('json');
		                        res.send(JSON.stringify(locations));
	                        }
                        });

                    });
                }
            }
        });
    }
);

app.get('/api/v1/groups/:slug/map/places',
    function(req, res) {
        res.charset = 'utf-8';

        Group.findOne({ _id: req.params.slug }, function (err, group) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!group) {
                    res.send(404, 'Unknown group');
                } else {
                    var locations = [];
                    group.members.forEach(function(user) {
                        Location.findOne({ _id: user},{}, { sort: { 'created_at': -1 } }).populate('user','given_name family_name _id picture').exec(function (err, location) {
                            locations.push(location);
                        });
                    });
                    res.type('json');
                    res.send(JSON.stringify(locations));
                }
            }
        });
    }
);

app.post('/api/v1/groups/:slug/place',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';

        Group.findOne({ _id: req.params.slug }, function (err, group) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!group) {
                    res.send(404, 'Unknown group');
                } else {
                    var place = new Place(req.body);
                    place.group = group._id;
                    place.added_by = req.user._id;
                    place.save(function(err) {
                        if(err) {
                            res.send(400, "Save failed");
                        } else {
                            res.type('json');
                            res.send(JSON.stringify(place));
                        }
                    })
                }
            }
        });
    }
);

app.post('/api/v1/users/me/position',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';

        User.findOne({ _id: req.user._id }, function (err, user) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!user) {
                    res.send(404, 'Unknown user...');
                } else {
                    var location = new Location(req.body);
	                geocoder.reverseGeocode( location.latitude, location.longitude, function ( err, data ) {
		                if(!err) {
			            	location.address = data.results[0].formatted_address;
		                }

		                location.user = req.user._id;

		                Group.find().where('members').in([req.user._id]).exec(function(err, groups) {
			                if(err) {
				                res.send(400, 'Bad request');
			                } else {
				                console.log("pinging group on ws");
				                groups.forEach(function(group) {
					                io.sockets.emit(group._id, {});
				                });
			                }
		                })

		                location.save(function(err) {
			                if(err) {
				                res.send(400, "Save failed");
			                } else {
				                console.log("Location update from "+ req.user._id);
				                res.type('json');
				                res.send(JSON.stringify(location));
			                }
		                })
	                },{ sensor: true });
                }
            }
        });
    }
);

app.post('/api/v1/groups',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';


    }
);

app.post('/api/v1/gcm',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';

        GcmDevice.findOne({ user: req.user._id }, function (err, device) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!device) {
                    var device = new GcmDevice();
                }

                device.registration_id = req.body.registration_id;
                device.user = req.user._id;

                device.save(function(err) {
                    if(err) {
                        res.send(400, "Save failed");
                    } else {
                        res.type('json');
                        res.send(JSON.stringify(device));
                    }
                })
            }
        });


    }
);

app.delete('/api/v1/gcm',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        res.charset = 'utf-8';

        GcmDevice.findOne({ user: req.user._id }, function (err, device) {
            if(err) {
                res.send(400, 'Bad request');
            } else {

                if(!device) {
                    res.send(404, 'Unknown device...');
                } else {
                    device.remove();
                    res.send({ message: 'ok', code: 200 });
                }
            }
        });
    }
);

app.get('/api/v1/oauth/callback', function(req, res) {
    var state = JSON.parse(req.query["state"]);
    ExternalService.findOne({_id: state.id}).exec(function(err, service) {

        if(service != null) {
            oauth2Client.getToken(req.query["code"], function(err, tokens) {
                console.log(tokens);
                service.access_token = tokens.access_token;

                if(tokens.refresh_token != undefined)
                    service.refresh_token = tokens.refresh_token;

                service.state = "completed";

                service.save(function(err) {
                    Services[service.service].onCallback(service, state.new_service);
                    res.charset = 'utf-8';
                    res.send(req.user);
                });

            });
        } else {
            console.log("unknown service");
            console.log(state);
        }
    });
});

app.get('/api/v1/services',
    function(req, res) {
        res.charset = 'utf-8';
        buildQuery(ServiceDefinition.find({}), req.query).exec(function (err, services) {
            if(err) {
                res.send(400, 'Bad request');
            } else {
                res.type('json');
                res.send(JSON.stringify(services));
            }
        });
    }
);

app.post('/api/v1/services/:name',
    passport.authenticate('bearer', { session: false }),
    function(req, res) {
        ServiceDefinition.findOne({ _id: req.params.name }).exec(function(err, service) {
            if(service != null) {
                ExternalService.findOne({ service: req.params.name, user: req.user._id }).exec(function(err, externalService) {
                    var new_service = false;
                    if(externalService == null) {
                        new_service = true;
                        externalService = new ExternalService({ user: req.user._id, service: service._id, state: "started" });
                    }

                    externalService.save(function (err, ext) {
                        var scopeStr = "";
                        service.scopes.forEach(function(scope) {
                            scopeStr += scope+" ";
                        });
                        scopeStr.trim();

                        var state = {
                            id: ext._id+"",
                            new_service: new_service
                        };

                        var url = oauth2Client.generateAuthUrl({
                            access_type: service.access_type,
                            scope: scopeStr,
                            state: JSON.stringify(state)
                        });
                        console.log(url);

                        res.charset = 'utf-8';
                        res.send({
                            auth_url: url
                        });
                    });
                });
            } else {
                console.log("unknown service: "+req.params.name);
            }
        });
    }
);


//app.post('/api/v1/location')
console.log(Settings);
console.log("Started listening at "+ (process.env.VCAP_APP_PORT || Settings.local_port));
server.listen(process.env.VCAP_APP_PORT || Settings.local_port);
