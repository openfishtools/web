const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true }
});

module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
