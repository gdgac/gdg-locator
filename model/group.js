var mongoose = require('mongoose');
var Schema = mongoose.Schema;

function make() {
    // Define User model
    GroupSchema = new Schema({
        _id: String,
        name: String,
        created_by: { type: String, ref: 'User' },
        members: [{ type: String, ref: 'User' }],
        invite_code: String,
        public_map: Boolean,
        created_at: Date,
        updated_at: Date
    });
    GroupSchema.pre('save', function(next){
        this.updated_at = new Date;
        if ( !this.created_at ) {
            this.created_at = new Date;
        }
        next();
    });
    return mongoose.model('Group', GroupSchema);
}

module.exports.make = make;
