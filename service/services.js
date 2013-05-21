/**
 * Created with JetBrains WebStorm.
 * User: maui
 * Date: 16.04.13
 * Time: 23:05
 * To change this template use File | Settings | File Templates.
 */
var fs = require('fs'),
    googleapis = require('googleapis');

function Services() {

};

Services.prototype.init = function(app) {
    var me = this;
    var files = fs.readdirSync('./service/');

    global.ServiceDefinition.find().exec(function(err, services) {
        services.forEach(function(service) {
            service.remove();
        });

        console.log("Initializing external service modules...");
        files.forEach(function(file) {
            if(file != 'services.js') {
                var service = require('./'+file);
                console.log("Initializing service: "+ service.info.name);
                service.registerApi(app);
                me[service.info.name] = service;

                var serviceDefinition = ServiceDefinition({
                    _id: service.info.name,
                    scopes: service.info.scopes,
                    description: service.info.description,
                    access_type: service.info.access_type
                }).save();
            }
        });
    });
};

var services = new Services();
module.exports = services;