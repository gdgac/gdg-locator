/**
 * Created with JetBrains WebStorm.
 * User: maui
 * Date: 10.05.13
 * Time: 12:04
 * To change this template use File | Settings | File Templates.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

function make() {
    // Define User model
    PlaceSchema = new Schema({
        _id: String,
        name: String,
        group: { type: String, ref: 'Group' },
        added_by: { type: String, ref: 'User' },
        valid_until: Date,
        created_at: Date,
        updated_at: Date
    });
    PlaceSchema.pre('save', function(next){
        this.updated_at = new Date;
        if ( !this.created_at ) {
            this.created_at = new Date;
        }
        next();
    });
    return mongoose.model('Place', PlaceSchema);
}

module.exports.make = make;
