var mongoose = require('mongoose');
var Schema = mongoose.Schema;

function make() {
    // Define User model
    var ServiceDefinitionScheme = new Schema({
        _id : String,
        scopes: [String],
        access_type: String,
        description: String,
        created_at: Date,
        updated_at: Date
    });
    ServiceDefinitionScheme.pre('save', function(next){
        this.updated_at = new Date;
        if ( !this.created_at ) {
            this.created_at = new Date;
        }
        next();
    });
    return mongoose.model('ServiceDefinition', ServiceDefinitionScheme);
}

module.exports.make = make;