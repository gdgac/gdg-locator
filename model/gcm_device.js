var mongoose = require('mongoose');
var Schema = mongoose.Schema;

function make() {
    // Define User model
    GcmDeviceSchema = new Schema({
        _id: String,
        registration_id: { type: String, ref: 'User' },
        user: { type: String, ref: 'User' },
        created_at: Date
    });
    GcmDeviceSchema.pre('save', function(next){
        if ( !this.created_at ) {
            this.created_at = new Date;
        }
        next();
    });
    return mongoose.model('GcmDevice', GcmDeviceSchema);
}

module.exports.make = make;
