/**
 * Created with JetBrains WebStorm.
 * User: maui
 * Date: 10.05.13
 * Time: 11:41
 * To change this template use File | Settings | File Templates.
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

function make() {
    // Define User model
    ChatMessageSchema = new Schema({
        group: { type: String, ref: 'Group' },
        author: { type: String, ref: 'User' },
        message: String,
        created_at: Date,
        updated_at: Date
    });
    ChatMessageSchema.pre('save', function(next){
        this.updated_at = new Date;
        if ( !this.created_at ) {
            this.created_at = new Date;
        }
        next();
    });
    return mongoose.model('ChatMessage', ChatMessageSchema);
}

module.exports.make = make;
