var mongoose = require('mongoose');
var Schema = mongoose.Schema;

function make() {
    // Define User model
    var ExternalServiceScheme = new Schema({
        user: { type: String, ref: 'User' },
        service: { type: String, ref: 'ServiceDefinition' },
        access_token: String,
        refresh_token: String,
        additional: [{ key: String, value: String }],
        state: String,
        created_at: Date,
        updated_at: Date
    });
    ExternalServiceScheme.pre('save', function(next){
        this.updated_at = new Date;
        if ( !this.created_at ) {
            this.created_at = new Date;
        }
        next();
    });
    ExternalServiceScheme.index({
        'user': 1,
        'service': 1
    }, { unique: true });
    return mongoose.model('ExternalService', ExternalServiceScheme);
}

module.exports.make = make;