loadScript("https://apis.google.com/js/client:plusone.js?onload=onGapiLoaded");

var App = Ember.Application.createWithMixins({
	LOG_TRANSITIONS: true,
	initialized: false,
    ready: function () {
        console.log("App is ready.");
	    App.initialized = true;
	    if(App.onAuth)
			App.onAuth(function(auth) {
				App.auth.set('accessToken', auth.accessToken);
			    App.auth.set('user', auth.user);
			    App.auth.set('authenticated', auth.authenticated);
		    });
    },
	auth: Em.Object.create({
		accessToken: undefined,
		user: undefined,
		authenticated: false
	}),
	Group: Em.Object.extend({
	}),
	GroupJoin: Em.Object.extend({
		invite_code: ""
	}),
	User: Em.Object.extend({
	}),
	Location: Em.Object.extend({
	}),
    IndexRoute: Em.Route.extend({
        redirect: function() {
	        if(App.auth.get("authenticated"))
		        this.transitionTo('dashboard');
        }
    }),
    DashboardRoute: Em.Route.extend({
	    redirect: function() {
		    if(!App.auth.get("authenticated"))
			    this.transitionTo('index');
	    }
    }),
    GroupsRoute: Em.Route.extend({
	    setupController: function(controller, model) {
		    if (model && Em.typeOf(model.then) === 'function') {
			    model.then(function(model) {
				    controller.set('content', model);
			    });
		    } else {
			    controller.set('content', model);
		    }
	    },
	    model: function() {
		    return App.Group.findAll();
	    },
	    redirect: function() {
		    if(!App.auth.get("authenticated"))
			    this.transitionTo('index');
	    }
    }),
	GroupRoute: Em.Route.extend({
		model: function(params) {
			if(params.slug)
				return App.Group.find(params.slug);
			else
				return App.Group.find(params);
		},
		redirect: function() {
			if(!App.auth.get("authenticated"))
				this.transitionTo('index');
		}
	}),
	GroupIndexRoute: Em.Route.extend({
		needs: ['group'],
		redirect: function() {
			if(!App.auth.get("authenticated"))
				this.transitionTo('index');
			else
				this.transitionTo('group.map');
		}
	}),
	GroupMapRoute: Em.Route.extend({
		needs: ['group'],
		model: function(params) {
			params = this.modelFor("group");

			if (params && Em.typeOf(params.then) === 'function') {
				return params.then(function(params) {
					return App.Location.findAll(params._id);
				});
			} else {
				return App.Location.findAll(params);
			}
		},
		renderTemplate: function() {
			console.log("render");
			var controller = this.get('controller');

			params = this.modelFor('group');
			this.socket = io.connect('https://gdg.hp.af.cm');
			this.socket.on(params._id, function (data) {
				console.log("update");

				this.transitionToRoute('users');
			});

			// Render the `favoritePost` template into
			// the outlet `posts`, and display the `favoritePost`
			// controller.
			this.render('group/map', {
				controller: controller
			});
			this.render('map', {
				into: 'group/map',
				outlet: 'map',
				controller: controller
			});
			this.render('user_list', {
				into: 'group/map',
				outlet: 'userlist',
				controller: controller
			});
		},
		redirect: function() {
			if(!App.auth.get("authenticated"))
				this.transitionTo('index');
		}
	}),
	GroupJoinRoute: Em.Route.extend({
		model: function() {
			return App.GroupJoin.create();
		},
		redirect: function() {
			if(!App.auth.get("authenticated"))
				this.transitionTo('index');
		}
	}),
	GroupMapController: Em.ObjectController.extend({

	}),
	GroupJoinController: Em.ObjectController.extend({
		needs: ['group'],
		back: function() {
			this.transitionTo('groups');
		},
		join: function() {
			var code = this.get('content').get('invite_code');
			var slug = this.get('controllers').get('group').get('_id');
			var me = this;
			$.ajax
			({
				data: {invite_code: code},
				type: "POST",
				url: "api/v1/groups/"+slug+"/join",
				dataType: 'json',
				beforeSend: function(xhr, settings) { xhr.setRequestHeader('Authorization','Bearer ' + App.auth.get('accessToken')); },
				error: function(e) {
					alert("Wrong Invite Code.");
				}
			}).then(function (data){
					me.transitionTo('groups');
			});
		}
	}),
	GroupLeaveController: Em.Controller.extend({
		needs: ['group'],
		back: function() {
			this.transitionTo('groups');
		},
		leave: function() {
			var slug = this.get('controllers').get('group').get('_id');
			var me = this;
			$.ajax
			({
				type: "POST",
				url: "api/v1/groups/"+slug+"/leave",
				dataType: 'json',
				beforeSend: function(xhr, settings) { xhr.setRequestHeader('Authorization','Bearer ' + App.auth.get('accessToken')); },
				error: function(e) {
					alert("Wrong Invite Code.");
				}
			}).then(function (data){
				me.transitionTo('groups');
			});
		}
	}),
	GroupLeaveRoute: Em.Route.extend({

	}),
	GroupIndexView: Em.View.extend({
		socket: undefined,
		didInsertElement: function() {
		}
	}),
    ApplicationView : Em.View.extend({
	    willInsertElement: function() {
		    console.log('will');
	    },
        didInsertElement: function() {
            var me = this;
            App.applicationController = me.controller;
            navigator.geolocation.getCurrentPosition(me.controller.onPosition);

	        if(App.auth.get('authenticated')) {
	            App.userController.set("content", App.auth.get('user'));
	        }
        },
	    authWatch: function () {
		    // do something here (note that the original value of 1 for someValue is never set as the application
		    // overwrites it immediately
		    console.log("aaaaaaaaaaaaaaaauuuuuth");

		    if(App.auth.get('authenticated')) {
			    App.userController.set("content", App.auth.get('user'));
			    this.get('controller').transitionTo('dashboard');
		    }

	    }.observes('App.auth.authenticated')
    }),
	ApplicationController : Em.Controller.extend({
	}),
    MapView : Ember.View.extend({
        templateName: 'map',
	    map: undefined,
        didInsertElement: function() {
	        var mapOptions = {
		        zoom: 8,
		        center: new google.maps.LatLng(-34.397, 150.644),
		        mapTypeId: google.maps.MapTypeId.ROADMAP
	        }
	        console.log("mappedy map");
	        var mapper = new google.maps.Map(document.getElementById("mapCanvas"), mapOptions);
	        this.set('map', mapper);

	        this.locationsChanged();
        },
	    locationsChanged: function(d,m) {
		    if (!this.$()) { return; } // View not in DOM
		    var me = this;
		    if(this.get('controller.content').length > 0) {
			    var idx = 0;
			    this.get('controller.content').forEach(function(loc) {
				    if(idx == 0) {
					    var newLoc = new google.maps.LatLng(loc.get('latitude'), loc.get('longitude'));
					    me.get('map').setCenter(newLoc);
				    }
				    idx++;
				    var marker = new google.maps.Marker({
					    position: new google.maps.LatLng(loc.get('latitude'), loc.get('longitude')),
					    map: me.get('map'),
					    title:loc.get('user').given_name+" "+loc.get('user').family_name,
					    icon: 'images/icon.png',
                        animation: google.maps.Animation.DROP
				    });

                    var infowindow = new google.maps.InfoWindow({
                        content: "<img src='"+loc.get('user').picture+"' style='width: 32px; height: 32px;'/>&nbsp;<b>"+loc.get('user').given_name+" "+loc.get('user').family_name+"</b><br/>"+loc.get('address')+"<br/>"+loc.get('created_at')
                    });

                    google.maps.event.addListener(marker, 'click', function() {
                        infowindow.open(me.get('map'), marker);
                    });
			    })
		    }
	    }.observes('controller.content')
    }),
	UserListController : Ember.ObjectController.extend({
		needs: ['group'],
		setupController: function(controller, song) {
			console.log(controller);
		}
	}),
	UserListView : Ember.View.extend({
		templateName: 'user_list'
	}),
    UserView : Ember.View.extend({
        templateName: 'auth',
        didInsertElement: function() {
            Ember.set(App, "userController",this.controller);
        },
        signOut: function(event) {
            var revokeUrl = 'https://accounts.google.com/o/oauth2/revoke?token=' +
                this.controller.get('content').token;
            var me = this;
            // Perform an asynchronous GET request.
            $.ajax({
                type: 'GET',
                url: revokeUrl,
                async: false,
                contentType: "application/json",
                dataType: 'jsonp',
                success: function(nullResponse) {
                    // Do something now that user is disconnected
                    // The response is always undefined.
                    me.controller.set("content", undefined);
                    App.auth.set('authenticated', false);
                    App.auth.set('user', undefined);
                    App.auth.set('access_token', undefined);
                    location.reload();
                },
                error: function(e) {
                    // Handle the error
                    // console.log(e);
                    // You could point users to manually disconnect if unsuccessful
                    // https://plus.google.com/apps
                }
            });
        }
    }),
    ApplicationController: Ember.Controller.extend({
        authenticated: false,
        user: undefined,
        access_token: undefined,
        onPosition: function(position) {

        }
    }),
    userController : Ember.ObjectController.create({
    })
});
App.Router.map(function() {
    this.route('dashboard');
    this.resource('groups', function() {
        this.route('new');
    });
    this.resource('group', { path: '/group/:slug'}, function() {
        this.route('join', {path: '/join'});
        this.route('leave');
	    this.route('map');
    });
    this.resource('settings');
})
Ember.Handlebars.registerBoundHelper('date', function(date) {
	return moment(date).fromNow();
});
Ember.Route.reopen({
	setupController: function(controller, model) {
		if (model && Em.typeOf(model.then) === 'function') {
			model.then(function(model) {
				controller.set('content', model);
			});
		} else if(typeof model == "string") {
			model = this.model(model);
			if (model && Em.typeOf(model.then) === 'function') {
				model.then(function(model) {
					controller.set('content', model);
				});
			} else {
				controller.set('content', model);
			}
		} else {
			controller.set('content', model);
		}
	}
})
App.Group.reopenClass({
	find: function(slug) {
		return $.ajax
		({
			type: "GET",
			url: "api/v1/groups/"+slug,
			dataType: 'json',
			beforeSend: function(xhr, settings) { xhr.setRequestHeader('Authorization','Bearer ' + App.auth.get('accessToken')); }
		}).then(function (data){
			return App.Group.create(data);
		});
	},
	findAll: function() {
		var groups = Em.A();
		$.ajax
		({
			type: "GET",
			url: "api/v1/groups",
			dataType: 'json',
			beforeSend: function(xhr, settings) { xhr.setRequestHeader('Authorization','Bearer ' +  App.auth.get('accessToken')); },
			success: function(data) {
				data.forEach(function(item) {
					groups.pushObject(App.Group.create(item));
				});
			}
		});
		return groups;

		/*.then(function (data){
			data.forEach(function(item) {
				groups.pushObject(App.Group.create(item));
			});
			return groups;
		});*/
	}
})

