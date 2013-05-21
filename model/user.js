var mongoose = require('mongoose');
var Schema = mongoose.Schema;

function make() {
    // Define User model
    UserSchema = new Schema({
        _id: String,
        email: String,
        given_name: String,
        family_name: String,
        picture: String,
        gender: String,
        locale: String,
        scope: String,
        token: String,
        expires_at: Date,
        updated_at: Date,
        created_at: Date
    });
    UserSchema.pre('save', function(next){
        this.updated_at = new Date;
        if ( !this.created_at ) {
            this.created_at = new Date;
        }
        next();
    });
    return mongoose.model('User', UserSchema);
}

module.exports.make = make;
