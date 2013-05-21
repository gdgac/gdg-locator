var mongoose = require('mongoose');
var Schema = mongoose.Schema;

function make() {
    // Define User model
    LocationSchema = new Schema({
        _id: String,
        user: { type: String, ref: 'User' },
        latitude: Number,
        longitude: Number,
	    address: String,
        source: String,
        created_at: Date
    });
    LocationSchema.pre('save', function(next){
        if ( !this.created_at ) {
            this.created_at = new Date;
        }
        next();
    });
    return mongoose.model('Location', LocationSchema);
}

module.exports.make = make;