App.Location.reopenClass({
	findAll: function(slug) {
		var locations = Em.A();
		return $.ajax
		({
			type: "GET",
			url: "api/v1/groups/"+slug+"/map/members",
			dataType: 'json',
			beforeSend: function(xhr, settings) { xhr.setRequestHeader('Authorization','Bearer ' +  App.auth.get('accessToken')); }
		}).then(function (data){
				data.forEach(function(item) {
					locations.pushObject(App.Location.create(item));
				});
				return locations;
		});
	}
})

App.deferReadiness();

function onAuth(authResult) {
	$('#curtain').fadeOut("fast");
	if (authResult['access_token']) {
		console.log("f");
		$.ajax
		({
			type: "GET",
			url: "api/v1/users/me",
			dataType: 'json',
			beforeSend: function(xhr, settings) { xhr.setRequestHeader('Authorization','Bearer ' + authResult['access_token']); },
			success: function (user){
				App.onAuth = function(cb) {
					document.getElementById('signinButton').setAttribute('style', 'display: none');
					console.log(user);
					auth = {};
					auth.authenticated = true;
					auth.user = user;
					auth.accessToken = authResult['access_token'];
					cb(auth);
					//App.userController.set("content", user);
					//App.applicationController.transitionToRoute('dashboard');
				}

				if(App.initialized) {
					console.log("ff");
					App.onAuth(function(auth) {
						App.auth.set('accessToken', auth.accessToken);
						App.auth.set('user', auth.user);
						App.auth.set('authenticated', auth.authenticated);
					});
				} else {
					App.advanceReadiness();
				}
			}
		});
	} else if (authResult['error']) {
		// There was an error.
		// Possible error codes:
		//   "access_denied" - User denied access to your app
		//   "immediate_failed" - Could not automatically log in the user
		console.log('There was an error: ' + authResult['error']);

		App.advanceReadiness();
	}
}

function onGapiLoaded() {
    loadScript("https://maps.googleapis.com/maps/api/js?key=yourkey&sensor=true&callback=onMapsLoaded");
}

function onMapsLoaded() {
	gapi.signin.render('signinButton', {
		'callback':  onAuth,
		'clientid': 'your client id',
		'cookiepolicy': 'single_host_origin',
		'requestvisibleactions': 'http://schemas.google.com/AddActivity',
		'scope': 'https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
	});
}

function loadScript(url) {
    var script = document.createElement('script');
    script.type='text/javascript';
    script.src = url;

    $("body").append(script);
}
